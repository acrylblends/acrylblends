#!/usr/bin/env node
// Builds the legacy layout fixtures `acrylblends upgrade` recognises: for every published acrylblends release that shipped templates, the scaffold files of
// each template, deduplicated by content hash, written verbatim under packages/cli/legacy/ plus a layouts.json index.
//
//   node scripts/build-legacy-layouts.mjs            (write the fixtures and the index)
//   node scripts/build-legacy-layouts.mjs --check    (compare with what the tags produce; write nothing)
//
// The releases are the git tags `v*` whose packages/cli/package.json version is published on npm; the templates and the files the frame layout replaces are
// derived from the current templates (the module src/frame.ts imports, its routes; src/app.ts when it exports composeInto), never from a hand list.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const templatesRoot = join(root, 'packages', 'cli', 'templates')
const legacyRoot = join(root, 'packages', 'cli', 'legacy')
const check = process.argv.includes('--check')
const log = (message) => console.log(`build-legacy-layouts: ${message}`)
const fail = (message) => {
  throw new Error(`build-legacy-layouts: ${message}`)
}

/** Every template the current scaffolder has. */
const templates = readdirSync(templatesRoot)
  .filter((name) => existsSync(join(templatesRoot, name, 'template.json')))
  .sort()

/**
 * The files the frame layout brings up to date for a template, as of the current templates: the route module `src/frame.ts` imports (or `src/routes.ts` for
 * a template without a frame row), plus `src/app.ts` when it exports `composeInto` (the composition root the app-plugins row calls).
 */
function scaffoldFiles(template) {
  const dir = join(templatesRoot, template, 'src')
  const frame = existsSync(join(dir, 'frame.ts')) ? readFileSync(join(dir, 'frame.ts'), 'utf8') : ''
  const route =
    [...frame.matchAll(/from '\.\/([^']+\.ts)'/gu)]
      .map((match) => `src/${match[1]}`)
      .find((file) => file !== 'src/app.ts' && existsSync(join(templatesRoot, template, file))) ??
    (existsSync(join(dir, 'routes.ts')) ? 'src/routes.ts' : undefined)
  if (route === undefined) fail(`the ${template} template has no route module`)
  const app = join(dir, 'app.ts')
  const files = [route]
  if (existsSync(app) && readFileSync(app, 'utf8').includes('export async function composeInto'))
    files.push('src/app.ts')
  return files.sort()
}

/** The published versions of the CLI: the tags are release commits, and a tag that never reached npm cannot have made an app in someone's hands. */
function publishedVersions() {
  return new Set(
    JSON.parse(
      execFileSync('npm', ['view', 'acrylblends', 'versions', '--json'], { encoding: 'utf8' }),
    ),
  )
}

/** Every release with templates: version, and for each template the scaffold file contents (or undefined when that release had no such template). */
function releases() {
  const published = publishedVersions()
  const tags = execFileSync('git', ['tag', '--list', 'v*'], { cwd: root, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean)
  const out = []
  for (const tag of tags) {
    const version = tag.slice(1)
    if (!published.has(version)) continue
    let manifest
    try {
      manifest = execFileSync('git', ['show', `${tag}:packages/cli/package.json`], {
        cwd: root,
        encoding: 'utf8',
      })
    } catch {
      continue // A tag from before the CLI package existed (the desktop releases).
    }
    if (JSON.parse(manifest).version !== version) fail(`${tag} carries a different version`)
    const layouts = {}
    for (const template of templates) {
      const files = {}
      let complete = true
      for (const file of scaffoldFiles(template)) {
        try {
          files[file] = execFileSync(
            'git',
            ['show', `${tag}:packages/cli/templates/${template}/${file}`],
            {
              cwd: root,
              encoding: 'utf8',
            },
          )
        } catch {
          complete = false
          break
        }
      }
      if (complete) layouts[template] = files
    }
    if (Object.keys(layouts).length > 0) out.push({ version, layouts })
  }
  return out
}

/** A layout's identity: the files and their bytes, so two releases that shipped the same scaffold share one fixture. */
function layoutHash(files) {
  const hash = createHash('sha256')
  for (const file of Object.keys(files).sort()) hash.update(`${file}\0${files[file]}\0`)
  return hash.digest('hex').slice(0, 12)
}

/** Semver order, so the index reads like the release history. */
function compareVersions(a, b) {
  const pa = a.split(/[.-]/u).map((part) => (Number.isNaN(Number(part)) ? part : Number(part)))
  const pb = b.split(/[.-]/u).map((part) => (Number.isNaN(Number(part)) ? part : Number(part)))
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x < y) return -1
    if (x > y) return 1
  }
  return 0
}

const all = releases().sort((a, b) => compareVersions(a.version, b.version))
if (all.length === 0) fail('no published release with templates was found')
const index = { generatedBy: 'scripts/build-legacy-layouts.mjs', releases: [], templates: {} }
for (const template of templates) index.templates[template] = {}
/** Every fixture's bytes, keyed by its path inside `legacy/`: the same map the writer writes and the checker compares. */
const fixtures = new Map()
for (const release of all) {
  const layouts = {}
  for (const [template, files] of Object.entries(release.layouts)) {
    const hash = layoutHash(files)
    layouts[template] = hash
    const paths = Object.keys(files).sort()
    const known = index.templates[template][hash]
    if (known !== undefined && JSON.stringify(known) !== JSON.stringify(paths))
      fail(`${template} ${hash} has two file lists`)
    index.templates[template][hash] = paths
    for (const file of paths) fixtures.set(`${template}/${hash}/${file}`, files[file])
  }
  index.releases.push({ version: release.version, layouts })
}
const indexText = `${JSON.stringify(index, null, 2)}\n`
if (check) {
  const problems = []
  const onDisk = new Map()
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) walk(path)
      else onDisk.set(relative(legacyRoot, path).split(sep).join('/'), readFileSync(path, 'utf8'))
    }
  }
  if (existsSync(legacyRoot)) walk(legacyRoot)
  onDisk.delete('layouts.json')
  for (const [file, text] of onDisk)
    if (!fixtures.has(file)) problems.push(`unexpected file ${file}`)
    else if (fixtures.get(file) !== text) problems.push(`different bytes ${file}`)
  for (const file of fixtures.keys()) if (!onDisk.has(file)) problems.push(`missing file ${file}`)
  if (!existsSync(join(legacyRoot, 'layouts.json'))) problems.push('layouts.json is missing')
  else if (readFileSync(join(legacyRoot, 'layouts.json'), 'utf8') !== indexText)
    problems.push('layouts.json is stale')
  if (problems.length > 0) {
    for (const problem of problems) console.error(`build-legacy-layouts: ${problem}`)
    process.exit(1)
  }
  log(
    `the fixtures match every published release (${String(all.length)} releases, ${String(Object.keys(fixtures).length)} files)`,
  )
} else {
  rmSync(legacyRoot, { recursive: true, force: true })
  for (const [file, text] of fixtures) {
    const target = join(legacyRoot, file)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, text)
  }
  writeFileSync(join(legacyRoot, 'layouts.json'), indexText)
  log(
    `wrote ${String(all.length)} releases and ${String(new Set(Object.values(index.templates).flatMap(Object.keys)).size)} distinct layouts from ${join('packages', 'cli', 'legacy')}`,
  )
}
