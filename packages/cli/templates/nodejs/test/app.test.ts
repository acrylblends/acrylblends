import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { pinnedInstance, withPort } from '../plugins/instance/index.ts'
import { type App, createApp } from '../src/app.ts'
import { APP_NAME } from '../src/routes.ts'

/** Throwaway homes and databases live inside the project (`.acrylblends/` is ignored by git), because a sandboxed agent may not write to the system temp folder. */
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

test('GET / answers with the app name', () =>
  withApp(async (app) => {
    const response = await app.root.router.request('/')
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { app: APP_NAME, ok: true })
  }))

test('GET /about renders the JSX page', () =>
  withApp(async (app) => {
    const response = await app.root.router.request('/about')
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') ?? '', /html/)
    assert.match(
      await response.text(),
      /<main><h1>About<\/h1><p>Rendered on the server with the JSX runtime in plugins\/acryl-router\.<\/p><\/main>/,
    )
  }))

test('an error thrown in a .tsx file names the .tsx line in its stack', async () => {
  const { failingPage } = await import('../src/page.tsx')
  let stack = ''
  try {
    failingPage()
  } catch (error) {
    stack = String((error as Error).stack)
  }
  assert.match(stack, /page\.tsx:\d+/)
})

test('answers health checks and 404 for unknown paths', () =>
  withApp(async (app) => {
    assert.equal((await app.root.router.request('/health')).status, 200)
    assert.equal((await app.root.router.request('/nope')).status, 404)
  }))

test('GET /counter serves a page with a client component, and the component is compiled for the browser', () =>
  withApp(async (app) => {
    const page = await app.root.router.request('/counter')
    assert.equal(page.status, 200)
    assert.match(await page.text(), /<script type="module" src="\/client\/counter\.tsx">/)
    const module = await app.root.router.request('/client/counter.tsx')
    assert.equal(module.status, 200)
    assert.match(module.headers.get('content-type') ?? '', /javascript/)
    assert.doesNotMatch(await module.text(), /<Counter|<button/)
    // The component's import of the DOM renderer is pointed at the browser build the acrylblends package ships.
    const runtime = await app.root.router.request('/client/@acrylblends/jsx-dom.js')
    assert.equal(runtime.status, 200)
  }))
