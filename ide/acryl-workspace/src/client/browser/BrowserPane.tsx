/** The browser tab: an address bar and a sandboxed frame. */

import { useRef, useState, type FormEvent, type SyntheticEvent } from 'react'
import { normalizeBrowserUrl, type WorkspaceState, type WorkspaceTile } from '../canvas/state.ts'

/**
 * Whether a finished tile load is the browser's own error page for one of this page's own addresses, so it should be retried once.
 *
 * A same-origin document always exposes `contentDocument`; null therefore means Chrome put its error page there (the request was reset or
 * refused), never a real page. A cross-origin page also hides its document, and is never retried: a healthy external page would otherwise
 * load twice. `lastRetried` keeps it to one automatic retry per press, so an address that is genuinely dead does not loop.
 */
export function shouldRetryBrowserLoad(options: {
  readonly src: string | null
  readonly topOrigin: string
  readonly documentReadable: boolean
  readonly lastRetried: string | undefined
}): boolean {
  if (options.documentReadable || options.src === null || options.lastRetried === options.src)
    return false
  let origin: string
  try {
    origin = new URL(options.src).origin
  } catch {
    return false
  }
  return origin === options.topOrigin
}

export function BrowserPane({
  tile,
  workspace,
}: {
  tile: WorkspaceTile
  workspace: WorkspaceState
}) {
  // A press of Go remounts the frame through this counter. The same address is not a state change the iframe would follow, so without it
  // a second Go after a failed load did nothing at all, and an attendee saw the error page stay no matter how often they pressed.
  const [attempt, setAttempt] = useState(0)
  const retried = useRef<string | undefined>(undefined)
  const href = tile.url ?? ''
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    // Read the field itself, never a React copy of it. The bar is uncontrolled for the same reason: a submit can arrive in the same tick as
    // the input event (a fast Enter, a pasted or restored address, a script that fills the bar), and state that has not committed yet made Go
    // submit nothing or the previous address. That was the first-Go failure: the press was lost, not the navigation.
    const field = event.currentTarget.elements.namedItem('address')
    if (!(field instanceof HTMLInputElement)) return
    const next = normalizeBrowserUrl(field.value)
    if (next === undefined) return
    // Each accepted press gets its own automatic retry (below), and a new address is loaded as a fresh navigation.
    retried.current = undefined
    if (next === href) setAttempt(current => current + 1)
    else workspace.updateTile(tile.id, { url: next })
  }
  const loaded = (event: SyntheticEvent<HTMLIFrameElement>): void => {
    const frame = event.currentTarget
    const src = frame.getAttribute('src')
    if (
      !shouldRetryBrowserLoad({
        src,
        topOrigin: window.location.origin,
        documentReadable: frame.contentDocument !== null,
        lastRetried: retried.current,
      })
    )
      return
    retried.current = src ?? undefined
    setAttempt(current => current + 1)
  }
  return (
    <div className="dshWorkspaceBrowser">
      <form className="dshWorkspaceBrowserBar" onSubmit={submit}>
        <input aria-label="Browser address" name="address" defaultValue={href} />
        <button type="submit">Go</button>
      </form>
      {href.length > 0 && (
        <iframe
          key={attempt}
          className="dshWorkspaceBrowserFrame"
          title="Browser tab"
          src={href}
          sandbox="allow-scripts allow-forms allow-same-origin"
          onLoad={loaded}
        />
      )}
    </div>
  )
}
