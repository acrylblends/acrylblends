import { spawn } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { findSecrets } from '@webboxes/app-persistence'
import { CLASS, CREATE, PACKAGE, TEMPLATE_MANIFEST } from './names'
import {
  type Fetchers,
  fetchSource,
  LIFECYCLE,
  parseSource,
  readManifest,
  realFetchers,
  removeTree,
  SOURCE_FORMS,
  SourceError,
  writeTemplate,
} from './source'
import { packageManagerInvocation } from './spawn'

export { CLASS, CREATE, PACKAGE, TEMPLATE_MANIFEST }

/**
 * The templates: the same list as acrylblends init (the framework package makes every one of them; create-acrylblends delegates). A test compares this list and its summaries with the
 * framework package's, so they cannot drift.
 */
export const TEMPLATES = ['blank', 'nodejs', 'notes', 'chat', 'todo', 'agent'] as const
export type Template = (typeof TEMPLATES)[number]
export const TEMPLATE_SUMMARY: Record<Template, string> = {
  blank: 'the router, a server and one route: the smallest app',
  nodejs: 'a web app with a page and a client component',
  notes: 'a multi-user notes app on the db port (sign-up, log-in, sessions)',
  chat: 'a chat app that streams an answer over server-sent events',
  todo: 'a to-do list on the router and state',
  agent: 'the blank app with an offline agent that builds plugins into the running app',
}
/** Names that were templates once and still work. */
export const TEMPLATE_ALIASES: Record<string, Template> = { 'acryl-app': 'agent' }
const TEMPLATE_LIST = TEMPLATES.map((name) => `  ${name.padEnd(7)} ${TEMPLATE_SUMMARY[name]}`).join(
  '\n',
)
export const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const
export type PackageManager = (typeof PACKAGE_MANAGERS)[number]

/** The version of this package. */
export const VERSION: string = (
  createRequire(import.meta.url)('../package.json') as { version: string }
).version

export const HELP = `${CREATE} ${VERSION} - create an ${CLASS} app

Usage:
  npm create ${PACKAGE}@latest [directory] [template | source] [-- options]

A source makes the app from someone else's template (it is downloaded and unpacked, nothing in it runs):
  github:owner/repo[#ref]    a GitHub repository, as a tarball (no clone)
  @scope/name[@version]      an npm package (npm pack --ignore-scripts)
  ./template.tgz             a packed template on disk
A template is a folder with an ${TEMPLATE_MANIFEST} (name, description, plugins).

Options:
  --template <name>   one of the templates below (asked when not given); a bare name after the directory means the same
                      (npm create ${PACKAGE}@latest my-app notes). Every template is a Cordis app: blend.yaml, plugins/
  --install           install the dependencies after creating the app (the lifecycle scripts it will run are listed first)
  --pm <manager>      ${PACKAGE_MANAGERS.join(', ')} (default: the one that ran this command, else npm)
  -y, --yes           ask nothing: template nodejs unless --template is given, directory ${PACKAGE}-app
  -h, --help          show this help

Templates (the same list as acrylblends init):
${TEMPLATE_LIST}
  -v, --version       show the version
`

/** A command line mistake. The command prints it with the help text and exits 2. */
export class UsageError extends Error {
  override name = 'UsageError'
}

export interface Io {
  stdout: { write(text: string): unknown }
  stderr: { write(text: string): unknown }
  cwd: string
  env: Record<string, string | undefined>
  /** Ask one question; `undefined` when there is no terminal to ask on. */
  ask: ((question: string) => Promise<string>) | undefined
  /** Run a program, showing its output; resolves to the exit code. */
  run(command: string, args: string[], cwd: string): Promise<number>
  /** How a template source is fetched; the real network and npm by default. */
  fetchers?: Fetchers
}

export function processIo(): Io {
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY)
  return {
    stdout: process.stdout,
    stderr: process.stderr,
    cwd: process.cwd(),
    env: process.env,
    ask: interactive
      ? async (question) => {
          const rl = createInterface({ input: process.stdin, output: process.stdout })
          try {
            return await rl.question(question)
          } finally {
            rl.close()
          }
        }
      : undefined,
    run: (command, args, cwd) =>
      new Promise((done) => {
        const invocation = packageManagerInvocation(command, args)
        const child = spawn(invocation.file, invocation.args, { cwd, stdio: 'inherit' })
        child.on('error', () => done(1))
        child.on('exit', (code) => done(code ?? 1))
      }),
  }
}

export interface CreateOptions {
  directory: string | undefined
  template: Template | undefined
  install: boolean
  pm: PackageManager | undefined
  yes: boolean
  /** `github:owner/repo[#ref]`, `@scope/name` or a packed `.tgz`: a template from outside this package. */
  source: string | undefined
}

export function isTemplate(value: string): value is Template {
  return (TEMPLATES as readonly string[]).includes(value)
}

/** The template a name means: itself, or what an old name stands for. */
export function resolveTemplate(value: string): Template | undefined {
  return isTemplate(value) ? value : TEMPLATE_ALIASES[value]
}

export function parseCreateOptions(argv: readonly string[]): CreateOptions {
  let parsed: ReturnType<typeof parse>
  try {
    parsed = parse(argv)
  } catch (error) {
    throw new UsageError((error as Error).message)
  }
  const { values, positionals } = parsed
  if (positionals.length > 2)
    throw new UsageError('takes a directory and at most one template source')
  // A bare name that is a built-in template means --template: `create my-app notes`. Only github:, @scope/ and .tgz are sources.
  const bare = positionals[1] !== undefined ? resolveTemplate(positionals[1]) : undefined
  if (positionals[1] !== undefined && values.template !== undefined)
    throw new UsageError('give a template (or a template source) or --template, not both')
  const named = values.template === undefined ? undefined : resolveTemplate(values.template)
  if (values.template !== undefined && named === undefined)
    throw new UsageError(`unknown template "${values.template}" (${TEMPLATES.join(', ')})`)
  if (values.pm !== undefined && !(PACKAGE_MANAGERS as readonly string[]).includes(values.pm))
    throw new UsageError(`unknown package manager "${values.pm}" (${PACKAGE_MANAGERS.join(', ')})`)
  return {
    directory: positionals[0],
    template: bare ?? named,
    install: values.install === true,
    pm: values.pm as PackageManager | undefined,
    yes: values.yes === true,
    source: bare === undefined ? positionals[1] : undefined,
  }
}

const parse = (argv: readonly string[]) =>
  parseArgs({
    args: [...argv],
    allowPositionals: true,
    strict: true,
    options: {
      template: { type: 'string' },
      install: { type: 'boolean' },
      pm: { type: 'string' },
      yes: { type: 'boolean', short: 'y' },
    },
  })

/** A valid package name from a directory name: lower case letters, digits and dashes. */
export function nameFrom(directory: string): string {
  const name = basename(resolve(directory))
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^[^a-z]+/, '')
    .replace(/-+$/g, '')
  return name === '' ? 'acryl-app' : name
}

function walkUp(from: string, test: (dir: string) => string | undefined): string {
  let dir = from
  for (;;) {
    const found = test(dir)
    if (found) return found
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`${CREATE} cannot find its files`)
    dir = parent
  }
}
const here = dirname(fileURLToPath(import.meta.url))
/** The framework docs: the copy `prepack` puts in the package, or `docs/framework` of the repository. */
const docsRoot = () =>
  walkUp(here, (d) =>
    existsSync(join(d, 'docs', 'framework', 'README.md'))
      ? join(d, 'docs', 'framework')
      : undefined,
  )

/**
 * The range a created app asks for: the framework version this package was released with, so a new app depends on the release that made it (and gets what that release's
 * commands can do), never an older one. A caret range, so it also takes the newer patch releases.
 */
export function frameworkRange(): string {
  const file = createRequire(import.meta.url).resolve(`${PACKAGE}/package.json`)
  return `^${(JSON.parse(readFileSync(file, 'utf8')) as { version: string }).version}`
}

export function replacePlaceholders(text: string, name: string): string {
  return text
    .replaceAll('__APP_NAME__', name)
    .replaceAll('__PACKAGE__', PACKAGE)
    .replaceAll('__CLASS__', CLASS)
    .replaceAll('__RANGE__', frameworkRange())
}

function copyDocs(target: string): void {
  const filter = (path: string) => !/(upstream\.json|UPSTREAM\.md)$/.test(path)
  mkdirSync(join(target, 'docs'), { recursive: true })
  cpSync(docsRoot(), join(target, 'docs', 'framework'), { recursive: true, filter })
}

const isEmpty = (directory: string) => !existsSync(directory) || readdirSync(directory).length === 0

/** The `acrylblends` command of the installed framework package, which creates every template. */
function acrylblendsBin(): string {
  const pkgFile = createRequire(import.meta.url).resolve(`${PACKAGE}/package.json`)
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8')) as { bin?: string | Record<string, string> }
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.[PACKAGE]
  if (!bin) throw new Error(`${PACKAGE} has no command to create an app with`)
  return join(dirname(pkgFile), bin)
}

/** The lifecycle scripts a template defines and the line that says when they run. */
const describeScripts = (scripts: Record<string, string>) =>
  Object.entries(scripts)
    .map(([key, value]) => `    ${key}: ${value}`)
    .join('\n')

/** Files whose text is checked for secrets: the template's own, not the framework docs copied in. */
function textFiles(root: string): { path: string; text: string }[] {
  const found: { path: string; text: string }[] = []
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        (prefix === '' && entry.name === 'docs')
      )
        continue
      if (entry.isDirectory()) walk(join(dir, entry.name), `${prefix}${entry.name}/`)
      else {
        const buffer = readFileSync(join(dir, entry.name))
        if (!buffer.subarray(0, 8000).includes(0))
          found.push({ path: `${prefix}${entry.name}`, text: buffer.toString('utf8') })
      }
    }
  }
  walk(root, '')
  return found
}

/**
 * Create an app from a template source (`github:`, `@scope/name`, a packed tarball). The source is fetched and unpacked into a scratch folder, checked
 * (manifest, secrets), and only then copied to the target; nothing in it is installed or run unless `--install`, which lists the scripts first.
 */
async function createFromSource(
  options: CreateOptions,
  target: string,
  directory: string,
  io: Io,
): Promise<number> {
  if (!isEmpty(target)) {
    io.stderr.write(`error: ${target} is not empty; nothing was changed\n`)
    return 1
  }
  const scratch = mkdtempSync(join(tmpdir(), 'create-acrylblends-'))
  try {
    const source = parseSource(options.source!, io.cwd)
    if (!source)
      throw new UsageError(`unknown template source "${options.source}" (${SOURCE_FORMS})`)
    const name = nameFrom(target)
    await fetchSource(
      source,
      join(scratch, 'source'),
      join(scratch, 'download'),
      io.fetchers ?? realFetchers,
    )
    const manifest = readManifest(join(scratch, 'source'))
    const staged = join(scratch, 'app')
    const { files, lifecycle } = writeTemplate(
      join(scratch, 'source'),
      staged,
      (text) => replacePlaceholders(text, name),
      frameworkRange(),
      name,
    )
    if (!existsSync(join(staged, 'AGENTS.md')))
      writeFileSync(
        join(staged, 'AGENTS.md'),
        `# ${name}\n\nAn ${CLASS} app made from the template "${manifest.name}": ${manifest.description}\n\nThe framework's API is in \`docs/framework/\` (start at \`docs/framework/README.md\`).\n`,
      )
    if (!existsSync(join(staged, 'CLAUDE.md')))
      copyFileSync(join(staged, 'AGENTS.md'), join(staged, 'CLAUDE.md'))
    const found = findSecrets(textFiles(staged))
    if (found.length > 0) {
      io.stderr.write(
        `error: the template holds what looks like a secret, so nothing was created:\n${found.map((f) => `  ${f.path}:${f.line} (${f.kind})`).join('\n')}\n`,
      )
      return 1
    }
    copyDocs(staged)
    cpSync(staged, target, { recursive: true })
    io.stdout.write(
      `created ${name} from ${manifest.name} (${manifest.description}) in ${target}: ${files.length} files, ${CLASS} docs in docs/framework\n`,
    )
    if (manifest.plugins.length > 0)
      io.stdout.write(
        `it needs these plugins: ${manifest.plugins.join(', ')}; add them with: npx ${PACKAGE} add ${manifest.plugins.join(' ')}\n`,
      )
    const pm: PackageManager =
      options.pm ??
      ((PACKAGE_MANAGERS as readonly string[]).find((m) =>
        (io.env.npm_config_user_agent ?? '').startsWith(`${m}/`),
      ) as PackageManager | undefined) ??
      'npm'
    const hasScripts = Object.keys(lifecycle).length > 0
    if (options.install) {
      const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')) as {
        dependencies?: object
        devDependencies?: object
      }
      io.stdout.write(
        `running ${pm} install in ${directory}. This installs: ${[...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})].join(', ') || 'nothing'}` +
          `${hasScripts ? `\nand runs the template's own lifecycle scripts:\n${describeScripts(lifecycle)}` : ''}\n` +
          `(the dependencies' install scripts run too unless your ${pm} is set to ignore them)\n`,
      )
      if ((await io.run(pm, ['install'], target)) !== 0) {
        io.stderr.write(`error: ${pm} install failed; run it yourself in ${directory}\n`)
        return 1
      }
    } else if (hasScripts) {
      io.stdout.write(
        `nothing was installed or run. The template defines ${LIFECYCLE.filter((k) => lifecycle[k]).join(', ')}, which ${pm} install would run:\n${describeScripts(lifecycle)}\nread them first, or pass --install to run them.\n`,
      )
    }
    io.stdout.write(
      `\nNext:\n  cd ${directory}\n${options.install ? '' : `  ${pm} install\n`}  see the template's README or package.json scripts\n`,
    )
    return 0
  } catch (error) {
    if (error instanceof SourceError) {
      io.stderr.write(`error: ${error.message}\nnothing was changed\n`)
      return 1
    }
    throw error
  } finally {
    removeTree(scratch)
  }
}

/** Create the app. Returns the exit code: 0 done, 1 refused or failed, 2 a usage error. Never calls `process.exit`. */
export async function runCreate(argv: readonly string[], io: Io = processIo()): Promise<number> {
  try {
    if (argv.includes('-h') || argv.includes('--help')) {
      io.stdout.write(HELP)
      return 0
    }
    if (argv.includes('-v') || argv.includes('--version')) {
      io.stdout.write(`${VERSION}\n`)
      return 0
    }
    const options = parseCreateOptions(argv)
    const ask = options.yes ? undefined : io.ask
    const directory =
      options.directory ??
      (ask
        ? (await ask(`Project directory (${PACKAGE}-app): `)).trim() || `${PACKAGE}-app`
        : `${PACKAGE}-app`)
    const target = resolve(io.cwd, directory)
    if (options.source !== undefined) return await createFromSource(options, target, directory, io)
    const template: Template =
      options.template ??
      (ask
        ? await (async () => {
            const answer =
              (
                await ask(
                  `Templates:\n${TEMPLATE_LIST}\nWhich template do you want to use? [nodejs]: `,
                )
              ).trim() || 'nodejs'
            const chosen = resolveTemplate(answer)
            if (chosen === undefined)
              throw new UsageError(`unknown template "${answer}" (${TEMPLATES.join(', ')})`)
            return chosen
          })()
        : 'nodejs')
    if (!isEmpty(target)) {
      io.stderr.write(`error: ${target} is not empty; nothing was changed\n`)
      return 1
    }
    const name = nameFrom(target)
    // Every template is a Cordis app, made by the framework package's own `init` (blend.yaml, plugins/, AGENTS.md, CLAUDE.md, the skill, the docs).
    const code = await io.run(
      process.execPath,
      [acrylblendsBin(), 'init', target, '--template', template, '--name', name, '--yes'],
      io.cwd,
    )
    if (code !== 0) return 1
    const pm: PackageManager =
      options.pm ??
      ((PACKAGE_MANAGERS as readonly string[]).find((m) =>
        (io.env.npm_config_user_agent ?? '').startsWith(`${m}/`),
      ) as PackageManager | undefined) ??
      'npm'
    if (options.install) {
      if ((await io.run(pm, ['install'], target)) !== 0) {
        io.stderr.write(`error: ${pm} install failed; run it yourself in ${directory}\n`)
        return 1
      }
    }
    const start = `${pm} run dev`
    io.stdout.write(
      `\nNext:\n  cd ${directory}\n${options.install ? '' : `  ${pm} install\n`}  ${start}\n`,
    )
    return 0
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr.write(`error: ${error.message}\n\n${HELP}`)
      return 2
    }
    io.stderr.write(`error: ${(error as Error).message}\n`)
    return 1
  }
}
