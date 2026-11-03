// @vitest-environment jsdom

/** The chat's History: every chat, closed ones included, searchable, and a pick reopens it (section 31, Q7). */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionListState } from '@acryl/ui/frame'
import { ChatHistory } from '../../src/client/chat/ChatHistory.tsx'
import type { WorkspaceShellState } from '../../src/client/worktrees/shell-state.ts'

afterEach(cleanup)

const sessions = {
  ids: ['c1', 'c2', 'c3'],
  byId: {
    c1: { displayTitle: 'Add due dates' },
    c2: { title: 'Old idea' },
    c3: { displayTitle: '' },
  },
} as unknown as SessionListState

const shell = (dismissed: readonly string[]): WorkspaceShellState => {
  // One stable snapshot, as the real shell keeps: a new object per read would make useSyncExternalStore loop.
  const snapshot = { dismissedChats: new Set(dismissed) }
  return { subscribe: () => () => {}, getSnapshot: () => snapshot } as unknown as WorkspaceShellState
}

describe('ChatHistory', () => {
  it('lists every chat, closed ones badged, and picks one', () => {
    const onPick = vi.fn()
    render(<ChatHistory sessions={sessions} current="c1" shell={shell(['c2'])} onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getByRole('button', { name: /Add due dates/u })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Old idea/u })).toBeTruthy()
    // A blank chat is still a row, named the way DSH names it.
    expect(screen.getByRole('button', { name: /New chat/u })).toBeTruthy()
    expect(screen.getByText('closed')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Old idea/u }))
    expect(onPick).toHaveBeenCalledWith('c2')
    // Picking closes the panel.
    expect(screen.queryByRole('dialog', { name: 'Chat history' })).toBeNull()
  })

  it('searches the titles', () => {
    render(<ChatHistory sessions={sessions} current={undefined} shell={shell([])} onPick={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    fireEvent.change(screen.getByLabelText('Search chats'), { target: { value: 'due' } })
    expect(screen.getByRole('button', { name: /Add due dates/u })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Old idea/u })).toBeNull()
    fireEvent.change(screen.getByLabelText('Search chats'), { target: { value: 'nothing' } })
    expect(screen.getByText('No chats match.')).toBeTruthy()
  })
})
