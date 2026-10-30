import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { applyIdeProfile } from './ide-profile'
import type { Io } from './io'
import { closure, copyPlugin, readLibrary } from './library'
import {
  addNodePreflight,
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
  resolveTemplate,
  sharedDir,
  TEMPLATE_SUMMARY,
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
  /** Print no "Next:" block: `create-acrylblends` runs `init` and prints its own, for the package manager it knows. */
  quietNext: boolean
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
  const named = values.template === undefined ? undefined : resolveTemplate(values.template)
  if (values.template !== undefined && named === undefined)
    throw new UsageError(`unknown template "${values.template}" (${TEMPLATES.join(', ')})`)
  const alias: Template | undefined = values.agent
    ? 'agent'
    : values['no-agent']
      ? 'blank'
      : undefined
  if (named !== undefined && alias !== undefined && named !== alias)
    throw new UsageError(
      `--template ${values.template} contradicts --${alias === 'agent' ? 'agent' : 'no-agent'}`,
    )
  return {
    directory: positionals[0],
    name: values.name,
    template: named ?? alias,
    install: values.install,
    desktop: values.desktop === true,
    quietNext: values['no-next'] === true,
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
      'no-next': { type: 'boolean' },
      yes: { type: 'boolean', short: 'y' },
    },
  })

const yes = (answer: string) => ['y', 'yes'].includes(answer.trim().toLowerCase())

async function askTemplate(ask: (question: string) => Promise<string>): Promise<Template> {
  const answer = (
    await ask(
      `Templates:\n${TEMPLATES.map((name) => `  ${name.padEnd(7)} ${TEMPLATE_SUMMARY[name]}`).join('\n')}\nTemplate [blank]: `,
    )
  )
    .trim()
    .toLowerCase()
  if (answer === '') return 'blank'
  const chosen = resolveTemplate(answer)
  if (chosen !== undefined) return chosen
  throw new UsageError(`unknown template "${answer}" (${TEMPLATES.join(', ')})`)
}

/** The frame packages' specs for a scaffolded app while the ide packages are unpublished (see the note in `init`). Unset or malformed: undefined. */
function frameProfileFromEnv():
  | { dshVersion: string; frameworkVersion: string; packages: Record<string, string> }
  | undefined {
  const raw = process.env.ACRYLBLENDS_FRAME_PACKAGES
  if (raw === undefined || raw.trim() === '') return undefined
  try {
    const parsed = JSON.parse(raw) as {
      dshVersion?: unknown
      frameworkVersion?: unknown
      packages?: unknown
    }
    if (typeof parsed.dshVersion !== 'string' || typeof parsed.frameworkVersion !== 'string')
      return undefined
    const packages: Record<string, string> = {}
    for (const [key, value] of Object.entries((parsed.packages ?? {}) as Record<string, unknown>))
      if (typeof value === 'string') packages[key] = value
    return { dshVersion: parsed.dshVersion, frameworkVersion: parsed.frameworkVersion, packages }
  } catch {
    return undefined
  }
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
  const own = closure(readTemplatePlugins(templateDir(template)), readLibrary())
  const plugins = options.desktop
    ? closure([...own.map((plugin) => plugin.name), 'desktop'], readLibrary())
    : own
  // What only the desktop shell brought (and needs), named apart so the list does not read as if the web app had asked for it.
  const forDesktop = plugins.filter((plugin) => !own.some((owned) => owned.name === plugin.name))
  for (const plugin of plugins) {
    copyPlugin(plugin, directory)
    if (plugin.imports) mergeImports(directory, plugin.imports, 'plugins')
    mergeDependencies(directory, plugin.dependencies)
    mergeTooling(directory, plugin)
  }
  addNodePreflight(directory)
  // The ACRYL frame (docs/plans/ide-port.md, slice 6): a template with a frame row (`src/frame.ts`) gets the app's own DSH profile and overlay, so
  // `npm run dev` opens it inside the frame with its page at /app. The frame's client packages are not published yet, so the specs come from
  // ACRYLBLENDS_FRAME_PACKAGES (JSON: {dshVersion, frameworkVersion, packages: {name: spec}}); without it the app keeps the framework-only script
  // and says so, instead of writing a profile that cannot install.
  const frameRow = existsSync(join(directory, 'src', 'frame.ts'))
    ? [{ id: 'app-routes', name: './src/frame.ts' }]
    : []
  if (frameRow.length > 0) {
    const frame = frameProfileFromEnv()
    if (frame === undefined) {
      io.stdout.write(
        'note: the ACRYL frame is not published yet; this app runs on the framework alone (docs/plans/ide-port-status.md)\n',
      )
    } else {
      const wrote = applyIdeProfile(directory, {
        appName: name,
        dshVersion: frame.dshVersion,
        frameworkVersion: frame.frameworkVersion,
        spec: (packageName) => frame.packages[packageName],
        dependencies: frame.packages,
        rows: frameRow,
      })
      io.stdout.write(`frame: wrote ${wrote.written.join(', ') || 'nothing (already right)'}\n`)
    }
  }
  const desktopPath = options.desktop ? readTemplateDesktopPath(templateDir(template)) : undefined
  if (desktopPath !== undefined) writeDesktopPath(directory, desktopPath)
  io.stdout.write(
    `created ${name} (${template}) in ${directory}: ${files.length} files, plugins ${own.map((plugin) => plugin.name).join(', ')}${forDesktop.length > 0 ? `; the desktop shell adds ${forDesktop.map((plugin) => plugin.name).join(', ')}, which it needs` : ''}\n`,
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
  if (!options.quietNext) io.stdout.write(`\nNext:\n${steps.join('')}`)
  return 0
}
