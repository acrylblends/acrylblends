import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/** One entry of the plugin library: `plugins/<name>/plugin.json` in this repository. */
export interface LibraryPlugin {
  readonly name: string
  readonly description: string
  /** Library plugins this one imports; they are copied with it. */
  readonly requires: readonly string[]
  /** npm packages an app needs at run time for this plugin. */
  readonly dependencies: Readonly<Record<string, string>>
  /** npm packages an app needs only to develop or run this plugin's tooling (for example `electron` for the desktop shell). */
  readonly devDependencies?: Readonly<Record<string, string>>
  /** `package.json` scripts the plugin adds; a script the app already has is kept. */
  readonly scripts?: Readonly<Record<string, string>>
  /** Lines the app's `.gitignore` needs for this plugin (added when missing, if the app has a `.gitignore`). */
  readonly gitignore?: readonly string[]
  /** How to mount it, shown after `acrylblends add`. */
  readonly mount?: string
  /**
   * Paths inside the plugin folder that are not copied into an app (for example a React hook an app without React cannot type-check, or colocated test
   * files). A pattern is an exact path or a glob: `*` matches within one folder name, `**` across folders, `?` one character; `**` followed by a slash also matches no folder.
   */
  readonly omit?: readonly string[]
}

/** A glob as a regular expression: `*` within a name, `**` across folders, `**` plus a slash may match no folder, `?` one character. */
function globToRegExp(glob: string): RegExp {
  let source = ''
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i] as string
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        source += '(?:.*/)?'
        i += 2
      } else {
        source += '.*'
        i += 1
      }
    } else if (c === '*') source += '[^/]*'
    else if (c === '?') source += '[^/]'
    else source += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${source}$`)
}

/** Whether a path inside a plugin folder (relative, any separator) is named by one of its `omit` patterns. */
export function isOmitted(inside: string, patterns: readonly string[] | undefined): boolean {
  if (!patterns || patterns.length === 0) return false
  const path = inside.split(sep).join('/')
  return patterns.some((pattern) =>
    /[*?]/.test(pattern) ? globToRegExp(pattern).test(path) : pattern === path,
  )
}

/** Files of a library plugin that stay in the repository: its manifest and its tests. */
const LIBRARY_ONLY = new Set(['plugin.json', 'test', 'tests'])

export class LibraryError extends Error {
  override name = 'LibraryError'
}

/** The library folder (`plugins/` at the repository root): walk up from this module, in source or in the build. */
export function libraryRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (;;) {
    const candidate = join(dir, 'plugins')
    if (existsSync(join(candidate, 'instance', 'plugin.json'))) return candidate
    const parent = dirname(dir)
    if (parent === dir)
      throw new LibraryError('acrylblends cannot find its plugin library (plugins/)')
    dir = parent
  }
}

/** Every plugin in the library, by name. */
export function readLibrary(root: string = libraryRoot()): Map<string, LibraryPlugin> {
  const plugins = new Map<string, LibraryPlugin>()
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const manifest = join(root, entry.name, 'plugin.json')
    if (!entry.isDirectory() || !existsSync(manifest)) continue
    const plugin = JSON.parse(readFileSync(manifest, 'utf8')) as LibraryPlugin
    if (plugin.name !== entry.name)
      throw new LibraryError(`plugins/${entry.name}/plugin.json names "${plugin.name}"`)
    plugins.set(plugin.name, {
      ...plugin,
      requires: plugin.requires ?? [],
      dependencies: plugin.dependencies ?? {},
    })
  }
  return plugins
}

/** The plugins to copy for `names`: each one after everything it requires, no duplicates. */
export function closure(
  names: readonly string[],
  library: Map<string, LibraryPlugin>,
): LibraryPlugin[] {
  const ordered: LibraryPlugin[] = []
  const visiting = new Set<string>()
  const visit = (name: string, trail: string[]) => {
    if (ordered.some((plugin) => plugin.name === name)) return
    const plugin = library.get(name)
    if (!plugin)
      throw new LibraryError(
        `no plugin "${name}" in the library${trail.length ? ` (required by ${trail.at(-1)})` : ''}`,
      )
    if (visiting.has(name))
      throw new LibraryError(
        `plugins require each other in a cycle: ${[...trail, name].join(' -> ')}`,
      )
    visiting.add(name)
    for (const required of plugin.requires) visit(required, [...trail, name])
    visiting.delete(name)
    ordered.push(plugin)
  }
  for (const name of names) visit(name, [])
  return ordered
}

/** The one folder every plugin of an app lives in, library copies and the ones an agent writes. */
export const PLUGINS_DIR = 'plugins'
/** Where apps made before 0.7.8 kept library copies; still understood for one release. */
export const LEGACY_PLUGINS_DIR = join('src', 'plugins')
/** The list of library copies in the plugins folder; the extensions plugin installs every other folder there. */
export const LIBRARY_LIST = 'library.json'

/** The plugins folder of an app: `plugins/`, or `src/plugins/` for an app that still has the old layout (and no `plugins/`). */
export function pluginsFolder(appDir: string): { dir: string; legacy: boolean } {
  const legacy =
    existsSync(join(appDir, LEGACY_PLUGINS_DIR)) && !existsSync(join(appDir, PLUGINS_DIR))
  return { dir: join(appDir, legacy ? LEGACY_PLUGINS_DIR : PLUGINS_DIR), legacy }
}

/** The warning for an app with the old layout. */
export const LEGACY_WARNING =
  'warning: this app keeps its plugins in src/plugins/ (and extensions/); plugins now live in one folder, plugins/. Move them with "git mv src/plugins plugins", fix the paths in tsconfig.json, package.json and src/, and see docs/framework/agents/index.md. The old layout is read for this release only.'

function recordLibraryCopy(folder: string, name: string): void {
  const file = join(folder, LIBRARY_LIST)
  const names: string[] = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as { plugins: string[] }).plugins
    : []
  if (!names.includes(name)) names.push(name)
  writeFileSync(file, `${JSON.stringify({ plugins: names.sort() }, null, 2)}\n`)
}

/** Copy one library plugin's source into `<app>/plugins/<name>/`. Throws when that folder already exists. */
export function copyPlugin(
  plugin: LibraryPlugin,
  appDir: string,
  root: string = libraryRoot(),
): string {
  const folder = pluginsFolder(appDir)
  const target = join(folder.dir, plugin.name)
  if (existsSync(target))
    throw new LibraryError(
      `${relativeName(appDir, target)} already exists; remove it first to copy a fresh one`,
    )
  const source = join(root, plugin.name)
  cpSync(source, target, {
    recursive: true,
    filter: (path) => {
      const inside = path.slice(source.length + 1)
      return (
        !(dirname(path) === source && LIBRARY_ONLY.has(inside)) && !isOmitted(inside, plugin.omit)
      )
    },
  })
  if (!folder.legacy) recordLibraryCopy(folder.dir, plugin.name)
  return target
}

const relativeName = (appDir: string, path: string) =>
  path
    .slice(appDir.length + 1)
    .split(sep)
    .join('/')
