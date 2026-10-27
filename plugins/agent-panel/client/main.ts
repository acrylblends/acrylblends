// The panel in the page: a button at the corner opens a side panel (a shadow root, so the app's CSS cannot touch it and it cannot touch the app's). It asks the app's
// agent through POST /api/agent-panel/ask, shows the answer as it arrives, and reloads the page after a run that installed or removed a plugin.
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
form { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-top: 1px solid #e5e7eb }
textarea { width: 100%; min-height: 64px; resize: vertical; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px }
.row { display: flex; gap: 8px; align-items: center }
.row button, header button { padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; cursor: pointer }
.row button.send { background: #1f2937; color: #fff; border-color: #1f2937 }
`

async function start(): Promise<void> {
  const reply = await fetch(`${PREFIX}/session`)
  if (!reply.ok) return
  const session = (await reply.json()) as Session

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
  const show = (open: boolean): void => {
    panel.classList.toggle('shown', open)
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

  let controller: AbortController | undefined
  stop.addEventListener('click', () => controller?.abort())
  shadow.querySelector('form')!.addEventListener('submit', async (submitted) => {
    submitted.preventDefault()
    const message = input.value.trim()
    if (message === '' || controller) return
    input.value = ''
    line(message, 'me')
    controller = new AbortController()
    send.disabled = true
    stop.disabled = false
    let changed = false
    let answer: HTMLElement | undefined
    try {
      const response = await fetch(`${PREFIX}/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-agent-panel-token': session.token },
        body: JSON.stringify({ message, driver: driver.value }),
        signal: controller.signal,
      })
      if (!response.ok) {
        line(
          ((await response.json().catch(() => ({}))) as { error?: string }).error ??
            `The panel answered ${response.status}.`,
          'err',
        )
        return
      }
      for await (const { event, data } of events(response)) {
        if (event === 'text') {
          answer ??= line('')
          answer.textContent += String(data.text ?? '')
        } else if (event === 'tool') {
          line(`${String(data.tool)}${data.error ? ` failed: ${String(data.error)}` : ''}`, 'tool')
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
      line(
        controller?.signal.aborted
          ? 'Stopped.'
          : `The request failed: ${error instanceof Error ? error.message : String(error)}`,
        'err',
      )
    } finally {
      controller = undefined
      send.disabled = false
      stop.disabled = true
    }
    // A plugin was installed or removed: the new feature is served by the running app, so the page only needs to be loaded again (unless something is being typed).
    if (changed && input.value.trim() === '') {
      line('Reloading the page to show it.', 'tool')
      setTimeout(() => location.reload(), 900)
    }
  })
  document.body.append(host)
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
