/**
 * `npm run lock`: write `acrylblends.lock.json` next to the manifest, recording what the app is built from: the manifest's digest, its
 * resolved rows and parameter values, and a content digest of every plugin folder in `src/plugins/`. Commit it; a diff of the lock is a
 * review of what changed.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { digestFolder } from '../digest/index.ts'
import { blueprintsIn, type Lock, loadManifest, lock, parentIdOf } from './index.ts'

export const LOCK_FILE = 'acrylblends.lock.json'

export function writeLock(appRoot: string): Lock {
  const getBlueprint = blueprintsIn(join(appRoot, 'blueprints'))
  const manifest = loadManifest(join(appRoot, 'blend.yaml'), { getBlueprint })
  const pluginsDir = join(appRoot, 'src', 'plugins')
  const sources: Record<string, string> = {}
  if (existsSync(pluginsDir)) {
    for (const entry of readdirSync(pluginsDir, { withFileTypes: true })) {
      if (entry.isDirectory())
        sources[entry.name] = `sha256:${digestFolder(join(pluginsDir, entry.name))}`
    }
  }
  // A Blend records the Blueprint file it was resolved over, so an upgrade shows up as a lock diff.
  const parent = parentIdOf(manifest)
  const blueprintFile = parent === undefined ? undefined : getBlueprint(parent)
  const blueprintDigest = blueprintFile
    ? `sha256:${createHash('sha256').update(readFileSync(blueprintFile)).digest('hex')}`
    : undefined
  const locked = lock(manifest, sources, blueprintDigest)
  writeFileSync(join(appRoot, LOCK_FILE), `${JSON.stringify(locked, null, 2)}\n`)
  return locked
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const appRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
  const locked = writeLock(appRoot)
  console.log(
    `wrote ${LOCK_FILE}: ${locked.plugins.length} rows, ${Object.keys(locked.sources).length} plugin sources`,
  )
}
