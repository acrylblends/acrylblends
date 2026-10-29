/**
 * The Host's side of the page channel: the connected pages of the app, and calls that go to the current one (moved from
 * `acryl-agent-control`, spec 041).
 *
 * The Host cannot reach into a page, so each page opens one event stream to the Host and answers calls by POST. With several pages open,
 * the one the user focused last is the one the agent drives. A page that reconnects with the same window id replaces its old stream.
 */

import {
  UiControlError,
  type ChannelToHost,
  type ChannelToPage,
  type UiRequest,
  type UiResult,
} from '../page/protocol.ts'

/** The slice of a page's stream the channel needs, so tests can supply their own. */
export interface PageStream {
  send(data: string): void
  close(): void
}

interface Pending {
  readonly connection: Connection
  readonly resolve: (value: UiResult) => void
  readonly reject: (cause: UiControlError) => void
  readonly timer: NodeJS.Timeout
  readonly cleanup: () => void
}

interface Connection {
  readonly stream: PageStream
  readonly windowId: string
  focused: boolean
  /** Order of last focus (or connection), so the most recent wins. */
  lastActive: number
}

/** How long a call may take before it is given up (a wait may take up to 10 seconds itself). */
const DEFAULT_CALL_TIMEOUT_MS = 30_000

export class UiChannel {
  private readonly connections = new Map<string, Connection>()
  private readonly pending = new Map<number, Pending>()
  private nextId = 1
  private clock = 0
  private closed = false
  /** Callers waiting for a page to (re)connect: each is told once, by the next stream that attaches. */
  private readonly attachWaiters = new Set<() => void>()

  /**
   * Register a page's stream. A stream already open for the same window is closed first, and its calls settle as `disconnected`.
   * @returns the function to call when this stream ends.
   */
  attach(windowId: string, focused: boolean, stream: PageStream): () => void {
    const previous = this.connections.get(windowId)
    if (previous !== undefined) this.drop(previous, true)
    const connection: Connection = { stream, windowId, focused, lastActive: ++this.clock }
    this.connections.set(windowId, connection)
    for (const waiter of [...this.attachWaiters]) waiter()
    return () => { if (this.connections.get(windowId) === connection) this.drop(connection, false) }
  }

  /** A message a page sent by POST. Only the window that was asked may answer a call, so another page cannot forge a result. */
  receive(windowId: string, message: ChannelToHost): void {
    const connection = this.connections.get(windowId)
    if (connection === undefined) return
    if (message.t === 'focus') {
      connection.focused = message.focused
      if (message.focused) connection.lastActive = ++this.clock
      return
    }
    const entry = this.pending.get(message.id)
    if (entry === undefined || entry.connection !== connection) return
    if (message.t === 'result') this.settle(message.id, message.value)
    else this.settle(message.id, undefined, new UiControlError(message.code, message.message))
  }

  /** True when at least one page is connected. */
  get connected(): boolean {
    return this.connections.size > 0
  }

  /** The windows currently connected, most recently active first (for diagnostics and tests). */
  windows(): readonly { windowId: string; focused: boolean }[] {
    return this.byRecency().map(({ windowId, focused }) => ({ windowId, focused }))
  }

  /**
   * Ask the current page to do something.
   * @throws UiControlError `no-window`, `timeout`, `aborted`, `unloaded`, `disconnected`, or whatever the page refused with.
   */
  call(request: UiRequest, options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<UiResult> {
    if (this.closed) return Promise.reject(new UiControlError('unloaded', 'the door was unloaded'))
    const target = this.byRecency()[0]
    if (target === undefined) return Promise.reject(new UiControlError('no-window', 'no page of the app is open to control'))
    const signal = options.signal
    if (signal?.aborted === true) return Promise.reject(new UiControlError('aborted', 'the call was cancelled'))
    const id = this.nextId
    this.nextId += 1
    return new Promise<UiResult>((resolve, reject) => {
      const timer = setTimeout(() => { this.settle(id, undefined, new UiControlError('timeout', 'the page did not answer in time')) }, options.timeoutMs ?? DEFAULT_CALL_TIMEOUT_MS)
      const onAbort = (): void => { this.settle(id, undefined, new UiControlError('aborted', 'the call was cancelled')) }
      signal?.addEventListener('abort', onAbort, { once: true })
      this.pending.set(id, { connection: target, resolve, reject, timer, cleanup: () => { signal?.removeEventListener('abort', onAbort) } })
      const frame: ChannelToPage = { t: 'call', id, request }
      try {
        target.stream.send(JSON.stringify(frame))
      } catch {
        this.settle(id, undefined, new UiControlError('disconnected', 'the page could not be reached'))
      }
    })
  }

  /**
   * A promise for the next time a page connects (a page that reloaded or moved opens a new stream). Ask for it BEFORE the call that makes the page leave, or a fast page is missed.
   * @returns whether a page connected within `timeoutMs`.
   */
  expectAttach(timeoutMs: number, count = 1): Promise<boolean> {
    return new Promise((resolve) => {
      let left = count
      const done = (value: boolean): void => { clearTimeout(timer); this.attachWaiters.delete(waiter); resolve(value) }
      const waiter = (): void => { left -= 1; if (left <= 0) done(true) }
      const timer = setTimeout(() => { done(false) }, timeoutMs)
      this.attachWaiters.add(waiter)
    })
  }

  /**
   * Ask every connected page to reload (the app just changed under them) and wait, up to `timeoutMs`, for them to come back. Best effort: a page that does not come back
   * (it was closed, or it moved to a page without the door) is not an error here.
   * @returns how many pages were asked.
   */
  async reloadAll(timeoutMs = 8000): Promise<number> {
    const targets = this.byRecency()
    if (this.closed || targets.length === 0) return 0
    const back = this.expectAttach(timeoutMs, targets.length)
    for (const target of targets) {
      const id = this.nextId
      this.nextId += 1
      // No call is waiting for the answer: the page answers by POST and the Host ignores an id it does not know.
      try { target.stream.send(JSON.stringify({ t: 'call', id, request: { op: 'reload' } } satisfies ChannelToPage)) } catch { /* that page is gone */ }
    }
    await back
    return targets.length
  }

  /** Close every page's stream and settle every pending call as `unloaded`. */
  close(): void {
    this.closed = true
    for (const id of [...this.pending.keys()]) this.settle(id, undefined, new UiControlError('unloaded', 'the door was unloaded'))
    for (const connection of [...this.connections.values()]) connection.stream.close()
    this.connections.clear()
  }

  private byRecency(): Connection[] {
    return [...this.connections.values()].sort((a, b) => b.lastActive - a.lastActive)
  }

  /** Forget a connection; its calls in flight settle as `disconnected` at once rather than waiting for their timeout. */
  private drop(connection: Connection, closeStream: boolean): void {
    this.connections.delete(connection.windowId)
    for (const [id, entry] of [...this.pending]) {
      if (entry.connection === connection) this.settle(id, undefined, new UiControlError('disconnected', 'the page went away before it answered'))
    }
    if (closeStream) connection.stream.close()
  }

  private settle(id: number, value: UiResult | undefined, failure?: UiControlError): void {
    const entry = this.pending.get(id)
    if (entry === undefined) return
    this.pending.delete(id)
    clearTimeout(entry.timer)
    entry.cleanup()
    if (failure !== undefined) entry.reject(failure)
    else if (value !== undefined) entry.resolve(value)
  }
}
