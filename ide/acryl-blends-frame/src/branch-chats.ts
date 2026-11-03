/**
 * Which branch each chat was opened on, kept in the app's ACRYL home (`<home>/frame/branch-chats.json`), keyed by the app's folder. The frame
 * reads it to list each branch's own chats; without it every chat would look like the checked-out branch's. Writes are serialized and atomic, so a
 * frame and its page never read half a file.
 */

import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** The file in the app's ACRYL home (from the `appInstance` service: this package never looks up a home itself). */
export function branchChatsFile(appHome: string): string {
  return join(appHome, 'frame', 'branch-chats.json')
}

/** A chat id to its branch, by the app folder the frame serves. */
type Roots = Record<string, Record<string, string>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** The file's words, keeping only what is a map of chat id to a branch name; anything else reads as nothing recorded. */
export function parseBranchChatsFile(text: string): Roots {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return {}
  }
  if (!isRecord(value) || !isRecord(value.roots)) return {}
  const roots: Roots = {}
  for (const [root, chats] of Object.entries(value.roots)) {
    if (!isRecord(chats)) continue
    const kept: Record<string, string> = {}
    for (const [id, branch] of Object.entries(chats)) {
      if (typeof branch === 'string' && branch !== '') kept[id] = branch
    }
    roots[root] = kept
  }
  return roots
}

export interface BranchChatsStore {
  /** The chats recorded for an app folder; empty when none were or the file is unreadable. @throws when the file cannot be read for another reason. */
  read(root: string): Promise<Record<string, string>>
  /** Record a chat's branch; an existing record is kept (a chat stays where it was opened). */
  assign(root: string, id: string, branch: string): Promise<void>
}

export function createBranchChatsStore(path: string): BranchChatsStore {
  // One file: reads and read-modify-writes take turns, so a write never erases another's entry.
  let tail: Promise<unknown> = Promise.resolve()
  const exclusive = <T>(work: () => Promise<T>): Promise<T> => {
    const run = tail.then(work, work)
    tail = run.catch(() => {})
    return run
  }
  const load = async (): Promise<Roots> => {
    try {
      return parseBranchChatsFile(await readFile(path, 'utf8'))
    } catch (cause) {
      if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'ENOENT') return {}
      throw cause
    }
  }
  const save = async (roots: Roots): Promise<void> => {
    await mkdir(dirname(path), { recursive: true })
    const temp = `${path}.${randomBytes(6).toString('hex')}.tmp`
    await writeFile(temp, `${JSON.stringify({ roots })}\n`, { encoding: 'utf8', mode: 0o600 })
    await rename(temp, path)
  }
  return {
    read(root) {
      return exclusive(async () => ({ ...(await load())[root] }))
    },
    assign(root, id, branch) {
      return exclusive(async () => {
        const roots = await load()
        const chats = roots[root] ?? {}
        if (chats[id] !== undefined) return
        await save({ ...roots, [root]: { ...chats, [id]: branch } })
      })
    },
  }
}
