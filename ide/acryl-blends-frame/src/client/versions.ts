/** The versions the left panel lists, through `acryl-versions`: the calls it makes and how a version is numbered. */

import type { VersionsEntry, VersionsLogView } from 'acryl-versions'

export interface VersionsPort {
  log(path: string): Promise<VersionsLogView>
  save(path: string, message: string): Promise<unknown>
}

/** "v7" for the newest of seven versions: the number counts from the first. */
export function versionNumber(entries: readonly VersionsEntry[], index: number): number {
  return entries.length - index
}

/** "saved" when nothing changed since the last version, else how many files did; nothing outside a repository. */
export function savedLabel(unsaved: number | undefined): string | undefined {
  if (unsaved === undefined) return undefined
  return unsaved === 0 ? 'saved' : `${String(unsaved)} unsaved`
}
