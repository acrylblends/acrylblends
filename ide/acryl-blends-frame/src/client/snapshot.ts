/**
 * The left panel's Capture: the app's snapshot verb `capture` on the frame's Host, and the one line it reads as.
 */

import { FRAME_SNAPSHOT_CAPTURE_PATH, parseSnapshotCapture, type SnapshotCapture } from '../contract.ts'

export interface SnapshotPort {
  /** @throws the Host's one line (an app made before the snapshot verbs, a `blend.yaml` that does not parse). */
  capture(): Promise<SnapshotCapture>
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

async function failure(response: Response, fallback: string): Promise<Error> {
  const body = (await response.json().catch(() => ({}))) as { error?: unknown }
  return new Error(typeof body.error === 'string' && body.error !== '' ? body.error : `${fallback} (HTTP ${String(response.status)})`)
}

export function createSnapshotApi(fetcher: FetchLike = (input, init) => fetch(input, init)): SnapshotPort {
  return {
    async capture() {
      const response = await fetcher(FRAME_SNAPSHOT_CAPTURE_PATH, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: '{}',
      })
      if (!response.ok) throw await failure(response, 'The app could not be captured')
      return parseSnapshotCapture(await response.json())
    },
  }
}

/** "Captured: notes got a row; 4 plugins locked." or "Captured: every plugin already had a row; 3 plugins locked." */
export function captureText(result: SnapshotCapture): string {
  const plugins = `${String(result.modules)} plugin${result.modules === 1 ? '' : 's'} locked`
  if (result.addedRows.length === 0) return `Captured: every plugin already had a row; ${plugins}.`
  const names = result.addedRows.join(', ')
  return `Captured: ${names} ${result.addedRows.length === 1 ? 'got a row' : 'got rows'}; ${plugins}.`
}
