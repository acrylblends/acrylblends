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
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { diffStat, unifiedDiff } from './diff'
import {
  frameProfileForApp,
  type IdeProfileInput,
  type IdeProfileWritePlan,
  planIdeProfileWrite,
  writeIdeProfilePlan,
} from './ide-profile'
import { UsageError } from './init'
import type { Io } from './io'
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

/** The overlay row that mounts an app's own routes inside the frame: the file `init` writes for a template that has one. */
const FRAME_ROW = { id: 'app-routes', name: './src/frame.ts' } as const

/** What `upgrade` does about the frame for one app: nothing (no row file, or no specs to install), or a write plan. */
type FrameStep =
  | { readonly kind: 'missing-row' }
  | { readonly kind: 'unavailable' }
  | {
      readonly kind: 'planned'
      readonly plan: IdeProfileWritePlan
      readonly input: IdeProfileInput
      /** Files that exist and acrylblends did not write: a refusal, unless `--force` backs them up. */
      readonly conflicts: readonly string[]
      readonly changed: boolean
    }

/**
 * Plan the frame half of an upgrade (IDE port, slice 6): an app whose template carries `src/frame.ts` gets the profile, the overlay, the runtime row and the
 * `dev`/`profile` scripts, exactly as `init` writes them for a fresh app; an app made before the frame has no row file and stays standalone, said plainly.
 * The specs are the environment's (a pre-frame app has no pins) or the app's own `package.json` (a framed app regenerates from what it installed).
 */
function planFrameStep(appDir: string): FrameStep {
  if (!existsSync(join(appDir, 'src', 'frame.ts'))) return { kind: 'missing-row' }
  const specs = frameProfileForApp(appDir)
  if (specs === undefined) return { kind: 'unavailable' }
  let name = basename(appDir)
  try {
    const manifest = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8')) as {
      name?: unknown
    }
    if (typeof manifest.name === 'string' && manifest.name !== '') name = manifest.name
  } catch {
    // The app's manifest was read by `upgrade` already; a name it cannot give falls back to the folder's.
  }
  const input: IdeProfileInput = {
    appName: name,
    dshVersion: specs.dshVersion,
    frameworkVersion: specs.frameworkVersion,
    spec: (packageName) => specs.packages[packageName],
    dependencies: specs.packages,
    rows: [FRAME_ROW],
  }
  const plan = planIdeProfileWrite(appDir, input)
  const conflicts = plan.files.filter((file) => file.state === 'conflict').map((file) => file.file)
  const changed = plan.manifestChanged || plan.files.some((file) => file.state !== 'same')
  return { kind: 'planned', plan, input, conflicts, changed }
}

/** The library copies an app carries: the plugins listed in `plugins/library.json`, or when there is none the folders of `plugins/` that the library knows. */
function carriedCopies(dir: string): string[] {
  const listFile = join(dir, LIBRARY_LIST)
  const listed = existsSync(listFile)
    ? ((JSON.parse(readFileSync(listFile, 'utf8')) as { plugins?: string[] }).plugins ?? [])
    : readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory())
  return listed.filter((name) => existsSync(join(dir, name)))
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
  const frame = planFrameStep(appDir)
  if (frame.kind === 'planned' && frame.conflicts.length > 0 && !options.force) {
    io.stderr.write(
      `error: ${frame.conflicts.join(', ')} in ${appDir} exist and acrylblends did not write them; nothing was changed. Move them aside (or merge them into the app's own overlay) and run again, or run again with --force (they are saved under .acrylblends/upgrade-backup/ first)\n`,
    )
    return 1
  }
  const frameChanged = frame.kind === 'planned' && frame.changed
  if (selected.length === 0 && !frameChanged) {
    io.stdout.write(
      frame.kind === 'planned'
        ? 'nothing to upgrade: the library plugins and the frame are up to date\n'
        : 'nothing to upgrade: the app carries no library plugins\n',
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
    if (frame.kind === 'missing-row')
      io.stdout.write(
        `  ${'frame'.padEnd(22)} no src/frame.ts: this app predates the frame and keeps running standalone\n`,
      )
    else if (frame.kind === 'unavailable')
      io.stdout.write(
        `  ${'frame'.padEnd(22)} no frame packages to install: set ACRYLBLENDS_FRAME_PACKAGES while they are unpublished\n`,
      )
    else {
      const touched = frame.plan.files.filter((file) => file.state !== 'same')
      const parts = [
        touched.length > 0
          ? touched
              .map((file) => `${file.file} ${file.state === 'add' ? 'added' : 'updated'}`)
              .join(', ')
          : 'up to date',
        frame.plan.manifestChanged ? 'package.json merged' : '',
      ].filter(Boolean)
      io.stdout.write(`  ${'frame'.padEnd(22)} ${parts.join(', ')}\n`)
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
    // The frame last, and re-planned against the manifest the plugin step left: the app row, the overlay, the runtime row and the profile script land as
    // `init` writes them for a fresh app, and a file of the app's own (no marker line) was refused above unless --force, which backs it up here.
    if (frame.kind === 'planned') {
      if (frameChanged) {
        for (const file of frame.conflicts) {
          mkdirSync(dirname(join(backup, file)), { recursive: true })
          cpSync(join(appDir, file), join(backup, file))
        }
        writeIdeProfilePlan(appDir, planIdeProfileWrite(appDir, frame.input))
      }
      if (frame.conflicts.length > 0)
        io.stdout.write(
          `the frame file(s) replaced by --force are saved in ${posix(relative(appDir, backup))}/\n`,
        )
    }
    io.stdout.write(
      `\nupgraded ${plans
        .filter((p) => [...p.files.values()].some((s) => s !== 'same' && s !== 'extra') || p.isNew)
        .map((p) => p.plugin.name)
        .join(', ')}\n`,
    )
    if (conflicts > 0)
      io.stdout.write(
        `the ${conflicts} edited file(s) replaced by --force are saved in ${posix(relative(appDir, backup))}/\n`,
      )
    io.stdout.write(
      `acrylblends is now ^${VERSION} in package.json${addedDependencies.length > 0 ? `; new dependencies: ${[...new Set(addedDependencies)].join(', ')}` : ''}: run npm install, then npm run check and npm test\n`,
    )
    return 0
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}
