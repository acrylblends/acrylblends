import { cpSync, existsSync, readFileSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { UsageError } from './init'
import type { Io } from './io'
import { closure, copyPlugin, type LibraryPlugin, readLibrary } from './library'
import { mergeDependencies } from './project'

export interface AddOptions {
  readonly names: readonly string[]
  readonly directory: string | undefined
}

/** Parse `add <plugin...> [--dir <app>]`. */
export function parseAddOptions(argv: readonly string[]): AddOptions {
  let parsed: ReturnType<typeof parse>
  try {
    parsed = parse(argv)
  } catch (error) {
    throw new UsageError((error as Error).message)
  }
  if (parsed.positionals.length === 0)
    throw new UsageError('add needs at least one plugin name (see "acrylblends plugins")')
  return { names: parsed.positionals, directory: parsed.values.dir }
}

const parse = (argv: readonly string[]) =>
  parseArgs({
    args: [...argv],
    allowPositionals: true,
    strict: true,
    options: { dir: { type: 'string' } },
  })

const present = (appDir: string, name: string) => existsSync(join(appDir, 'src', 'plugins', name))

/**
 * Copy library plugins into an existing app, with the plugins they require, and add their npm packages to its package.json.
 * Refuses a plugin the app already has. Returns the exit code.
 */
export async function add(options: AddOptions, io: Io): Promise<number> {
  const appDir = resolve(io.cwd, options.directory ?? '.')
  if (!existsSync(join(appDir, 'package.json')) || !existsSync(join(appDir, 'src'))) {
    io.stderr.write(
      `error: ${appDir} is not an app (no package.json and src/); run "acrylblends init" first\n`,
    )
    return 1
  }
  // A path is an external plugin folder; anything else is a library plugin name.
  const external = options.names.filter((name) => /[\\/]/.test(name) || name.startsWith('.'))
  for (const folder of external) {
    const code = addExternal(resolve(io.cwd, folder), appDir, io)
    if (code !== 0) return code
  }
  const names = options.names.filter((name) => !external.includes(name))
  if (names.length === 0) return 0
  const already = names.filter((name) => present(appDir, name))
  if (already.length > 0) {
    io.stderr.write(
      `error: the app already has ${already.map((name) => `src/plugins/${name}`).join(', ')}\n`,
    )
    return 1
  }
  const toCopy: LibraryPlugin[] = closure(names, readLibrary()).filter(
    (plugin) => !present(appDir, plugin.name),
  )
  const addedDependencies: string[] = []
  for (const plugin of toCopy) {
    copyPlugin(plugin, appDir)
    addedDependencies.push(...mergeDependencies(appDir, plugin.dependencies))
  }
  io.stdout.write(`added ${toCopy.map((plugin) => plugin.name).join(', ')} to ${appDir}\n`)
  if (addedDependencies.length > 0)
    io.stdout.write(`new dependencies: ${addedDependencies.join(', ')} (run npm install)\n`)
  for (const plugin of toCopy.filter((plugin) => names.includes(plugin.name))) {
    io.stdout.write(
      `\n${plugin.name}: ${plugin.mount ?? `import it from './plugins/${plugin.name}/index.ts' and mount it in src/app.ts`}\n`,
    )
  }
  return 0
}

const PLUGIN_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

/**
 * Bring an external plugin folder (a package made with the builder's package_plugin, or any folder with an index.ts that exports a
 * Cordis plugin) into the app's `extensions/`, where the extensions plugin installs it like any other: checked, staged, started,
 * verified. Its runtime dependencies are not installed here; they are reported so the user adds them deliberately.
 */
function addExternal(folder: string, appDir: string, io: Io): number {
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    io.stderr.write(`error: ${folder} is not a folder\n`)
    return 1
  }
  if (!['index.ts', 'index.js', 'index.mjs'].some((entry) => existsSync(join(folder, entry)))) {
    io.stderr.write(`error: ${folder} has no index.ts that exports a Cordis plugin\n`)
    return 1
  }
  const manifestFile = join(folder, 'package.json')
  const manifest = existsSync(manifestFile)
    ? (JSON.parse(readFileSync(manifestFile, 'utf8')) as {
        name?: string
        dependencies?: Record<string, string>
      })
    : {}
  const name = (manifest.name ?? basename(folder)).replace(/^@[^/]+\//, '')
  if (!PLUGIN_NAME.test(name)) {
    io.stderr.write(
      `error: "${name}" is not a plugin name (lowercase letters, digits and dashes)\n`,
    )
    return 1
  }
  const target = join(appDir, 'extensions', name)
  if (existsSync(target)) {
    io.stderr.write(`error: the app already has extensions/${name}\n`)
    return 1
  }
  cpSync(folder, target, {
    recursive: true,
    filter: (path) => !/[\\/](node_modules|\.git)([\\/]|$)/.test(path.slice(folder.length)),
  })
  io.stdout.write(
    `added external plugin ${name} to ${join(appDir, 'extensions')}; it installs at the next start\n`,
  )
  const dependencies = Object.keys(manifest.dependencies ?? {})
  if (dependencies.length > 0)
    io.stdout.write(
      `it uses ${dependencies.join(', ')}: add them to the app with npm install first\n`,
    )
  return 0
}

/** `acrylblends plugins`: the library, one line per plugin. */
export function listPlugins(io: Io): number {
  for (const plugin of readLibrary().values()) {
    const requires = plugin.requires.length > 0 ? ` (requires ${plugin.requires.join(', ')})` : ''
    io.stdout.write(`${plugin.name.padEnd(12)} ${plugin.description}${requires}\n`)
  }
  return 0
}
