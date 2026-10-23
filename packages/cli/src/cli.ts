import { createRequire } from 'node:module'
import { add, listPlugins, parseAddOptions } from './add'
import { init, parseInitOptions, UsageError } from './init'
import { type Io, processIo } from './io'

/** The version of this package. */
export const VERSION: string = (
  createRequire(import.meta.url)('../package.json') as { version: string }
).version

export const HELP = `acrylblends ${VERSION} - scaffold Cordis apps

Usage:
  acrylblends init [dir] [options]       Create a Cordis app in an empty or new directory
  acrylblends add <plugin...> [--dir d]  Copy library plugins (and what they require) into an app;
                                      a folder path brings an external plugin into its extensions/
  acrylblends plugins                    List the plugin library

Options for init:
  --template <name>      blank or agent (asked when not given); --agent means --template agent,
                         --no-agent means --template blank
  --name <name>          the project name (default: the directory name)
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
