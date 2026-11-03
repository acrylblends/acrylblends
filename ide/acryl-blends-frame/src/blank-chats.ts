/**
 * The blank chat the Host last handed out, per app folder and branch, kept in the frame's home (`<home>/frame/blank-chats.json`) like
 * `branch-chats.json`. A frame load reuses it while it still has no turn, instead of letting DSH create a session every time. Writes are serialized
 * and atomic.
 */

import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export function blankChatsFile(appHome: string): string {
  return join(appHome, 'frame', 'blank-chats.json')
}

/** App folder, then branch, to a chat id. */
type Roots = Record<string, Record<string, string>>

export function parseBlankChatsFile(text: string): Roots {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return {}
  }
  const roots: Roots = {}
  const raw = value !== null && typeof value === 'object' ? (value as { roots?: unknown }).roots : undefined
  if (raw === null || typeof raw !== 'object') return roots
  for (const [root, branches] of Object.entries(raw)) {
    if (branches === null || typeof branches !== 'object') continue
    roots[root] = Object.fromEntries(Object.entries(branches).filter(([, id]) => typeof id === 'string' && id !== '')) as Record<string, string>
  }
  return roots
}

export interface BlankChatsStore {
  read(root: string, branch: string): Promise<string | undefined>
  record(root: string, branch: string, id: string): Promise<void>
}

export function createBlankChatsStore(path: string): BlankChatsStore {
  let tail: Promise<unknown> = Promise.resolve()
  const exclusive = <T>(work: () => Promise<T>): Promise<T> => {
    const run = tail.then(work, work)
    tail = run.catch(() => {})
    return run
  }
  const load = async (): Promise<Roots> => {
    try {
      return parseBlankChatsFile(await readFile(path, 'utf8'))
    } catch (cause) {
      if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'ENOENT') return {}
      throw cause
    }
  }
  return {
    read: (root, branch) => exclusive(async () => (await load())[root]?.[branch]),
    record: (root, branch, id) => exclusive(async () => {
      const roots = await load()
      if (roots[root]?.[branch] === id) return
      await mkdir(dirname(path), { recursive: true })
      const temp = `${path}.${randomBytes(6).toString('hex')}.tmp`
      await writeFile(temp, `${JSON.stringify({ roots: { ...roots, [root]: { ...roots[root], [branch]: id } } })}\n`, { encoding: 'utf8', mode: 0o600 })
      await rename(temp, path)
    }),
  }
}
