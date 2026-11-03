import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import * as nodeServer from 'acryl-node-server'
import { Acryl, apply as routerApply, name as routerName } from 'acryl-router'
import {
  instance,
  PORT_BASE,
  PORT_SPAN,
  projectInstance,
  selectInstance,
  stablePort,
  withPort,
} from '../index.ts'

test('a project keeps its data in its own folder, with a stable port in the app range', () => {
  const chosen = projectInstance('/work/My Shop')
  assert.equal(chosen.kind, 'project')
  assert.equal(chosen.name, 'my-shop')
  assert.equal(chosen.home, join('/work/My Shop', '.acrylblends'))
  assert.equal(chosen.root, '/work/My Shop')
  assert.equal(chosen.port.start, stablePort(chosen.id))
  assert.ok(chosen.port.start >= PORT_BASE && chosen.port.start < PORT_BASE + PORT_SPAN)
  assert.ok(Object.isFrozen(chosen) && Object.isFrozen(chosen.port))
})

test('two folders with the same name are different apps', () => {
  assert.notEqual(projectInstance('/a/shop').id, projectInstance('/b/shop').id)
})

test('the environment pins the home and the port; nothing else reads it', () => {
  const chosen = selectInstance({
    projectRoot: '/work/shop',
    env: { ACRYLBLENDS_HOME: '/tmp/isolated', ACRYLBLENDS_PORT: '0' },
  })
  assert.equal(chosen.kind, 'pinned')
  assert.equal(chosen.home, '/tmp/isolated')
  assert.equal(chosen.root, '/work/shop')
  assert.equal(chosen.name, 'shop')
  assert.deepEqual(chosen.port, { start: 0, scan: false })
  assert.equal(selectInstance({ projectRoot: '/work/shop' }).kind, 'project')
})

test('the interface is loopback unless the environment names one (a container sets it)', () => {
  assert.equal(selectInstance({ projectRoot: '/work/shop', env: {} }).host, undefined)
  const chosen = selectInstance({ projectRoot: '/work/shop', env: { ACRYLBLENDS_HOST: '0.0.0.0' } })
  assert.equal(chosen.host, '0.0.0.0')
})

test('PORT and HOST, the names hosting platforms set, are read when the ACRYLBLENDS_ ones are not, and lose to them', () => {
  const platform = selectInstance({
    projectRoot: '/work/shop',
    env: { PORT: '3299', HOST: '0.0.0.0' },
  })
  assert.deepEqual(platform.port, { start: 3299, scan: true })
  assert.equal(platform.host, '0.0.0.0')
  const both = selectInstance({
    projectRoot: '/work/shop',
    env: { PORT: '3299', HOST: '0.0.0.0', ACRYLBLENDS_PORT: '3400', ACRYLBLENDS_HOST: '127.0.0.1' },
  })
  assert.equal(both.port.start, 3400)
  assert.equal(both.host, '127.0.0.1')
  // An empty ACRYLBLENDS_PORT is not a choice: the platform's PORT is.
  assert.equal(
    selectInstance({ projectRoot: '/work/shop', env: { ACRYLBLENDS_PORT: ' ', PORT: '3299' } }).port
      .start,
    3299,
  )
})

test('an invalid port is refused', () => {
  assert.throws(() => withPort(projectInstance('/x'), 70_000), /port must be/)
})

test('an app whose stable port is one a browser refuses still comes up, because the server moves on', async () => {
  // Every app's seed is hashed into 3100..3999, and 3659 is both inside that range and on the Fetch standard's bad ports: Chromium refuses the
  // page (ERR_UNSAFE_PORT) and Node's fetch answers "bad port". The frame gate was refused at exactly 3659 on 2026-11-03. The listener must skip it.
  let seeded = ''
  for (let n = 0; n < 10_000 && seeded === ''; n += 1) {
    const root = `/tmp/acryl-seed-${String(n)}`
    if (projectInstance(root).port.start === 3659) seeded = root
  }
  assert.notEqual(seeded, '', 'a project folder whose stable port is 3659')
  const chosen = projectInstance(seeded)
  assert.equal(nodeServer.isRestrictedPort(chosen.port.start), true)
  const root = new Context()
  await root.plugin({ name: routerName, apply: routerApply })
  const fiber = root.plugin(nodeServer, { port: chosen.port.start, scan: 20 })
  await fiber
  root.router.route(
    '/',
    new Acryl().get('/ok', (c) => c.text('ok')),
  )
  assert.equal(nodeServer.isRestrictedPort(root.nodeServer.port), false)
  assert.ok(root.nodeServer.port > 3659)
  assert.equal(await (await fetch(`${root.nodeServer.url}/ok`)).text(), 'ok')
  await root.fiber.dispose()
})

test('the plugin provides the chosen instance', async () => {
  const root = new Context()
  const chosen = projectInstance('/work/shop')
  const fiber = root.plugin(instance, chosen)
  await fiber.await()
  assert.equal(root.get('appInstance'), chosen)
  await fiber.dispose()
})
