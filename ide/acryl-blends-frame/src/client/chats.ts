/**
 * The chats as the frame lists them: DSH's sessions, newest list order, the one DSH's main view retains marked current. Opening one asks DSH's own
 * navigation (`uiWorkspace`) when it is composed, so DSH stays the one owner of which session is shown (the reason is in acryl-workspace's
 * `sessions/main-session.ts`); without it, the frame holds the main-view reference itself.
 */

import type { ISessions, SessionListState, SessionReference } from '@acryl/ui/frame'
import { FRAME_REAL_CHATS_PATH, parseRealChats, type RealChatView } from '../contract.ts'
import type { BlankChatApi } from './blank-chat.ts'
import type { ChatRow, ChatsPort } from './LeftPanel.tsx'

type SessionId = Parameters<ISessions['retain']>[0]
/** The options DSH's session creation takes (the workspace it belongs to is one of them). */
type SessionCreateOptions = NonNullable<Parameters<ISessions['create']>[0]>
type WorkspaceId = NonNullable<SessionCreateOptions['workspaceId']>

export interface MainViewNavigation {
  openSession(target: SessionId): void
}

/** The share of DSH's `workspaces` service used here: register a folder as a workspace, so a chat made in it is bound to it. */
export interface WorkspaceRegistration {
  create(input: { readonly path: string }): Promise<{ readonly workspaceId: WorkspaceId }>
}

/** A chat's name: its own title once it has one, else "New chat" (DSH's display title falls back to the project folder's name, which names no chat). */
/** What a chat with no title of its own is called. */
export const NEW_CHAT = 'New chat'

export function chatTitle(row: { readonly title?: string | null }): string {
  const title = row.title?.trim()
  return title === undefined || title === '' ? NEW_CHAT : title
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
export function visibleChats(rows: readonly ChatRow[], real: ReadonlyMap<string, string>, running: ReadonlySet<string> = new Set()): ChatRow[] {
  return rows
    .filter(row => row.current || real.has(row.id) || running.has(row.id))
    // A chat DSH has not loaded has no title in its list; the Host read one from the log. A title the list has is DSH's own and wins.
    .map((row) => {
      const named = real.get(row.id)
      return row.title === NEW_CHAT && named !== undefined && named !== '' ? { ...row, title: named } : row
    })
}

export interface RealChatsApi {
  read(): Promise<readonly RealChatView[]>
}

export function createRealChatsApi(fetcher: (input: string, init?: RequestInit) => Promise<Response> = (input, init) => fetch(input, init)): RealChatsApi {
  return {
    async read() {
      const response = await fetcher(FRAME_REAL_CHATS_PATH, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`the chats could not be read (HTTP ${String(response.status)})`)
      return parseRealChats(await response.json()).chats
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
  private real: ReadonlyMap<string, string> = new Map()
  /** The chats already offered to the Host as the branch's blank one (once each). */
  private readonly offered = new Set<string>()
  private running: ReadonlySet<string> = new Set()
  private reading = false
  private again = false

  constructor(
    private readonly navigation: () => MainViewNavigation | undefined,
    private readonly workspaceFor: () => WorkspaceRegistration | undefined = () => undefined,
    private readonly realChats: RealChatsApi = { read: async () => [] },
    private readonly blank: BlankChatApi = { read: async () => undefined, record: async () => false },
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
    void this.openBlank()
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

  /**
   * On a load, show the blank chat the Host handed out for this branch instead of the session DSH would create. A chat already open (DSH was
   * quicker, or the person's saved one) is left alone, and a refused open leaves DSH's own choice.
   */
  private async openBlank(): Promise<void> {
    try {
      const id = await this.blank.read()
      if (id === undefined || this.sessions === undefined || this.all.some(row => row.current)) return
      this.open(id)
    } catch {
      // DSH opens its own chat; the next load asks again.
    }
  }

  /** The open chat has no turn: offer it to the Host as the branch's blank chat, so the next load finds it. */
  private offerCurrent(): void {
    const current = this.all.find(row => row.current)
    if (current === undefined || this.real.has(current.id) || this.running.has(current.id) || this.offered.has(current.id)) return
    this.offered.add(current.id)
    void this.blank.record(current.id).catch(() => { this.offered.delete(current.id) })
  }

  /**
   * A new chat for the folder and the one the main view shows: the branch's blank chat when the Host has one (a branch has at most one), else a
   * session DSH creates on the Host. Undefined without the sessions service.
   */
  async create(cwd: string): Promise<string | undefined> {
    const sessions = this.sessions
    if (sessions === undefined) return undefined
    const known = await this.blank.read().catch(() => undefined)
    if (known !== undefined) {
      this.open(known)
      return known
    }
    // A DSH chat works in a workspace: register the app's folder first (DSH resolves an existing registration), so the new session is bound to
    // it instead of opening onto a workspace chooser. Without the workspace service the session is still made, unbound.
    const workspaces = this.workspaceFor()
    const workspace = workspaces === undefined ? undefined : await workspaces.create({ path: cwd }).catch(() => undefined)
    const id = await sessions.create({ cwd, ...(workspace === undefined ? {} : { workspaceId: workspace.workspaceId }) })
    this.offered.add(id)
    void this.blank.record(id).catch(() => {})
    this.open(id)
    return id
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
          this.real = new Map((await this.realChats.read()).map(chat => [chat.id, chat.title]))
          this.publishVisible()
          this.offerCurrent()
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
