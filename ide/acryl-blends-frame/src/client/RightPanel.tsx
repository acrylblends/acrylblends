/**
 * The right panel (docs/design/blends-frame-mockup.html): everything the person works with, as tabs opened with +. Agents: the chat (DSH's
 * conversation with the model the person connected) and Claude Code, Codex or Pi as they are, TUIs in a PTY. Tools: a terminal, Files (fuzzy
 * search, a file opens as its own tab) and Git. There is no Browser: the canvas is the browser. The chat has History at its top left.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { formatRelativeTime } from 'acryl-versions/client'
import type { FrameState } from '../contract.ts'
import { FilesView } from './FilesView.tsx'
import { FileView } from './FileView.tsx'
import { GitView } from './GitView.tsx'
import type { ChatsPort } from './LeftPanel.tsx'
import { FILES_TAB, GIT_TAB, PTY_AGENTS, fileTab, ptyTab, terminalTab, type FrameTab, type FrameTabs, type PtyAgent } from './tabs.ts'
import { TerminalView } from './TerminalView.tsx'
import type { FrameTools } from './tools.ts'
import type { VersionsPort } from './versions.ts'

const HistoryIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.6h2.6M8 5v3.2l2 1.3" />
  </svg>
)

const PlusIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
)

const PTY_NOTE = 'Claude, Codex and Pi run as they are, in a terminal. They drive the app from inside: they know the ACRYL app\'s architecture through its skills, extend it with Cordis plugins, and use the app\'s UI through acryl-control.'

export interface RightPanelProps {
  readonly chats: ChatsPort
  readonly tabs: FrameTabs
  readonly tools: FrameTools
  readonly versions: VersionsPort
  readonly state: FrameState | undefined
  readonly renderConversation: () => ReactNode
}

const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

function TabLabel({ tab }: { readonly tab: FrameTab }) {
  switch (tab.kind) {
    case 'chat': return <>Chat <span className="acrylBlendsTabKind">DeepSeek</span></>
    case 'pty': return <>{PTY_AGENTS.find(entry => entry.agent === tab.agent)?.tab} <span className="acrylBlendsTabKind">PTY</span></>
    case 'terminal': return <>Terminal</>
    case 'files': return <>Files</>
    case 'file': return <>{baseName(tab.path)}</>
    case 'git': return <>Git</>
  }
}

export function RightPanel({ chats, tabs, tools, versions, state, renderConversation }: RightPanelProps) {
  const subscribeChats = useCallback((listener: () => void) => chats.subscribe(listener), [chats])
  const rows = useSyncExternalStore(subscribeChats, () => chats.getSnapshot())
  const subscribeTabs = useCallback((listener: () => void) => tabs.subscribe(listener), [tabs])
  const strip = useSyncExternalStore(subscribeTabs, () => tabs.getSnapshot())
  const [history, setHistory] = useState(false)
  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState(false)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const menuRef = useRef<HTMLDivElement>(null)
  const current = rows.find(row => row.current)
  const active = strip.tabs.find(tab => tab.id === strip.active) ?? strip.tabs[0]
  const root = state?.appRoot
  const shownChats = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle === '' ? rows : rows.filter(row => row.title.toLowerCase().includes(needle))
  }, [rows, query])

  useEffect(() => {
    if (!menu) return undefined
    const away = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(false) }
    window.addEventListener('pointerdown', away)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('pointerdown', away)
      window.removeEventListener('keydown', escape)
    }
  }, [menu])

  const start = async (command: PtyAgent | 'shell') => {
    setMenu(false)
    setNotice(undefined)
    try {
      const view = await tools.pty.start(command, root)
      tabs.open(command === 'shell' ? terminalTab(view.id) : ptyTab(command, view.id))
    } catch (cause) {
      const label = command === 'shell' ? 'The terminal' : PTY_AGENTS.find(entry => entry.agent === command)?.label ?? command
      setNotice(`${label} could not start: ${cause instanceof Error ? cause.message : String(cause)}`)
    }
  }

  const close = (id: string) => {
    const closed = tabs.close(id)
    if (closed?.kind === 'pty' || closed?.kind === 'terminal') {
      tools.terminals.release(closed.terminalId)
      void tools.pty.close(closed.terminalId).catch(() => {})
    }
  }

  const openTool = (tab: FrameTab) => {
    setMenu(false)
    tabs.open(tab)
  }

  return (
    <>
      <div className="acrylBlendsTabs" ref={menuRef}>
        <div className="acrylBlendsTabStrip" role="tablist" aria-label="Agents and tools">
          {strip.tabs.map(tab => (
            <div key={tab.id} className="acrylBlendsTabWrap" data-closable={tab.kind !== 'chat' || undefined}>
              <button
                type="button"
                role="tab"
                className="acrylBlendsTab"
                aria-selected={tab.id === active?.id}
                title={tab.kind === 'file' ? tab.path : undefined}
                onClick={() => { tabs.activate(tab.id) }}
                onAuxClick={(event) => { if (event.button === 1) close(tab.id) }}
              >
                <TabLabel tab={tab} />
              </button>
              {tab.kind !== 'chat' && (
                <button type="button" className="acrylBlendsTabClose" aria-label="Close tab" onClick={() => { close(tab.id) }}>×</button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="acrylBlendsIconButton acrylBlendsPlus"
            aria-label="Open an agent, a terminal, files or git"
            title="Open an agent, a terminal, files or git"
            aria-expanded={menu}
            onClick={() => { setMenu(value => !value) }}
          >
            <PlusIcon />
          </button>
        </div>
        {menu && (
          <div className="acrylBlendsMenu" role="menu">
            <div className="acrylBlendsMenuHead">Agents</div>
            <button type="button" role="menuitem" className="acrylBlendsMenuItem" onClick={() => { openTool({ kind: 'chat', id: 'chat' }) }}>
              Chat <small>your model</small>
            </button>
            {PTY_AGENTS.map(entry => (
              <button key={entry.agent} type="button" role="menuitem" className="acrylBlendsMenuItem" onClick={() => { void start(entry.agent) }}>
                {entry.label} <small>PTY</small>
              </button>
            ))}
            <div className="acrylBlendsMenuHead">Tools</div>
            <button type="button" role="menuitem" className="acrylBlendsMenuItem" onClick={() => { void start('shell') }}>
              Terminal <small>shell</small>
            </button>
            <button type="button" role="menuitem" className="acrylBlendsMenuItem" onClick={() => { openTool(FILES_TAB) }}>
              Files <small>tree; a file opens as a tab</small>
            </button>
            <button type="button" role="menuitem" className="acrylBlendsMenuItem" onClick={() => { openTool(GIT_TAB) }}>
              Git <small>changes, history</small>
            </button>
            <div className="acrylBlendsMenuItem" data-gone aria-disabled="true">Browser <small>the canvas is it</small></div>
          </div>
        )}
      </div>
      {notice !== undefined && (
        <p className="acrylBlendsNotice" role="alert">
          {notice}
          <button type="button" className="acrylBlendsTabClose" aria-label="Dismiss" onClick={() => { setNotice(undefined) }}>×</button>
        </p>
      )}
      {/* The chat stays mounted under the other tabs, so its scroll and draft survive a switch. */}
      <div className="acrylBlendsChatPane" hidden={active?.kind !== 'chat'}>
        <div className="acrylBlendsChatHead">
          <button
            type="button"
            className="acrylBlendsHistoryButton"
            aria-pressed={history}
            onClick={() => { setHistory(value => !value) }}
          >
            <HistoryIcon />History
          </button>
          <span className="acrylBlendsChatTitle">{current?.title ?? ''}</span>
        </div>
        {history && (
          <div className="acrylBlendsHistory" role="dialog" aria-label="Chat history">
            <input
              className="acrylBlendsSearch"
              aria-label="Search chats"
              placeholder="Search chats"
              value={query}
              onChange={(event) => { setQuery(event.target.value) }}
            />
            {shownChats.length === 0 && <p className="acrylBlendsNote">No chats match.</p>}
            {/* Chats are not tied to a branch yet: every one is the checked-out branch's, the folder the chat works in. */}
            {shownChats.length > 0 && <div className="acrylBlendsHistoryGroup">{state?.branches.find(branch => branch.current)?.name ?? 'Chats'}</div>}
            {shownChats.map(row => (
              <button
                key={row.id}
                type="button"
                className="acrylBlendsHistoryRow"
                aria-current={row.current || undefined}
                onClick={() => {
                  chats.open(row.id)
                  setHistory(false)
                }}
              >
                {row.title}
                <small>{[row.current ? 'open' : 'closed', row.updatedAt === undefined ? '' : formatRelativeTime(new Date(row.updatedAt).toISOString())].filter(part => part !== '').join(' · ')}</small>
              </button>
            ))}
          </div>
        )}
        <div className="acrylBlendsConversation" hidden={history}>
          {renderConversation()}
        </div>
      </div>
      {(active?.kind === 'pty' || active?.kind === 'terminal') && (
        <>
          <TerminalView key={active.terminalId} terminals={tools.terminals} terminalId={active.terminalId} />
          {active.kind === 'pty' && <p className="acrylBlendsPtyNote">{PTY_NOTE}</p>}
        </>
      )}
      {active?.kind === 'files' && root !== undefined && (
        <FilesView files={tools.files} root={root} openFile={(path) => { tabs.open(fileTab(path)) }} />
      )}
      {active?.kind === 'file' && root !== undefined && <FileView key={active.path} files={tools.files} root={root} path={active.path} />}
      {active?.kind === 'git' && root !== undefined && (
        <GitView git={tools.git} versions={versions} root={root} revision={`${state?.head ?? ''}:${String(state?.unsaved ?? '')}`} />
      )}
    </>
  )
}
