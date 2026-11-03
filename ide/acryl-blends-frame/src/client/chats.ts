/**
 * The chats as the frame lists them: DSH's sessions, newest list order, the one DSH's main view retains marked current. Opening one asks DSH's own
 * navigation (`uiWorkspace`) when it is composed, so DSH stays the one owner of which session is shown (the reason is in acryl-workspace's
 * `sessions/main-session.ts`); without it, the frame holds the main-view reference itself.
 */

import type { ISessions, SessionListState, SessionReference } from '@acryl/ui/frame'
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

const EMPTY: readonly ChatRow[] = Object.freeze([])

export class ChatsStore implements ChatsPort {
  private rows: readonly ChatRow[] = EMPTY
  private sessions: ISessions | undefined
  private held: SessionReference | undefined
  private readonly listeners = new Set<() => void>()

  constructor(
    private readonly navigation: () => MainViewNavigation | undefined,
    private readonly workspaceFor: () => WorkspaceRegistration | undefined = () => undefined,
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
    const read = () => { this.publish(Object.freeze(chatRows(sessions.list.getSnapshot()))) }
    const stop = sessions.list.subscribe(read)
    read()
    return () => {
      stop()
      this.held?.release()
      this.held = undefined
      if (this.sessions === sessions) this.sessions = undefined
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

  /** A new chat for the folder (DSH creates the session on the Host) and the one the main view shows; undefined without the sessions service. */
  async create(cwd: string): Promise<string | undefined> {
    const sessions = this.sessions
    if (sessions === undefined) return undefined
    // A DSH chat works in a workspace: register the app's folder first (DSH resolves an existing registration), so the new session is bound to
    // it instead of opening onto a workspace chooser. Without the workspace service the session is still made, unbound.
    const workspaces = this.workspaceFor()
    const workspace = workspaces === undefined ? undefined : await workspaces.create({ path: cwd }).catch(() => undefined)
    const id = await sessions.create({ cwd, ...(workspace === undefined ? {} : { workspaceId: workspace.workspaceId }) })
    this.open(id)
    return id
  }

  private publish(rows: readonly ChatRow[]): void {
    this.rows = rows
    for (const listener of [...this.listeners]) listener()
  }
}
