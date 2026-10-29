import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { pinnedInstance, withPort } from '../plugins/instance/index.ts'
import { type App, createApp } from '../src/app.ts'
import { APP_NAME } from '../src/routes.ts'

/** Throwaway homes live inside the project (`.acrylblends/` is ignored by git): a sandboxed agent may not write to the system temp folder. */
const scratch = join(fileURLToPath(new URL('..', import.meta.url)), '.acrylblends', 'test')
mkdirSync(scratch, { recursive: true })

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

/** Boot the app in a throwaway home on any free port, run the test, always stop it and remove the home. */
async function withApp(run: (app: App) => Promise<void>) {
  const home = await mkdtemp(join(scratch, 'app-test-'))
  const app = await createApp(withPort(pinnedInstance(home, { root: projectRoot }), 0), {
    listen: false,
  })
  try {
    await run(app)
  } finally {
    await app.stop()
    await rm(home, { recursive: true, force: true })
  }
}

test('serves the index route', () =>
  withApp(async (app) => {
    const response = await app.root.router.request(`/`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { app: APP_NAME, ok: true })
  }))

test('answers health checks and 404 for unknown paths', () =>
  withApp(async (app) => {
    assert.equal((await app.root.router.request(`/health`)).status, 200)
    const missing = await app.root.router.request(`/nope`)
    assert.equal(missing.status, 404)
    await missing.body?.cancel()
  }))

/** A sandbox may forbid listening on a port (Codex's workspace-write does); the one test that starts the real server is skipped there, and says so. */
const canListen = await new Promise<boolean>((done) => {
  const probe = createServer()
  probe.once('error', () => done(false))
  probe.listen(0, '127.0.0.1', () => probe.close(() => done(true)))
})
const skip = canListen ? false : 'this environment does not allow listening on a port'
if (!canListen)
  console.log(
    `skipped: the test that starts the real server (${skip}); every other test ran in process`,
  )

test('stops listening when stopped', { skip }, async () => {
  const home = await mkdtemp(join(scratch, 'app-test-'))
  // The door is left out (ACRYL_DOOR=off): one process at a time serves a folder's door.
  process.env.ACRYL_DOOR = 'off'
  const app = await createApp(withPort(pinnedInstance(home, { root: projectRoot }), 0))
  await app.stop()
  await assert.rejects(fetch(`${app.url}/health`))
  await rm(home, { recursive: true, force: true })
})

/** Boot in a given environment, with the warnings collected. */
async function inEnvironment(
  env: Record<string, string | undefined>,
  run: (app: App, warnings: string[]) => Promise<void>,
) {
  const saved = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]))
  const warnings: string[] = []
  const warn = console.warn
  console.warn = (message: unknown) => void warnings.push(String(message))
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    await withApp((app) => run(app, warnings))
  } finally {
    console.warn = warn
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

const asking = (app: App) =>
  app.root.router.request('/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question: 'add 2 3' }),
  })

test('in production the agent and the builder are left out and the extensions are read-only: no /ask, no live install, no approve route; the page and /health stay', () =>
  inEnvironment({ NODE_ENV: 'production', ACRYL_PRODUCTION_KEEP: undefined }, async (app) => {
    assert.equal((await app.root.router.request('/health')).status, 200)
    assert.equal((await app.root.router.request('/')).status, 200)
    for (const [path, method] of [
      ['/ask', 'POST'],
      ['/extensions', 'GET'],
      ['/extensions/approve', 'POST'],
      ['/tasks', 'GET'],
    ] as const) {
      const response = await app.root.router.request(path, { method })
      assert.equal(response.status, 404, `${method} ${path} answered ${response.status}`)
      await response.body?.cancel()
    }
    assert.equal((app.root as unknown as { agent?: unknown }).agent, undefined)
    // The service is there (it starts what plugins/ holds, once) and refuses every change.
    const service = (
      app.root as unknown as { extensions?: { install(source: string): Promise<unknown> } }
    ).extensions
    assert.ok(service, 'the extensions service starts read-only in production')
    await assert.rejects(service.install('/anywhere'), /read-only here \(production\)/)
  }))

test('ACRYL_PRODUCTION_KEEP keeps the named rows in production and says so at start; a name it does not know is reported', () =>
  inEnvironment(
    { NODE_ENV: 'production', ACRYL_PRODUCTION_KEEP: 'agent,extensions,nope' },
    async (app, warnings) => {
      const answer = await asking(app)
      assert.equal(answer.status, 200)
      assert.equal(((await answer.json()) as { status: string }).status, 'completed')
      assert.equal((await app.root.router.request('/extensions')).status, 200)
      assert.ok(
        warnings.some((line) => line.includes('"agent" row runs in production')),
        warnings.join('\n'),
      )
      assert.ok(warnings.some((line) => line.includes('"extensions" row runs in production')))
      assert.ok(!warnings.some((line) => line.includes('"builder" row runs in production')))
      assert.ok(warnings.some((line) => line.includes('names "nope"')))
    },
  ))

test('outside production nothing changes: the agent answers and the extensions route is there', () =>
  inEnvironment({ NODE_ENV: 'test', ACRYL_PRODUCTION_KEEP: undefined }, async (app, warnings) => {
    assert.equal((await asking(app)).status, 200)
    assert.equal((await app.root.router.request('/extensions')).status, 200)
    assert.deepEqual(warnings, [])
  }))
