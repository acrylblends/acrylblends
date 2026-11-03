/** The centre: the app's own page in one frame. A navigation or a reload mounts a NEW frame; a frame is never re-pointed (section 30). */

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import type { AppCanvasState } from './app-canvas.ts'

export function AppCanvas({ canvas }: { canvas: AppCanvasState }) {
  const snapshot = useSyncExternalStore(
    (listener) => canvas.subscribe(listener),
    () => canvas.getSnapshot(),
  )
  const frame = useRef<HTMLIFrameElement | null>(null)
  // The service reads the live page through the frame the component rendered. Laid out before paint so `pageWindow` answers as soon as the
  // document it is asked about is the one on screen.
  useLayoutEffect(() => {
    canvas.attach(frame.current)
    return () => canvas.attach(null)
  }, [canvas, snapshot.address, snapshot.attempt])
  useEffect(() => () => canvas.attach(null), [canvas])
  if (snapshot.address === undefined) return null
  return (
    <iframe
      // The address and the attempt are both part of the key: a change mounts a new frame instead of pointing this one somewhere else.
      key={`${String(snapshot.attempt)} ${snapshot.address}`}
      ref={frame}
      className="acrylAppCanvasFrame"
      title="App"
      src={snapshot.address}
      sandbox="allow-scripts allow-forms allow-same-origin"
      onLoad={(event) => {
        const address = snapshot.address
        if (address === undefined) return
        canvas.reportLoad(address, event.currentTarget.contentDocument !== null)
      }}
    />
  )
}
