/**
 * Which branch each chat was opened on, as the Host remembers it, and the frame's copy of that map. DSH knows no branches: a chat the frame has
 * not recorded yet is put on the checked-out branch when it is first seen, once, and stays there when the folder moves.
 */

import { FRAME_BRANCH_CHATS_PATH, parseBranchChats } from '../contract.ts'

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface BranchChatsApi {
  /** The recorded map. @throws when the Host does not answer it. */
  read(): Promise<Record<string, string>>
  /** Record a chat's branch. @throws when the Host refuses it (the caller tries again later). */
  assign(id: string, branch: string): Promise<void>
}

export function createBranchChatsApi(fetcher: FetchLike = (input, init) => fetch(input, init)): BranchChatsApi {
  return {
    async read() {
      const response = await fetcher(FRAME_BRANCH_CHATS_PATH, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`The branch chats could not be read (HTTP ${String(response.status)}).`)
      return parseBranchChats(await response.json())
    },
    async assign(id, branch) {
      const response = await fetcher(FRAME_BRANCH_CHATS_PATH, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id, branch }),
      })
      if (!response.ok) throw new Error(`The chat could not be recorded (HTTP ${String(response.status)}).`)
    },
  }
}

/** The map as the panels read it: a chat id to the branch it was opened on. */
export interface BranchChatsPort {
  getSnapshot(): Readonly<Record<string, string>>
  subscribe(listener: () => void): () => void
}

export class BranchChatsStore implements BranchChatsPort {
  private chats: Readonly<Record<string, string>> = Object.freeze({})
  private readonly pending = new Set<string>()
  private readonly listeners = new Set<() => void>()

  constructor(private readonly api: BranchChatsApi) {}

  getSnapshot(): Readonly<Record<string, string>> {
    return this.chats
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Read what the Host remembers; a failed read keeps the map the frame has and leaves new chats assignable. */
  async load(): Promise<void> {
    try {
      const recorded = await this.api.read()
      this.publish({ ...this.chats, ...recorded })
    } catch {
      // The Host answers again on the next page; until then a new chat is still put on its branch here.
    }
  }

  /**
   * Put every chat that is not recorded yet on `branch`, the checked-out one when it was first seen. The map shows the assignment at once (the
   * panel lists the chat under its branch while the Host write runs); a refused write is dropped so the next look tries again.
   */
  adopt(ids: readonly string[], branch: string): void {
    for (const id of ids) {
      if (this.chats[id] !== undefined || this.pending.has(id)) continue
      this.pending.add(id)
      this.publish({ ...this.chats, [id]: branch })
      void this.api.assign(id, branch).then(
        () => { this.pending.delete(id) },
        () => {
          this.pending.delete(id)
          if (this.chats[id] !== branch) return
          const next = { ...this.chats }
          delete next[id]
          this.publish(next)
        },
      )
    }
  }

  private publish(next: Readonly<Record<string, string>>): void {
    this.chats = Object.freeze(next)
    for (const listener of [...this.listeners]) listener()
  }
}

/**
 * Chat history as the History list shows it (mockup scenario 5): one group per branch, the checked-out branch first and the others by name,
 * each keeping the rows' own order; a chat no branch was recorded for yet comes last, under no name.
 */
export function historyGroups<Row extends { readonly id: string }>(
  rows: readonly Row[],
  assignments: Readonly<Record<string, string>>,
  checkedOut: string | undefined,
): { readonly branch: string | undefined; readonly rows: readonly Row[] }[] {
  const groups = new Map<string | undefined, Row[]>()
  for (const row of rows) {
    const branch = assignments[row.id]
    const group = groups.get(branch)
    if (group === undefined) groups.set(branch, [row])
    else group.push(row)
  }
  const rank = (branch: string | undefined): number => (branch === checkedOut ? 0 : branch === undefined ? 2 : 1)
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || (a ?? '').localeCompare(b ?? ''))
    .map(([branch, grouped]) => ({ branch, rows: grouped }))
}
