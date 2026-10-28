import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import * as router from '../../acryl-router/src/index.ts'
import * as state from '../../acryl-state/src/index.ts'
import { agent, memory, model, tools } from '../../agent/index.ts'
import { builder } from '../../builder/index.ts'
import { extensions } from '../../extensions/index.ts'
import { instance, pinnedInstance } from '../../instance/index.ts'
import * as panel from '../index.ts'

const cleanup: Array<() => Promise<void> | void> = []
afterEach(async () => {
  for (const step of cleanup.splice(0)) await step()
})

const OWN = { 'sec-fetch-site': 'same-origin' }

/** An app with the agent family, the panel mounted BEFORE a page of the app's own. */
async function boot(env: Record<string, string | undefined> = {}) {
  const saved = { NODE_ENV: process.env.NODE_ENV, ACRYL_DOOR: process.env.ACRYL_DOOR }
  process.env.NODE_ENV = env.NODE_ENV ?? 'test'
  if (env.ACRYL_DOOR === undefined) delete process.env.ACRYL_DOOR
  else process.env.ACRYL_DOOR = env.ACRYL_DOOR
  const root = mkdtempSync(join(tmpdir(), 'panel-root-'))
  const app = new Context()
  const fibers: Array<ReturnType<Context['plugin']>> = []
  // One after another, as `blend.yaml` does (compose): the panel's middleware is mounted before the page it wraps.
  const mount = async (fiber: ReturnType<Context['plugin']>) => {
    fibers.push(fiber)
    await fiber.await()
  }
  for (const start of [
    () => app.plugin(instance, pinnedInstance(join(root, '.acrylblends'), { root })),
    () => app.plugin(router),
    () => app.plugin(state),
    () => app.plugin(extensions, { sources: [{ dir: join(root, 'plugins'), trust: 'install' }] }),
    () => app.plugin(model),
    () => app.plugin(tools),
    () => app.plugin(memory),
    () => app.plugin(agent),
    () => app.plugin(builder, {}),
    () => app.plugin(panel, { drivers: [] }),
    () =>
      app.plugin({
        name: 'page',
        inject: ['router'],
        apply(ctx: Context) {
          ctx.router.route(
            '/',
            new router.Acryl()
              .get('/', (c) => c.html('<!doctype html><html><body><h1>Home</h1></body></html>'))
              .get('/data', (c) => c.json({ ok: true })),
          )
        },
      }),
  ])
    await mount(start())
  cleanup.push(async () => {
    for (const fiber of [...fibers].reverse()) await fiber.dispose()
    rmSync(root, { recursive: true, force: true })
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  return { app, root }
}

/** The events of a finished server-sent stream. */
async function eventsOf(
  response: Response,
): Promise<Array<{ event: string; data: Record<string, unknown> }>> {
  const text = await response.text()
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((block) => ({
      event: /^event: (.*)$/mu.exec(block)?.[1] ?? 'message',
      data: JSON.parse(/^data: (.*)$/mu.exec(block)?.[1] ?? '{}') as Record<string, unknown>,
    }))
}

test('the script tag is added to HTML pages and to nothing else', async () => {
  const { app } = await boot()
  const page = await (await app.router.request('/')).text()
  assert.match(
    page,
    /<script type="module" src="\/api\/agent-panel\/panel\.js"><\/script><\/body>/u,
  )
  assert.equal(await (await app.router.request('/data')).text(), '{"ok":true}')
})

test("only the app's own page gets a session, and the token is needed to ask", async () => {
  const { app } = await boot()
  assert.equal((await app.router.request('/api/agent-panel/session')).status, 403)
  assert.equal(
    (
      await app.router.request('/api/agent-panel/session', {
        headers: { 'sec-fetch-site': 'cross-site' },
      })
    ).status,
    403,
  )
  const session = (await (
    await app.router.request('/api/agent-panel/session', { headers: OWN })
  ).json()) as { token: string; drivers: Array<{ name: string; kind: string }> }
  assert.deepEqual(session.drivers, [{ name: 'agent', kind: 'chat' }])
  assert.match(session.token, /^[0-9a-f]{48}$/u)
  const ask = (headers: Record<string, string>, body: unknown) =>
    app.router.request('/api/agent-panel/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  assert.equal((await ask({}, { message: 'hi' })).status, 403)
  assert.equal((await ask(OWN, { message: 'hi' })).status, 403)
  assert.equal(
    (await ask({ ...OWN, 'x-agent-panel-token': 'wrong' }, { message: 'hi' })).status,
    403,
  )
  const good = { ...OWN, 'x-agent-panel-token': session.token }
  assert.equal((await ask(good, { message: '' })).status, 400)
  assert.equal((await ask(good, { message: 'hi', driver: 'claude' })).status, 400)
})

test('a message makes the agent build a feature live: tool events, a change event, and the page of the running app serves it', async () => {
  const { app, root } = await boot()
  const session = (await (
    await app.router.request('/api/agent-panel/session', { headers: OWN })
  ).json()) as { token: string }
  assert.equal((await app.router.request('/hello')).status, 404)
  const response = await app.router.request('/api/agent-panel/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...OWN, 'x-agent-panel-token': session.token },
    body: JSON.stringify({ message: 'create route hello /hello Hello' }),
  })
  assert.equal(response.status, 200)
  const events = await eventsOf(response)
  const names = events.map((e) => e.event)
  assert.ok(names.includes('tool'), names.join())
  assert.ok(names.includes('change'), names.join())
  assert.deepEqual(events.find((e) => e.event === 'change')?.data, {
    extension: 'hello',
    action: 'installed',
  })
  assert.equal(names.at(-1), 'done')
  assert.equal(events.at(-1)?.data.changed, true)
  assert.match(
    String(events.find((e) => e.event === 'text')?.data.text),
    /hello: installed, active/u,
  )
  // No restart: the same app answers the new route now.
  assert.deepEqual(await (await app.router.request('/hello')).json(), { text: 'Hello' })
  // Every ask is in the audit log, without its text.
  const audit = readFileSync(join(root, '.acryl', 'audit', 'agent-panel.jsonl'), 'utf8')
  assert.match(audit, /"ask":"start","driver":"agent"/u)
  assert.match(audit, /"ask":"end","driver":"agent","changed":true/u)
  assert.doesNotMatch(audit, /create route hello/u)
})

test("the panel's browser code is served and compiled for the browser", async () => {
  const { app } = await boot()
  const loader = await app.router.request('/api/agent-panel/panel.js')
  assert.equal(loader.status, 200)
  assert.match(await loader.text(), /agent-panel\/client\/main\.ts/u)
  const main = await app.router.request('/api/agent-panel/client/main.ts')
  assert.equal(main.status, 200)
  assert.match(main.headers.get('content-type') ?? '', /javascript/u)
  assert.doesNotMatch(await main.text(), /: Session|interface /u)
})

test('it is a development tool: with NODE_ENV=production or ACRYL_DOOR=off it adds nothing', async () => {
  for (const env of [{ NODE_ENV: 'production' }, { ACRYL_DOOR: 'off' }]) {
    const { app, root } = await boot(env)
    assert.doesNotMatch(await (await app.router.request('/')).text(), /agent-panel/u)
    assert.equal(
      (await app.router.request('/api/agent-panel/session', { headers: OWN })).status,
      404,
    )
    assert.equal(existsSync(join(root, '.acryl')), false)
    await cleanup.pop()?.()
  }
})

test('another plugin adds a chat driver to the registry; the panel lists it, runs it, and drops it when the plugin goes', async () => {
  const { app } = await boot()
  const session = async () =>
    (await (await app.router.request('/api/agent-panel/session', { headers: OWN })).json()) as {
      token: string
      drivers: Array<{ name: string; kind: string }>
    }
  const fiber = app.plugin({
    name: 'echo-driver',
    inject: ['drivers'],
    apply(ctx: Context) {
      ctx.effect(() =>
        ctx.drivers.register({
          kind: 'chat',
          name: 'echo',
          async *start({ message }) {
            yield { event: 'text', data: { text: `echo: ${message}` } }
          },
        }),
      )
    },
  })
  await fiber.await()
  const listed = await session()
  assert.deepEqual(
    listed.drivers.map((d) => d.name),
    ['agent', 'echo'],
  )
  const response = await app.router.request('/api/agent-panel/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...OWN, 'x-agent-panel-token': listed.token },
    body: JSON.stringify({ message: 'hi', driver: 'echo' }),
  })
  const events = await eventsOf(response)
  assert.deepEqual(
    events.map((e) => [e.event, e.data.text ?? e.data.changed]),
    [
      ['text', 'echo: hi'],
      ['done', false],
    ],
  )
  await fiber.dispose()
  assert.deepEqual(
    (await session()).drivers.map((d) => d.name),
    ['agent'],
  )
})

test('a plugin that injects drivers is pending while no panel is mounted, and starts when the panel arrives', async () => {
  const app = new Context()
  let registered = false
  const fiber = app.plugin({
    name: 'late-driver',
    inject: ['drivers'],
    apply(ctx: Context) {
      ctx.effect(() => {
        registered = true
        return () => {}
      })
    },
  })
  await fiber.await().catch(() => {})
  assert.equal(registered, false)
  const { createDrivers } = await import('../drivers.ts')
  app.provide('drivers', createDrivers())
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(registered, true)
  await fiber.dispose()
})

test('pi is offered when it has a DeepSeek key, from the environment or from its own stored login', async () => {
  const { piHasDeepseekKey } = await import('../headless.ts')
  const { mkdirSync, writeFileSync } = await import('node:fs')
  const home = mkdtempSync(join(tmpdir(), 'pi-home-'))
  cleanup.push(() => rmSync(home, { recursive: true, force: true }))
  assert.equal(piHasDeepseekKey({}, home), false, 'no key and no login')
  assert.equal(
    piHasDeepseekKey({ DEEPSEEK_API_KEY: 'k' }, home),
    true,
    'the key in the environment',
  )
  mkdirSync(join(home, '.pi', 'agent'), { recursive: true })
  writeFileSync(join(home, '.pi', 'agent', 'auth.json'), JSON.stringify({ openai: { key: 'x' } }))
  assert.equal(piHasDeepseekKey({}, home), false, 'a login for another provider does not count')
  writeFileSync(
    join(home, '.pi', 'agent', 'auth.json'),
    JSON.stringify({ deepseek: { type: 'api_key', key: 'k' } }),
  )
  assert.equal(piHasDeepseekKey({}, home), true, 'the DeepSeek key pi stored')
  writeFileSync(join(home, '.pi', 'agent', 'auth.json'), 'not json')
  assert.equal(piHasDeepseekKey({}, home), false, 'an unreadable file is no login')
})
