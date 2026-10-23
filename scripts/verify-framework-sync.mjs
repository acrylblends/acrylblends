#!/usr/bin/env node
// Fail when a vendored framework file was edited here, or (with --against) when ACRYL moved on (spec 015).
//
//   node scripts/verify-framework-sync.mjs                              the files match the digest recorded in upstream.json
//   node scripts/verify-framework-sync.mjs --against <ACRYL checkout>   and they still equal what that checkout produces at its HEAD
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DOCS_DIR,
  digestOf,
  listFiles,
  NOTICE_FILES,
  PLUGINS,
  readJson,
  readTemplateSources,
  readUpstream,
  readUpstreamDocs,
  readVendoredDocs,
  TEMPLATE_SOURCES,
  VENDORED_DIRS,
} from './lib/framework.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const againstAt = args.indexOf('--against')
const against = againstAt >= 0 ? args[againstAt + 1] : undefined
const problems = []
const notes = []

for (const name of Object.keys(PLUGINS)) {
  const target = join(root, 'plugins', name)
  const recordFile = join(target, 'upstream.json')
  if (!existsSync(recordFile)) {
    problems.push(
      `${name}: plugins/${name}/upstream.json is missing; run scripts/sync-framework.mjs`,
    )
    continue
  }
  const record = readJson(recordFile)
  const files = new Map()
  for (const dir of VENDORED_DIRS)
    for (const file of listFiles(join(target, dir)))
      files.set(`${dir}/${file}`, readFileSync(join(target, dir, file)))
  for (const notice of NOTICE_FILES)
    if (existsSync(join(target, notice))) files.set(notice, readFileSync(join(target, notice)))
  const actual = digestOf(files)
  if (actual !== record.digest) {
    problems.push(
      `${name}: the vendored files differ from the recorded digest (${record.digest.slice(0, 19)} recorded, ${actual.slice(0, 19)} found). Someone edited a copy: make the change in ACRYL (${record.source.repo}, ${record.source.path}) and run scripts/sync-framework.mjs again.`,
    )
  }
  if (record.notice === null)
    notes.push(
      `${name}: upstream has no LICENSE or NOTICE file yet (the framework rewrites Hono's design, whose MIT notice must travel with it)`,
    )
  if (against !== undefined) {
    const upstream = readUpstream(resolve(against), name)
    const expected = digestOf(upstream.files)
    if (expected !== record.digest)
      problems.push(
        `${name}: the ACRYL checkout at ${against} produces ${expected.slice(0, 19)}, not the recorded ${record.digest.slice(0, 19)}: ACRYL moved on or this copy is stale; run scripts/sync-framework.mjs`,
      )
  }
}

for (const [template, config] of Object.entries(TEMPLATE_SOURCES)) {
  const recordFile = join(root, config.dir, 'upstream.json')
  if (!existsSync(recordFile)) {
    problems.push(`${config.dir}/upstream.json is missing; run scripts/sync-framework.mjs`)
    continue
  }
  const record = readJson(recordFile)
  const files = new Map(
    Object.values(config.files).map((path) => [path, readFileSync(join(root, config.dir, path))]),
  )
  if (digestOf(files) !== record.digest)
    problems.push(
      `template ${template}: a synced file differs from the recorded digest. Change it in ACRYL and run scripts/sync-framework.mjs again.`,
    )
  if (
    against !== undefined &&
    digestOf(readTemplateSources(resolve(against), template).files) !== record.digest
  )
    problems.push(
      `template ${template}: the ACRYL checkout at ${against} differs from the recorded digest; run scripts/sync-framework.mjs`,
    )
}

const docsRecordFile = join(root, DOCS_DIR, 'upstream.json')
if (!existsSync(docsRecordFile))
  problems.push(`${DOCS_DIR}/upstream.json is missing; run scripts/sync-framework.mjs`)
else {
  const record = readJson(docsRecordFile)
  const actual = digestOf(readVendoredDocs(root))
  if (actual !== record.digest)
    problems.push(
      `${DOCS_DIR}: a page differs from the recorded digest (${record.digest.slice(0, 19)} recorded, ${actual.slice(0, 19)} found). Change the text in ACRYL and run scripts/sync-framework.mjs again.`,
    )
  if (against !== undefined && digestOf(readUpstreamDocs(resolve(against))) !== record.digest)
    problems.push(
      `${DOCS_DIR}: the ACRYL checkout at ${against} has different docs than the recorded digest; run scripts/sync-framework.mjs`,
    )
}

for (const note of notes) console.warn(`note: ${note}`)
if (problems.length > 0) {
  for (const problem of problems) console.error(`verify-framework-sync: ${problem}`)
  process.exit(1)
}
console.log(
  `verify-framework-sync: ${Object.keys(PLUGINS).length} plugins and docs/framework match their recorded digests${against ? ' and the ACRYL checkout' : ''}`,
)
