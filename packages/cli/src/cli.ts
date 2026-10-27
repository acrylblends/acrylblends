import { createRequire } from 'node:module'
import { add, listPlugins, parseAddOptions } from './add'
import { buildClient, parseBuildClientOptions } from './build-client'
import { checkDeps, parseCheckDepsOptions } from './check-deps'
import { init, parseInitOptions, UsageError } from './init'
import { type Io, processIo } from './io'
import { kvImport, parseKvOptions } from './kv-import'

/** The version of this package. */
export const VERSION: string = (
  createRequire(import.meta.url)('../package.json') as { version: string }
).version

export const HELP = `acrylblends ${VERSION} - scaffold Cordis apps

Usage:
  acrylblends init [dir] [options]       Create a Cordis app in an empty or new directory
  acrylblends add <plugin...> [--dir d]  Copy library plugins (and what they require) into an app;
                                      a folder path brings an external plugin into its plugins/
  acrylblends plugins                    List the plugin library
  acrylblends build-client [root] [out]  Compile the client modules once for production (src/client to dist/client)
  acrylblends kv import <kv.json> <db>   Move a JSON-file kv store into the kv table of a SQLite database [--overwrite] [--table t] [--migrations dir]
  acrylblends check-deps [dir]           Fail when app code imports a database driver or opener outside the file named in
                                      package.json "acryl": { "opener": "src/db.ts" } (a port is imported, a provider is not)

Options for init:
  --template <name>      blank or agent (asked when not given); --agent means --template agent,
                         --no-agent means --template blank
  --name <name>          the project name (default: the directory name)
  --desktop              also add the desktop shell: npm run desktop opens a window on the app
  --install              run npm install after copying
  -y, --yes              ask nothing; use defaults (the blank template, no install)

  -h, --help             show this help
  -v, --version          show the version
`

/**
 * Run the CLI and return the exit code: 0 done, 1 failed or refused, 2 a usage error. Never calls `process.exit`.
 */
export async function runCli(argv: readonly string[], io: Io = processIo()): Promise<number> {
  const [command, ...args] = argv
  try {
    if (command === undefined || command === 'help' || command === '-h' || command === '--help') {
      io.stdout.write(HELP)
      return command === undefined ? 2 : 0
    }
    if (command === 'version' || command === '-v' || command === '--version') {
      io.stdout.write(`${VERSION}\n`)
      return 0
    }
    if (command === 'init') return await init(parseInitOptions(args), io)
    if (command === 'add') return await add(parseAddOptions(args), io)
    if (command === 'build-client') return await buildClient(parseBuildClientOptions(args), io)
    if (command === 'kv') return await kvImport(parseKv(args), io)
    if (command === 'check-deps') return checkDeps(parseCheckDeps(args), io)
    if (command === 'plugins') return listPlugins(io)
    throw new UsageError(`unknown command "${command}"`)
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr.write(`error: ${error.message}\n\n${HELP}`)
      return 2
    }
    io.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }
}

function parseCheckDeps(args: readonly string[]) {
  try {
    return parseCheckDepsOptions(args)
  } catch (error) {
    throw new UsageError((error as Error).message)
  }
}

function parseKv(args: readonly string[]) {
  return parseKvOptions(args)
}
