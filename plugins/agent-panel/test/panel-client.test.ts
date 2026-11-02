// The panel in a page that is replaced (a run that changes files reloads the page, and a mount replaces the panel): a submit is prevented before anything
// else and says why, a remount leaves one host and keeps the draft, and a page reloaded mid-run shows the run it lost. The frame gate caught the opposite
// once - an empty log with no refusal and no run (2026-11-02) - so these are the promises the panel makes to a person on a slow machine.
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { start } from '../client/main.ts'

const SESSION = { token: 'gate-token', drivers: [{ name: 'agent', kind: 'chat' }] }
let dom: JSDOM | undefined

/** One server-sent answer: the frames, then the stream closes. */
function runStream(frames: readonly string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      for (const frame of frames) controller.enqueue(encoder.encode(frame))
      setTimeout(() => {
        controller.close()
      }, 100)
    },
  })
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

/** A page with the globals the panel reads and a fetch that answers the session and the follow request; no WebSocket, so the panel streams over fetch. */
function mountPage(follow: () => Response): void {
  dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://127.0.0.1:4444/app',
  })
  const globals = globalThis as unknown as Record<string, unknown>
  globals.window = dom.window
  globals.document = dom.window.document
  globals.sessionStorage = dom.window.sessionStorage
  globals.location = dom.window.location
  globals.Event = dom.window.Event
  delete globals.WebSocket
  globals.fetch = async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.endsWith('/session'))
      return new Response(JSON.stringify(SESSION), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    if (url.endsWith('/run')) return follow()
    return new Response('{}', { status: 200 })
  }
}

afterEach(() => {
  dom?.window.close()
  dom = undefined
})

const documentOf = (): Document => dom!.window.document

/** The one panel host and its shadow root. */
function panel(): { host: HTMLElement; root: ShadowRoot } {
  const host = documentOf().getElementById('agent-panel')
  assert.ok(host !== null, 'the panel mounted')
  return { host, root: host.shadowRoot! }
}

/** Poll until the check passes (the panel's stream is asynchronous). */
async function waitFor(check: () => boolean, ms = 3_000): Promise<void> {
  const end = Date.now() + ms
  while (!check() && Date.now() < end) await new Promise((done) => setTimeout(done, 25))
  assert.ok(check(), 'the expected panel state arrived')
}

test('a submit is prevented before anything else and says why when nothing is typed', async () => {
  mountPage(() => runStream([]))
  await start('/api/agent-panel')
  const { root } = panel()
  const event = new dom!.window.Event('submit', { bubbles: true, cancelable: true })
  root.querySelector('form')!.dispatchEvent(event)
  assert.equal(event.defaultPrevented, true, 'the form default never runs')
  assert.match(root.querySelector('#log')!.textContent ?? '', /Type a message first\./)
  // The form names no action either: a missed preventDefault could only submit to this page, never navigate it.
  assert.equal(root.querySelector('form')!.getAttribute('action'), null)
})

test('a remount replaces the one host and keeps the draft', async () => {
  mountPage(() => runStream([]))
  await start('/api/agent-panel')
  const input = panel().root.querySelector('textarea') as HTMLTextAreaElement
  input.value = 'half a thought'
  input.dispatchEvent(new dom!.window.Event('input', { bubbles: true }))
  await start('/api/agent-panel')
  const panels = documentOf().querySelectorAll('#agent-panel')
  assert.equal(panels.length, 1, 'one live panel after a remount')
  assert.equal(
    (panels[0]!.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement).value,
    'half a thought',
  )
})

test('a page replaced mid-run shows the run it lost, retrying while the record arrives', async () => {
  let calls = 0
  // The first two answers are "no run yet": a reload can ask before the server has recorded the run, and the panel must retry instead of showing an
  // empty log for a run that exists.
  mountPage(() => {
    calls += 1
    return calls <= 2
      ? new Response('', { status: 404 })
      : runStream([
          'event: run\ndata: {"message":"add 2 3","startedAt":1,"ended":false}\n\n',
          'event: text\ndata: {"text":"The answer is 5."}\n\n',
        ])
  })
  await start('/api/agent-panel')
  const { root } = panel()
  await waitFor(() => (root.querySelector('#log')!.textContent ?? '').includes('The answer is 5.'))
  const log = root.querySelector('#log')!.textContent ?? ''
  assert.match(log, /add 2 3/, 'the question the run lost is shown again')
  assert.match(log, /The answer is 5\./, 'the answer is shown again')
})
