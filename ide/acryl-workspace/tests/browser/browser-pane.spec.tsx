// @vitest-environment jsdom

/** The browser tab's address bar is the gate to every app in the frame, so a press of Go must never be lost or do nothing. */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BrowserPane, shouldRetryBrowserLoad } from '../../src/client/browser/BrowserPane.tsx'
import { WorkspaceState, type WorkspaceTile } from '../../src/client/canvas/state.ts'

afterEach(() => { cleanup() })

const workspaceTile = (state: WorkspaceState, url?: string): WorkspaceTile => {
  const tile = state.addTile('browser')
  if (tile === undefined) throw new Error('the state refused a browser tile')
  if (url !== undefined) state.updateTile(tile.id, { url })
  return state.getSnapshot().tiles.find(candidate => candidate.id === tile.id) ?? tile
}

const form = (): HTMLFormElement => screen.getByLabelText('Browser address').closest('form') as HTMLFormElement

describe('BrowserPane', () => {
  it('submits the address in the field even when its change has not reached React yet', () => {
    const state = new WorkspaceState()
    const tile = workspaceTile(state)
    render(<BrowserPane tile={tile} workspace={state} />)
    // What a fast Enter after typing, a paste, or a script that fills the bar does: the field holds the address, the controlled state
    // behind it does not. Reading the React copy here (the old code) submitted nothing at all, which was the frame's first-Go failure.
    const input = screen.getByLabelText('Browser address') as HTMLInputElement
    input.value = '127.0.0.1:4000/app'
    fireEvent.submit(form())
    expect(state.getSnapshot().tiles.find(candidate => candidate.id === tile.id)?.url).toBe(
      'https://127.0.0.1:4000/app',
    )
  })

  it('reloads the same address on the next Go instead of leaving a failed page in place', () => {
    const state = new WorkspaceState()
    const tile = workspaceTile(state, 'http://127.0.0.1:4000/app')
    render(<BrowserPane tile={tile} workspace={state} />)
    const first = screen.getByTitle('Browser tab')
    fireEvent.submit(form())
    const second = screen.getByTitle('Browser tab')
    // The iframe is remounted (its key moved), so the address is really fetched again; updating the tile with the same url is a no-op
    // React never re-renders for, which is why the second and third press in the old gate could never recover from an error page.
    expect(second).not.toBe(first)
    expect(second.getAttribute('src')).toBe('http://127.0.0.1:4000/app')
    expect(state.getSnapshot().tiles.find(candidate => candidate.id === tile.id)?.url).toBe(
      'http://127.0.0.1:4000/app',
    )
  })
})

describe('shouldRetryBrowserLoad', () => {
  const sameOrigin = 'http://127.0.0.1:4000/app'
  const retry = (options: Partial<Parameters<typeof shouldRetryBrowserLoad>[0]>): boolean =>
    shouldRetryBrowserLoad({
      src: sameOrigin,
      topOrigin: 'http://127.0.0.1:4000',
      documentReadable: false,
      retries: 0,
      ...options,
    })

  it('reloads an unreadable document at one of this page own addresses (the browser error page)', () => {
    expect(retry({})).toBe(true)
    expect(retry({ retries: 1 })).toBe(true)
  })

  it('leaves a readable document alone, and never retries an external page, which also hides its document', () => {
    expect(retry({ documentReadable: true })).toBe(false)
    expect(retry({ src: 'https://example.com/' })).toBe(false)
  })

  it('stops at the attempt budget per press, and does nothing for an address it cannot parse or does not have', () => {
    expect(retry({ retries: 2 })).toBe(false)
    expect(retry({ src: 'not a url' })).toBe(false)
    expect(retry({ src: null })).toBe(false)
  })
})
