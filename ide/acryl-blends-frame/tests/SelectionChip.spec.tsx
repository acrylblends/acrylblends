// @vitest-environment jsdom

/** The chip above the composer: what is selected, the x that clears it, and the send gestures that carry the context into the message. */

import { cleanup, fireEvent, render } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SelectionChip, type SelectionChipInjected } from '../src/client/SelectionChip.tsx'
import { SelectionStore } from '../src/client/selection.ts'

const PICKED = { label: 'Task card', selector: '#board > div', page: '/board' }

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

function face(store: SelectionStore): SelectionChipInjected {
  return {
    selection: {
      get: () => store.getSnapshot().selection,
      subscribe: listener => store.subscribe(listener),
    },
    clear: () => { store.clear() },
    send: vi.fn(),
    focus: vi.fn(),
  }
}

describe('SelectionChip', () => {
  it('renders nothing until an element is picked, then names it', () => {
    const store = new SelectionStore()
    const { container } = render(<SelectionChip {...face(store)} />)
    expect(container.querySelector('.acrylBlendsSelectionChip')).toBeNull()
    act(() => { store.select(PICKED) })
    expect(container.querySelector('.acrylBlendsSelectionChipLabel')?.textContent).toBe('Selected: Task card')
  })

  it('clears the selection from its x', () => {
    const store = new SelectionStore()
    store.select(PICKED)
    const { getByLabelText, container } = render(<SelectionChip {...face(store)} />)
    act(() => { getByLabelText('Clear selection').click() })
    expect(store.getSnapshot().selection).toBeUndefined()
    expect(container.querySelector('.acrylBlendsSelectionChip')).toBeNull()
  })

  it('gives the composer the keyboard when an element is picked', () => {
    const store = new SelectionStore()
    const injected = face(store)
    render(<SelectionChip {...injected} />)
    act(() => { store.select(PICKED) })
    expect(injected.focus).toHaveBeenCalledTimes(1)
  })

  it('carries the context on Enter and on the primary button, and leaves every other gesture alone', () => {
    const store = new SelectionStore()
    store.select(PICKED)
    const injected = face(store)
    render(<SelectionChip {...injected} />)
    document.body.insertAdjacentHTML('beforeend', `
      <div data-composer-card>
        <div contenteditable="true">Fix the invite link.</div>
        <div data-trigger-menu></div>
        <button type="button">Send</button>
      </div>`)
    const editable = document.querySelector('[contenteditable]') as HTMLElement
    const send = document.querySelector('[data-composer-card] button') as HTMLButtonElement

    // A trigger menu owns Enter: the person is picking a reference or a command.
    fireEvent.keyDown(editable, { key: 'Enter' })
    expect(injected.send).not.toHaveBeenCalled()
    document.querySelector('[data-trigger-menu]')?.remove()

    fireEvent.keyDown(editable, { key: 'Enter', shiftKey: true })
    expect(injected.send).not.toHaveBeenCalled()
    fireEvent.keyDown(editable, { key: 'Enter', isComposing: true })
    expect(injected.send).not.toHaveBeenCalled()

    fireEvent.keyDown(editable, { key: 'Enter' })
    expect(injected.send).toHaveBeenCalledTimes(1)

    // A second control after the primary means this is not the send button.
    const extra = document.createElement('button')
    extra.type = 'button'
    document.querySelector('[data-composer-card]')?.append(extra)
    fireEvent.click(send)
    expect(injected.send).toHaveBeenCalledTimes(1)
    extra.remove()

    fireEvent.click(send)
    expect(injected.send).toHaveBeenCalledTimes(2)

    // The rest of the page keeps its own gestures.
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(injected.send).toHaveBeenCalledTimes(2)
    send.disabled = true
    fireEvent.click(send)
    expect(injected.send).toHaveBeenCalledTimes(2)
  })

  it('stops watching gestures once the selection is gone', () => {
    const store = new SelectionStore()
    store.select(PICKED)
    const injected = face(store)
    render(<SelectionChip {...injected} />)
    document.body.insertAdjacentHTML('beforeend', '<div data-composer-card><div contenteditable="true">text</div><button>Send</button></div>')
    const editable = document.querySelector('[contenteditable]') as HTMLElement
    act(() => { store.clear() })
    fireEvent.keyDown(editable, { key: 'Enter' })
    expect(injected.send).not.toHaveBeenCalled()
  })
})
