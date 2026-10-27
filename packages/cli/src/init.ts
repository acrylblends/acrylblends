import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import type { Io } from './io'
import { closure, copyPlugin, readLibrary } from './library'
import {
  copyFrameworkDocs,
  copyTemplate,
  isValidName,
  mergeDependencies,
  mergeImports,
  mergeTooling,
  nameFrom,
  readTemplateDesktopPath,
  readTemplatePlugins,
  TargetNotEmptyError,
  writeAgentFiles,
  writeDesktopPath,
} from './project'
import {
  frameworkDocsRoot,
  isTemplate,
  sharedDir,
  TEMPLATES,
  type Template,
  templateDir,
} from './templates'

/** A command line mistake. The CLI prints it with the help text and exits 2. */
export class UsageError extends Error {
  override name = 'UsageError'
}

/** What `init` was asked for. Anything left undefined is asked for on a terminal, or defaulted. */
export interface InitOptions {
  directory: string | undefined
  name: string | undefined
  template: Template | undefined
  install: boolean | undefined
  /** Also add the desktop shell (`add desktop`): an Electron window on the app's own server. */
  desktop: boolean
  yes: boolean
}

/** Parse `init [dir] [--template t] [--agent|--no-agent] [--name n] [--install] [-y]`. `--agent` means `--template agent`, `--no-agent` means `--template blank`. */
export function parseInitOptions(argv: readonly string[]): InitOptions {
  let parsed: ReturnType<typeof parse>
  try {
    parsed = parse(argv)
  } catch (error) {
    throw new UsageError((error as Error).message)
  }
  const { values, positionals } = parsed
  if (positionals.length > 1) throw new UsageError('init takes at most one directory')
  if (values.agent && values['no-agent'])
    throw new UsageError('use --agent or --no-agent, not both')
  if (values.template !== undefined && !isTemplate(values.template))
    throw new UsageError(`unknown template "${values.template}" (${TEMPLATES.join(', ')})`)
  const alias: Template | undefined = values.agent
    ? 'agent'
    : values['no-agent']
      ? 'blank'
      : undefined
  if (values.template !== undefined && alias !== undefined && values.template !== alias)
    throw new UsageError(
      `--template ${values.template} contradicts --${alias === 'agent' ? 'agent' : 'no-agent'}`,
    )
  return {
    directory: positionals[0],
    name: values.name,
    template: (values.template as Template | undefined) ?? alias,
    install: values.install,
    desktop: values.desktop === true,
    yes: values.yes === true,
  }
}

const parse = (argv: readonly string[]) =>
  parseArgs({
    args: [...argv],
    allowPositionals: true,
    strict: true,
    options: {
      name: { type: 'string' },
      template: { type: 'string' },
      agent: { type: 'boolean' },
      'no-agent': { type: 'boolean' },
      install: { type: 'boolean' },
      desktop: { type: 'boolean' },
      yes: { type: 'boolean', short: 'y' },
    },
  })

const yes = (answer: string) => ['y', 'yes'].includes(answer.trim().toLowerCase())

async function askTemplate(ask: (question: string) => Promise<string>): Promise<Template> {
  const answer = (await ask(`Template (${TEMPLATES.join(', ')}) [blank]: `)).trim().toLowerCase()
  if (answer === '') return 'blank'
  if (isTemplate(answer)) return answer
  throw new UsageError(`unknown template "${answer}" (${TEMPLATES.join(', ')})`)
}

/** Scaffold a Cordis app. Returns the exit code: 0 done, 1 refused or failed. Never overwrites anything. */
export async function init(options: InitOptions, io: Io): Promise<number> {
  const relative = options.directory ?? '.'
  const directory = resolve(io.cwd, relative)
  const ask = options.yes ? undefined : io.ask

  let name = options.name ?? nameFrom(directory)
  if (options.name === undefined && ask)
    name = (await ask(`Project name (${name}): `)).trim() || name
  if (!isValidName(name)) {
    throw new UsageError(
      `"${name}" is not a valid project name (lower case letters, digits and dashes, starting with a letter)`,
    )
  }
  const template = options.template ?? (ask ? await askTemplate(ask) : 'blank')
  const install =
    options.install ?? (ask ? yes(await ask('Install dependencies with npm now? (y/N): ')) : false)

  let files: string[]
  try {
    files = copyTemplate(templateDir(template), directory, name)
    files.push(...writeAgentFiles(sharedDir(), templateDir(template), directory, name))
    files.push(...copyFrameworkDocs(frameworkDocsRoot(), directory))
  } catch (error) {
    if (!(error instanceof TargetNotEmptyError)) throw error
    io.stderr.write(`error: ${error.message}\n`)
    return 1
  }
  const plugins = closure(
    [...readTemplatePlugins(templateDir(template)), ...(options.desktop ? ['desktop'] : [])],
    readLibrary(),
  )
  for (const plugin of plugins) {
    copyPlugin(plugin, directory)
    if (plugin.imports) mergeImports(directory, plugin.imports, 'plugins')
    mergeDependencies(directory, plugin.dependencies)
    mergeTooling(directory, plugin)
  }
  const desktopPath = options.desktop ? readTemplateDesktopPath(templateDir(template)) : undefined
  if (desktopPath !== undefined) writeDesktopPath(directory, desktopPath)
  io.stdout.write(
    `created ${name} (${template}) in ${directory}: ${files.length} files, plugins ${plugins.map((plugin) => plugin.name).join(', ')}\n`,
  )

  if (install && (await io.install(directory)) !== 0) {
    io.stderr.write('error: npm install failed; run it yourself in the new directory\n')
    return 1
  }
  const steps = [
    relative === '.' ? '' : `  cd ${relative}\n`,
    install ? '' : '  npm install\n',
    '  npm run dev\n  npm test\n',
  ]
  io.stdout.write(`\nNext:\n${steps.join('')}`)
  return 0
}
