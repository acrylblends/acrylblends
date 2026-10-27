// Shared by sync-framework.mjs and verify-framework-sync.mjs: how ACRYL's framework plugins are vendored into this repository (spec 015).
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'

export const SOURCE_REPO = 'acryldev/acryl'

/** The framework plugins, in dependency order. `entries` maps each importable subpath to the upstream file it resolves to. */
export const PLUGINS = {
  'acryl-router': {
    entries: {
      '': 'src/index.ts',
      '/middleware': 'src/middleware/index.ts',
      '/helpers': 'src/helpers/index.ts',
      '/client': 'src/client.ts',
      '/jsx': 'src/core/jsx/index.ts',
      '/jsx/jsx-runtime': 'src/core/jsx/jsx-runtime.ts',
      '/jsx/jsx-dev-runtime': 'src/core/jsx/jsx-dev-runtime.ts',
      '/jsx/streaming': 'src/core/jsx/streaming.ts',
    },
    testsNotRun: {
      'tests/loader.spec.ts':
        'loads the built lib/ entry through the real Loader; the library ships source and has no build',
    },
  },
  'acryl-router-http': {
    entries: { '': 'src/index.ts' },
    testsNotRun: {
      'tests/adapter.spec.ts':
        'needs @deepseek-ai/dsh-host-webserver (the DSH web server); acryl-node-server has its own tests',
      'tests/stream.spec.ts': 'needs @deepseek-ai/dsh-host-webserver (the DSH web server)',
      'tests/surfaces.spec.ts': 'needs @deepseek-ai/dsh-host-webserver (the DSH web server)',
    },
  },
  'acryl-node-server': {
    entries: { '': 'src/index.ts', '/client-modules': 'src/client-modules.ts' },
    testsNotRun: {
      'tests/client-modules.spec.ts':
        "links typescript from the plugin's own node_modules (ACRYL's workspace layout); clientModules and build-client are exercised here by the templates' tests and verify:scaffolder",
      'tests/register.spec.ts':
        "links typescript from the plugin's own node_modules (ACRYL's workspace layout); the hook is exercised here by the templates' own .tsx tests and verify:scaffolder",
    },
  },
  'acryl-state': {
    entries: { '': 'src/index.ts', '/react': 'src/react.ts' },
    testsNotRun: {
      'tests/react.spec.ts':
        'needs react and @testing-library/react, which generated apps do not install',
    },
  },
  'acryl-inspect': { entries: { '': 'src/index.ts' }, testsNotRun: {} },
  // Data (spec 049): the `db` port and its SQLite provider as Cordis plugins, and the `kv` port with its two providers. The plain apps use
  // `acrylblends/db`, `acrylblends/db/sqlite` and `acrylblends/kv/*` instead.
  'acryl-db': {
    entries: {
      '': 'src/index.ts',
      '/cordis': 'src/cordis.ts',
      '/conformance': 'src/conformance.ts',
    },
    testsNotRun: {},
  },
  'acryl-db-sqlite': {
    entries: { '': 'src/index.ts', '/open': 'src/open.ts' },
    testsNotRun: {
      'tests/loader.spec.ts':
        'loads the plugin through the real Loader (@deepseek-ai/cordis-plugin-loader), which generated apps do not install; the plain opener it wraps is tested here by open.spec.ts and conformance.spec.ts',
    },
  },
  // The door (spec 049 slice 9): an agent looks at the running page, acts on it and installs plugins live, through `.acryl/bin/acryl`.
  'acryl-door': {
    entries: { '': 'src/index.ts' },
    testsNotRun: {
      'tests/page/accessible-name-hidden.spec.ts':
        'needs jsdom, a development dependency of ACRYL that generated apps do not install; it runs in ACRYL, and verify:scaffolder walks the door in a real browser',
      'tests/page/channel.spec.ts':
        'needs jsdom, a development dependency of ACRYL that generated apps do not install; it runs in ACRYL, and verify:scaffolder walks the door in a real browser',
      'tests/page/driver.spec.ts':
        'needs jsdom, a development dependency of ACRYL that generated apps do not install; it runs in ACRYL, and verify:scaffolder walks the door in a real browser',
      'tests/page/indicator.spec.ts':
        'needs jsdom, a development dependency of ACRYL that generated apps do not install; it runs in ACRYL, and verify:scaffolder walks the door in a real browser',
      'tests/page/visible-text.spec.ts':
        'needs jsdom, a development dependency of ACRYL that generated apps do not install; it runs in ACRYL, and verify:scaffolder walks the door in a real browser',
      'tests/host/door.spec.ts':
        'needs jsdom, a development dependency of ACRYL that generated apps do not install; it runs in ACRYL, and verify:scaffolder walks the door in a real browser',
      'tests/host/verbs.spec.ts':
        'needs jsdom, a development dependency of ACRYL that generated apps do not install; it runs in ACRYL, and verify:scaffolder walks the door in a real browser',
      'tests/host/shim.spec.ts':
        'needs jsdom, a development dependency of ACRYL that generated apps do not install; it runs in ACRYL, and verify:scaffolder walks the door in a real browser',
      'tests/host/loader.spec.ts':
        'loads the plugin through the real Loader (@deepseek-ai/cordis-plugin-loader), which generated apps do not install',
    },
  },
  'acryl-kv': {
    entries: {
      '': 'src/index.ts',
      '/cordis': 'src/cordis.ts',
      '/conformance': 'src/conformance.ts',
    },
    testsNotRun: {},
  },
  'acryl-kv-json': {
    entries: { '': 'src/index.ts', '/open': 'src/open.ts' },
    testsNotRun: {
      'tests/loader.spec.ts':
        'loads the plugin through the real Loader (@deepseek-ai/cordis-plugin-loader), which generated apps do not install; the plain opener it wraps is tested here by open.spec.ts and conformance.spec.ts',
      'tests/crash.spec.ts':
        'kills a child process that imports the package build (lib/), which a copy vendored into an app does not have; it runs in ACRYL',
    },
  },
  'acryl-kv-db': {
    entries: { '': 'src/index.ts', '/open': 'src/open.ts' },
    testsNotRun: {
      'tests/loader.spec.ts':
        'loads the plugin through the real Loader (@deepseek-ai/cordis-plugin-loader), which generated apps do not install; kvOnDb is tested here by open.spec.ts and conformance.spec.ts',
    },
  },
}

/** Folders copied verbatim from a plugin, and the notice files copied when upstream has them. */
export const VENDORED_DIRS = ['src', 'tests']
export const NOTICE_FILES = ['LICENSE', 'LICENSE.md', 'NOTICE', 'NOTICE.md']

/** Every file under `dir`, as relative paths with `/` separators, sorted by code unit. */
export function listFiles(dir) {
  const found = []
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const path = join(current, entry.name)
      if (entry.isDirectory()) walk(path)
      else found.push(relative(dir, path).split(sep).join('/'))
    }
  }
  if (existsSync(dir) && statSync(dir).isDirectory()) walk(dir)
  return found.sort((a, b) => (a < b ? -1 : 1))
}

/**
 * The digest of a set of vendored files: sha256 over each relative path, a NUL, the bytes and a NUL, in sorted order. It is the algorithm of
 * `digestFolder` in @webboxes/blends-core, applied to the vendored paths only (a plugin folder also holds files of our own: plugin.json, upstream.json).
 */
export function digestOf(files) {
  const hash = createHash('sha256')
  for (const path of [...files.keys()].sort((a, b) => (a < b ? -1 : 1)))
    hash.update(path).update('\0').update(files.get(path)).update('\0')
  return `sha256:${hash.digest('hex')}`
}

/** What a bare specifier names: `acryl-router`, `acryl-router/middleware` ... becomes the path of the vendored file, relative to the importing file. */
function resolveSpecifier(specifier, fromFile, pluginsRoot) {
  for (const [plugin, { entries }] of Object.entries(PLUGINS)) {
    for (const [subpath, upstreamFile] of Object.entries(entries)) {
      if (specifier !== `${plugin}${subpath}`) continue
      const target = pluginsRoot
        ? `${pluginsRoot}/${plugin}/${upstreamFile}`
        : `${plugin}/${upstreamFile}`
      let path = relative(dirname(fromFile), target).split(sep).join('/')
      if (!path.startsWith('.')) path = `./${path}`
      return path
    }
  }
  return undefined
}

const SPECIFIER =
  /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(['"])(acryl-[A-Za-z0-9-]+(?:\/[A-Za-z0-9./-]+)?)\2/gu

/** For every character of a TypeScript source: 0 = code, 1 = inside a comment, 2 = inside a string or template literal. */
export function classify(source) {
  const kind = new Uint8Array(source.length)
  let i = 0
  while (i < source.length) {
    const c = source[i]
    const next = source[i + 1]
    if (c === '/' && next === '/') {
      const end = source.indexOf('\n', i)
      const stop = end === -1 ? source.length : end
      kind.fill(1, i, stop)
      i = stop
    } else if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2)
      const stop = end === -1 ? source.length : end + 2
      kind.fill(1, i, stop)
      i = stop
    } else if (c === "'" || c === '"' || c === '`') {
      let j = i + 1
      while (j < source.length && source[j] !== c) {
        if (source[j] === '\\') j += 1
        else if (c !== '`' && source[j] === '\n') break
        j += 1
      }
      kind.fill(2, i, Math.min(j + 1, source.length))
      i = j + 1
    } else i += 1
  }
  return kind
}

/**
 * Rewrite the specifiers that name another vendored plugin to relative paths. `file` is the path of the file inside `plugins/` (for example
 * `acryl-state/src/service.ts`). Only real import and export statements are touched: a specifier named in a comment or in a string (a documentation
 * example) is text, not a dependency. Any other `acryl-*` specifier in code is an error: the vendored plugins may depend only on each other and on
 * public packages.
 */
export function rewriteSpecifiers(source, file, pluginsRoot = '') {
  const kind = classify(source)
  let count = 0
  const rewritten = source.replace(SPECIFIER, (match, lead, quote, specifier, offset) => {
    if (kind[offset] !== 0) return match
    const path = resolveSpecifier(specifier, file, pluginsRoot)
    if (path === undefined)
      throw new Error(
        `${file}: imports "${specifier}", which is not one of the vendored framework plugins`,
      )
    count += 1
    return `${lead}${quote}${path}${quote}`
  })
  return { source: rewritten, count }
}

/** The files a plugin contributes, read from an ACRYL checkout and rewritten: a Map of `<plugin>/<relative path>` to bytes, and how many specifiers changed. */
export function readUpstream(checkout, plugin) {
  const root = join(checkout, 'plugins', plugin)
  if (!existsSync(join(root, 'package.json')))
    throw new Error(`${root} is not a plugin folder of the ACRYL checkout`)
  const files = new Map()
  let rewritten = 0
  const add = (relativePath) => {
    const bytes = readFileSync(join(root, relativePath))
    if (/\.(?:ts|tsx|mts)$/u.test(relativePath)) {
      const result = rewriteSpecifiers(bytes.toString('utf8'), `${plugin}/${relativePath}`)
      rewritten += result.count
      files.set(relativePath, Buffer.from(result.source))
    } else files.set(relativePath, bytes)
  }
  for (const dir of VENDORED_DIRS)
    for (const file of listFiles(join(root, dir))) add(`${dir}/${file}`)
  const notices = []
  for (const name of NOTICE_FILES) {
    if (existsSync(join(root, name))) {
      add(name)
      notices.push(name)
    }
  }
  const notice = notices.length > 0 ? notices : null
  // A test file whose header says `vendoring: skip - <reason>` is vendored but not run here: it tests the plugin's own build, which a copy in an app does not have.
  const skipped = {}
  for (const [path, bytes] of files) {
    const marker = /^\s*\*\s*vendoring: skip - (.+(?:\n\s*\*\s+(?!\/)\S.*)*)/mu.exec(
      bytes.toString('utf8'),
    )
    if (marker && path.startsWith('tests/'))
      skipped[path] = (marker[1] ?? '').replace(/\n\s*\*\s*/gu, ' ').trim()
  }
  for (const entry of Object.values(PLUGINS[plugin].entries)) {
    if (!files.has(entry))
      throw new Error(`${plugin}: the entry ${entry} is not in the vendored files`)
  }
  return { files, rewritten, notice, skipped }
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** ACRYL's framework docs are copied as they are into docs/framework/. These two files are ours and are not part of the digest. */
export const DOCS_DIR = 'docs/framework'
export const DOCS_OURS = new Set(['upstream.json', 'UPSTREAM.md'])

/** The docs tree of an ACRYL checkout, verbatim: a Map of the path inside docs/framework to bytes. */
export function readUpstreamDocs(checkout) {
  const root = join(checkout, DOCS_DIR)
  if (!existsSync(root)) throw new Error(`${root} does not exist in the ACRYL checkout`)
  const files = new Map()
  for (const file of listFiles(root)) files.set(file, readFileSync(join(root, file)))
  return files
}

/** The docs already in this repository, without the files that are ours. */
export function readVendoredDocs(repoRoot) {
  const root = join(repoRoot, DOCS_DIR)
  const files = new Map()
  for (const file of listFiles(root))
    if (!DOCS_OURS.has(file)) files.set(file, readFileSync(join(root, file)))
  return files
}

/** Files of an ACRYL checkout that become template files: upstream path to template path (the reference app, `examples/acryl-todo`). */
export const TEMPLATE_SOURCES = {
  todo: {
    dir: 'packages/cli/templates/todo',
    /** Where the framework plugins sit in a generated app, relative to the app folder. */
    pluginsRoot: 'plugins',
    files: {
      'examples/acryl-todo/src/index.ts': 'src/todo.ts',
      'examples/acryl-todo/src/page.ts': 'src/page.ts',
    },
  },
  /** The package's own README (the npm page): ACRYL writes it with its examples type-checked against the packed framework, so it is synced and digest-checked, never edited here. */
  cliReadme: {
    dir: 'packages/cli',
    pluginsRoot: 'plugins',
    files: {
      'distribution/acrylblends-framework/README.md': 'README.md',
    },
  },
  /** Two pure pieces of ACRYL Desktop (spec 018): the isolated Electron user-data folder and the bounded, escalating shutdown. They import nothing but `node:path`. */
  desktop: {
    dir: 'plugins/desktop',
    pluginsRoot: 'plugins',
    files: {
      'apps/acryl-desktop/src/shell/desktop-user-data.ts': 'user-data.ts',
      'apps/acryl-desktop/src/shell/shutdown.ts': 'shutdown.ts',
    },
  },
  /** The same two files for the desktop shell of a plain Acryl app (`desktop-web`). */
  desktopWeb: {
    dir: 'plugins/desktop-web',
    pluginsRoot: 'plugins',
    files: {
      'apps/acryl-desktop/src/shell/desktop-user-data.ts': 'user-data.ts',
      'apps/acryl-desktop/src/shell/shutdown.ts': 'shutdown.ts',
    },
  },
}

/** The template files of one template, read from an ACRYL checkout and rewritten for the app layout: a Map of template path to bytes. */
export function readTemplateSources(checkout, template) {
  const config = TEMPLATE_SOURCES[template]
  const files = new Map()
  let rewritten = 0
  for (const [from, to] of Object.entries(config.files)) {
    const result = rewriteSpecifiers(
      readFileSync(join(checkout, from), 'utf8'),
      to,
      config.pluginsRoot,
    )
    rewritten += result.count
    files.set(to, Buffer.from(result.source))
  }
  return { files, rewritten }
}
