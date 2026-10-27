import type { Db } from '../plugins/acryl-db/src/index.ts'
import type {} from '../plugins/acryl-db/src/cordis.ts'
import { pinnedInstance, withPort } from '../plugins/instance/index.ts'
import { createApp as boot } from '../src/app.ts'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, test } from 'node:test'
import { createApp } from '../src/chat-app.ts'
import type { Llm } from '../src/llm.ts'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

/**
 * A fresh database in memory with the real migrations, opened by the app's own `db` row (the whole Cordis app boots, so the test exercises the same
 * composition as production). Every app is stopped, and its home removed, when the tests end.
 */
const stops: (() => Promise<void>)[] = []
after(() => Promise.all(stops.map((stop) => stop())))
async function memoryDb(): Promise<Db> {
  const home = await mkdtemp(join(tmpdir(), 'chat-test-'))
  const app = await boot(withPort(pinnedInstance(home, { root: projectRoot }), 0), {
    database: ':memory:',
  })
  stops.push(async () => {
    await app.stop()
    await rm(home, { recursive: true, force: true })
  })
  return app.root.db
}

/** A model that answers with fixed pieces and records what it was asked. */
function mock(pieces: string[]) {
  const asked: { role: string; content: string }[][] = []
  const llm: Llm = async function* (messages) {
    asked.push(messages)
    for (const piece of pieces) yield piece
  }
  return { llm, asked }
}

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

/** Parse a Server-Sent Events body into [event, data] pairs. */
function events(text: string): [string, string][] {
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const event = /^event: (.*)$/m.exec(block)?.[1] ?? 'message'
      const data = /^data: (.*)$/m.exec(block)?.[1] ?? ''
      return [event, data]
    })
}

test('the answer streams as events: meta, one token per piece, done', async () => {
  const { llm } = mock(['Hel', 'lo ', 'there\nline'])
  const app = createApp(await memoryDb(), llm)
  const res = await app.request('/api/chat', post({ message: 'hi' }))
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type') ?? '', /text\/event-stream/)
  const got = events(await res.text())
  assert.deepEqual(
    got.map(([e]) => e),
    ['meta', 'token', 'token', 'token', 'done'],
  )
  assert.equal(
    got
      .filter(([e]) => e === 'token')
      .map(([, d]) => JSON.parse(d) as string)
      .join(''),
    'Hello there\nline',
  )
})

test('history is stored, sent back to the model, and listed', async () => {
  const { llm, asked } = mock(['ok'])
  const app = createApp(await memoryDb(), llm)
  const first = events(
    await (await app.request('/api/chat', post({ message: 'first question' }))).text(),
  )
  const id = (JSON.parse(first[0]![1]) as { conversation: number }).conversation
  await (await app.request('/api/chat', post({ message: 'second', conversation: id }))).text()
  assert.deepEqual(
    asked[1]?.map((m) => m.content),
    ['first question', 'ok', 'second'],
  )
  const one = (await (await app.request(`/api/conversations/${id}`)).json()) as {
    messages: { role: string }[]
  }
  assert.deepEqual(
    one.messages.map((m) => m.role),
    ['user', 'assistant', 'user', 'assistant'],
  )
  const list = (await (await app.request('/api/conversations')).json()) as {
    conversations: { title: string }[]
  }
  assert.equal(list.conversations[0]?.title, 'first question')
  const page = await (await app.request(`/?c=${id}`)).text()
  assert.match(page, /first question/)
  assert.match(page, /src="\/client\/chat\.tsx"/)
})

test('a bad message answers 400 with a message, an unknown conversation 404, and nothing reaches the model', async () => {
  const { llm, asked } = mock(['x'])
  const app = createApp(await memoryDb(), llm)
  const empty = await app.request('/api/chat', post({ message: '  ' }))
  assert.equal(empty.status, 400)
  assert.match(JSON.stringify(await empty.json()), /Write a message/)
  assert.equal(
    (await app.request('/api/chat', post({ message: 'hi', conversation: 99 }))).status,
    404,
  )
  assert.equal(asked.length, 0)
})

test('a conversation can be deleted', async () => {
  const app = createApp(await memoryDb(), mock(['a']).llm)
  const first = events(await (await app.request('/api/chat', post({ message: 'hi' }))).text())
  const id = (JSON.parse(first[0]![1]) as { conversation: number }).conversation
  assert.equal((await app.request(`/api/conversations/${id}`, { method: 'DELETE' })).status, 200)
  assert.equal((await app.request(`/api/conversations/${id}`)).status, 404)
  assert.equal((await app.request(`/api/conversations/${id}`, { method: 'DELETE' })).status, 404)
})

test('a failing model sends an error event with a plain message and no detail', async () => {
  const llm: Llm = async function* () {
    yield 'partial '
    throw new Error('upstream secret detail')
  }
  const app = createApp(await memoryDb(), llm)
  const text = await (await app.request('/api/chat', post({ message: 'hi' }))).text()
  assert.doesNotMatch(text, /secret detail/)
  const last = events(text).at(-1)
  assert.equal(last?.[0], 'error')
  assert.match(last?.[1] ?? '', /could not answer/)
})

test('when the client goes away the model call is aborted and what arrived is kept', async () => {
  let sawAbort: (value: boolean) => void = () => {}
  const aborted = new Promise<boolean>((resolve) => {
    sawAbort = resolve
  })
  const llm: Llm = async function* (_messages, signal) {
    yield 'first '
    // The signal may already be aborted by the time the model is asked for more: an abort event that has fired does not fire again.
    if (!signal.aborted)
      await new Promise<void>((resolve) =>
        signal.addEventListener('abort', () => resolve(), { once: true }),
      )
    sawAbort(signal.aborted)
    if (signal.aborted) throw new DOMException('aborted', 'AbortError')
    yield 'never sent'
  }
  const db = await memoryDb()
  const app = createApp(db, llm)
  const controller = new AbortController()
  const res = await app.request('/api/chat', {
    ...post({ message: 'hi' }),
    signal: controller.signal,
  })
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let seen = ''
  while (!seen.includes('first')) seen += decoder.decode((await reader.read()).value)
  controller.abort()
  assert.equal(await aborted, true)
  await new Promise((resolve) => setTimeout(resolve, 50))
  const rows = await db.all<{ role: string; content: string }>(
    'SELECT role, content FROM messages ORDER BY id',
  )
  assert.deepEqual(
    rows.map((r) => `${r.role}:${r.content}`),
    ['user:hi', 'assistant:first '],
  )
})
