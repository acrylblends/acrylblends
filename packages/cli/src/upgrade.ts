import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { diffStat, unifiedDiff } from './diff'
import { APP_PLUGINS_FILE, appFrameRows } from './frame-rows'
import {
  frameProfileForApp,
  GENERATED_MARKER,
  type IdeProfileInput,
  type IdeProfileWritePlan,
  planIdeProfileWrite,
  writeIdeProfilePlan,
} from './ide-profile'
import { UsageError } from './init'
import type { Io } from './io'
import { appNameOf, carriesFrame, identifyTemplate, readLegacy } from './legacy'
import {
  closure,
  copyPlugin,
  LEGACY_WARNING,
  LIBRARY_LIST,
  type LibraryPlugin,
  pluginsFolder,
  readLibrary,
  recordLibraryCopy,
} from './library'
import { hashFolder, readHistory, readLock, recordLock } from './lock'
import { appendGitignore, mergeDependencies, mergeImports, mergeTooling } from './project'
import { type Template, templateDir } from './templates'
import { VERSION } from './version'

export interface UpgradeOptions {
  /** Library plugins to upgrade; none means every library plugin the app carries. */
  readonly names: readonly string[]
  readonly directory: string | undefined
  /** Show what would change and stop. */
  readonly dryRun: boolean
  /** Replace a file the app edited too (the edited version is saved first). */
  readonly force: boolean
  /** Print the diff of every changed file, not only of the edited ones. */
  readonly diff: boolean
}

/** Parse `upgrade [plugin...] [--dir <app>] [--dry-run] [--force] [--diff]`. */
export function parseUpgradeOptions(argv: readonly string[]): UpgradeOptions {
  let parsed: ReturnType<typeof parse>
  try {
    parsed = parse(argv)
  } catch (error) {
    throw new UsageError((error as Error).message)
  }
  return {
    names: parsed.positionals,
    directory: parsed.values.dir,
    dryRun: parsed.values['dry-run'] === true,
    force: parsed.values.force === true,
    diff: parsed.values.diff === true,
  }
}

const parse = (argv: readonly string[]) =>
  parseArgs({
    args: [...argv],
    allowPositionals: true,
    strict: true,
    options: {
      dir: { type: 'string' },
      'dry-run': { type: 'boolean' },
      force: { type: 'boolean' },
      diff: { type: 'boolean' },
    },
  })

type FileState = 'same' | 'add' | 'update' | 'conflict' | 'remove' | 'extra'

interface PluginPlan {
  readonly plugin: LibraryPlugin
  /** The app does not have this plugin at all (a new requirement of one that it has). */
  readonly isNew: boolean
  /** Path inside the plugin folder to what happens to it. */
  readonly files: Map<string, FileState>
  /** The hashes of the files the current library would copy. */
  readonly fresh: Record<string, string>
}

const posix = (path: string): string => path.split(sep).join('/')

function readText(path: string): string {
  return readFileSync(path, 'utf8')
}

/** The library copies an app carries: the plugins listed in `plugins/library.json`, or when there is none the folders of `plugins/` that the library knows. */
function carriedCopies(dir: string): string[] {
  const listFile = join(dir, LIBRARY_LIST)
  const listed = existsSync(listFile)
    ? ((JSON.parse(readFileSync(listFile, 'utf8')) as { plugins?: string[] }).plugins ?? [])
    : readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory())
  return listed.filter((name) => existsSync(join(dir, name)))
}

/** The plugins the frame's host layer mounts by path: any framed app carries them, and an app made before the frame gets them here. */
const HOST_PLUGINS = ['acryl-web-server', 'acryl-page'] as const

/** The profile script the DSH-profile layout used; the host launcher replaced it, so an app upgraded from that layout drops it. */
const OLD_PROFILE_SCRIPT = 'scripts/ide-profile.mjs'

/** One file the frame step writes: a template scaffold file, the frame row, or the generated composition row. */
interface FrameFileWrite {
  readonly file: string
  readonly text: string
  readonly state: 'add' | 'same' | 'update' | 'conflict'
}

/** What `upgrade` does about the frame for one app: nothing (and why), or a plan computed before anything is written. */
export type FrameStep =
  | { readonly kind: 'unidentified' }
  | { readonly kind: 'no-frame-template'; readonly template: Template }
  | { readonly kind: 'unavailable'; readonly template: Template }
  | {
      readonly kind: 'planned'
      readonly template: Template
      /** What the overlay's rows and the package.json merge are planned from. */
      readonly input: IdeProfileInput
      readonly profile: IdeProfileWritePlan
      /** The app's scaffold, its frame row and the generated composition row. */
      readonly files: readonly FrameFileWrite[]
      /** Frame plugins the app does not carry yet. */
      readonly hostPlugins: readonly string[]
      /** The DSH-profile script of the older layout, removed when it is acrylblends' own. */
      readonly removeProfileScript: boolean
      /** Paths the app edited; refused without `--force`. */
      readonly conflicts: readonly string[]
      readonly changed: boolean
    }

/** The state of one generated file that already exists: our marker makes it ours to update, anything else is the app's. */
function generatedState(existing: string | undefined, text: string): FrameFileWrite['state'] {
  if (existing === undefined) return 'add'
  if (existing === text) return 'same'
  return GENERATED_MARKER.test(existing.split('\n', 1)[0] ?? '') ? 'update' : 'conflict'
}

/**
 * Plan the frame half of an upgrade: an app made by the previous published release gets the frame-hosted layout (`scripts/ide-host.mjs`, the overlay with
 * the app's rows, `frame/app-plugins.mjs` with its entry isolate, the mount config in its composition root, the host plugins), and the template's own files
 * are replaced only where the app still has the released ones. An app whose scaffold was edited is refused by the caller unless it passes --force; an app
 * of a template without a frame row yet, or one whose scaffold is not this release's, stays standalone and is told so.
 */
export function planFrameStep(
  appDir: string,
  library: ReadonlyMap<string, LibraryPlugin>,
  templateDirFor: (template: Template) => string = templateDir,
): FrameStep {
  const name = appNameOf(appDir)
  const layout = identifyTemplate(appDir, name)
  if (layout === undefined) return { kind: 'unidentified' }
  if (!carriesFrame(layout.template, templateDirFor(layout.template)))
    return { kind: 'no-frame-template', template: layout.template }
  const specs = frameProfileForApp(appDir)
  if (specs === undefined) return { kind: 'unavailable', template: layout.template }
  const released = readLegacy(appDir, layout, name)
  const files: FrameFileWrite[] = released.files.map((file) => ({
    file: file.file,
    text: file.text,
    state: file.state,
  }))
  // The composition root as it will be once the scaffold is written: the plan may be about to replace it.
  const plannedAppTs = files.find((file) => file.file === 'src/app.ts')?.text
  const appTs =
    plannedAppTs ??
    (existsSync(join(appDir, 'src', 'app.ts'))
      ? readText(join(appDir, 'src', 'app.ts'))
      : undefined)
  const rows = appFrameRows(appDir, { ...(appTs === undefined ? {} : { appTs }), hasFrame: true })
  if (rows.appPlugins !== undefined) {
    const path = join(appDir, APP_PLUGINS_FILE)
    files.push({
      file: APP_PLUGINS_FILE,
      text: rows.appPlugins,
      state: generatedState(existsSync(path) ? readText(path) : undefined, rows.appPlugins),
    })
  }
  const hostPlugins = HOST_PLUGINS.filter(
    (plugin) => library.has(plugin) && !existsSync(join(appDir, 'plugins', plugin)),
  )
  const oldScript = join(appDir, OLD_PROFILE_SCRIPT)
  const removeProfileScript =
    existsSync(oldScript) && GENERATED_MARKER.test(readText(oldScript).split('\n', 1)[0] ?? '')
  const input: IdeProfileInput = {
    appName: name,
    dshVersion: specs.dshVersion,
    frameworkVersion: specs.frameworkVersion,
    spec: (packageName) => specs.packages[packageName],
    dependencies: specs.packages,
    rows: rows.rows,
  }
  const profile = planIdeProfileWrite(appDir, input)
  const conflicts = [
    ...files.filter((file) => file.state === 'conflict').map((file) => file.file),
    ...profile.files.filter((file) => file.state === 'conflict').map((file) => file.file),
  ]
  const changed =
    files.some((file) => file.state !== 'same') ||
    profile.manifestChanged ||
    profile.files.some((file) => file.state !== 'same') ||
    hostPlugins.length > 0 ||
    removeProfileScript
  return {
    kind: 'planned',
    template: layout.template,
    input,
    profile,
    files,
    hostPlugins,
    removeProfileScript,
    conflicts,
    changed,
  }
}

/** The `frame` line `upgrade` prints: every file it changes, or why it leaves the app alone. */
export function frameReport(frame: FrameStep): string {
  if (frame.kind === 'unidentified')
    return "not the previous release's scaffold (edited, or another version): left on the framework alone"
  if (frame.kind === 'no-frame-template')
    return `the ${frame.template} template has no src/frame.ts yet: left standalone`
  if (frame.kind === 'unavailable')
    return 'no frame packages to install: set ACRYLBLENDS_FRAME_PACKAGES while they are unpublished'
  const parts: string[] = []
  for (const file of frame.files)
    if (file.state !== 'same')
      parts.push(`${file.file} ${file.state === 'update' ? 'updated' : 'added'}`)
  for (const file of frame.profile.files)
    if (file.state !== 'same')
      parts.push(`${file.file} ${file.state === 'update' ? 'updated' : 'added'}`)
  for (const plugin of frame.hostPlugins) parts.push(`plugins/${plugin} added`)
  if (frame.removeProfileScript) parts.push(`${OLD_PROFILE_SCRIPT} removed`)
  if (frame.profile.manifestChanged)
    parts.push('package.json merged (dev runs scripts/ide-host.mjs)')
  return parts.length === 0 ? 'up to date' : parts.join(', ')
}

/**
 * `acrylblends upgrade`: bring the library plugins an app carries (the router, the server, the door, `extensions`, ...) up to the version of this package. Each file is compared with what
 * the app was given: an untouched file is replaced, a file the app edited stops the upgrade (it is shown as a diff and nothing changes) unless `--force`, which saves the edited version
 * under `.acrylblends/upgrade-backup/` first. Returns the exit code: 0 done or nothing to do, 1 refused or failed.
 */
export async function upgrade(options: UpgradeOptions, io: Io): Promise<number> {
  const appDir = resolve(io.cwd, options.directory ?? '.')
  if (!existsSync(join(appDir, 'package.json')) || !existsSync(join(appDir, 'src'))) {
    io.stderr.write(
      `error: ${appDir} is not an app (no package.json and src/); run "acrylblends init" first\n`,
    )
    return 1
  }
  const folder = pluginsFolder(appDir)
  if (folder.legacy) {
    io.stderr.write(
      `${LEGACY_WARNING}\nerror: upgrade needs the one-folder layout (plugins/); move the plugins first\n`,
    )
    return 1
  }
  const library = readLibrary()
  const carried = carriedCopies(folder.dir)
  const unknown = carried.filter((name) => !library.has(name))
  for (const name of options.names)
    if (!carried.includes(name)) {
      io.stderr.write(
        `error: the app carries no library plugin "${name}" (it carries: ${carried.filter((n) => library.has(n)).join(', ') || 'none'})\n`,
      )
      return 1
    }
  const selected = (options.names.length > 0 ? [...options.names] : carried).filter((name) =>
    library.has(name),
  )
  // The frame half of the upgrade, planned before anything is written so a refusal leaves the folder exactly as it was.
  const frame = planFrameStep(appDir, library)
  if (frame.kind === 'planned' && frame.conflicts.length > 0 && !options.force) {
    io.stderr.write(
      `error: ${frame.conflicts.join(', ')} in ${appDir} ${frame.conflicts.length === 1 ? 'is' : 'are'} not the previous release's scaffold and acrylblends did not write ${frame.conflicts.length === 1 ? 'it' : 'them'}; nothing was changed. Move the app's version aside (or merge it into the template's) and run again, or run again with --force (the app's versions are saved under .acrylblends/upgrade-backup/ first)\n`,
    )
    return 1
  }
  const frameChanged = frame.kind === 'planned' && frame.changed
  if (selected.length === 0 && !frameChanged) {
    io.stdout.write(
      frame.kind === 'planned'
        ? 'nothing to upgrade: the library plugins and the frame are up to date\n'
        : `nothing to upgrade: the app carries no library plugins\n  ${'frame'.padEnd(22)} ${frameReport(frame)}\n`,
    )
    return 0
  }

  // What the current library would copy, into a scratch folder inside the app (`.acrylblends/` is ignored by git).
  const scratch = join(appDir, '.acrylblends', `upgrade-${process.pid}-${Date.now()}`)
  const lock = readLock(folder.dir)
  const history = readHistory()
  const plans: PluginPlan[] = []
  try {
    mkdirSync(join(scratch, 'plugins'), { recursive: true })
    const wanted = closure(selected, library)
    for (const plugin of wanted) copyPlugin(plugin, scratch)
    for (const plugin of wanted) {
      const here = join(folder.dir, plugin.name)
      const fresh = hashFolder(join(scratch, 'plugins', plugin.name))
      const files = new Map<string, FileState>()
      const isNew = !existsSync(here)
      const mine = isNew ? {} : hashFolder(here)
      const recorded = lock.plugins[plugin.name]?.files ?? {}
      const pristine = (file: string, hash: string): boolean =>
        recorded[file] === hash || (history[plugin.name]?.[file]?.includes(hash) ?? false)
      for (const [file, hash] of Object.entries(fresh)) {
        const have = mine[file]
        files.set(
          file,
          have === undefined
            ? 'add'
            : have === hash
              ? 'same'
              : pristine(file, have)
                ? 'update'
                : 'conflict',
        )
      }
      for (const [file, hash] of Object.entries(mine))
        if (!(file in fresh)) files.set(file, pristine(file, hash) ? 'remove' : 'extra')
      plans.push({ plugin, isNew, files, fresh })
    }

    // The report.
    const count = (plan: PluginPlan, state: FileState): string[] =>
      [...plan.files].filter(([, s]) => s === state).map(([file]) => file)
    io.stdout.write(`upgrade: the library plugins of ${appDir} to acrylblends ${VERSION}\n`)
    let conflicts = 0
    let changes = 0
    for (const plan of plans) {
      const [updated, added, removed, edited, extra] = (
        ['update', 'add', 'remove', 'conflict', 'extra'] as const
      ).map((state) => count(plan, state))
      const label = plan.plugin.name.padEnd(22)
      conflicts += (edited as string[]).length
      if (plan.isNew) {
        changes += 1
        io.stdout.write(`  ${label} new (required by a plugin of the app)\n`)
        continue
      }
      if (
        (updated as string[]).length +
          (added as string[]).length +
          (removed as string[]).length +
          (edited as string[]).length ===
        0
      ) {
        io.stdout.write(
          `  ${label} up to date${(extra as string[]).length > 0 ? ` (keeps ${(extra as string[]).length} file(s) of its own)` : ''}\n`,
        )
        continue
      }
      changes += 1
      let plus = 0
      let minus = 0
      for (const file of [...(updated as string[]), ...(edited as string[])]) {
        const stat = diffStat(
          readText(join(folder.dir, plan.plugin.name, file)),
          readText(join(scratch, 'plugins', plan.plugin.name, file)),
        )
        plus += stat.added
        minus += stat.removed
      }
      const parts = [
        (updated as string[]).length > 0
          ? `${(updated as string[]).length} updated (+${plus} -${minus})`
          : '',
        (added as string[]).length > 0 ? `${(added as string[]).length} added` : '',
        (removed as string[]).length > 0 ? `${(removed as string[]).length} removed` : '',
        (edited as string[]).length > 0 ? `${(edited as string[]).length} EDITED HERE` : '',
        (extra as string[]).length > 0 ? `${(extra as string[]).length} of its own kept` : '',
      ].filter(Boolean)
      io.stdout.write(`  ${label} ${parts.join(', ')}\n`)
    }
    for (const name of unknown)
      io.stdout.write(`  ${name.padEnd(22)} not in this library: left alone\n`)
    io.stdout.write(`  ${'frame'.padEnd(22)} ${frameReport(frame)}\n`)

    // Diffs: always of the edited files (what would be lost), of every changed file with --diff.
    for (const plan of plans) {
      for (const [file, state] of plan.files) {
        if (
          !(
            state === 'conflict' ||
            (options.diff && (state === 'update' || state === 'add' || state === 'remove'))
          )
        )
          continue
        const name = `plugins/${plan.plugin.name}/${file}`
        const before = state === 'add' ? '' : readText(join(folder.dir, plan.plugin.name, file))
        const after =
          state === 'remove' ? '' : readText(join(scratch, 'plugins', plan.plugin.name, file))
        io.stdout.write(
          `\n${state === 'conflict' ? 'EDITED HERE, the upgrade would replace it:\n' : ''}${unifiedDiff(name, before, after)}`,
        )
      }
    }
    if (conflicts > 0 && !options.force) {
      io.stderr.write(
        `\nerror: ${conflicts} file(s) were edited in this app and the upgrade would replace them; nothing was changed. Review the diffs above, move your changes out of the plugin (a plugin of your own in plugins/<name>/), or run again with --force (the edited versions are saved under .acrylblends/upgrade-backup/)\n`,
      )
      return 1
    }
    if (options.dryRun) {
      io.stdout.write(
        `\n${changes === 0 && !frameChanged ? 'everything is up to date' : 'dry run: nothing was changed'}\n`,
      )
      return 0
    }
    if (changes === 0 && !frameChanged) {
      io.stdout.write('\neverything is up to date\n')
      return 0
    }

    // Apply.
    const backup = join(
      appDir,
      '.acrylblends',
      'upgrade-backup',
      new Date().toISOString().replace(/[:.]/gu, '-'),
    )
    const addedDependencies: string[] = []
    for (const plan of plans) {
      const here = join(folder.dir, plan.plugin.name)
      if (plan.isNew) {
        // Copied the way `add` copies it: the plugin, and what it needs in package.json.
        mkdirSync(here, { recursive: true })
        cpSync(join(scratch, 'plugins', plan.plugin.name), here, { recursive: true })
        recordLibraryCopy(folder.dir, plan.plugin.name)
      } else {
        for (const [file, state] of plan.files) {
          const target = join(here, file)
          if (state === 'conflict') {
            mkdirSync(dirname(join(backup, plan.plugin.name, file)), { recursive: true })
            cpSync(target, join(backup, plan.plugin.name, file))
          }
          if (state === 'add' || state === 'update' || state === 'conflict') {
            mkdirSync(dirname(target), { recursive: true })
            cpSync(join(scratch, 'plugins', plan.plugin.name, file), target)
          } else if (state === 'remove') rmSync(target, { force: true })
        }
        recordLibraryCopy(folder.dir, plan.plugin.name)
      }
      recordLock(folder.dir, plan.plugin.name, plan.fresh)
      const plugin = plan.plugin
      if (plugin.imports) mergeImports(appDir, plugin.imports, posix(relative(appDir, folder.dir)))
      addedDependencies.push(...mergeDependencies(appDir, plugin.dependencies))
      addedDependencies.push(...mergeTooling(appDir, plugin).devDependencies)
      appendGitignore(appDir, plugin.gitignore)
    }
    // The package the app depends on moves with its plugins.
    const manifestFile = join(appDir, 'package.json')
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as {
      dependencies?: Record<string, string>
    }
    if (
      manifest.dependencies?.acrylblends !== undefined &&
      manifest.dependencies.acrylblends !== `^${VERSION}`
    ) {
      manifest.dependencies.acrylblends = `^${VERSION}`
      writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
    }
    // The frame last: the app's scaffold, the frame row, the generated composition row, the host plugins and the launcher/overlay write as `init` writes
    // them for a fresh app. A file of the app's own (no marker, or not the released template's) was refused above unless --force, which backs it up here.
    let frameBackups = 0
    if (frame.kind === 'planned' && frameChanged) {
      for (const file of [...frame.files, ...frame.profile.files]) {
        if (file.state !== 'conflict') continue
        mkdirSync(dirname(join(backup, file.file)), { recursive: true })
        cpSync(join(appDir, file.file), join(backup, file.file))
        frameBackups += 1
      }
      for (const plugin of frame.hostPlugins) {
        const known = library.get(plugin)
        if (known === undefined) continue
        copyPlugin(known, appDir)
        if (known.imports) mergeImports(appDir, known.imports, 'plugins')
        addedDependencies.push(...mergeDependencies(appDir, known.dependencies))
        addedDependencies.push(...mergeTooling(appDir, known).devDependencies)
        appendGitignore(appDir, known.gitignore)
        recordLibraryCopy(folder.dir, plugin)
      }
      for (const file of frame.files) {
        if (file.state === 'same') continue
        const target = join(appDir, file.file)
        mkdirSync(dirname(target), { recursive: true })
        writeFileSync(target, file.text)
      }
      // Re-planned against the manifest the plugin step and the host plugins left.
      writeIdeProfilePlan(appDir, planIdeProfileWrite(appDir, frame.input))
      if (frame.removeProfileScript) rmSync(join(appDir, OLD_PROFILE_SCRIPT), { force: true })
    }
    const upgradedPlugins = plans
      .filter((p) => [...p.files.values()].some((s) => s !== 'same' && s !== 'extra') || p.isNew)
      .map((p) => p.plugin.name)
    io.stdout.write(
      `\nupgraded ${[...upgradedPlugins, ...(frameChanged ? ['the frame'] : [])].join(', ')}\n`,
    )
    if (conflicts + frameBackups > 0)
      io.stdout.write(
        `the ${conflicts + frameBackups} edited file(s) replaced by --force are saved in ${posix(relative(appDir, backup))}/\n`,
      )
    io.stdout.write(
      `acrylblends is now ^${VERSION} in package.json${addedDependencies.length > 0 ? `; new dependencies: ${[...new Set(addedDependencies)].join(', ')}` : ''}: run npm install, then npm run check and npm test\n`,
    )
    return 0
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}
