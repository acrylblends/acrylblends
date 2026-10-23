// Shared by sync-framework.mjs and verify-framework-sync.mjs: how ACRYL's framework plugins are vendored into this repository (spec 015).
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'

export const SOURCE_REPO = 'acryldev/acryl'

/** The framework plugins (acryl-router-http is not among them: it needs the DSH web server, which acryl-node-server replaces). `entries` maps each importable subpath to the upstream file it resolves to. */
export const PLUGINS = {
  'acryl-router': {
    entries: {
      '': 'src/index.ts',
      '/middleware': 'src/middleware/index.ts',
      '/helpers': 'src/helpers/index.ts',
    },
    testsNotRun: {
      'tests/loader.spec.ts':
        'loads the built lib/ entry through the real Loader; the library ships source and has no build',
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
function resolveSpecifier(specifier, fromFile) {
  for (const [plugin, { entries }] of Object.entries(PLUGINS)) {
    for (const [subpath, upstreamFile] of Object.entries(entries)) {
      if (specifier !== `${plugin}${subpath}`) continue
      const target = `${plugin}/${upstreamFile}`
      let path = relative(dirname(fromFile), target).split(sep).join('/')
      if (!path.startsWith('.')) path = `./${path}`
      return path
    }
  }
  return undefined
}

const SPECIFIER =
  /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(['"])(acryl-[A-Za-z0-9-]+(?:\/[A-Za-z0-9./-]+)?)\2/gu

/**
 * Rewrite the specifiers that name another vendored plugin to relative paths. `file` is the path of the file inside `plugins/` (for example
 * `acryl-state/src/service.ts`). Any other `acryl-*` specifier is an error: the vendored plugins may depend only on each other and on public packages.
 */
export function rewriteSpecifiers(source, file) {
  let count = 0
  const rewritten = source.replace(SPECIFIER, (_match, lead, quote, specifier) => {
    const path = resolveSpecifier(specifier, file)
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
  let notice = null
  for (const name of NOTICE_FILES) {
    if (existsSync(join(root, name))) {
      add(name)
      notice = name
      break
    }
  }
  for (const entry of Object.values(PLUGINS[plugin].entries)) {
    if (!files.has(entry))
      throw new Error(`${plugin}: the entry ${entry} is not in the vendored files`)
  }
  return { files, rewritten, notice }
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}
