/** The centre: the app's own page in one frame. A navigation or a reload mounts a NEW frame; a frame is never re-pointed (section 30). */

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import type { SelectedElement } from '../selection.ts'
import type { AppCanvasState } from './app-canvas.ts'
import { attachPicker } from './picker.ts'

export interface AppCanvasProps {
  readonly canvas: AppCanvasState
  /** The frame's select control is on: clicks in the app pick an element instead of acting on the app. */
  readonly picking?: boolean
  /** One element was picked. */
  readonly onPick?: (element: SelectedElement) => void
  /** Escape left the picker. */
  readonly onCancel?: () => void
}

export function AppCanvas({ canvas, picking = false, onPick, onCancel }: AppCanvasProps) {
  const snapshot = useSyncExternalStore(
    (listener) => canvas.subscribe(listener),
    () => canvas.getSnapshot(),
  )
  const frame = useRef<HTMLIFrameElement | null>(null)
  // The handlers are read at the event, so a new callback identity never tears the picker down and re-attaches it.
  const handlers = useRef({ onPick, onCancel })
  handlers.current = { onPick, onCancel }
  // The service reads the live page through the frame the component rendered. Laid out before paint so `pageWindow` answers as soon as the
  // document it is asked about is the one on screen.
  useLayoutEffect(() => {
    canvas.attach(frame.current)
    return () => canvas.attach(null)
  }, [canvas, snapshot.address, snapshot.attempt])
  useEffect(() => () => canvas.attach(null), [canvas])
  // A picker belongs to one document: a load (`snapshot.loaded`) or a new frame (address, attempt) attaches it again to the page now shown.
  useEffect(() => {
    if (!picking || snapshot.address === undefined) return undefined
    const doc = frame.current?.contentDocument
    if (doc === null || doc === undefined) return undefined
    return attachPicker(doc, {
      onPick: (element) => { handlers.current.onPick?.(element) },
      onCancel: () => { handlers.current.onCancel?.() },
    })
  }, [picking, snapshot.address, snapshot.attempt, snapshot.loaded])
  if (snapshot.address === undefined) return null
  return (
    <iframe
      // The address and the attempt are both part of the key: a change mounts a new frame instead of pointing this one somewhere else.
      key={`${String(snapshot.attempt)} ${snapshot.address}`}
      ref={frame}
      className="acrylAppCanvasFrame"
      title="App"
      src={snapshot.address}
      onLoad={(event) => {
        const address = snapshot.address
        if (address === undefined) return
        canvas.reportLoad(address, event.currentTarget.contentDocument !== null)
      }}
    />
  )
}
