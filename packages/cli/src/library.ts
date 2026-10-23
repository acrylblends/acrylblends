import { cpSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** One entry of the plugin library: `plugins/<name>/plugin.json` in this repository. */
export interface LibraryPlugin {
  readonly name: string
  readonly description: string
  /** Library plugins this one imports; they are copied with it. */
  readonly requires: readonly string[]
  /** npm packages an app needs at run time for this plugin. */
  readonly dependencies: Readonly<Record<string, string>>
  /** How to mount it, shown after `acrylblends add`. */
  readonly mount?: string
  /** Paths inside the plugin folder that are not copied into an app (for example a React hook an app without React cannot type-check). */
  readonly omit?: readonly string[]
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

/** Copy one library plugin's source into `<app>/src/plugins/<name>/`. Throws when that folder already exists. */
export function copyPlugin(
  plugin: LibraryPlugin,
  appDir: string,
  root: string = libraryRoot(),
): string {
  const target = join(appDir, 'src', 'plugins', plugin.name)
  if (existsSync(target))
    throw new LibraryError(
      `src/plugins/${plugin.name} already exists; remove it first to copy a fresh one`,
    )
  const source = join(root, plugin.name)
  cpSync(source, target, {
    recursive: true,
    filter: (path) => {
      const inside = path.slice(source.length + 1)
      return (
        !(dirname(path) === source && LIBRARY_ONLY.has(inside)) && !plugin.omit?.includes(inside)
      )
    },
  })
  return target
}
