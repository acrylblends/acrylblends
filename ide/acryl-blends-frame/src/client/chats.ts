/**
 * The chats as the frame lists them: DSH's sessions, newest first, the one DSH's main view retains marked current. Opening one asks DSH's own
 * navigation (`uiWorkspace`) when it is composed, so DSH stays the one owner of which session is shown (the reason is in acryl-workspace's
 * `sessions/main-session.ts`); without it, the frame holds the main-view reference itself.
 *
 * Which branch a chat belongs to is the branch-chats map (`./branch-chats.ts`), the one source of truth. The rule this store keeps: the chat on
 * screen always belongs to the checked-out branch (docs/design/blends-frame-mockup.html, scenarios 2 and 5). Whatever moves the folder to another
 * branch - the left panel, the New button, the Git tab, a terminal - the chat on screen then becomes that branch's own (`decideChat`).
 */

import type { ISessions, SessionListState, SessionReference } from '@acryl/ui/frame'
import { FRAME_REAL_CHATS_PATH, parseRealChats, type RealChatView } from '../contract.ts'
import type { BranchChatsStore } from './branch-chats.ts'
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

/** What the store does to make the chat on screen the checked-out branch's. */
export type ChatDecision =
  | { readonly action: 'none' }
  /** Show this chat of the branch. */
  | { readonly action: 'open'; readonly id: string }
  /** Record this chat (the one on screen) as the branch's: it was made elsewhere and no branch is recorded for it yet. */
  | { readonly action: 'adopt'; readonly id: string }
  /** The branch has no chat to show: make one. */
  | { readonly action: 'create' }

export interface ChatsView {
  /** DSH's sessions, newest first. */
  readonly rows: readonly ChatRow[]
  /** The chats with a turn (the Host's list). */
  readonly real: ReadonlyMap<string, string>
  readonly running: ReadonlySet<string>
  /** Chat id to branch: the branch-chats map. */
  readonly assignments: Readonly<Record<string, string>>
  readonly branch: string
  /** The chat a tab of the strip asks for on this branch, shown instead of the branch's newest. */
  readonly preferred?: string | undefined
}

const byNewest = (a: ChatRow, b: ChatRow): number => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)

/**
 * The chat the checked-out branch shows: the tab's chat when it is the branch's, else its newest chat with a turn, else one of its chats still
 * blank. Undefined when the branch has none.
 */
export function branchChat(view: ChatsView, exclude: ReadonlySet<string> = new Set()): ChatRow | undefined {
  const own = view.rows.filter(row => view.assignments[row.id] === view.branch && !exclude.has(row.id)).sort(byNewest)
  const used = (row: ChatRow): boolean => view.real.has(row.id) || view.running.has(row.id)
  const wanted = view.preferred === undefined ? undefined : own.find(row => row.id === view.preferred)
  return wanted ?? own.find(used) ?? own[0]
}

/**
 * The chat on screen against the checked-out branch. One that belongs to the branch stays (unless a tab of the strip asks for another of the
 * branch's). One recorded for another branch gives way to this branch's own chat, or a new one. One no branch is recorded for is the branch's
 * own when it has a turn (it was made before anything was recorded) or when the branch has no chat yet; otherwise it is a stray blank session DSH
 * made on load, and the branch's own chat is shown instead, so a load never piles up another empty chat. Nothing on screen yet: the branch's own
 * chat if it has one, else DSH's choice.
 */
export function decideChat(view: ChatsView): ChatDecision {
  const current = view.rows.find(row => row.current)
  const own = branchChat(view)
  if (current === undefined) return own === undefined ? { action: 'none' } : { action: 'open', id: own.id }
  const recorded = view.assignments[current.id]
  if (recorded === view.branch) {
    return own !== undefined && own.id === view.preferred && own.id !== current.id ? { action: 'open', id: own.id } : { action: 'none' }
  }
  if (recorded === undefined) {
    const used = view.real.has(current.id) || view.running.has(current.id)
    return used || own === undefined ? { action: 'adopt', id: current.id } : { action: 'open', id: own.id }
  }
  return own === undefined ? { action: 'create' } : { action: 'open', id: own.id }
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

/** How long an open DSH was asked for is waited on before the frame may ask again. */
const PENDING_MS = 3000

export interface ChatsDeps {
  readonly navigation: () => MainViewNavigation | undefined
  readonly workspaceFor?: () => WorkspaceRegistration | undefined
  readonly realChats?: RealChatsApi
  /** The map of chat to branch: the one source of truth, read here and written once per chat. */
  readonly branchChats?: BranchChatsStore
  /** The checked-out branch; undefined outside a repository (no branch to keep a chat for). */
  readonly branch?: () => string | undefined
  /** The app's folder, where a chat made by the frame works. */
  readonly appRoot?: () => string | undefined
  /** The chat the strip's active tab asks for on the checked-out branch, if it is a tab of one. */
  readonly preferred?: () => string | undefined
}

export class ChatsStore implements ChatsPort {
  private rows: readonly ChatRow[] = EMPTY
  private sessions: ISessions | undefined
  private held: SessionReference | undefined
  private readonly listeners = new Set<() => void>()

  private all: readonly ChatRow[] = EMPTY
  private real: ReadonlyMap<string, string> = new Map()
  private realLoaded = false
  private running: ReadonlySet<string> = new Set()
  private reading = false
  private scheduled = false
  private again = false
  private creating: Promise<string | undefined> | undefined
  /** The chat `open` last asked DSH for, until DSH shows it (see `reconcile`). */
  private pending: { readonly id: string; readonly branch: string | undefined; readonly from: string | undefined; readonly at: number } | undefined

  constructor(private readonly deps: ChatsDeps) {}

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
      this.reconcile()
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
    this.pending = { id, branch: this.deps.branch?.(), from: this.all.find(row => row.current)?.id, at: Date.now() }
    const navigation = this.deps.navigation()
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
   * Make the chat on screen the checked-out branch's (`decideChat`). Called whenever anything it depends on changes: the branch, the sessions, the
   * chats with a turn, the branch-chats map, the strip's tab. It acts only once the map and the Host's chat list have been read: before that a
   * chat that looks unrecorded may only be one the frame has not heard about, and recording it would put it on the wrong branch.
   */
  reconcile(): void {
    if (this.scheduled) return
    this.scheduled = true
    // Never in the middle of the notification that asked: DSH moves its main view inside a call that tells its subscribers on the way, and a chat opened
    // from there is replaced when that call finishes (it keeps the view it started with). One run once the call is over serves every ask made meanwhile.
    queueMicrotask(() => {
      this.scheduled = false
      this.decide()
    })
  }

  private decide(): void {
    const branch = this.deps.branch?.()
    const map = this.deps.branchChats
    if (this.sessions === undefined || branch === undefined || map === undefined) return
    if (!map.isLoaded()) {
      void map.load()
      return
    }
    if (!this.realLoaded) return
    // A chat with a turn that no branch was recorded for (made before the frame recorded anything) is this branch's: recorded once, here.
    map.adopt(this.all.filter(row => this.real.has(row.id) || this.running.has(row.id)).map(row => row.id), branch)
    // DSH swaps the main view's chat in steps (the old one is released before the new one is retained) and tells its subscribers at each step. A view
    // with no chat while an open is on its way is that swap, not a reason to decide again (which asked DSH over and over, so the chat never showed).
    // The ask is over when its chat shows, when the view is on a chat that is neither the old one nor the asked one (someone else navigated), when the
    // branch moved on, or when it has had `PENDING_MS` to show.
    const shown = this.all.find(row => row.current)?.id
    const pending = this.pending
    if (pending !== undefined && (shown === pending.id || pending.branch !== branch || (shown !== undefined && shown !== pending.from) || Date.now() - pending.at > PENDING_MS)) this.pending = undefined
    if (this.pending !== undefined && shown === undefined) return
    const decision = decideChat({ rows: this.all, real: this.real, running: this.running, assignments: map.getSnapshot(), branch, preferred: this.deps.preferred?.() })
    if (decision.action === 'open') this.open(decision.id)
    else if (decision.action === 'adopt') map.adopt([decision.id], branch)
    else if (decision.action === 'create') void this.create().catch(() => {})
  }

  /**
   * A new chat on the checked-out branch, shown at once: a DSH session made on the Host and recorded for the branch before anything else can see
   * it. Undefined without the sessions service or outside a branch. A second call while one runs gets the same chat.
   */
  create(): Promise<string | undefined> {
    // Started on the next tick: the session list may tell its subscribers synchronously while the session is made, and they must find this guard set.
    this.creating ??= Promise.resolve().then(() => this.make()).finally(() => { this.creating = undefined })
    return this.creating
  }

  private async make(): Promise<string | undefined> {
    const sessions = this.sessions
    const branch = this.deps.branch?.()
    const cwd = this.deps.appRoot?.()
    if (sessions === undefined || branch === undefined || cwd === undefined) return undefined
    // A DSH chat works in a workspace: register the app's folder first (DSH resolves an existing registration), so the new session is bound to
    // it instead of opening onto a workspace chooser. Without the workspace service the session is still made, unbound.
    const workspaces = this.deps.workspaceFor?.()
    const workspace = workspaces === undefined ? undefined : await workspaces.create({ path: cwd }).catch(() => undefined)
    const id = await sessions.create({ cwd, ...(workspace === undefined ? {} : { workspaceId: workspace.workspaceId }) })
    this.deps.branchChats?.adopt([id], branch)
    this.open(id)
    return id
  }

  /**
   * "+ then Chat": a chat of its own on the checked-out branch. The chat on screen is reused when it has no turn yet (it is already a new chat), so
   * the strip never fills with empty ones; @returns its id and whether it was made now. Undefined when no chat could be made.
   */
  async startChat(): Promise<{ readonly id: string; readonly made: boolean } | undefined> {
    const branch = this.deps.branch?.()
    const current = this.all.find(row => row.current)
    const blank = current !== undefined && this.realLoaded && !this.real.has(current.id) && !this.running.has(current.id)
    if (current !== undefined && blank && branch !== undefined && this.deps.branchChats?.getSnapshot()[current.id] === branch) return { id: current.id, made: false }
    const id = await this.create()
    return id === undefined ? undefined : { id, made: true }
  }

  /**
   * The base tab's chat: the checked-out branch's newest chat that has no tab of its own, shown. Nothing changes when the branch has no such chat.
   */
  openPrimary(exclude: ReadonlySet<string>): void {
    const branch = this.deps.branch?.()
    const map = this.deps.branchChats
    if (branch === undefined || map === undefined) return
    const chat = branchChat({ rows: this.all, real: this.real, running: this.running, assignments: map.getSnapshot(), branch }, exclude)
    if (chat !== undefined) this.open(chat.id)
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
          this.real = new Map((await (this.deps.realChats ?? { read: async () => [] }).read()).map(chat => [chat.id, chat.title]))
          this.realLoaded = true
          this.publishVisible()
          this.reconcile()
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
