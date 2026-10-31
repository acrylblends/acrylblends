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

test('renders a .tsx page, and an error in it names the .tsx line', () =>
  withApp(async (app) => {
    const response = await app.root.router.request(`/about`)
    assert.equal(response.status, 200)
    assert.match(await response.text(), /<main><h1>About<\/h1>/)
    const { failingPage } = await import('../src/about.tsx')
    let stack = ''
    try {
      failingPage()
    } catch (error) {
      stack = String((error as Error).stack)
    }
    assert.match(stack, /about\.tsx:\d+/)
  }))

test('answers health checks and 404 for unknown paths', () =>
  withApp(async (app) => {
    assert.equal((await app.root.router.request(`/health`)).status, 200)
    const missing = await app.root.router.request(`/nope`)
    assert.equal(missing.status, 404)
    await missing.body?.cancel()
  }))

test('the frame row mounts the same routes under /app; the app on its own server keeps its old URLs', () =>
  withApp(async (app) => {
    // Standalone (production, `npm start`): the public URLs do not move.
    for (const path of ['/', '/about', '/health']) {
      const response = await app.root.router.request(path)
      assert.equal(response.status, 200, path)
      await response.body?.cancel()
    }
    // The frame row requires the frame's router and web adapter; the app's routes mount at the one prefix the app names.
    const frame = await import('../src/frame.ts')
    assert.deepEqual([...frame.inject].sort(), ['router', 'routerHttp'])
    const { FRAME_MOUNT_PREFIX, routes } = await import('../src/routes.ts')
    routes.apply(app.root, { prefix: FRAME_MOUNT_PREFIX })
    for (const path of ['', '/about', '/health']) {
      const response = await app.root.router.request(`${FRAME_MOUNT_PREFIX}${path}`)
      assert.equal(response.status, 200, path)
      await response.body?.cancel()
    }
    const missing = await app.root.router.request(`${FRAME_MOUNT_PREFIX}/nope`)
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
  const app = await createApp(withPort(pinnedInstance(home, { root: projectRoot }), 0))
  await app.stop()
  await assert.rejects(fetch(`${app.url}/health`))
  await rm(home, { recursive: true, force: true })
})

test('the manifest decides what is mounted: a parameter changes the server, an unknown value is refused', async () => {
  const { readManifest } = await import('../src/app.ts')
  const manifest = readManifest()
  assert.deepEqual(
    manifest.plugins.map((row) => row.id),
    ['router', 'routes', 'server'],
  )
  assert.throws(() => readManifest({ nothing: 1 }), /parameter-override-unknown/)
})
