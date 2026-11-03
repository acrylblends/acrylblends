/**
 * The right panel's tabs (docs/design/blends-frame-mockup.html): the chat, PTY agents (Claude Code, Codex, Pi as they are, in a terminal), a
 * terminal, Files, a file opened from it, and Git. One store for the right panel's strip and the left panel's open items; remembered per page.
 * A terminal tab names the Host's PTY session, which outlives the page, so a reload shows the same terminal again. Every tab but the chat belongs
 * to the branch it was opened on: the strip shows the checked-out branch's tabs, and the others stay (a terminal keeps running) out of the list.
 */

import type { ViewStorage } from './view-state.ts'

/** The PTY agents the + menu offers, in its order: their workspace agent ids and labels. */
export const PTY_AGENTS = [
  { agent: 'claude', label: 'Claude Code', tab: 'Claude' },
  { agent: 'codex', label: 'Codex', tab: 'Codex' },
  { agent: 'pi', label: 'Pi', tab: 'Pi' },
] as const

export type PtyAgent = (typeof PTY_AGENTS)[number]['agent']

export type FrameTab =
  /** `chat` is the base tab, always there: the branch's chat. A chat made with "+ then Chat" has a tab of its own, named `chat:<session>`. */
  | { readonly kind: 'chat'; readonly id: string; readonly session?: string; readonly branch?: string }
  | { readonly kind: 'pty'; readonly id: string; readonly agent: PtyAgent; readonly terminalId: string; readonly branch?: string }
  | { readonly kind: 'terminal'; readonly id: string; readonly terminalId: string; readonly branch?: string }
  | { readonly kind: 'files'; readonly id: 'files'; readonly branch?: string }
  | { readonly kind: 'file'; readonly id: string; readonly path: string; readonly branch?: string }
  | { readonly kind: 'git'; readonly id: 'git'; readonly branch?: string }

export interface FrameTabsSnapshot {
  readonly tabs: readonly FrameTab[]
  readonly active: string
  /** What each terminal says it runs (its title, as a shell sets it: `npm test`), by terminal id; not remembered. */
  readonly titles?: Readonly<Record<string, string>>
}

const STORAGE_KEY = 'acryl-blends-frame.tabs.v1'
const CHAT: FrameTab = { kind: 'chat', id: 'chat' }
/** The base chat tab: always first, never closed, on every branch. */
const isBase = (tab: FrameTab): boolean => tab.kind === 'chat' && tab.id === 'chat'

/** The first run: the chat alone. */
export const FIRST_RUN_TABS: FrameTabsSnapshot = { tabs: [CHAT], active: 'chat' }

export const chatTab = (session: string): FrameTab => ({ kind: 'chat', id: `chat:${session}`, session })
export const ptyTab = (agent: PtyAgent, terminalId: string): FrameTab => ({ kind: 'pty', id: `pty:${terminalId}`, agent, terminalId })
export const terminalTab = (terminalId: string): FrameTab => ({ kind: 'terminal', id: `terminal:${terminalId}`, terminalId })
export const fileTab = (path: string): FrameTab => ({ kind: 'file', id: `file:${path}`, path })
export const FILES_TAB: FrameTab = { kind: 'files', id: 'files' }
export const GIT_TAB: FrameTab = { kind: 'git', id: 'git' }

/** The tabs the strip shows on a branch: the base chat always, and what was opened on that branch. No branch (outside a repository): every tab. */
export function tabsForBranch(snapshot: FrameTabsSnapshot, branch: string | undefined): readonly FrameTab[] {
  if (branch === undefined) return snapshot.tabs
  return snapshot.tabs.filter(tab => isBase(tab) || tab.branch === branch)
}

const stamped = (tab: FrameTab, branch: string | undefined): FrameTab => (branch === undefined ? tab : { ...tab, branch })

function parseTab(value: unknown): FrameTab | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const tab = value as Record<string, unknown>
  const text = (key: string): string | undefined => (typeof tab[key] === 'string' && tab[key] !== '' ? tab[key] as string : undefined)
  const branch = text('branch')
  switch (tab.kind) {
    case 'chat': { const session = text('session'); return session === undefined ? CHAT : stamped(chatTab(session), branch) }
    case 'files': return stamped(FILES_TAB, branch)
    case 'git': return stamped(GIT_TAB, branch)
    case 'file': { const path = text('path'); return path === undefined ? undefined : stamped(fileTab(path), branch) }
    case 'terminal': { const id = text('terminalId'); return id === undefined ? undefined : stamped(terminalTab(id), branch) }
    case 'pty': {
      const id = text('terminalId')
      const agent = PTY_AGENTS.find(entry => entry.agent === tab.agent)?.agent
      return id === undefined || agent === undefined ? undefined : stamped(ptyTab(agent, id), branch)
    }
    default: return undefined
  }
}

/** A remembered strip, or the first run's when it is missing or malformed. The chat is always there, first. */
export function parseStoredTabs(raw: string | null): FrameTabsSnapshot {
  if (raw === null) return FIRST_RUN_TABS
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return FIRST_RUN_TABS
  }
  if (value === null || typeof value !== 'object' || !Array.isArray((value as { tabs?: unknown }).tabs)) return FIRST_RUN_TABS
  const tabs: FrameTab[] = [CHAT]
  for (const entry of (value as { tabs: unknown[] }).tabs) {
    const tab = parseTab(entry)
    if (tab !== undefined && !tabs.some(existing => existing.id === tab.id)) tabs.push(tab)
  }
  const active = (value as { active?: unknown }).active
  return { tabs, active: typeof active === 'string' && tabs.some(tab => tab.id === active) ? active : 'chat' }
}

/** Whether the remembered strip already went through the branch migration (`setBranch`). */
function parseStoredBranching(raw: string | null): boolean {
  if (raw === null) return false
  try {
    const value: unknown = JSON.parse(raw)
    return value !== null && typeof value === 'object' && (value as { branched?: unknown }).branched === true
  } catch {
    return false
  }
}

/** The tab a terminal session shows in, if one does. */
export function tabOfTerminal(snapshot: FrameTabsSnapshot, terminalId: string): FrameTab | undefined {
  return snapshot.tabs.find(tab => (tab.kind === 'pty' || tab.kind === 'terminal') && tab.terminalId === terminalId)
}

export class FrameTabs {
  private snapshot: FrameTabsSnapshot
  private readonly listeners = new Set<() => void>()
  /** The checked-out branch the strip is showing; new tabs are opened on it. */
  private branch: string | undefined
  /** Whether the remembered tabs already went through the branch migration (see `setBranch`). */
  private branched: boolean

  constructor(private readonly storage?: ViewStorage) {
    let raw: string | null = null
    try {
      raw = storage?.getItem(STORAGE_KEY) ?? null
    } catch {
      raw = null
    }
    this.snapshot = parseStoredTabs(raw)
    this.branched = parseStoredBranching(raw)
  }

  getSnapshot(): FrameTabsSnapshot {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * The checked-out branch. The first time it is known, the tabs remembered before branches had their own lists (every tab carried no branch) are
   * put on that branch, which is where they were opened as far as anyone can tell; later calls only change where new tabs go.
   */
  setBranch(branch: string | undefined): void {
    this.branch = branch
    if (this.branched || branch === undefined) return
    this.branched = true
    this.set({ tabs: this.snapshot.tabs.map(tab => (isBase(tab) || tab.branch !== undefined ? tab : { ...tab, branch })), active: this.snapshot.active })
  }

  /** Show a tab, adding it at the end of the strip when it is not open yet; a tab opened now belongs to the checked-out branch. */
  open(tab: FrameTab): void {
    const next = !isBase(tab) && tab.branch === undefined && this.branch !== undefined ? { ...tab, branch: this.branch } : tab
    const open = this.snapshot.tabs.some(existing => existing.id === next.id)
    this.set({ tabs: open ? this.snapshot.tabs : [...this.snapshot.tabs, next], active: next.id })
  }

  /** Add tabs that are not in the strip yet, at the end, without showing them; a tab added now belongs to the checked-out branch. */
  add(...added: readonly FrameTab[]): void {
    const fresh = added
      .filter(tab => !this.snapshot.tabs.some(existing => existing.id === tab.id))
      .map(tab => (!isBase(tab) && tab.branch === undefined && this.branch !== undefined ? { ...tab, branch: this.branch } : tab))
    if (fresh.length > 0) this.set({ tabs: [...this.snapshot.tabs, ...fresh], active: this.snapshot.active })
  }

  activate(id: string): void {
    if (this.snapshot.tabs.some(tab => tab.id === id)) this.set({ ...this.snapshot, active: id })
  }

  /** The id of the tab that shows a chat: its own when it has one, else the base chat tab. */
  chatTabId(session: string): string {
    return this.snapshot.tabs.find(tab => tab.kind === 'chat' && tab.session === session)?.id ?? 'chat'
  }

  /** Close a tab (never the base chat); the one before it is shown when it was. @returns the closed tab. */
  close(id: string): FrameTab | undefined {
    const index = this.snapshot.tabs.findIndex(tab => tab.id === id)
    const tab = this.snapshot.tabs[index]
    if (tab === undefined || isBase(tab)) return undefined
    const tabs = this.snapshot.tabs.filter(existing => existing.id !== id)
    const active = this.snapshot.active === id ? (tabs[index - 1] ?? tabs[0] ?? CHAT).id : this.snapshot.active
    this.set({ tabs, active })
    return tab
  }

  /** Close the chat tabs of chats that are not open (a chat closed on another page, or before this strip was remembered). @returns whether any closed. */
  closeChatsNotIn(open: ReadonlySet<string>): boolean {
    const tabs = this.snapshot.tabs.filter(tab => tab.kind !== 'chat' || tab.session === undefined || open.has(tab.session))
    if (tabs.length === this.snapshot.tabs.length) return false
    const active = tabs.some(tab => tab.id === this.snapshot.active) ? this.snapshot.active : CHAT.id
    this.set({ tabs, active })
    return true
  }

  /** A terminal's program set its title. */
  setTitle(terminalId: string, title: string): void {
    if (this.snapshot.titles?.[terminalId] === title) return
    this.snapshot = { ...this.snapshot, titles: { ...this.snapshot.titles, [terminalId]: title } }
    for (const listener of [...this.listeners]) listener()
  }

  private set(next: FrameTabsSnapshot): void {
    if (next.active === this.snapshot.active && next.tabs === this.snapshot.tabs) return
    this.snapshot = { ...next, ...(this.snapshot.titles === undefined ? {} : { titles: this.snapshot.titles }) }
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify({ tabs: next.tabs, active: next.active, branched: this.branched }))
    } catch {
      // A blocked storage only forgets the strip for the next page.
    }
    for (const listener of [...this.listeners]) listener()
  }
}

/**
 * What a terminal row says it runs: the command a shell put in its title (`npm test`); an idle prompt's `user@host:/path/app` title says only
 * the folder (`app`).
 */
export function terminalMeta(title: string | undefined): string {
  if (title === undefined) return ''
  const idle = /^[^@\s]+@[^:\s]+:\s*(.*)$/.exec(title.trim())
  if (idle === null) return title.trim()
  const path = (idle[1] as string).replace(/\/+$/, '')
  return path.slice(path.lastIndexOf('/') + 1) || path
}
