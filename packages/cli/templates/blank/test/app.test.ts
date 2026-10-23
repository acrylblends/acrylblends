import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { type App, createApp } from '../src/app.ts'
import { pinnedInstance, withPort } from '../src/plugins/instance/index.ts'
import { APP_NAME } from '../src/routes.ts'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

/** Boot the app in a throwaway home on any free port, run the test, always stop it and remove the home. */
async function withApp(run: (app: App) => Promise<void>) {
  const home = await mkdtemp(join(tmpdir(), 'app-test-'))
  const app = await createApp(withPort(pinnedInstance(home, { root: projectRoot }), 0))
  try {
    await run(app)
  } finally {
    await app.stop()
    await rm(home, { recursive: true, force: true })
  }
}

test('serves the index route', () =>
  withApp(async (app) => {
    const response = await fetch(`${app.url}/`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { app: APP_NAME, ok: true })
  }))

test('answers health checks and 404 for unknown paths', () =>
  withApp(async (app) => {
    assert.equal((await fetch(`${app.url}/health`)).status, 200)
    const missing = await fetch(`${app.url}/nope`)
    assert.equal(missing.status, 404)
    await missing.body?.cancel()
  }))

test('stops listening when stopped', async () => {
  const home = await mkdtemp(join(tmpdir(), 'app-test-'))
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
    ['http', 'routes', 'server'],
  )
  assert.throws(() => readManifest({ nothing: 1 }), /parameter-override-unknown/)
})
