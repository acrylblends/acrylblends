/**
 * The right panel: the agents as tabs. This slice has the chat (DSH's conversation, with the model the person connected); the PTY agents, the
 * terminal, files and git join the same strip as their plugins arrive. Above the chat: History, every chat with a search, and the shown chat's title.
 */

import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { ChatsPort } from './LeftPanel.tsx'

const HistoryIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.6h2.6M8 5v3.2l2 1.3" />
  </svg>
)

export interface RightPanelProps {
  readonly chats: ChatsPort
  readonly renderConversation: () => ReactNode
}

export function RightPanel({ chats, renderConversation }: RightPanelProps) {
  const subscribe = useCallback((listener: () => void) => chats.subscribe(listener), [chats])
  const rows = useSyncExternalStore(subscribe, () => chats.getSnapshot())
  const [history, setHistory] = useState(false)
  const [query, setQuery] = useState('')
  const current = rows.find(row => row.current)
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle === '' ? rows : rows.filter(row => row.title.toLowerCase().includes(needle))
  }, [rows, query])

  return (
    <>
      <div className="acrylBlendsTabs" role="tablist" aria-label="Agents">
        <button type="button" role="tab" className="acrylBlendsTab" aria-selected="true">
          Chat <span className="acrylBlendsTabKind">DeepSeek</span>
        </button>
      </div>
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
          {shown.length === 0 && <p className="acrylBlendsNote">No chats match.</p>}
          {shown.map(row => (
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
              <small>{row.current ? 'open' : ''}</small>
            </button>
          ))}
        </div>
      )}
      <div className="acrylBlendsConversation" hidden={history}>
        {renderConversation()}
      </div>
    </>
  )
}
