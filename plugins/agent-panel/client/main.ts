// The panel in the page: a button at the corner opens a side panel (a shadow root, so the app's CSS cannot touch it and it cannot touch the app's). It asks the app's
// agent through POST /api/agent-panel/ask, shows the answer as it arrives, and reloads the page after a run that installed or removed a plugin.
import { describeTool } from './describe.ts'
import { renderMarkdown } from './markdown.ts'

const PREFIX = '/api/agent-panel'

interface Session {
  token: string
  drivers: Array<{ name: string; kind: 'chat' | 'terminal' }>
}
interface PanelEvent {
  event: string
  data: Record<string, unknown>
}

/** The events of a server-sent stream, as they arrive. */
async function* events(response: Response): AsyncGenerator<PanelEvent> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) return
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/gu, '\n')
    for (let end = buffer.indexOf('\n\n'); end !== -1; end = buffer.indexOf('\n\n')) {
      const block = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      let event = 'message'
      let data = ''
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (data !== '') yield { event, data: JSON.parse(data) as Record<string, unknown> }
    }
  }
}

/** What a run is read from: its events, and a way to end the run. A socket and a stream give the same events. */
interface RunSource {
  readonly events: AsyncIterable<PanelEvent>
}

/** The door's id for this page, when the door is in it: sent with a question so the agent's calls (which name no window) drive this page and not another open one. */
function doorPage(): { page?: string } {
  const published = (window as unknown as Record<symbol, { windowId?: unknown } | undefined>)[
    Symbol.for('acryl.door.page')
  ]
  return typeof published?.windowId === 'string' ? { page: published.windowId } : {}
}

/** A WebSocket is not one of the browser's six connections per host, so the panel's Stop and a run still work when two windows stream their own state. */
let socketBroken = false
let activeSocket: WebSocket | undefined

/** The server did not accept the token: it is not the one this page was given (the app restarted since, which `node --watch` does at every change of a file). */
class Refused extends Error {}

/**
 * Open the run socket and send the token and the first action. Resolves once the server has accepted the token (its `accepted` frame), with the socket and its events: the
 * frames of the run as panel events, until the socket closes. One set of handlers serves the socket for its whole life, so a frame is never handed to a handler that was
 * replaced. Rejects with `Refused` when the token is not accepted, and with another error when the page cannot upgrade (a proxy, a server without `ws`): the caller falls back
 * to the stream.
 */
function openSocket(
  token: string,
  action: Record<string, unknown>,
): Promise<{ socket: WebSocket; events: AsyncGenerator<PanelEvent> }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(
      `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${PREFIX}/run/ws`,
    )
    const queue: PanelEvent[] = []
    let wake: (() => void) | undefined
    let closed = false
    let accepted = false
    const timer = setTimeout(() => {
      socket.close()
      reject(new Error('the socket was not accepted in time'))
    }, 4000)
    socket.onopen = () => {
      socket.send(JSON.stringify({ t: 'hello', token }))
      socket.send(JSON.stringify(action))
    }
    socket.onmessage = (message) => {
      try {
        const frame = JSON.parse(String(message.data)) as { e?: unknown; d?: unknown }
        if (frame.e === 'accepted' && !accepted) {
          accepted = true
          clearTimeout(timer)
          resolve({ socket, events: read() })
        } else if (typeof frame.e === 'string')
          queue.push({ event: frame.e, data: (frame.d ?? {}) as Record<string, unknown> })
      } catch {
        // Not a frame of ours.
      }
      wake?.()
    }
    socket.onclose = (event) => {
      clearTimeout(timer)
      closed = true
      if (!accepted)
        reject(
          event.code === 4401
            ? new Refused('the token was not accepted')
            : new Error('the socket closed before it was accepted'),
        )
      wake?.()
    }
    socket.onerror = () => {
      clearTimeout(timer)
      if (!accepted) reject(new Error('the server refused the upgrade'))
    }
    async function* read(): AsyncGenerator<PanelEvent> {
      for (;;) {
        const next = queue.shift()
        if (next !== undefined) {
          yield next
          continue
        }
        if (closed) return
        await new Promise<void>((done) => {
          wake = done
        })
      }
    }
  })
}

const css = `
:host { all: initial }
* { box-sizing: border-box; font: 14px system-ui, sans-serif }
button.open { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; border: 0; border-radius: 24px; padding: 10px 16px; background: #1f2937; color: #fff; cursor: pointer; box-shadow: 0 2px 8px #0004 }
section { position: fixed; top: 0; right: 0; bottom: 0; width: min(380px, 100vw); z-index: 2147483001; display: none; flex-direction: column; background: #fff; color: #111827; border-left: 1px solid #d1d5db; box-shadow: -2px 0 12px #0003 }
section.shown { display: flex }
header { display: flex; gap: 8px; align-items: center; padding: 8px 12px; border-bottom: 1px solid #e5e7eb }
header strong { flex: 1 }
#term { flex: 1; min-height: 0; background: #000 }
#term[hidden], form[hidden], #log[hidden] { display: none }
#log { flex: 1; overflow: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px }
.msg { white-space: pre-wrap; padding: 8px 10px; border-radius: 8px; background: #f3f4f6 }
.me { background: #dbeafe; align-self: flex-end }
.tool { font: 12px ui-monospace, monospace; color: #4b5563; background: none; padding: 0 }
.err { background: #fee2e2 }
.msg.md { white-space: normal; overflow-wrap: anywhere }
.md > :first-child { margin-top: 0 } .md > :last-child { margin-bottom: 0 }
.md p, .md ul, .md ol, .md pre, .md blockquote { margin: 0 0 8px }
.md h3, .md h4, .md h5, .md h6 { margin: 10px 0 4px; font-weight: 600 } .md h3 { font-size: 16px } .md h4, .md h5, .md h6 { font-size: 14px }
.md ul, .md ol { padding-left: 20px } .md li { margin: 2px 0 }
.md code { font: 12px ui-monospace, monospace; background: #e5e7eb; padding: 1px 4px; border-radius: 4px }
.md pre { overflow: auto; background: #111827; color: #f9fafb; padding: 8px 10px; border-radius: 6px }
.md pre code { background: none; padding: 0; color: inherit; white-space: pre }
.md blockquote { border-left: 3px solid #d1d5db; padding-left: 10px; color: #4b5563 }
.md a { color: #1d4ed8 }
.working { font: 12px ui-monospace, monospace; color: #6b7280; padding: 0 }
form { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-top: 1px solid #e5e7eb }
textarea { width: 100%; min-height: 64px; resize: vertical; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px }
.row { display: flex; gap: 8px; align-items: center }
.row button, header button { padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; cursor: pointer }
.row button.send { background: #1f2937; color: #fff; border-color: #1f2937 }
.row button:disabled { opacity: 0.45; cursor: not-allowed }
`

async function start(): Promise<void> {
  const reply = await fetch(`${PREFIX}/session`)
  if (!reply.ok) return
  let session = (await reply.json()) as Session

  const host = document.createElement('div')
  host.id = 'agent-panel'
  const shadow = host.attachShadow({ mode: 'open' })
  shadow.innerHTML = `<style>${css}</style>
    <button class="open" type="button">Ask the agent</button>
    <section aria-label="Agent panel">
      <header><strong>Agent</strong><select aria-label="Agent">${session.drivers
        .map((d) => `<option>${d.name}</option>`)
        .join(
          '',
        )}</select><button class="termstop" type="button" hidden>Stop terminal</button><button class="close" type="button" aria-label="Close">×</button></header>
      <div id="log" role="log"></div>
      <div id="term" hidden></div>
      <form><textarea aria-label="Message" placeholder="What should the app do?"></textarea>
        <div class="row"><button class="send" type="submit">Send</button><button class="stop" type="button" disabled>Stop</button></div></form>
    </section>`
  const $ = <T extends Element>(selector: string): T => shadow.querySelector<T>(selector)!
  const panel = $<HTMLElement>('section')
  const log = $<HTMLElement>('#log')
  const input = $<HTMLTextAreaElement>('textarea')
  const send = $<HTMLButtonElement>('.send')
  const stop = $<HTMLButtonElement>('.stop')
  const driver = $<HTMLSelectElement>('select')
  const term = $<HTMLElement>('#term')
  const termStop = $<HTMLButtonElement>('.termstop')
  termStop.addEventListener('click', () => void terminal?.stop())
  const form = $<HTMLFormElement>('form')
  document.body.append(host)
  const kindOf = (name: string): 'chat' | 'terminal' =>
    session.drivers.find((d) => d.name === name)?.kind ?? 'chat'
  let terminal: { detach(): void; stop(): Promise<void> } | undefined
  // A terminal driver swaps the chat for the driver's own terminal (loaded from the plugin that provides it, only when asked for).
  const choose = async (): Promise<void> => {
    terminal?.detach()
    terminal = undefined
    const isTerminal = kindOf(driver.value) === 'terminal'
    log.hidden = isTerminal
    form.hidden = isTerminal
    term.hidden = !isTerminal
    termStop.hidden = !isTerminal
    if (!isTerminal) return
    try {
      const url = '/api/driver-pty/client/terminal.ts'
      const { openTerminal } = (await import(url)) as {
        openTerminal(options: {
          container: HTMLElement
          token: string
          driver: string
          status(text: string): void
          onChange(change: { extension: string; action: string }): void
        }): Promise<{ detach(): void; stop(): Promise<void> }>
      }
      await refreshSession()
      terminal = await openTerminal({
        container: term,
        token: session.token,
        driver: driver.value,
        status: (text) => line(text, 'tool'),
        onChange: (change) => {
          line(`plugin ${change.extension}: ${change.action}`, 'tool')
          line('Reloading the page to show it.', 'tool')
          setTimeout(() => location.reload(), 900)
        },
      })
    } catch (error) {
      line(
        `The terminal could not open: ${error instanceof Error ? error.message : String(error)}`,
        'err',
      )
      log.hidden = false
    }
  }
  driver.addEventListener('change', () => void choose())
  // The panel sits beside the page, not over it: while it is open the page is narrower by the panel's width, so its header and right-hand columns stay in view. (An element of the page
  // that is positioned fixed to the window is not part of that layout and can still lie under the panel.)
  const root = document.documentElement
  const docked = ['margin-right'] as const
  const saved = new Map<string, [string, string]>()
  const dock = (open: boolean): void => {
    if (open) {
      for (const property of docked)
        saved.set(property, [
          root.style.getPropertyValue(property),
          root.style.getPropertyPriority(property),
        ])
      root.style.setProperty(
        'margin-right',
        `${String(Math.min(380, Math.floor(window.innerWidth * 0.9)))}px`,
        'important',
      )
    } else {
      for (const property of docked) {
        const [value, priority] = saved.get(property) ?? ['', '']
        if (value === '') root.style.removeProperty(property)
        else root.style.setProperty(property, value, priority)
      }
      saved.clear()
    }
  }
  const show = (open: boolean): void => {
    const was = panel.classList.contains('shown')
    panel.classList.toggle('shown', open)
    if (open !== was) dock(open)
    if (open) input.focus()
  }
  $('button.open').addEventListener('click', () => show(true))
  $('button.close').addEventListener('click', () => show(false))
  const line = (text: string, kind = ''): HTMLElement => {
    const el = document.createElement('div')
    el.className = `msg ${kind}`
    el.textContent = text
    log.append(el)
    log.scrollTop = log.scrollHeight
    return el
  }

  // A run belongs to the app, not to this page: it goes on when the page reloads (the door reloads it after a plugin change, an agent may move it to another page) and the page that
  // loads next follows it again. Only Stop cancels it.
  const headers = { 'content-type': 'application/json', 'x-agent-panel-token': session.token }
  /**
   * The token belongs to one start of the app: `node --watch` restarts it at every change of a file, and a page left open across that restart holds a token the new server
   * does not know. Ask for the session again; the caller tries once more with what it gets.
   */
  const refreshSession = async (): Promise<void> => {
    const reply = await fetch(`${PREFIX}/session`)
    if (!reply.ok) return
    session = (await reply.json()) as Session
    headers['x-agent-panel-token'] = session.token
  }
  let following = false
  const stopRun = (): void => {
    // On the run's socket when there is one: a request would wait behind the browser's six connections per host.
    if (activeSocket?.readyState === WebSocket.OPEN)
      activeSocket.send(JSON.stringify({ t: 'stop' }))
    else void fetch(`${PREFIX}/stop`, { method: 'POST', headers })
  }
  stop.addEventListener('click', stopRun)
  // The door's "Agent is driving" bar has a Stop too (the same page): it ends this run.
  window.addEventListener('acryl:stop-run', stopRun)
  const REFUSED = Symbol('refused')
  /** A run over the socket when the server upgrades, else over the stream, with one console warning saying why. `REFUSED` when the server does not know the token. */
  const tryOpenRun = async (
    action: { t: 'ask'; message: string; driver: string; page?: string } | { t: 'follow' },
  ): Promise<RunSource | { error: string } | undefined | typeof REFUSED> => {
    if (!socketBroken && typeof WebSocket !== 'undefined') {
      try {
        const { socket, events: frames } = await openSocket(session.token, action)
        activeSocket = socket
        socket.addEventListener('close', () => {
          if (activeSocket === socket) activeSocket = undefined
        })
        return { events: frames }
      } catch (cause) {
        if (cause instanceof Refused) return REFUSED
        socketBroken = true
        console.warn(
          `agent-panel: the run could not open a WebSocket (${cause instanceof Error ? cause.message : String(cause)}); using server-sent events, which count against the browser's six connections per host`,
        )
      }
    }
    if (action.t === 'ask') {
      const response = await fetch(`${PREFIX}/ask`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: action.message, driver: action.driver, page: action.page }),
      })
      if (response.status === 403) return REFUSED
      if (!response.ok)
        return {
          error:
            ((await response.json().catch(() => ({}))) as { error?: string }).error ??
            `The panel answered ${response.status}.`,
        }
      return { events: events(response) }
    }
    const latest = await fetch(`${PREFIX}/run`, { headers })
    if (latest.status === 403) return REFUSED
    return latest.ok && (latest.headers.get('content-type') ?? '').includes('text/event-stream')
      ? { events: events(latest) }
      : undefined
  }
  /** `tryOpenRun`, and when the token was refused, a new session and one more try without the person seeing anything; a second refusal is shown. */
  const openRun = async (
    action: { t: 'ask'; message: string; driver: string; page?: string } | { t: 'follow' },
  ): Promise<RunSource | { error: string } | undefined> => {
    const first = await tryOpenRun(action)
    if (first !== REFUSED) return first
    await refreshSession()
    const second = await tryOpenRun(action)
    return second === REFUSED
      ? { error: 'the panel was not accepted (reload the page and try again)' }
      : second
  }
  /**
   * Show one run, as its events come, until it ends. `own` is true for a run this page just started (its question is on screen); a run found on load is shown from its question, and
   * a run that had already ended before the page loaded is only shown, never reloads the page.
   */
  const watch = async (source: RunSource, own: boolean): Promise<void> => {
    let live = true
    let changed = false
    let answer: HTMLElement | undefined
    let answered = ''
    // A coding agent started headless says little until it is done, so the panel says it is working, and for how long (from when the run began, not from when this page loaded).
    let started = Date.now()
    let working: HTMLElement | undefined
    let timer: ReturnType<typeof setInterval> | undefined
    const tick = (): void => {
      if (working === undefined) return
      const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000))
      working.textContent = `Working... ${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`
      log.append(working)
    }
    // The panel is busy once there is a run to show. A page that just loaded asks the server for the latest run first, and "there is none" must not make a message typed in that moment
    // wait or vanish, so a run that is only being looked for does not count (it begins at its first event).
    const begin = (): void => {
      if (working !== undefined) return
      following = true
      send.disabled = true
      stop.disabled = false
      working = line('', 'working')
      tick()
      timer = setInterval(tick, 1000)
    }
    if (own) begin()
    try {
      for await (const { event, data } of source.events) {
        if (event === 'idle') continue
        begin()
        if (event === 'run') {
          if (typeof data.startedAt === 'number') started = data.startedAt
          tick()
          live = data.ended !== true
          if (!own) {
            if (typeof data.message === 'string') line(data.message, 'me')
            if (typeof data.driver === 'string' && kindOf(data.driver) === 'chat')
              driver.value = data.driver
            const recent =
              data.ended !== true ||
              (typeof data.endedAt === 'number' && Date.now() - data.endedAt < 120_000)
            if (recent) show(true)
          }
        } else if (event === 'text') {
          answer ??= line('', 'md')
          answered += String(data.text ?? '')
          answer.replaceChildren(renderMarkdown(answered, document))
          log.scrollTop = log.scrollHeight
        } else if (event === 'tool') {
          const described = describeTool(data)
          if (described !== undefined) line(described, 'tool')
        } else if (event === 'change') {
          changed = true
          line(`plugin ${String(data.extension)}: ${String(data.action)}`, 'tool')
        } else if (event === 'error') {
          line(String(data.message ?? 'The run failed.'), 'err')
        } else if (event === 'done') {
          changed = changed || data.changed === true
        }
      }
    } catch (error) {
      line(`The request failed: ${error instanceof Error ? error.message : String(error)}`, 'err')
    } finally {
      if (timer !== undefined) clearInterval(timer)
      if (working !== undefined) {
        working.remove()
        following = false
        send.disabled = false
        stop.disabled = true
      }
    }
    // A plugin was installed or removed while this page watched: the new feature is served by the running app, so the page only needs to be loaded again (unless something is being typed).
    // A run that ended before this page loaded was already shown after its reload, and does not reload it again.
    if (live && changed && input.value.trim() === '') {
      line('Reloading the page to show it.', 'tool')
      setTimeout(() => location.reload(), 900)
    }
  }
  form.addEventListener('submit', async (submitted) => {
    submitted.preventDefault()
    const message = input.value.trim()
    if (message === '' || following) return
    input.value = ''
    line(message, 'me')
    try {
      const run = await openRun({ t: 'ask', message, driver: driver.value, ...doorPage() })
      if (run === undefined) return
      if ('error' in run) {
        line(run.error, 'err')
        return
      }
      await watch(run, true)
    } catch (error) {
      line(`The request failed: ${error instanceof Error ? error.message : String(error)}`, 'err')
    }
  })
  // The latest run, if there is one: shown again after a reload (its question, its events), and followed if it is still going.
  try {
    const latest = await openRun({ t: 'follow' })
    if (latest !== undefined && !('error' in latest)) void watch(latest, false)
  } catch {
    // No run to show.
  }
  // A terminal that was open before a reload is still running on the server: show it again.
  try {
    const remembered = JSON.parse(sessionStorage.getItem('driver-pty-session') ?? 'null') as {
      driver?: string
    } | null
    if (remembered?.driver && kindOf(remembered.driver) === 'terminal') {
      driver.value = remembered.driver
      show(true)
      void choose()
    }
  } catch {
    // No storage: nothing to show again.
  }
}

void start()
