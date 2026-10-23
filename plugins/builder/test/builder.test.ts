import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import * as router from '../../acryl-router/src/index.ts'
import { agent, memory, model, tools } from '../../agent/index.ts'
import { extensions } from '../../extensions/index.ts'
import { instance, pinnedInstance } from '../../instance/index.ts'
import { builder } from '../index.ts'

const cleanup: Array<() => Promise<void> | void> = []
afterEach(async () => {
  for (const step of cleanup.splice(0)) await step()
})

/** An app with the builder: its project folder and its home are throwaway folders. */
async function boot() {
  const root = mkdtempSync(join(tmpdir(), 'builder-root-'))
  const home = join(root, '.acrylblends')
  const app = new Context()
  const fibers = [
    app.plugin(instance, pinnedInstance(home, { root })),
    app.plugin(router),
    app.plugin(extensions, { sources: [{ dir: join(root, 'extensions'), trust: 'install' }] }),
    app.plugin(model),
    app.plugin(tools),
    app.plugin(memory),
    app.plugin(agent),
    app.plugin(builder, {}),
  ]
  for (const fiber of fibers) await fiber.await()
  cleanup.push(async () => {
    for (const fiber of [...fibers].reverse()) await fiber.dispose()
    rmSync(root, { recursive: true, force: true })
  })
  const ask = async (question: string) => {
    const result = await app.agent.run(question)
    return result.status === 'completed'
      ? result.output
      : `budget exceeded after ${result.steps} steps`
  }
  const get = async (path: string) => {
    const response = await app.router.request(path)
    return { status: response.status, body: response.ok ? await response.json() : undefined }
  }
  return { app, root, ask, get }
}

test('the agent builds a route plugin, updates it, survives a broken update, and removes it', async () => {
  const { ask, get, root } = await boot()
  assert.equal(await ask('create route hello /hello Hello'), 'hello: installed, active.')
  assert.deepEqual(await get('/hello'), { status: 200, body: { text: 'Hello' } })

  assert.equal(await ask('update route hello /hello Bonjour'), 'hello: updated, active.')
  assert.deepEqual((await get('/hello')).body, { text: 'Bonjour' })

  assert.equal(
    await ask('break plugin hello'),
    'Refused: hello refuses to start. Previous version restored: true.',
  )
  assert.deepEqual((await get('/hello')).body, { text: 'Bonjour' })

  assert.equal(await ask('list plugins'), 'hello (active)')
  assert.equal(await ask('remove plugin hello'), 'hello: done.')
  assert.equal((await get('/hello')).status, 404)
  assert.equal(existsSync(join(root, 'extensions', 'hello')), false)
})

test('package_plugin turns an extension into a standalone package with Cordis as a peer', async () => {
  const { app, ask, root } = await boot()
  await ask('create route hello /hello Hello')
  const packaged = (await app.tools.call('package_plugin', { name: 'hello' })) as { dir: string }
  assert.equal(packaged.dir, join(root, 'plugin-packages', 'hello'))
  const manifest = JSON.parse(readFileSync(join(packaged.dir, 'package.json'), 'utf8'))
  assert.deepEqual(
    [manifest.name, manifest.peerDependencies, manifest.dependencies],
    ['hello', { '@deepseek-ai/cordis': '4.0.4' }, undefined],
  )
  assert.ok(existsSync(join(packaged.dir, 'index.ts')))
  await assert.rejects(app.tools.call('package_plugin', { name: 'ghost' }), /has no index\.ts/)
})

test('writes stay inside the plugin folder and only take source files', async () => {
  const { app } = await boot()
  await assert.rejects(
    app.tools.call('write_plugin', { name: 'x', files: { '../escape.ts': '' } }),
    /inside the plugin folder/,
  )
  await assert.rejects(
    app.tools.call('write_plugin', { name: 'x', files: { 'run.sh': 'rm -rf /' } }),
    /only .ts/,
  )
  await assert.rejects(
    app.tools.call('write_plugin', { name: 'Bad', files: { 'index.ts': '' } }),
    /lowercase/,
  )
})

test('the builder refuses to write anywhere that is not an extensions source', async () => {
  const root = mkdtempSync(join(tmpdir(), 'builder-root-'))
  cleanup.push(() => rmSync(root, { recursive: true, force: true }))
  const app = new Context()
  for (const plugin of [model, tools, memory, agent]) await app.plugin(plugin).await()
  await app.plugin(instance, pinnedInstance(join(root, '.acrylblends'), { root })).await()
  await app
    .plugin(extensions, { sources: [{ dir: join(root, 'elsewhere'), trust: 'install' }] })
    .await()
  await assert.rejects(app.plugin(builder, {}).await(), /not an extensions source/)
})

test('a plugin installed live reads a service as a property (ctx.router), not only with ctx.get', async () => {
  const { app, root } = await boot()
  const dir = join(root, 'extensions', 'probe')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'index.ts'),
    `export const name = 'probe'
export const inject = ['router']
export function apply(ctx) {
  ctx.router.get('/probe', (c) => c.json({ ok: true }))
}
`,
  )
  const installed = (await app.extensions.install(dir)) as { ok: boolean; errors?: string[] }
  assert.equal(installed.ok, true, installed.errors?.join('; '))
  assert.equal((await app.router.request('/probe')).status, 200)
  await app.extensions.remove('probe')
  assert.equal((await app.router.request('/probe')).status, 404)
})
