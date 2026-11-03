/**
 * The chats as the frame lists them: DSH's sessions, newest list order, the one DSH's main view retains marked current. Opening one asks DSH's own
 * navigation (`uiWorkspace`) when it is composed, so DSH stays the one owner of which session is shown (the reason is in acryl-workspace's
 * `sessions/main-session.ts`); without it, the frame holds the main-view reference itself.
 */

import type { ISessions, SessionListState, SessionReference } from '@acryl/ui/frame'
import { FRAME_REAL_CHATS_PATH, parseRealChats } from '../contract.ts'
import type { ChatRow, ChatsPort } from './LeftPanel.tsx'

type SessionId = Parameters<ISessions['retain']>[0]

export interface MainViewNavigation {
  openSession(target: SessionId): void
}

/** A chat's name: its own title once it has one, else "New chat" (DSH's display title falls back to the project folder's name, which names no chat). */
export function chatTitle(row: { readonly title?: string | null }): string {
  const title = row.title?.trim()
  return title === undefined || title === '' ? 'New chat' : title
}

export function chatRows(list: SessionListState): ChatRow[] {
  return list.ids.flatMap((id) => {
    const row = list.byId[id]
    if (row === undefined) return []
    const updatedAt = (row as { readonly updatedAt?: unknown }).updatedAt
    return [{ id, title: chatTitle(row), current: (row.retainedBy.mainView ?? 0) > 0, ...(typeof updatedAt === 'number' ? { updatedAt } : {}) }]
  })
}

/**
 * The rows the left panel lists: a chat with no turn is not a chat, except the one open right now (it is where the next message goes). A chat that is
 * running is real by definition. `real` is the Host's list of chats with a turn; until it has been read, only the open chat shows.
 */
export function visibleChats(rows: readonly ChatRow[], real: ReadonlySet<string>, running: ReadonlySet<string> = new Set()): ChatRow[] {
  return rows.filter(row => row.current || real.has(row.id) || running.has(row.id))
}

export interface RealChatsApi {
  read(): Promise<readonly string[]>
}

export function createRealChatsApi(fetcher: (input: string, init?: RequestInit) => Promise<Response> = (input, init) => fetch(input, init)): RealChatsApi {
  return {
    async read() {
      const response = await fetcher(FRAME_REAL_CHATS_PATH, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`the chats could not be read (HTTP ${String(response.status)})`)
      return parseRealChats(await response.json()).sessions
    },
  }
}

const EMPTY: readonly ChatRow[] = Object.freeze([])

export class ChatsStore implements ChatsPort {
  private rows: readonly ChatRow[] = EMPTY
  private sessions: ISessions | undefined
  private held: SessionReference | undefined
  private readonly listeners = new Set<() => void>()

  private all: readonly ChatRow[] = EMPTY
  private real: ReadonlySet<string> = new Set()
  private running: ReadonlySet<string> = new Set()
  private reading = false
  private again = false

  constructor(
    private readonly navigation: () => MainViewNavigation | undefined,
    private readonly realChats: RealChatsApi = { read: async () => [] },
  ) {}

  getSnapshot(): readonly ChatRow[] {
    return this.rows
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Follow `sessions` until the returned disposer runs (the service's fiber ends). */
  watch(sessions: ISessions): () => void {
    this.sessions = sessions
    const read = () => {
      const list = sessions.list.getSnapshot()
      this.all = chatRows(list)
      this.running = new Set(list.ids.filter(id => list.byId[id]?.running === true))
      this.publishVisible()
      void this.refreshReal()
    }
    const stop = sessions.list.subscribe(read)
    read()
    return () => {
      stop()
      this.held?.release()
      this.held = undefined
      if (this.sessions === sessions) this.sessions = undefined
      this.all = EMPTY
      this.publish(EMPTY)
    }
  }

  open(id: string): void {
    const sessions = this.sessions
    if (sessions === undefined) return
    const navigation = this.navigation()
    if (navigation !== undefined) {
      navigation.openSession(id as SessionId)
      this.held?.release()
      this.held = undefined
      return
    }
    const next = sessions.retain(id as SessionId, { source: 'mainView' })
    const previous = this.held
    this.held = next
    previous?.release()
  }

  /** Ask the Host which chats have a turn; a read that comes in while one runs asks once more afterwards, and a failed read keeps what was known. */
  private async refreshReal(): Promise<void> {
    if (this.reading) {
      this.again = true
      return
    }
    this.reading = true
    try {
      do {
        this.again = false
        try {
          this.real = new Set(await this.realChats.read())
          this.publishVisible()
        } catch {
          // The rows already shown stay; the next change of the list asks again.
        }
      } while (this.again)
    } finally {
      this.reading = false
    }
  }

  private publishVisible(): void {
    const rows = visibleChats(this.all, this.real, this.running)
    if (rows.length === this.rows.length && rows.every((row, index) => row === this.rows[index] || JSON.stringify(row) === JSON.stringify(this.rows[index]))) return
    this.publish(Object.freeze(rows))
  }

  private publish(rows: readonly ChatRow[]): void {
    this.rows = rows
    for (const listener of [...this.listeners]) listener()
  }
}
