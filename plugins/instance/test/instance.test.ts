import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
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

test('the plugin provides the chosen instance', async () => {
  const root = new Context()
  const chosen = projectInstance('/work/shop')
  const fiber = root.plugin(instance, chosen)
  await fiber.await()
  assert.equal(root.get('appInstance'), chosen)
  await fiber.dispose()
})
