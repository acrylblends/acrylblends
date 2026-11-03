/**
 * The chat's History: every chat of the frame, the ones closed with the tab's x included, with one search field (docs/plans/ide-host-inversion.md
 * section 31, Q7). Picking one makes it open again - its dismissal is cleared and the selection opens its row and tab.
 */

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import type { SessionListState } from '@acryl/ui/frame'
import type { WorkspaceShellState } from '../worktrees/shell-state.ts'

export interface ChatHistoryProps {
  readonly sessions: SessionListState
  /** The chat the shown tab has, marked as current. */
  readonly current: string | undefined
  readonly shell: WorkspaceShellState
  readonly onPick: (sessionId: string) => void
}

/** One session as the list holds it. */
type SessionRow = SessionListState['byId'][keyof SessionListState['byId']]

/** A row's name: the agent's own title, else the placeholder DSH gives a blank chat. */
function titleOf(row: SessionRow): string {
  const title = row.displayTitle?.trim() || row.title?.trim()
  return title === undefined || title === '' ? 'New chat' : title
}

export function ChatHistory({ sessions, current, shell, onPick }: ChatHistoryProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const subscribe = useCallback((listener: () => void) => shell.subscribe(listener), [shell])
  const dismissed = useSyncExternalStore(subscribe, () => shell.getSnapshot().dismissedChats)
  const rows = useMemo(
    () =>
      sessions.ids.flatMap((id) => {
        const row = sessions.byId[id as keyof SessionListState['byId']]
        return row === undefined ? [] : [{ id, title: titleOf(row), closed: dismissed.has(id) }]
      }),
    [sessions, dismissed],
  )
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle === '' ? rows : rows.filter((row) => row.title.toLowerCase().includes(needle))
  }, [rows, query])
  return (
    <div className="dshWorkspaceChatHistory">
      <button
        type="button"
        className="dshWorkspaceChatHistoryButton"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value)
        }}
      >
        History
      </button>
      {open && (
        <div className="dshWorkspaceChatHistoryPanel" role="dialog" aria-label="Chat history">
          <input
            aria-label="Search chats"
            placeholder="Search chats"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
            }}
          />
          {shown.length === 0 ? (
            <p className="dshWorkspaceChatHistoryEmpty">No chats match.</p>
          ) : (
            <ul>
              {shown.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={row.id === current ? 'on' : undefined}
                    onClick={() => {
                      onPick(row.id)
                      setOpen(false)
                    }}
                  >
                    <span className="dshWorkspaceChatHistoryTitle">{row.title}</span>
                    {row.closed && <span className="dshWorkspaceChatHistoryClosed">closed</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
