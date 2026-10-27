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
import { defaultsSection, pluginsSection, skillText, writeSelfKnowledge } from './self-knowledge'
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

export const TEMPLATES = ['nodejs', 'notes', 'chat', 'bun', 'acryl-app'] as const
export type Template = (typeof TEMPLATES)[number]
export const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const
export type PackageManager = (typeof PACKAGE_MANAGERS)[number]

/** The version of this package. */
export const VERSION: string = (
  createRequire(import.meta.url)('../package.json') as { version: string }
).version

export const HELP = `${CREATE} ${VERSION} - create an ${CLASS} app

Usage:
  npm create ${PACKAGE}@latest [directory] [source] [-- options]

A source makes the app from someone else's template (it is downloaded and unpacked, nothing in it runs):
  github:owner/repo[#ref]    a GitHub repository, as a tarball (no clone)
  @scope/name[@version]      an npm package (npm pack --ignore-scripts)
  ./template.tgz             a packed template on disk
A template is a folder with an ${TEMPLATE_MANIFEST} (name, description, plugins).

Options:
  --template <name>   nodejs, notes, chat, bun (experimental), acryl-app (asked when not given)
  --install           install the dependencies after creating the app (the lifecycle scripts it will run are listed first)
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
  if (positionals[1] !== undefined && values.template !== undefined)
    throw new UsageError('give a template source or --template, not both')
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
    source: positionals[1],
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
  const run = {
    nodejs: 'npm run dev',
    notes: 'npm run dev',
    chat: 'npm run dev',
    bun: 'bun run dev',
  }[template]
  const desktopNote =
    template === 'nodejs' || template === 'notes' || template === 'chat'
      ? `\nTo run it as a desktop window: \`npx ${PACKAGE} add desktop\`, \`npm install\`, then \`npm run desktop\` (see \`docs/framework/getting-started/desktop.md\`).`
      : ''
  const test = {
    nodejs: 'npm test` and `npm run check',
    notes: 'npm test` and `npm run check',
    chat: 'npm test` and `npm run check',
    bun: 'bun test` and `bun run check',
  }[template]
  const jsxNote =
    template === 'nodejs' || template === 'notes' || template === 'chat'
      ? 'Write pages in `.tsx` (see `src/' +
        (template === 'notes' ? 'views.tsx' : 'page.tsx') +
        "`): the scripts in `package.json` run Node.js with `--import acrylblends/node-server/register`, which compiles `.tsx` with this app's own `typescript`, and `tsconfig.json` sets `jsx: react-jsx` with `jsxImportSource: acrylblends/jsx`. Render a component with `.toString()` and return it with `c.html(...)`. A command that starts the app without those scripts (a bare `node src/index.ts`) cannot load a `.tsx` file. Without a build step you can write the call JSX compiles to instead: `jsx('h1', { class: 'title' }, 'Hello')` from `'acrylblends/jsx'`, children after the props. See `docs/framework/guides/jsx.md`."
      : "Bun compiles `.tsx` itself: write pages in `.tsx`, render a component with `.toString()` and return it with `c.html(...)`. `jsx('h1', { class: 'title' }, 'Hello')` from `'acrylblends/jsx'` (children after the props) is the same thing without JSX syntax. See `docs/framework/guides/jsx.md`."
  const clientNote =
    template === 'nodejs'
      ? `- **Client components** (run in the browser) live in \`src/client/\`, which has its own \`tsconfig.json\` (DOM types, no Node types); \`clientModules\` in \`src/app.ts\` compiles them when the browser asks, and \`npm run build\` compiles them once for production. See \`src/client/counter.tsx\` and \`docs/framework/guides/client-modules.md\`.\n`
      : ''
  const chatStructure =
    template === 'chat'
      ? `
## Structure (a chat app: a streamed answer, history in a database)

- **The dependency rule:** only \`src/db.ts\` (the \`opener\` in \`package.json\`) opens the database. Every other file takes a \`Db\` (\`import type { Db } from '${PACKAGE}/db'\`) as an argument and never imports \`node:sqlite\`, \`pg\`, another driver or \`${PACKAGE}/db/sqlite\`. \`npm test\` and \`npm run check\` run \`${PACKAGE} check-deps\`, which names the file and line of a violation; do not move the \`opener\` entry to silence it.
- \`src/llm.ts\`: \`Llm\`, what the app needs from a model (messages in, pieces out, an aborted signal stops the work), and \`openAiCompatible\`, which calls an OpenAI-compatible chat completions API with \`stream: true\`. The base URL is \`DEEPSEEK_BASE_URL\` (default \`https://api.deepseek.com\`), the model \`DEEPSEEK_MODEL\` (default \`deepseek-chat\`), the key **only** the environment variable \`DEEPSEEK_API_KEY\`, read at the moment of the call: never write it to a file, a response or a log.
- \`src/db.ts\`: \`openChatDb()\` (the \`db\` port on a SQLite file, \`data/chat.sqlite\` or \`$CHAT_DB\`, with \`migrations/\` applied on start; it returns \`{ db, close }\`) and \`chatStore(db)\`. The routes only call \`chatStore\`; keep SQL out of them. Every \`db\` call returns a promise: \`await\` it. The shape of the database is \`migrations/NNN-name.sql\`: to change it add the next numbered file and never edit one that has run. See \`docs/framework/guides/data.md\`.
- \`src/app.ts\` opens the database (top-level \`await\`) and exports the app and \`close\`; \`src/index.ts\` serves it and closes the database on SIGTERM. \`src/chat-app.ts\`: \`createApp(db, llm)\`. \`POST /api/chat\` answers Server-Sent Events: \`meta\` (the conversation id), a \`token\` per piece, then \`done\` or \`error\`. The request's signal (\`c.req.raw.signal\`) goes to the model call, so a closed tab or the Stop button stops the request to the model; what had arrived is kept.
- \`src/client/chat.tsx\`: the client component (own \`tsconfig.json\`, browser types): sends the message with \`fetch\`, reads the events as they arrive, shows the answer growing, and aborts on Stop. \`clientModules\` compiles it when the browser asks; \`npm run build\` compiles it once into \`dist/client\`. See \`docs/framework/guides/client-modules.md\`.
- \`test/chat.test.ts\` tests every route with a mock \`Llm\` (never the network); keep it that way. \`test/server.test.ts\` starts the real server and stops it with a signal.
- To try it with a real model: \`DEEPSEEK_API_KEY=... npm run dev\`.

## Before you ship

Read \`docs/framework/getting-started/deploy.md\`. In short: \`npm ci --omit=dev\`, \`npm run build\`, \`NODE_ENV=production npm start\`; the app listens on \`127.0.0.1\` (\`HOST=0.0.0.0\` only in a container); the SQLite file goes outside the code folder (\`CHAT_DB=/var/lib/chat/chat.sqlite\`) and is backed up; the model key is an environment variable of the service (a root-only environment file for systemd), never a file in the repository. Anyone who can reach the app can spend your key: put it behind a login or on a private network before it is public.
`
      : ''
  const notesStructure =
    template === 'notes'
      ? `
## Structure (a notes app: accounts, sessions, a database)

- \`src/db.ts\`: \`openNotesDb()\` (the \`db\` port on a SQLite file, \`data/notes.sqlite\` or \`$NOTES_DB\`, with \`migrations/\` applied on start; it returns \`{ db, close }\`) and \`notesStore(db)\`, the queries for notes. Every \`db\` call returns a promise: \`await\` it. Use \`?\` bindings, never string-built SQL. See \`docs/framework/guides/data.md\`.
- \`migrations/\`: the shape of the database, one numbered file per change (\`001-notes.sql\`). A file that has run is never edited; a change is the next file (\`002-name.sql\`).
- **The dependency rule:** only \`src/db.ts\` (the \`opener\` in \`package.json\`) opens the database. Every other file takes a \`Db\` (\`import type { Db } from '${PACKAGE}/db'\`) as an argument and never imports \`node:sqlite\`, \`pg\`, another driver or \`${PACKAGE}/db/sqlite\`. \`npm test\` and \`npm run check\` run \`${PACKAGE} check-deps\`, which names the file and line of a violation; do not move the \`opener\` entry to silence it.
- \`src/auth.ts\`: scrypt password hashes (\`node:crypto\`) and the \`sessions\` table; the cookie \`sid\` holds a random token.
- \`src/schema.ts\`: the rules for a note and for credentials. The HTML forms and the JSON API both use \`checkNote\`.
- \`src/views.tsx\`: the pages, as JSX components rendered to strings, and the small script for the instant filter.
- \`src/client/\`: client components, with their own \`tsconfig.json\` (browser types). \`counter.tsx\` is the live character counter. \`clientModules\` in \`notes-app.ts\` compiles them when the browser asks; \`npm run build\` compiles them once into \`dist/client\` for production. See \`docs/framework/guides/client-modules.md\`.
- \`src/notes-app.ts\`: \`createApp(db)\` (pages and forms, csrf on) and \`createApi(db)\` (the JSON API under \`/api/notes\`, chained so \`testClient\` is typed). \`src/app.ts\` opens the database (top-level \`await\`) and exports the app and \`close\`; \`src/index.ts\` serves it and closes the database on SIGTERM. Tests open \`openNotesDb(':memory:')\` and pass its \`db\` to \`createApp\`.
- \`test/notes.test.ts\`: a test for every route. A form POST in a test needs \`origin: 'http://localhost'\` (csrf) and the \`sid\` cookie from sign up.
- Forms answer an invalid input with status 400 and the same page with the messages; a successful POST redirects with 303.
- To add a column or a table: write the next migration (\`migrations/002-name.sql\`), then change \`notesStore\`, \`checkNote\`, the form and the list in \`views.tsx\`, and the tests. Do not edit \`001-notes.sql\`.

## Before you ship

Read \`docs/framework/getting-started/deploy.md\`. In short:

- Install with \`npm ci --omit=dev\`, run \`npm run build\` (it compiles \`src/client\` once; with \`NODE_ENV=production\` only \`dist/client\` is served), and start with \`NODE_ENV=production npm start\` (\`typescript\` stays a runtime dependency: it compiles the \`.tsx\` pages at start).
- The app listens on \`127.0.0.1\`; set \`HOST=0.0.0.0\` only in a container. \`PORT\` chooses the port.
- Put the SQLite file outside the code folder (\`NOTES_DB=/var/lib/notes/notes.sqlite\`) and back it up.
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

Run it with \`${run}\`. The routes are in \`${template === 'bun' ? 'src/index.ts' : template === 'notes' ? 'src/notes-app.ts' : template === 'chat' ? 'src/chat-app.ts' : 'src/app.ts'}\`; an app is a function from \`Request\` to \`Response\`,
so test a route with \`await app.request('/path')\` and no server.${desktopNote}

${notesStructure}${chatStructure}
${defaultsSection(template, PACKAGE)}
${pluginsSection(PACKAGE)}
## Things that surprise people

- A page mounted at \`/x\` answers \`/x\`, not \`/x/\` (trailing slashes are strict); \`trimTrailingSlash()\` redirects.
- A \`json\` validator target reads the body only with a JSON \`Content-Type\`; a failure answers 400 with \`{ error, issues: [{ message, path }] }\`.
- \`throw new HTTPException(404, { message })\` answers an error response (plain text).
- \`testClient(app)\` from \`'${PACKAGE}/testing'\` types only routes chained on the \`new ${CLASS}()\` expression (\`new ${CLASS}().get(...).post(...)\`); headers such as a cookie go in the second argument of each call.
- **JSX:** ${jsxNote}
${clientNote}
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
  written.push(
    ...writeSelfKnowledge(target, agentsText(template, name), skillText(name, template, PACKAGE)),
  )
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
                  `Which template do you want to use? (nodejs, notes, chat, bun (experimental), acryl-app) [nodejs]: `,
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
      chat: `${pm} run dev`,
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
