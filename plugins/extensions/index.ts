/**
 * The extensions service (`ctx.extensions`): install, update, remove and reload Cordis plugins while the app runs.
 *
 * Extracted from ACRYL (`plugins/acryl-extension-context/lib/install.js`, `stage.js`, `reconcile.js`), where an agent-written plugin
 * installs, runs, updates and is removed live in the packaged app on macOS, Windows and Linux. ACRYL goes through pnpm and the Harness
 * Loader; here an extension is a folder with an `index.ts` (or `.js`) that exports a Cordis plugin, mounted as a child fiber of this
 * plugin. The rules carried over:
 *
 * - Check before changing anything; every answer is a structured result the agent can act on (`ok`, `stage`, `errors`, `next`).
 * - Stage a content-hashed copy and import it fresh, so an update runs new code without a restart (`stage.ts`).
 * - Import the new version while the old one still runs; dispose the old one only then. If the new one fails to start, mount the old
 *   one again (`restoredPrevious`), so a broken update never leaves the app without the version that worked.
 * - Report the real fiber state: `active`, `pending` (with the services it waits for) or `failed` (with the real error).
 * - One operation at a time, in order. A ledger line for every change (`ledger.ts`).
 * - At startup, reinstall what was installed; install new folders only from sources trusted to `install`, and only list the rest
 *   (ACRYL's trust rule: code that arrived through a `git pull` must not run until someone asks for it).
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { type Context, type Fiber, Service } from '@deepseek-ai/cordis'
import type {} from '../instance/index.ts'
import type { Sandbox } from '../sandbox/index.ts'
import { appendLedger, type LedgerEntry, readLedger } from './ledger.ts'
import { resolveFromApp, routerAliases } from './resolve.ts'
import { discard, hashFolder, prune, stage } from './stage.ts'

/** A fiber's lifecycle state, by name (Cordis's own enum is a `const enum`, which does not exist at run time). */
export type ExtensionState = 'pending' | 'loading' | 'active' | 'failed' | 'disposed' | 'unloading'
const STATES: readonly ExtensionState[] = [
  'pending',
  'loading',
  'active',
  'failed',
  'disposed',
  'unloading',
]

/** Whether new folders found in a source are installed at startup, or only listed until someone installs them. */
/** `install`: installed at start; `list`: only reported; `ask`: an install waits for an explicit approve (or deny), recorded in the ledger. */
export type Trust = 'install' | 'list' | 'ask'

export interface ExtensionSource {
  readonly dir: string
  readonly trust: Trust
}

/** The library copies a plugins folder holds (`library.json`, written by `acrylblends add`): the app mounts them itself, so they are not extensions. */
function libraryCopies(dir: string): ReadonlySet<string> {
  try {
    const listed = (
      JSON.parse(readFileSync(join(dir, 'library.json'), 'utf8')) as { plugins?: unknown }
    ).plugins
    return new Set(
      Array.isArray(listed)
        ? listed.filter((name): name is string => typeof name === 'string')
        : [],
    )
  } catch {
    return new Set()
  }
}

export interface ExtensionsConfig {
  /** Where extension folders may come from. An app passes its `plugins/` folder (library copies listed in its `library.json` are skipped). Defaults to `<app home>/extensions`, trusted to install, for a service used without an app folder. */
  sources?: readonly ExtensionSource[]
  /** When true, every source that would install by itself asks for approval instead (`ask`). */
  approval?: boolean
  /**
   * Production: the extension folders of the sources that install by themselves are started straight from where they are, once, and nothing can be installed, updated or
   * removed afterwards (those calls are refused). No staging, no state file, no ledger, no approval queue are written or asked: the code that runs is the code in the folder,
   * as it is deployed. One line says what was started, and a recorded extension whose folder is missing is a warning.
   */
  readOnly?: boolean
  /** Where the read-only start says what it did (the console by default). */
  log?: (line: string) => void
}

const READ_ONLY =
  'the extensions of this app are read-only here (production): nothing can be installed, updated, removed or approved while it runs'

export interface ExtensionInfo {
  readonly name: string
  readonly source: string
  readonly version: string
  readonly state: ExtensionState
  /** Services an extension waits for, when it is pending. */
  readonly missing: readonly string[]
  /** The source folder no longer exists; the last installed version still runs. */
  readonly stale: boolean
}

export type InstallResult =
  | {
      readonly ok: true
      readonly name: string
      readonly action: 'installed' | 'updated' | 'unchanged'
      readonly state: ExtensionState
      readonly missing: readonly string[]
      readonly version: string
    }
  | {
      readonly ok: false
      /** check: before anything changed; import: loading the code; activate: starting it; verify: its own `check` failed. */
      readonly stage: 'check' | 'import' | 'activate' | 'verify' | 'approval'
      readonly name?: string
      readonly errors: readonly string[]
      /** Present for an update: whether the version that was running is running again. */
      readonly restoredPrevious?: boolean
      readonly next: string
    }

export type RemoveResult =
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly name: string; readonly errors: readonly string[] }

export interface StartupSummary {
  readonly installed: string[]
  readonly pending: string[]
  readonly stale: string[]
  readonly failed: Array<{ name: string; error: string }>
}

/** A Cordis plugin module as an extension exports it. */
interface PluginModule {
  readonly name?: unknown
  readonly inject?: unknown
  readonly apply: (...args: unknown[]) => unknown
  /** Optional self-check, run after the plugin starts with the plugin's own context (so `ctx.router` reads as in `apply`): it throws (or rejects) when the plugin does not work. */
  readonly check?: (ctx: Context) => unknown
}

interface Installed {
  readonly name: string
  readonly source: string
  readonly version: string
  /** The staged copy that is mounted. */
  readonly dir: string
  readonly module: PluginModule
  fiber: Fiber
}

interface Record_ {
  readonly source: string
  readonly version: string
  readonly dir: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    extensions: Extensions
  }

  interface Events {
    /** An extension was installed, updated, restored or removed. */
    'extensions/changed'(
      name: string,
      action:
        | 'installed'
        | 'updated'
        | 'restored'
        | 'removed'
        | 'requested'
        | 'approved'
        | 'denied',
    ): void
  }
}

export const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const CHECK_TIMEOUT_MS = 10_000
const ENTRIES = ['index.ts', 'index.js', 'index.mjs']
const KEPT =
  'The version that was running is still running. Fix the error above, then install again.'
const RESTORED =
  'The version that was running is running again. Fix the error above, then install again.'
const NOTHING = 'Nothing was installed. Fix the error above, then install again.'
const WAITING =
  'Nothing was installed. The owner must approve this version (approve) or refuse it (deny); then it installs.'

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))
const inside = (path: string, folder: string) => {
  const rel = relative(resolve(folder), resolve(path))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

function injected(module: PluginModule): string[] {
  const inject = module.inject
  if (Array.isArray(inject))
    return inject.filter((name): name is string => typeof name === 'string')
  if (inject && typeof inject === 'object') {
    const required = (inject as { required?: unknown }).required
    if (Array.isArray(required))
      return required.filter((name): name is string => typeof name === 'string')
    return Object.keys(inject)
  }
  return []
}

/** The service. One instance serves one app home. */
/** The slice of the state service this plugin uses, by name, so it imports nothing from acryl-state. */
interface StateService {
  cell<T>(key: string, initial: T): { set(value: T): void }
}

export class Extensions extends Service {
  readonly sources: readonly ExtensionSource[]
  readonly stageRoot: string
  readonly stateFile: string
  readonly ledgerFile: string
  /** Settles when the startup pass is done. */
  readonly ready: Promise<StartupSummary>
  private readonly installed = new Map<string, Installed>()
  private readonly stale = new Set<string>()
  /** The version approved for each name in an `ask` source, and installs still waiting for a decision. */
  private readonly approved = new Map<string, string>()
  private readonly requests = new Map<string, { dir: string; version: string }>()
  private tail: Promise<unknown> = Promise.resolve()
  private disposed = false
  private readonly readOnly: boolean
  private readonly say: (line: string) => void
  /**
   * The context the service was constructed with. Inside a service method `this.ctx` is Cordis's shadow context, which resolves services as the
   * service's own fiber, so a plugin mounted from it would read `ctx.router` from the installer's fiber and fail. Extensions mount from this one.
   */
  private readonly owner: Context

  constructor(ctx: Context, config: ExtensionsConfig = {}) {
    super(ctx, 'extensions')
    this.owner = ctx
    this.readOnly = config.readOnly === true
    this.say = config.log ?? ((line) => console.log(line))
    const { home, root } = ctx.appInstance
    this.sources = (config.sources ?? [{ dir: join(home, 'extensions'), trust: 'install' }]).map(
      (source) => ({
        dir: resolve(source.dir),
        trust: config.approval === true && source.trust === 'install' ? 'ask' : source.trust,
      }),
    )
    this.stageRoot = join(home, 'extensions-staged')
    this.stateFile = join(home, 'extensions.json')
    this.ledgerFile = join(home, 'extensions-ledger.jsonl')
    // Effects run their disposers newest first: settle pending operations, then dispose every mounted extension, then drop the hook.
    // Staged copies live in the app's home, outside the app: their bare imports are resolved from the app. A read-only start imports the folders where they are (inside the app).
    if (!this.readOnly)
      ctx.effect(
        () => resolveFromApp(this.stageRoot, root, routerAliases()),
        'extensions: resolve staged imports from the app',
      )
    ctx.effect(
      () => async () => {
        for (const entry of [...this.installed.values()].reverse())
          await entry.fiber.dispose().catch(() => undefined)
        this.installed.clear()
      },
      'extensions: dispose mounted extensions',
    )
    ctx.effect(
      () => async () => {
        this.disposed = true
        await this.tail.catch(() => undefined)
      },
      'extensions: settle pending operations',
    )
    // With the state service mounted, what is installed is also a cell: any surface reads it as JSON or streams its changes (`/api/state/extensions`).
    ctx.inject(['state'], (inner) => {
      const state = (inner as unknown as { state: StateService }).state
      const cell = state.cell('extensions', this.list())
      inner.on('extensions/changed', () => cell.set(this.list()))
    })
    this.ready = this.serial(() => this.startup())
  }

  /** Install a folder, or update the installed extension of the same name. The folder must be inside one of the sources. */
  install(source: string): Promise<InstallResult> {
    if (this.readOnly) return Promise.reject(new Error(READ_ONLY))
    return this.serial(() => this.installNow(source))
  }

  /** Remove an installed extension: dispose it, forget it, delete its staged copies. Its source folder is left alone. */
  remove(name: string): Promise<RemoveResult> {
    if (this.readOnly) return Promise.reject(new Error(READ_ONLY))
    return this.serial(() => this.removeNow(name))
  }

  /** Bring every installed extension in line with its source, and install new folders from sources trusted to install. */
  reload(): Promise<InstallResult[]> {
    if (this.readOnly) return Promise.reject(new Error(READ_ONLY))
    return this.serial(async () => {
      const results: InstallResult[] = []
      for (const entry of [...this.installed.values()]) {
        if (!existsSync(entry.source)) {
          this.stale.add(entry.name)
          continue
        }
        if (hashFolder(entry.source) !== entry.version)
          results.push(await this.installNow(entry.source))
      }
      for (const found of this.discover()) {
        if (found.trust === 'install' && !this.installed.has(found.name))
          results.push(await this.installNow(found.dir))
      }
      return results
    })
  }

  /** What is installed, with each extension's live state. */
  list(): ExtensionInfo[] {
    return [...this.installed.values()]
      .map((entry) => {
        const state = STATES[entry.fiber.state] ?? 'failed'
        return {
          name: entry.name,
          source: entry.source,
          version: entry.version,
          state,
          missing: state === 'pending' ? this.missing(entry.module) : [],
          stale: this.stale.has(entry.name),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  /** Installs waiting for an owner's decision. */
  approvals(): Array<{ name: string; version: string; dir: string }> {
    return [...this.requests.entries()].map(([name, request]) => ({ name, ...request }))
  }

  /** Approve the version that is waiting, then install it. Refused when the source changed since it was requested. */
  approve(name: string): Promise<InstallResult> {
    if (this.readOnly) return Promise.reject(new Error(READ_ONLY))
    return this.serial(async (): Promise<InstallResult> => {
      const request = this.requests.get(name)
      if (!request) {
        return {
          ok: false,
          stage: 'approval',
          name,
          errors: [`nothing is waiting for approval for "${name}"`],
          next: NOTHING,
        }
      }
      this.requests.delete(name)
      if (!existsSync(request.dir) || hashFolder(request.dir) !== request.version) {
        return {
          ok: false,
          stage: 'approval',
          name,
          errors: [
            'the source changed after it was requested; the new version needs its own request',
          ],
          next: NOTHING,
        }
      }
      this.approved.set(name, request.version)
      this.record({ kind: 'approved', name, version: request.version })
      this.ctx.emit('extensions/changed', name, 'approved')
      return this.installNow(request.dir)
    })
  }

  /** Refuse the version that is waiting. Nothing changes except the ledger. */
  deny(name: string): Promise<RemoveResult> {
    if (this.readOnly) return Promise.reject(new Error(READ_ONLY))
    return this.serial(async (): Promise<RemoveResult> => {
      const request = this.requests.get(name)
      if (!request)
        return { ok: false, name, errors: [`nothing is waiting for approval for "${name}"`] }
      this.requests.delete(name)
      this.record({ kind: 'denied', name, version: request.version })
      this.ctx.emit('extensions/changed', name, 'denied')
      return { ok: true, name }
    })
  }

  private trustOf(dir: string): Trust {
    return this.sources.find((source) => inside(dir, source.dir))?.trust ?? 'list'
  }

  /** Extension folders in the sources that are not installed. */
  pending(): Array<{ name: string; dir: string; trust: Trust }> {
    return this.discover().filter((found) => !this.installed.has(found.name))
  }

  /** Every change so far, oldest first. */
  ledger(): LedgerEntry[] {
    return readLedger(this.ledgerFile)
  }

  private serial<T>(run: () => Promise<T>): Promise<T> {
    const guarded = () => {
      if (this.disposed) return Promise.reject(new Error('extensions: the service is disposed'))
      return run()
    }
    const result = this.tail.then(guarded, guarded)
    this.tail = result.catch(() => undefined)
    return result
  }

  private discover(): Array<{ name: string; dir: string; trust: Trust }> {
    const found: Array<{ name: string; dir: string; trust: Trust }> = []
    for (const source of this.sources) {
      if (!existsSync(source.dir)) continue
      const library = libraryCopies(source.dir)
      for (const entry of readdirSync(source.dir, { withFileTypes: true })) {
        const dir = join(source.dir, entry.name)
        if (
          entry.isDirectory() &&
          NAME.test(entry.name) &&
          !library.has(entry.name) &&
          ENTRIES.some((file) => existsSync(join(dir, file)))
        ) {
          if (!found.some((other) => other.name === entry.name))
            found.push({ name: entry.name, dir, trust: source.trust })
        }
      }
    }
    return found
  }

  /** The checks that need no code to run. */
  private check(source: string): { name: string; dir: string; errors: string[] } {
    const dir = resolve(source)
    const name = basename(dir)
    const errors: string[] = []
    if (!isAbsolute(source)) errors.push(`the path must be absolute, got "${source}"`)
    if (!this.sources.some((allowed) => inside(dir, allowed.dir))) {
      errors.push(
        `"${dir}" is not inside an extension source (${this.sources.map((allowed) => allowed.dir).join(', ')})`,
      )
    }
    if (!NAME.test(name))
      errors.push(
        `the folder name "${name}" must be lowercase letters, digits and dashes; it is the extension's name`,
      )
    if (!existsSync(dir) || !statSync(dir).isDirectory()) errors.push(`"${dir}" is not a folder`)
    else if (!ENTRIES.some((file) => existsSync(join(dir, file))))
      errors.push(`"${dir}" has no ${ENTRIES.join(', ')}`)
    return { name, dir, errors }
  }

  /**
   * A tool folder (`tool.json` next to an `index.ts` that exports `run(input)`) is code we do not trust, so it is never imported
   * here. It becomes a generated plugin that registers a tool whose every call runs in the sandbox, and whose examples run in the
   * sandbox as the install's self-check. `tool.json`: `{ "description": "...", "examples": [{ "input": ..., "output": ... }] }`.
   */
  private toolModule(dir: string, name: string): PluginModule | undefined {
    const file = join(dir, 'tool.json')
    if (!existsSync(file)) return undefined
    let spec: { description?: unknown; examples?: unknown; timeoutMs?: unknown }
    try {
      spec = JSON.parse(readFileSync(file, 'utf8'))
    } catch (error) {
      throw new Error(`tool.json is not valid JSON: ${message(error)}`)
    }
    if (typeof spec.description !== 'string' || spec.description.trim() === '')
      throw new Error('tool.json needs a "description"')
    const examples = spec.examples
    if (
      !Array.isArray(examples) ||
      examples.length === 0 ||
      !examples.every(
        (example) =>
          example && typeof example === 'object' && 'input' in example && 'output' in example,
      )
    ) {
      throw new Error(
        'tool.json needs "examples": a non-empty list of { "input": ..., "output": ... }; they are run in the sandbox when the tool is installed',
      )
    }
    const timeoutMs =
      typeof spec.timeoutMs === 'number' ? Math.min(Math.max(spec.timeoutMs, 100), 30_000) : 5000
    const entry = ENTRIES.map((candidate) => join(dir, candidate)).find((path) =>
      existsSync(path),
    ) as string
    const description = spec.description
    const run = (ctx: Context, input: unknown) =>
      // `get`, not `ctx.sandbox`: the self-check runs from the service's own context, which does not declare the dependency.
      ((ctx.get as (service: string) => unknown)('sandbox') as Sandbox)
        .run(entry, input, { timeoutMs })
        .then((result) => {
          if (!result.ok) throw new Error(`${result.kind}: ${result.error}`)
          return result.output
        })
    return {
      name,
      inject: ['tools', 'sandbox'],
      apply: ((ctx: Context) => {
        const tools = (ctx.get as (service: string) => unknown)('tools') as {
          register(
            tool: string,
            definition: { description: string; run(input: unknown): unknown },
          ): () => void
        }
        ctx.effect(() => tools.register(name, { description, run: (input) => run(ctx, input) }))
      }) as PluginModule['apply'],
      check: async (ctx: Context) => {
        for (const [index, example] of (
          examples as Array<{ input: unknown; output: unknown }>
        ).entries()) {
          const actual = await run(ctx, example.input)
          if (!isDeepStrictEqual(actual, example.output)) {
            throw new Error(
              `example ${index + 1} expected ${JSON.stringify(example.output)} but the tool returned ${JSON.stringify(actual)}`,
            )
          }
        }
      },
    }
  }

  private async load(dir: string, name: string): Promise<PluginModule> {
    const tool = this.toolModule(dir, name)
    if (tool) return tool
    const entry = ENTRIES.map((file) => join(dir, file)).find((path) => existsSync(path)) as string
    const module = (await import(pathToFileURL(entry).href)) as Partial<PluginModule> & {
      default?: Partial<PluginModule>
    }
    const plugin = typeof module.apply === 'function' ? module : module.default
    if (!plugin || typeof plugin.apply !== 'function') {
      throw new Error(
        `${basename(entry)} must export a Cordis plugin: "export const name = '${name}'" and "export function apply(ctx) { ... }"`,
      )
    }
    if (plugin.name !== undefined && plugin.name !== name) {
      throw new Error(
        `the plugin is named "${String(plugin.name)}" but its folder is "${name}"; they must match`,
      )
    }
    return { ...plugin, name } as PluginModule
  }

  private missing(module: PluginModule): string[] {
    return injected(module).filter((service) => this.ctx.get(service) === undefined)
  }

  /** Run the extension's own `check`, if it has one, with a time limit. Returns the failure, or `undefined` when it passes. */
  private async verify(
    module: PluginModule,
    ctx: Context,
  ): Promise<{ stage: 'verify'; error: string } | undefined> {
    if (typeof module.check !== 'function') return undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const limit = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`its check did not finish within ${CHECK_TIMEOUT_MS} ms`)),
          CHECK_TIMEOUT_MS,
        )
      })
      await Promise.race([Promise.resolve(module.check(ctx)), limit])
      return undefined
    } catch (error) {
      return { stage: 'verify', error: `its check failed: ${message(error)}` }
    } finally {
      clearTimeout(timer)
    }
  }

  /** Mount a module as a child fiber and wait until it settles. */
  private async mount(module: PluginModule): Promise<{ fiber: Fiber; error?: unknown }> {
    // An extension is a plugin module whose config, if any, comes from its own defaults.
    const fiber = this.owner.plugin(module as unknown as Parameters<Context['plugin']>[0])
    try {
      await fiber.await()
      return { fiber }
    } catch (error) {
      return { fiber, error }
    }
  }

  private record(entry: Omit<LedgerEntry, 'at'>): void {
    appendLedger(this.ledgerFile, entry)
  }

  private saveState(): void {
    const records: Record<string, Record_> = {}
    for (const entry of this.installed.values())
      records[entry.name] = { source: entry.source, version: entry.version, dir: entry.dir }
    mkdirSync(join(this.stateFile, '..'), { recursive: true })
    const temporary = `${this.stateFile}.${String(process.pid)}.tmp`
    writeFileSync(temporary, `${JSON.stringify(records, null, 2)}\n`)
    renameSync(temporary, this.stateFile)
  }

  private async installNow(source: string): Promise<InstallResult> {
    const { name, dir, errors } = this.check(source)
    if (errors.length > 0) return { ok: false, stage: 'check', name, errors, next: NOTHING }
    const previous = this.installed.get(name)
    const version = hashFolder(dir)
    const running =
      previous && previous.version === version && STATES[previous.fiber.state] !== 'failed'
    // A source that asks: this exact version must have been approved. Anything else waits, and the ledger says so.
    if (!running && this.trustOf(dir) === 'ask' && this.approved.get(name) !== version) {
      if (this.requests.get(name)?.version !== version) {
        this.requests.set(name, { dir, version })
        this.record({ kind: 'requested', name, version })
        this.ctx.emit('extensions/changed', name, 'requested')
      }
      return {
        ok: false,
        stage: 'approval',
        name,
        errors: [`version ${version} is waiting for approval`],
        next: WAITING,
      }
    }
    if (previous && previous.version === version && STATES[previous.fiber.state] !== 'failed') {
      const state = STATES[previous.fiber.state] ?? 'failed'
      return {
        ok: true,
        name,
        action: 'unchanged',
        state,
        missing: state === 'pending' ? this.missing(previous.module) : [],
        version,
      }
    }

    // Import the new version while the old one keeps running: a syntax error or a missing export changes nothing.
    const staged = stage(dir, this.stageRoot, name)
    let module: PluginModule
    try {
      module = await this.load(staged.dir, name)
    } catch (error) {
      discard(staged.dir)
      this.record({ kind: 'refused', name, version: staged.version, error: message(error) })
      return {
        ok: false,
        stage: 'import',
        name,
        errors: [message(error)],
        ...(previous ? { restoredPrevious: true } : {}),
        next: previous ? KEPT : NOTHING,
      }
    }

    if (previous) await previous.fiber.dispose()
    const mounted = await this.mount(module)
    const state = STATES[mounted.fiber.state] ?? 'failed'
    // Commit before "done": a plugin that started still has to pass its own check before the install counts.
    const failure =
      mounted.error !== undefined || state === 'failed'
        ? {
            stage: 'activate' as const,
            error: message(mounted.error ?? 'the plugin failed to start'),
          }
        : state === 'active'
          ? await this.verify(module, mounted.fiber.ctx)
          : undefined
    if (failure) {
      await mounted.fiber.dispose().catch(() => undefined)
      discard(staged.dir)
      const error = failure.error
      this.record({ kind: 'refused', name, version: staged.version, error })
      let restored = false
      if (previous) {
        const again = await this.mount(previous.module)
        restored = again.error === undefined && STATES[again.fiber.state] !== 'failed'
        previous.fiber = again.fiber
        if (restored) {
          this.record({ kind: 'restored', name, version: previous.version })
          this.ctx.emit('extensions/changed', name, 'restored')
        } else {
          this.installed.delete(name)
          this.saveState()
        }
      }
      return {
        ok: false,
        stage: failure.stage,
        name,
        errors: [error],
        ...(previous ? { restoredPrevious: restored } : {}),
        next: restored ? RESTORED : NOTHING,
      }
    }

    const action = previous ? 'updated' : 'installed'
    this.installed.set(name, {
      name,
      source: dir,
      version: staged.version,
      dir: staged.dir,
      module,
      fiber: mounted.fiber,
    })
    this.stale.delete(name)
    this.saveState()
    prune(this.stageRoot, name, [staged.dir])
    this.record({ kind: action, name, version: staged.version })
    this.ctx.emit('extensions/changed', name, action)
    return {
      ok: true,
      name,
      action,
      state,
      missing: state === 'pending' ? this.missing(module) : [],
      version: staged.version,
    }
  }

  private async removeNow(name: string): Promise<RemoveResult> {
    const entry = this.installed.get(name)
    if (!entry) return { ok: false, name, errors: [`"${name}" is not installed`] }
    await entry.fiber.dispose()
    this.installed.delete(name)
    this.stale.delete(name)
    this.saveState()
    prune(this.stageRoot, name, [])
    this.record({ kind: 'removed', name, version: entry.version })
    this.ctx.emit('extensions/changed', name, 'removed')
    return { ok: true, name }
  }

  /** Never throws: one extension's failure is recorded and the others still start. */
  /**
   * The production start: every folder of a source that installs by itself is loaded from where it is and mounted; the line says which. An extension that the app's own record
   * (`extensions.json`, written by dev) names while its folder is gone is named in a warning, because it is not started.
   */
  private async startupReadOnly(): Promise<StartupSummary> {
    const summary: StartupSummary = { installed: [], pending: [], stale: [], failed: [] }
    const found = this.discover()
    for (const folder of found) {
      if (folder.trust !== 'install') {
        summary.pending.push(folder.name)
        continue
      }
      try {
        const module = await this.load(folder.dir, folder.name)
        const mounted = await this.mount(module)
        this.installed.set(folder.name, {
          name: folder.name,
          source: folder.dir,
          version: hashFolder(folder.dir),
          dir: folder.dir,
          module,
          fiber: mounted.fiber,
        })
        if (mounted.error !== undefined)
          summary.failed.push({ name: folder.name, error: message(mounted.error) })
        else summary.installed.push(folder.name)
      } catch (error) {
        summary.failed.push({ name: folder.name, error: message(error) })
      }
    }
    this.say(
      summary.installed.length === 0
        ? `extensions: none found in ${this.sources.map((source) => basename(source.dir)).join(', ')}/`
        : `extensions (read-only): ${summary.installed.join(', ')}`,
    )
    for (const failure of summary.failed)
      this.say(`WARNING: extension "${failure.name}" did not start: ${failure.error}`)
    try {
      if (existsSync(this.stateFile)) {
        for (const recorded of Object.keys(
          JSON.parse(readFileSync(this.stateFile, 'utf8')) as Record<string, unknown>,
        )) {
          if (!found.some((folder) => folder.name === recorded))
            this.say(
              `WARNING: ${basename(this.stateFile)} records the extension "${recorded}", but ${this.sources.map((source) => basename(source.dir)).join(', ')}/ has no folder for it: it is not started in production. Commit its folder, or run the app in development and install it again`,
            )
        }
      }
    } catch {
      // A record that cannot be read says nothing about what to start.
    }
    return summary
  }

  private async startup(): Promise<StartupSummary> {
    if (this.readOnly) return this.startupReadOnly()
    const summary: StartupSummary = { installed: [], pending: [], stale: [], failed: [] }
    let records: Record<string, Record_> = {}
    try {
      if (existsSync(this.stateFile))
        records = JSON.parse(readFileSync(this.stateFile, 'utf8')) as Record<string, Record_>
    } catch (error) {
      summary.failed.push({ name: 'extensions.json', error: message(error) })
    }
    for (const [name, record] of Object.entries(records)) {
      try {
        // What was installed before was approved then: an unchanged source starts again without asking.
        this.approved.set(name, record.version)
        if (existsSync(record.source)) {
          const result = await this.installNow(record.source)
          if (result.ok) summary.installed.push(name)
          else summary.failed.push({ name, error: result.errors.join('; ') })
          continue
        }
        // The source is gone: the last installed version still runs, and is reported as stale.
        summary.stale.push(name)
        this.stale.add(name)
        if (!existsSync(record.dir)) {
          summary.failed.push({ name, error: 'neither the source nor the staged copy exists' })
          continue
        }
        const module = await this.load(record.dir, name)
        const mounted = await this.mount(module)
        if (mounted.error !== undefined)
          summary.failed.push({ name, error: message(mounted.error) })
        this.installed.set(name, {
          name,
          source: record.source,
          version: record.version,
          dir: record.dir,
          module,
          fiber: mounted.fiber,
        })
      } catch (error) {
        summary.failed.push({ name, error: message(error) })
      }
    }
    for (const found of this.discover()) {
      if (this.installed.has(found.name)) continue
      if (found.trust !== 'install') {
        summary.pending.push(found.name)
        continue
      }
      try {
        const result = await this.installNow(found.dir)
        if (result.ok) summary.installed.push(found.name)
        else summary.failed.push({ name: found.name, error: result.errors.join('; ') })
      } catch (error) {
        summary.failed.push({ name: found.name, error: message(error) })
      }
    }
    if (Object.keys(records).length > 0 || summary.installed.length > 0) this.saveState()
    return summary
  }
}

/** The plugin: mount it after `instance`. Installed extensions mount as its children and leave with it. */
export const extensions = {
  name: 'extensions',
  inject: ['appInstance'],
  async apply(ctx: Context, config: ExtensionsConfig) {
    const service = new Extensions(ctx, config ?? {})
    await service.ready
  },
}
