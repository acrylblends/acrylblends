#!/usr/bin/env node
// Vendor ACRYL's framework into this repository (spec 015). ACRYL is the source of truth: a needed change goes upstream first, then is synced here.
//
//   node scripts/sync-framework.mjs <path to an ACRYL checkout> [--dry-run]
//
// For each plugin it copies src/ and tests/ (and a LICENSE or NOTICE when upstream has one) verbatim, rewriting only the specifiers that name another
// vendored plugin, and records the commit and a digest of what it wrote in plugins/<name>/upstream.json. It also copies docs/framework/ verbatim into
// docs/framework/. Never edit a vendored file here.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DOCS_DIR,
  digestOf,
  NOTICE_FILES,
  PLUGINS,
  readUpstream,
  readUpstreamDocs,
  SOURCE_REPO,
  VENDORED_DIRS,
} from './lib/framework.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const checkout = args.find((arg) => !arg.startsWith('--'))
if (!checkout) {
  console.error('usage: node scripts/sync-framework.mjs <path to an ACRYL checkout> [--dry-run]')
  process.exit(2)
}
const git = (...gitArgs) =>
  execFileSync('git', ['-C', resolve(checkout), ...gitArgs], { encoding: 'utf8' }).trim()

const commit = git('rev-parse', 'HEAD')
const dirty = git(
  'status',
  '--porcelain',
  '--',
  ...Object.keys(PLUGINS).map((name) => `plugins/${name}`),
  DOCS_DIR,
)
if (dirty !== '') {
  console.error(
    `sync-framework: the checkout has uncommitted changes in the framework, so the commit ${commit.slice(0, 8)} would not reproduce them:\n${dirty}`,
  )
  process.exit(1)
}

for (const [name, config] of Object.entries(PLUGINS)) {
  const target = join(root, 'plugins', name)
  if (!existsSync(join(target, 'plugin.json'))) {
    console.error(
      `sync-framework: plugins/${name}/plugin.json is missing (it is ours: the library entry). Create it first.`,
    )
    process.exit(1)
  }
  const { files, rewritten, notice } = readUpstream(resolve(checkout), name)
  const upstream = {
    source: { repo: SOURCE_REPO, path: `plugins/${name}`, commit },
    vendored: [...VENDORED_DIRS, ...(notice ? [notice] : [])],
    rewrittenSpecifiers: rewritten,
    digest: digestOf(files),
    testsNotRun: config.testsNotRun,
    notice,
  }
  if (!dryRun) {
    for (const dir of VENDORED_DIRS) rmSync(join(target, dir), { recursive: true, force: true })
    for (const file of NOTICE_FILES) rmSync(join(target, file), { force: true })
    for (const [path, bytes] of files) {
      mkdirSync(dirname(join(target, path)), { recursive: true })
      writeFileSync(join(target, path), bytes)
    }
    writeFileSync(join(target, 'upstream.json'), `${JSON.stringify(upstream, null, 2)}\n`)
  }
  console.log(
    `${name}: ${files.size} files, ${rewritten} specifiers rewritten, ${upstream.digest.slice(0, 19)}${notice ? '' : ' (no upstream notice file)'}`,
  )
}

const docs = readUpstreamDocs(resolve(checkout))
const docsRecord = {
  source: { repo: SOURCE_REPO, path: DOCS_DIR, commit },
  files: docs.size,
  digest: digestOf(docs),
}
if (!dryRun) {
  const docsTarget = join(root, DOCS_DIR)
  rmSync(docsTarget, { recursive: true, force: true })
  for (const [path, bytes] of docs) {
    mkdirSync(dirname(join(docsTarget, path)), { recursive: true })
    writeFileSync(join(docsTarget, path), bytes)
  }
  writeFileSync(join(docsTarget, 'upstream.json'), `${JSON.stringify(docsRecord, null, 2)}\n`)
  writeFileSync(
    join(docsTarget, 'UPSTREAM.md'),
    `# Generated copy\n\nThis folder is a copy of \`${DOCS_DIR}\` of ${SOURCE_REPO} at commit \`${commit}\`, made by \`scripts/sync-framework.mjs\`. Do not edit it here: change the text in ACRYL and sync again. \`pnpm run verify:framework\` fails when a page differs from the recorded digest.\n`,
  )
}
console.log(`${DOCS_DIR}: ${docs.size} files, ${docsRecord.digest.slice(0, 19)}`)
console.log(
  dryRun
    ? `dry run only, commit ${commit.slice(0, 8)}`
    : `synced from ${SOURCE_REPO} ${commit.slice(0, 8)}`,
)
