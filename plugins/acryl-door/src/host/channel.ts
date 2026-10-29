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

/** A call that went to a page that never acknowledged it, and was taken back to be sent to the next page. */
class Silent extends UiControlError {
  constructor() {
    super('timeout', 'the page did not acknowledge the call')
  }
}

interface Pending {
  acked: boolean
  ackTimer: NodeJS.Timeout | undefined
  readonly connection: Connection
  readonly resolve: (value: UiResult) => void
  readonly reject: (cause: UiControlError) => void
  readonly timer: NodeJS.Timeout
  readonly cleanup: () => void
}

interface Connection {
  readonly stream: PageStream
  readonly windowId: string
  /** The desktop window the page is in, when the Electron shell tagged it. */
  readonly shellWindow: number | undefined
  focused: boolean
  /** Order of last focus (or connection), so the most recent wins. */
  lastActive: number
  /** A page that did not acknowledge a read-only call in time (a frozen or abandoned tab): last in line until it speaks again. */
  suspect: boolean
}

/** How long a call may take before it is given up (a wait may take up to 10 seconds itself). */
const DEFAULT_CALL_TIMEOUT_MS = 30_000
/** How long a page has to say it heard a read-only call before the call goes to the next page. */
const DEFAULT_ACK_MS = 3000

export interface ChannelOptions {
  /** How long a page has to acknowledge a read-only call (`look`, `wait`) before the next page is tried. */
  readonly ackMs?: number
}

/**
 * The pages and who drives which. One page answers a call, chosen the same way every time: the page the Host just sent somewhere (it comes back as a new page, `prefer`), else the
 * one in front (it reports `focused`), else the most recently active; a page that did not acknowledge a call in time goes to the end of the line. An explicit desktop `window` picks its page.
 */
export class UiChannel {
  private readonly ackMs: number
  /** The page the Host sent to a new place and that came back: it keeps being driven until the person focuses another page. */
  private preferred: string | undefined

  constructor(options: ChannelOptions = {}) {
    this.ackMs = options.ackMs ?? DEFAULT_ACK_MS
  }

  private readonly connections = new Map<string, Connection>()
  private readonly pending = new Map<number, Pending>()
  private nextId = 1
  private clock = 0
  private closed = false
  /** Callers waiting for a page to (re)connect: each is told once, by the next stream that attaches. */
  private readonly attachWaiters = new Set<(windowId: string) => void>()

  /**
   * Register a page's stream. A stream already open for the same window is closed first, and its calls settle as `disconnected`.
   * @returns the function to call when this stream ends.
   */
  attach(windowId: string, focused: boolean, stream: PageStream, shellWindow?: number): () => void {
    const previous = this.connections.get(windowId)
    if (previous !== undefined) this.drop(previous, true)
    const connection: Connection = { stream, windowId, shellWindow, focused, lastActive: ++this.clock, suspect: false }
    this.connections.set(windowId, connection)
    for (const waiter of [...this.attachWaiters]) waiter(windowId)
    return () => { if (this.connections.get(windowId) === connection) this.drop(connection, false) }
  }

  /** A message a page sent by POST. Only the window that was asked may answer a call, so another page cannot forge a result. */
  receive(windowId: string, message: ChannelToHost): void {
    const connection = this.connections.get(windowId)
    if (connection === undefined) return
    // Whatever a page says, it is alive.
    connection.suspect = false
    if (message.t === 'focus') {
      connection.focused = message.focused
      if (message.focused) {
        connection.lastActive = ++this.clock
        // The person moved to this page: the Host stops insisting on the one it sent somewhere.
        if (this.preferred !== windowId) this.preferred = undefined
      }
      return
    }
    const entry = this.pending.get(message.id)
    if (entry === undefined || entry.connection !== connection) return
    if (message.t === 'ack') {
      entry.acked = true
      if (entry.ackTimer !== undefined) clearTimeout(entry.ackTimer)
      return
    }
    if (message.t === 'result') this.settle(message.id, message.value)
    else this.settle(message.id, undefined, new UiControlError(message.code, message.message))
  }

  /** True when at least one page is connected. */
  get connected(): boolean {
    return this.connections.size > 0
  }

  /** The windows currently connected, most recently active first (for diagnostics and tests). */
  windows(): readonly { windowId: string; focused: boolean; shellWindow?: number }[] {
    return this.ordered().map(({ windowId, focused, shellWindow }) => ({ windowId, focused, ...(shellWindow === undefined ? {} : { shellWindow }) }))
  }

  /** Drive this page from now on (it is the one the Host just sent to a new place), until the person focuses another. */
  prefer(windowId: string): void {
    const connection = this.connections.get(windowId)
    if (connection === undefined) return
    this.preferred = windowId
    connection.lastActive = ++this.clock
  }

  /**
   * Ask the current page to do something. A read-only call (`look`, `wait`) that the page does not acknowledge in time goes to the next page, and the silent one is last in line
   * until it speaks; a call that changes the page is never sent to a second page, because the first might still run it.
   * @throws UiControlError `no-window`, `timeout`, `aborted`, `unloaded`, `disconnected`, or whatever the page refused with.
   */
  async call(request: UiRequest, options: { signal?: AbortSignal; timeoutMs?: number; window?: number } = {}): Promise<UiResult> {
    if (this.closed) throw new UiControlError('unloaded', 'the door was unloaded')
    const ordered = this.ordered()
    // `window` is the number `window list` prints: that desktop window's page, not the one used last.
    const candidates = options.window === undefined ? ordered : ordered.filter(connection => connection.shellWindow === options.window)
    if (candidates.length === 0 && options.window !== undefined) {
      const known = ordered.flatMap(connection => (connection.shellWindow === undefined ? [] : [String(connection.shellWindow)]))
      throw new UiControlError('no-window', `no page of window ${String(options.window)} is connected to the door${known.length === 0 ? ' (no desktop window has a page connected)' : `; windows with a page: ${known.join(', ')}`}; window list prints the windows`)
    }
    if (candidates.length === 0) throw new UiControlError('no-window', 'no page of the app is open to control')
    if (options.signal?.aborted === true) throw new UiControlError('aborted', 'the call was cancelled')
    const readOnly = request.op === 'snapshot' || request.op === 'wait'
    for (const [at, target] of candidates.entries()) {
      try {
        return await this.callOne(target, request, options, readOnly && at < candidates.length - 1)
      } catch (cause) {
        if (!(cause instanceof Silent)) throw cause
      }
    }
    throw new UiControlError('timeout', 'no page of the app answered')
  }

  private callOne(target: Connection, request: UiRequest, options: { signal?: AbortSignal; timeoutMs?: number }, failOver: boolean): Promise<UiResult> {
    const signal = options.signal
    const id = this.nextId
    this.nextId += 1
    return new Promise<UiResult>((resolve, reject) => {
      const timer = setTimeout(() => { this.settle(id, undefined, new UiControlError('timeout', 'the page did not answer in time')) }, options.timeoutMs ?? DEFAULT_CALL_TIMEOUT_MS)
      const onAbort = (): void => { this.settle(id, undefined, new UiControlError('aborted', 'the call was cancelled')) }
      signal?.addEventListener('abort', onAbort, { once: true })
      const ackTimer = failOver
        ? setTimeout(() => {
            const entry = this.pending.get(id)
            if (entry === undefined || entry.acked) return
            target.suspect = true
            this.settle(id, undefined, new Silent())
          }, this.ackMs)
        : undefined
      this.pending.set(id, { acked: false, ackTimer, connection: target, resolve, reject, timer, cleanup: () => { signal?.removeEventListener('abort', onAbort) } } as Pending)
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
   * A promise for the window id of the next page that connects and was not connected when this was asked (the page that came back after a reload or a move).
   * @returns that id, or `undefined` when no new page connected within `timeoutMs`.
   */
  expectNewPage(timeoutMs: number): Promise<string | undefined> {
    const known = new Set(this.connections.keys())
    return new Promise((resolve) => {
      const done = (value: string | undefined): void => { clearTimeout(timer); this.attachWaiters.delete(waiter); resolve(value) }
      const waiter = (windowId: string): void => { if (!known.has(windowId)) done(windowId) }
      const timer = setTimeout(() => { done(undefined) }, timeoutMs)
      this.attachWaiters.add(waiter)
    })
  }

  /**
   * Ask every connected page to reload (the app just changed under them) and wait, up to `timeoutMs`, for them to come back. Best effort: a page that does not come back
   * (it was closed, or it moved to a page without the door) is not an error here.
   * @returns how many pages were asked.
   */
  async reloadAll(timeoutMs = 8000): Promise<number> {
    const targets = this.ordered()
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

  /** The order pages are driven in: the one the Host sent somewhere, suspect ones last, the one in front, then the most recently active. */
  private ordered(): Connection[] {
    const rank = (connection: Connection): number => (connection.suspect ? 0 : 4) + (connection.windowId === this.preferred ? 2 : 0) + (connection.focused ? 1 : 0)
    return [...this.connections.values()].sort((a, b) => rank(b) - rank(a) || b.lastActive - a.lastActive)
  }

  /** Forget a connection; its calls in flight settle as `disconnected` at once rather than waiting for their timeout. */
  private drop(connection: Connection, closeStream: boolean): void {
    this.connections.delete(connection.windowId)
    if (this.preferred === connection.windowId) this.preferred = undefined
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
    if (entry.ackTimer !== undefined) clearTimeout(entry.ackTimer)
    entry.cleanup()
    if (failure !== undefined) entry.reject(failure)
    else if (value !== undefined) entry.resolve(value)
  }
}
