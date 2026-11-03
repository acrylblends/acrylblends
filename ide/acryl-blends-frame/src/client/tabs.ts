/**
 * The right panel's tabs (docs/design/blends-frame-mockup.html): the chat, PTY agents (Claude Code, Codex, Pi as they are, in a terminal), a
 * terminal, Files, a file opened from it, and Git. One store for the right panel's strip and the left panel's open items; remembered per page.
 * A terminal tab names the Host's PTY session, which outlives the page, so a reload shows the same terminal again.
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
  | { readonly kind: 'chat'; readonly id: 'chat' }
  | { readonly kind: 'pty'; readonly id: string; readonly agent: PtyAgent; readonly terminalId: string }
  | { readonly kind: 'terminal'; readonly id: string; readonly terminalId: string }
  | { readonly kind: 'files'; readonly id: 'files' }
  | { readonly kind: 'file'; readonly id: string; readonly path: string }
  | { readonly kind: 'git'; readonly id: 'git' }

export interface FrameTabsSnapshot {
  readonly tabs: readonly FrameTab[]
  readonly active: string
  /** What each terminal says it runs (its title, as a shell sets it: `npm test`), by terminal id; not remembered. */
  readonly titles?: Readonly<Record<string, string>>
}

const STORAGE_KEY = 'acryl-blends-frame.tabs.v1'
const CHAT: FrameTab = { kind: 'chat', id: 'chat' }

/** The first run: the chat alone. */
export const FIRST_RUN_TABS: FrameTabsSnapshot = { tabs: [CHAT], active: 'chat' }

export const ptyTab = (agent: PtyAgent, terminalId: string): FrameTab => ({ kind: 'pty', id: `pty:${terminalId}`, agent, terminalId })
export const terminalTab = (terminalId: string): FrameTab => ({ kind: 'terminal', id: `terminal:${terminalId}`, terminalId })
export const fileTab = (path: string): FrameTab => ({ kind: 'file', id: `file:${path}`, path })
export const FILES_TAB: FrameTab = { kind: 'files', id: 'files' }
export const GIT_TAB: FrameTab = { kind: 'git', id: 'git' }

function parseTab(value: unknown): FrameTab | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const tab = value as Record<string, unknown>
  const text = (key: string): string | undefined => (typeof tab[key] === 'string' && tab[key] !== '' ? tab[key] as string : undefined)
  switch (tab.kind) {
    case 'chat': return CHAT
    case 'files': return FILES_TAB
    case 'git': return GIT_TAB
    case 'file': { const path = text('path'); return path === undefined ? undefined : fileTab(path) }
    case 'terminal': { const id = text('terminalId'); return id === undefined ? undefined : terminalTab(id) }
    case 'pty': {
      const id = text('terminalId')
      const agent = PTY_AGENTS.find(entry => entry.agent === tab.agent)?.agent
      return id === undefined || agent === undefined ? undefined : ptyTab(agent, id)
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

/** The tab a terminal session shows in, if one does. */
export function tabOfTerminal(snapshot: FrameTabsSnapshot, terminalId: string): FrameTab | undefined {
  return snapshot.tabs.find(tab => (tab.kind === 'pty' || tab.kind === 'terminal') && tab.terminalId === terminalId)
}

export class FrameTabs {
  private snapshot: FrameTabsSnapshot
  private readonly listeners = new Set<() => void>()

  constructor(private readonly storage?: ViewStorage) {
    let raw: string | null = null
    try {
      raw = storage?.getItem(STORAGE_KEY) ?? null
    } catch {
      raw = null
    }
    this.snapshot = parseStoredTabs(raw)
  }

  getSnapshot(): FrameTabsSnapshot {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Show a tab, adding it at the end of the strip when it is not open yet. */
  open(tab: FrameTab): void {
    const open = this.snapshot.tabs.some(existing => existing.id === tab.id)
    this.set({ tabs: open ? this.snapshot.tabs : [...this.snapshot.tabs, tab], active: tab.id })
  }

  activate(id: string): void {
    if (this.snapshot.tabs.some(tab => tab.id === id)) this.set({ ...this.snapshot, active: id })
  }

  /** Close a tab (never the chat); the one before it is shown when it was. @returns the closed tab. */
  close(id: string): FrameTab | undefined {
    const index = this.snapshot.tabs.findIndex(tab => tab.id === id)
    const tab = this.snapshot.tabs[index]
    if (tab === undefined || tab.kind === 'chat') return undefined
    const tabs = this.snapshot.tabs.filter(existing => existing.id !== id)
    const active = this.snapshot.active === id ? (tabs[index - 1] ?? tabs[0] ?? CHAT).id : this.snapshot.active
    this.set({ tabs, active })
    return tab
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
      this.storage?.setItem(STORAGE_KEY, JSON.stringify({ tabs: next.tabs, active: next.active }))
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
