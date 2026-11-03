/**
 * The versions the left panel lists, through `acryl-versions`: the calls it makes, how a version is numbered, how its time reads, and which
 * versions are shared (also on another branch or the remote, which the frame's Host answers).
 */

import type { VersionsEntry, VersionsLogView } from 'acryl-versions'
import { FRAME_VERSIONS_SHARED_PATH, parseSharedVersions } from '../contract.ts'

export interface VersionsPort {
  log(path: string): Promise<VersionsLogView>
  save(path: string, message: string): Promise<unknown>
  /** The versions that are also on another local branch or a remote-tracking branch. */
  shared(hashes: readonly string[]): Promise<readonly string[]>
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface SharedVersionsApi {
  /** @throws when the Host does not answer the shared check. */
  shared(hashes: readonly string[]): Promise<readonly string[]>
}

export function createSharedVersionsApi(fetcher: FetchLike = (input, init) => fetch(input, init)): SharedVersionsApi {
  return {
    async shared(hashes) {
      const response = await fetcher(FRAME_VERSIONS_SHARED_PATH, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ hashes }),
      })
      if (!response.ok) throw new Error(`The shared versions could not be read (HTTP ${String(response.status)}).`)
      return parseSharedVersions(await response.json())
    },
  }
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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** The versions list's short time: "now", "2 min", "2 h", the weekday within a week ("Sun"), then days ("9 d"). */
export function shortTime(at: string, now: number = Date.now()): string {
  const time = Date.parse(at)
  if (!Number.isFinite(time)) return ''
  const seconds = Math.max(0, Math.floor((now - time) / 1000))
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${String(minutes)} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return WEEKDAYS[new Date(time).getDay()] ?? ''
  return `${String(days)} d`
}
