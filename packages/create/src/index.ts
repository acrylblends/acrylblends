import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { CLASS, CREATE, PACKAGE } from './names'
import { packageManagerInvocation } from './spawn'

export { CLASS, CREATE, PACKAGE }

export const TEMPLATES = ['nodejs', 'notes', 'bun', 'acryl-app'] as const
export type Template = (typeof TEMPLATES)[number]
export const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const
export type PackageManager = (typeof PACKAGE_MANAGERS)[number]

/** The version of this package. */
export const VERSION: string = (
  createRequire(import.meta.url)('../package.json') as { version: string }
).version

export const HELP = `${CREATE} ${VERSION} - create an ${CLASS} app

Usage:
  npm create ${PACKAGE}@latest [directory] [-- options]

Options:
  --template <name>   nodejs, notes, bun (experimental), acryl-app (asked when not given)
  --install           install the dependencies after creating the app
  --pm <manager>      ${PACKAGE_MANAGERS.join(', ')} (default: the one that ran this command, else npm)
  -y, --yes           ask nothing: template nodejs unless --template is given, directory ${PACKAGE}-app
  -h, --help          show this help
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
}

export function isTemplate(value: string): value is Template {
  return (TEMPLATES as readonly string[]).includes(value)
}

export function parseCreateOptions(argv: readonly string[]): CreateOptions {
  let parsed: ReturnType<typeof parse>
  try {
    parsed = parse(argv)
  } catch (error) {
    throw new UsageError((error as Error).message)
  }
  const { values, positionals } = parsed
  if (positionals.length > 1) throw new UsageError('takes at most one directory')
  if (values.template !== undefined && !isTemplate(values.template))
    throw new UsageError(`unknown template "${values.template}" (${TEMPLATES.join(', ')})`)
  if (values.pm !== undefined && !(PACKAGE_MANAGERS as readonly string[]).includes(values.pm))
    throw new UsageError(`unknown package manager "${values.pm}" (${PACKAGE_MANAGERS.join(', ')})`)
  return {
    directory: positionals[0],
    template: values.template as Template | undefined,
    install: values.install === true,
    pm: values.pm as PackageManager | undefined,
    yes: values.yes === true,
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
const templatesRoot = () =>
  walkUp(here, (d) =>
    existsSync(join(d, 'templates', 'nodejs')) ? join(d, 'templates') : undefined,
  )
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

/** The guide for a coding agent in a created app: where the API is, how to run it, what must pass. */
export function agentsText(template: Exclude<Template, 'acryl-app'>, name: string): string {
  const run = { nodejs: 'npm run dev', notes: 'npm run dev', bun: 'bun run dev' }[template]
  const desktopNote =
    template === 'nodejs' || template === 'notes'
      ? `\nTo run it as a desktop window: \`npx ${PACKAGE} add desktop\`, \`npm install\`, then \`npm run desktop\` (see \`docs/framework/getting-started/desktop.md\`).`
      : ''
  const test = {
    nodejs: 'npm test` and `npm run check',
    notes: 'npm test` and `npm run check',
    bun: 'bun test` and `bun run check',
  }[template]
  const jsxNote =
    template === 'nodejs' || template === 'notes'
      ? 'Write pages in `.tsx` (see `src/' +
        (template === 'notes' ? 'views.tsx' : 'page.tsx') +
        "`): the scripts in `package.json` run Node.js with `--import acrylblends/node-server/register`, which compiles `.tsx` with this app's own `typescript`, and `tsconfig.json` sets `jsx: react-jsx` with `jsxImportSource: acrylblends/jsx`. Render a component with `.toString()` and return it with `c.html(...)`. A command that starts the app without those scripts (a bare `node src/index.ts`) cannot load a `.tsx` file. Without a build step you can write the call JSX compiles to instead: `jsx('h1', { class: 'title' }, 'Hello')` from `'acrylblends/jsx'`, children after the props. See `docs/framework/guides/jsx.md`."
      : "Bun compiles `.tsx` itself: write pages in `.tsx`, render a component with `.toString()` and return it with `c.html(...)`. `jsx('h1', { class: 'title' }, 'Hello')` from `'acrylblends/jsx'` (children after the props) is the same thing without JSX syntax. See `docs/framework/guides/jsx.md`."
  const notesStructure =
    template === 'notes'
      ? `
## Structure (a notes app: accounts, sessions, a database)

- \`src/db.ts\`: \`openDb()\` (SQLite through the built-in \`node:sqlite\`; the file is \`notes.db\` or \`$NOTES_DB\`) and \`notesStore(db)\`, the queries for notes.
- \`src/auth.ts\`: scrypt password hashes (\`node:crypto\`) and the \`sessions\` table; the cookie \`sid\` holds a random token.
- \`src/schema.ts\`: the rules for a note and for credentials. The HTML forms and the JSON API both use \`checkNote\`.
- \`src/views.tsx\`: the pages, as JSX components rendered to strings, and the small script for the live character counter and the instant filter.
- \`src/notes-app.ts\`: \`createApp(db)\` (pages and forms, csrf on) and \`createApi(db)\` (the JSON API under \`/api/notes\`, chained so \`testClient\` is typed). \`src/app.ts\` is \`export default createApp()\`; tests call \`createApp(openDb(':memory:'))\`.
- \`test/notes.test.ts\`: a test for every route. A form POST in a test needs \`origin: 'http://localhost'\` (csrf) and the \`sid\` cookie from sign up.
- Forms answer an invalid input with status 400 and the same page with the messages; a successful POST redirects with 303.
- To add a column: change the \`CREATE TABLE\` in \`openDb\`, \`notesStore\`, \`checkNote\`, the form and the list in \`views.tsx\`, and the tests.

## Before you ship

Read \`docs/framework/getting-started/deploy.md\`. In short:

- Install with \`npm ci --omit=dev\` and start with \`NODE_ENV=production npm start\` (\`typescript\` stays a runtime dependency: it compiles the \`.tsx\` pages at start).
- The app listens on \`127.0.0.1\`; set \`HOST=0.0.0.0\` only in a container. \`PORT\` chooses the port.
- Put the SQLite file outside the code folder (\`NOTES_DB=/var/lib/notes/notes.db\`) and back it up.
- Behind an HTTPS reverse proxy set \`TRUST_PROXY=1\` and \`PUBLIC_ORIGIN=https://your.site\`, or the cookie is not \`Secure\` and csrf refuses form posts.
- \`npm test\` includes a test that starts the server and stops it with SIGTERM; keep it passing if you change \`src/index.ts\`.
`
      : ''
  return `# ${name}

An ${CLASS} app (${template}${template === 'bun' ? ', experimental' : ''}): handlers over the Web Standard \`Request\` and \`Response\`, from the \`${PACKAGE}\` package.

## The framework's API is in \`docs/framework/\`

Start at \`docs/framework/README.md\`; \`api/summary.md\` is the one-page summary. Import the class from \`'${PACKAGE}'\` and each middleware or helper from its own
subpath (\`'${PACKAGE}/cors'\`, \`'${PACKAGE}/validator'\`, ...). Parts marked "not yet available" in the docs are not in the package yet.

## This app

Run it with \`${run}\`. The routes are in \`${template === 'bun' ? 'src/index.ts' : template === 'notes' ? 'src/notes-app.ts' : 'src/app.ts'}\`; an app is a function from \`Request\` to \`Response\`,
so test a route with \`await app.request('/path')\` and no server.${desktopNote}

${notesStructure}
## Things that surprise people

- A page mounted at \`/x\` answers \`/x\`, not \`/x/\` (trailing slashes are strict); \`trimTrailingSlash()\` redirects.
- A \`json\` validator target reads the body only with a JSON \`Content-Type\`; a failure answers 400 with \`{ error, issues: [{ message, path }] }\`.
- \`throw new HTTPException(404, { message })\` answers an error response (plain text).
- \`testClient(app)\` from \`'${PACKAGE}/testing'\` types only routes chained on the \`new ${CLASS}()\` expression (\`new ${CLASS}().get(...).post(...)\`); headers such as a cookie go in the second argument of each call.
- **JSX:** ${jsxNote}

## Before you say you are done

\`${test}\` pass.
`
}

function copyDocs(target: string): void {
  const filter = (path: string) => !/(upstream\.json|UPSTREAM\.md)$/.test(path)
  mkdirSync(join(target, 'docs'), { recursive: true })
  cpSync(docsRoot(), join(target, 'docs', 'framework'), { recursive: true, filter })
}

function copyTemplate(
  template: Exclude<Template, 'acryl-app'>,
  target: string,
  name: string,
): string[] {
  const written: string[] = []
  const walk = (from: string, to: string, prefix: string) => {
    mkdirSync(to, { recursive: true })
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      const targetName = prefix === '' && entry.name === 'gitignore' ? '.gitignore' : entry.name
      if (entry.isDirectory())
        walk(join(from, entry.name), join(to, targetName), `${prefix}${entry.name}/`)
      else {
        writeFileSync(
          join(to, targetName),
          replacePlaceholders(readFileSync(join(from, entry.name), 'utf8'), name),
        )
        written.push(`${prefix}${targetName}`)
      }
    }
  }
  walk(join(templatesRoot(), template), target, '')
  writeFileSync(join(target, 'AGENTS.md'), agentsText(template, name))
  writeFileSync(join(target, 'CLAUDE.md'), '@AGENTS.md\n')
  copyDocs(target)
  return written
}

const isEmpty = (directory: string) => !existsSync(directory) || readdirSync(directory).length === 0

/** The `acrylblends` command of the installed framework package, which creates the `acryl-app` template. */
function acrylblendsBin(): string {
  const pkgFile = createRequire(import.meta.url).resolve(`${PACKAGE}/package.json`)
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8')) as { bin?: string | Record<string, string> }
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.[PACKAGE]
  if (!bin) throw new Error(`${PACKAGE} has no command to create an app with`)
  return join(dirname(pkgFile), bin)
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
    const template: Template =
      options.template ??
      (ask
        ? await (async () => {
            const answer =
              (
                await ask(
                  `Which template do you want to use? (nodejs, notes, bun (experimental), acryl-app) [nodejs]: `,
                )
              ).trim() || 'nodejs'
            if (!isTemplate(answer))
              throw new UsageError(`unknown template "${answer}" (${TEMPLATES.join(', ')})`)
            return answer
          })()
        : 'nodejs')
    if (!isEmpty(target)) {
      io.stderr.write(`error: ${target} is not empty; nothing was changed\n`)
      return 1
    }
    const name = nameFrom(target)
    if (template === 'acryl-app') {
      const code = await io.run(
        process.execPath,
        [acrylblendsBin(), 'init', target, '--template', 'agent', '--name', name, '--yes'],
        io.cwd,
      )
      if (code !== 0) return 1
    } else {
      const files = copyTemplate(template, target, name)
      io.stdout.write(
        `created ${name} (${template}) in ${target}: ${files.length} files, ${CLASS} docs in docs/framework\n`,
      )
    }
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
    const start = {
      nodejs: `${pm} run dev`,
      notes: `${pm} run dev`,
      bun: 'bun run dev',
      'acryl-app': `${pm} run dev`,
    }[template]
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
