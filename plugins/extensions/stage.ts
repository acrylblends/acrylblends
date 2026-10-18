/**
 * Staging: every installed version of an extension is a complete copy under `<home>/extensions-staged/<name>/<stamp>-<hash>/`.
 *
 * Extracted from ACRYL (`acryl-extension-context/lib/stage.js`). Node caches an ES module by URL, so a re-imported file keeps its old
 * code; a copy at a new path has fresh URLs for the entry and everything it imports, so it is evaluated anew. The author's source folder
 * is never modified. The hash makes an unchanged source recognisable; the stamp makes "newest" well defined.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'
import { digestFolder, FOLDER_DIGEST_SKIPPED } from '@webboxes/blends-core'

/** A short content digest of a folder, so an unchanged source keeps its version. */
export const hashFolder = (dir: string, length = 12): string => digestFolder(dir, length)

/** Copy `source` into a new version folder under `stageRoot/<name>/` and return its path and version. */
export function stage(
  source: string,
  stageRoot: string,
  name: string,
): { dir: string; version: string } {
  const version = hashFolder(source)
  const stamp = String(Date.now()).padStart(15, '0')
  const dir = join(stageRoot, name, `${stamp}-${version}`)
  mkdirSync(dir, { recursive: true })
  cpSync(source, dir, {
    recursive: true,
    filter: (path) => !FOLDER_DIGEST_SKIPPED.has(basename(path)),
  })
  return { dir, version }
}

/** Delete staged versions of `name` except the ones to keep (best effort). Modules already loaded stay in memory until the app restarts. */
export function prune(stageRoot: string, name: string, keep: readonly string[]): void {
  const folder = join(stageRoot, name)
  if (!existsSync(folder)) return
  if (keep.length === 0) {
    rmSync(folder, { recursive: true, force: true })
    return
  }
  for (const entry of readdirSync(folder)) {
    const path = join(folder, entry)
    if (!keep.includes(path)) rmSync(path, { recursive: true, force: true })
  }
}
