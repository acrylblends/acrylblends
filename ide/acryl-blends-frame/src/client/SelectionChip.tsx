/**
 * The chip above the chat composer for the element picked in the app (docs/design/blends-frame-mockup.html, scenario 2). It names what the
 * person meant and clears it; the context reaches the agent on the next message through the send hook, which writes the element's page and
 * selector into the draft at the moment the composer sends, so the person's own text stays exactly as they typed it.
 */

import { useEffect, useSyncExternalStore } from 'react'
import type { SelectedElement } from './selection.ts'

export interface SelectionChipInjected {
  readonly selection: {
    get(): SelectedElement | undefined
    subscribe(listener: () => void): () => void
  }
  clear(): void
  /** Prepend the selection's context to the composer draft, just before the person's own send. */
  send(): void
  /** Return the keyboard to the composer, the way the frame's feedback hand-off does. */
  focus(): void
}

export type SelectionChipProps = SelectionChipInjected

/**
 * Whether one DOM event is a send gesture of the chat composer. Only the composer card counts, so the rest of the page keeps its own keys
 * and clicks; an open trigger menu owns Enter because the person is picking a reference or a command, not sending.
 */
export function isSendGesture(event: Event): boolean {
  const target = event.target
  if (!(target instanceof Element)) return false
  if (event.type === 'keydown') {
    const key = event as KeyboardEvent
    if (key.key !== 'Enter' || key.isComposing || key.shiftKey || key.altKey || (key.metaKey && key.ctrlKey)) return false
    const card = target.closest('[data-composer-card]')
    return card !== null && card.querySelector('[data-trigger-menu]') === null
  }
  if (event.type === 'click') {
    const button = target.closest('button')
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false
    const card = button.closest('[data-composer-card]')
    if (card === null) return false
    // The primary action is the card's last button: Send, or Stop while a draft is empty (the send hook leaves that draft alone).
    const buttons = card.querySelectorAll('button')
    return buttons[buttons.length - 1] === button
  }
  return false
}

export function SelectionChip({ selection, clear, send, focus }: SelectionChipProps) {
  const current = useSyncExternalStore(selection.subscribe, selection.get, selection.get)
  // A new pick is the person asking the chat about that element: the composer takes the keyboard, as the mockup's next message does.
  useEffect(() => {
    if (current !== undefined) focus()
  }, [current?.selector, current?.page, focus])
  useEffect(() => {
    if (current === undefined) return undefined
    const onGesture = (event: Event): void => { if (isSendGesture(event)) send() }
    window.addEventListener('keydown', onGesture, true)
    window.addEventListener('click', onGesture, true)
    return () => {
      window.removeEventListener('keydown', onGesture, true)
      window.removeEventListener('click', onGesture, true)
    }
  }, [current?.selector, current?.page, send])
  if (current === undefined) return null
  return (
    <div className="acrylBlendsSelectionDock">
      <span className="acrylBlendsSelectionChip" title={current.selector}>
        <span className="acrylBlendsSelectionChipLabel">Selected: {current.label}</span>
        <button
          type="button"
          className="acrylBlendsSelectionChipClear"
          aria-label="Clear selection"
          title="Clear selection"
          onClick={clear}
        >
          ×
        </button>
      </span>
    </div>
  )
}
