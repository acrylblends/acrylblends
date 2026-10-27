import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { pinnedInstance, withPort } from '../plugins/instance/index.ts'
import { type App, createApp, readManifest } from '../src/app.ts'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

/** Boot the app on any free port with its data in `home`, run the test, always stop it. */
async function withApp(home: string, run: (app: App) => Promise<void>) {
  const app = await createApp(withPort(pinnedInstance(home, { root: projectRoot }), 0))
  try {
    await run(app)
  } finally {
    await app.stop()
  }
}

async function withHome(run: (home: string) => Promise<void>) {
  const home = await mkdtemp(join(tmpdir(), 'todo-test-'))
  try {
    await run(home)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
}

const send = (app: App, method: string, path: string, body?: unknown) =>
  fetch(`${app.url}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

test('creates, completes, lists and deletes', () =>
  withHome((home) =>
    withApp(home, async (app) => {
      const created = await send(app, 'POST', '/todo/api', { title: ' buy milk ' })
      assert.equal(created.status, 201)
      assert.deepEqual(await created.json(), { id: 1, title: 'buy milk', done: false })

      const done = await send(app, 'PATCH', '/todo/api/1', { done: true })
      assert.deepEqual(await done.json(), { id: 1, title: 'buy milk', done: true })
      assert.deepEqual(await (await send(app, 'GET', '/todo/api')).json(), [
        { id: 1, title: 'buy milk', done: true },
      ])

      assert.equal((await send(app, 'DELETE', '/todo/api/1')).status, 204)
      assert.deepEqual(await (await send(app, 'GET', '/todo/api')).json(), [])
    }),
  ))

test('a change from a foreign origin is refused; a plain request from this machine works', () =>
  withHome((home) =>
    withApp(home, async (app) => {
      const post = (headers: Record<string, string>) =>
        fetch(`${app.url}/todo/api`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify({ title: 'x' }),
        })
      assert.equal((await post({ origin: 'http://evil.example' })).status, 403)
      assert.equal((await post({ origin: 'null' })).status, 403)
      assert.equal((await post({})).status, 201)
      assert.equal((await post({ origin: new URL(app.url).origin })).status, 201)
    }),
  ))

test('rejects bad input and unknown ids', () =>
  withHome((home) =>
    withApp(home, async (app) => {
      assert.equal((await send(app, 'POST', '/todo/api', { title: '' })).status, 400)
      assert.equal((await send(app, 'POST', '/todo/api', { title: 42 })).status, 400)
      assert.equal((await send(app, 'DELETE', '/todo/api/9')).status, 404)
      assert.equal((await send(app, 'PATCH', '/todo/api/9', { done: true })).status, 404)
      assert.equal((await send(app, 'GET', '/nope')).status, 404)
    }),
  ))

test('the list survives a restart: a second app on the same home sees it', () =>
  withHome(async (home) => {
    await withApp(home, async (app) => {
      await send(app, 'POST', '/todo/api', { title: 'first' })
      await send(app, 'POST', '/todo/api', { title: 'second' })
      await send(app, 'PATCH', '/todo/api/2', { done: true })
    })
    await withApp(home, async (app) => {
      const list = (await (await send(app, 'GET', '/todo/api')).json()) as Array<{
        id: number
        done: boolean
      }>
      assert.deepEqual(
        list.map((todo) => [todo.id, todo.done]),
        [
          [1, false],
          [2, true],
        ],
      )
      const created = (await (await send(app, 'POST', '/todo/api', { title: 'third' })).json()) as {
        id: number
      }
      assert.equal(created.id, 3)
    })
  }))

test('serves the page, and streams the list: now, and again on every change', () =>
  withHome((home) =>
    withApp(home, async (app) => {
      const page = await send(app, 'GET', '/todo')
      assert.equal(page.status, 200)
      assert.match(await page.text(), /<title>Todo<\/title>/)

      const controller = new AbortController()
      const stream = await fetch(`${app.url}/todo/events`, { signal: controller.signal })
      const reader = stream.body!.getReader()
      const decoder = new TextDecoder()
      let text = ''
      const until = async (what: RegExp) => {
        for (let waited = 0; !what.test(text) && waited < 3000; waited += 25) {
          const next = await Promise.race([
            reader.read(),
            new Promise<{ done: true; value: undefined }>((done) =>
              setTimeout(() => done({ done: true, value: undefined }), 25),
            ),
          ])
          if (next.value) text += decoder.decode(next.value, { stream: true })
        }
        assert.match(text, what)
      }
      await until(/data: \[\]/)
      await send(app, 'POST', '/todo/api', { title: 'streamed' })
      await until(/"title":"streamed"/)
      controller.abort()
    }),
  ))

test('the manifest decides what is mounted', () => {
  assert.deepEqual(
    readManifest().plugins.map((row) => row.id),
    ['router', 'state', 'todo', 'server'],
  )
})
