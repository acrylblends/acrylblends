import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { digestFiles } from '@webboxes/blends-core'
import { packFolder, type ReleasePort, readTarball } from '@webboxes/plugin-hub'
import * as router from '../../acryl-router/src/index.ts'
import { routeSource } from '../../builder/script.ts'
import { extensions } from '../../extensions/index.ts'
import { instance, pinnedInstance } from '../../instance/index.ts'
import { type PullResult, pluginShare } from '../index.ts'
import { splitDigest } from '../pull-check.ts'

const cleanup: Array<() => Promise<void> | void> = []
afterEach(async () => {
  for (const step of cleanup.splice(0)) await step()
})

const scratch = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

const ROUTE = routeSource('hello', '/hello', 'Hello')

/** A plugin as a person released it: the folder packed by the hub, the same way `package_plugin` does. */
function pack(files: Record<string, string>, manifest: Record<string, unknown> = {}) {
  const dir = scratch('share-source-')
  const all = {
    'package.json': `${JSON.stringify({ name: 'hello', version: '1.0.0', type: 'module', keywords: ['cordis-plugin', 'acrylblends'], ...manifest }, null, 2)}\n`,
    ...files,
  }
  for (const [path, content] of Object.entries(all)) {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), content)
  }
  const packed = packFolder(dir)
  const file = join(scratch('share-release-'), packed.fileName)
  writeFileSync(file, packed.tarball)
  const digest = digestFiles(
    readTarball(packed.tarball).map(({ path, content }) => ({
      path,
      bytes: content,
      kind: 'file' as const,
    })),
  )
  return { file, tarball: packed.tarball, integrity: packed.integrity, digest }
}

/** One release on a pretend GitHub, as the hub's port reads it. */
const releaseOf = (tarball: Uint8Array, tag = 'v1.0.0'): ReleasePort => ({
  release: async () => ({
    tag,
    assets: [{ name: `hello-${tag.slice(1)}.tgz`, url: 'fixture:hello' }],
  }),
  download: async () => tarball,
})

async function boot(config: { releases?: ReleasePort } = {}) {
  const root = scratch('share-root-')
  const app = new Context()
  const fibers = [
    app.plugin(instance, pinnedInstance(join(root, '.acrylblends'), { root })),
    app.plugin(router),
    app.plugin(extensions, { sources: [{ dir: join(root, 'plugins'), trust: 'install' }] }),
    app.plugin(pluginShare, config),
  ]
  for (const fiber of fibers) await fiber.await()
  cleanup.push(async () => {
    for (const fiber of [...fibers].reverse()) await fiber.dispose()
  })
  const share = (app as unknown as { pluginShare: { pull(source: string): Promise<PullResult> } })
    .pluginShare
  const get = async (path: string) => {
    const response = await (
      app as unknown as { router: { request(path: string): Promise<Response> } }
    ).router.request(path)
    return {
      status: response.status,
      body: response.status === 200 ? await response.json() : undefined,
    }
  }
  const installed = () =>
    (app as unknown as { extensions: { list(): readonly unknown[] } }).extensions.list()
  /** What a refusal must leave as it was: nothing in plugins/, nothing running, no scratch left in the home. */
  const untouched = async () => {
    assert.deepEqual(
      existsSync(join(root, 'plugins')) ? readdirSync(join(root, 'plugins')) : [],
      [],
    )
    assert.deepEqual(installed(), [])
    assert.equal((await get('/hello')).status, 404)
    assert.deepEqual(
      readdirSync(join(root, '.acrylblends')).filter((entry) => entry.startsWith('plugin-pull')),
      [],
    )
  }
  return { app, fibers, root, share, get, installed, untouched }
}

const refused = (result: PullResult, refusal: string, reason: RegExp) => {
  assert.equal(result.ok, false, JSON.stringify(result))
  if (result.ok) return
  assert.equal(result.refusal, refusal, JSON.stringify(result))
  assert.match(result.reason, reason)
  assert.ok(result.next.length > 0, 'a refusal says what to do next')
}

test('a released plugin is pulled into the running app and its route answers without a restart', async () => {
  const release = pack({ 'index.ts': ROUTE })
  const { share, get, root } = await boot({ releases: releaseOf(release.tarball) })
  assert.equal((await get('/hello')).status, 404)
  const result = await share.pull('github:someone/hello@1.0.0')
  assert.ok(result.ok, JSON.stringify(result))
  assert.deepEqual(
    [result.name, result.version, result.integrity, result.digest, result.action, result.state],
    ['hello', '1.0.0', release.integrity, release.digest, 'installed', 'active'],
  )
  assert.deepEqual((await get('/hello')).body, { text: 'Hello' })
  assert.ok(existsSync(join(root, 'plugins', 'hello', 'index.ts')))
})

test('a .tgz path is a source, read from the app folder when relative', async () => {
  const release = pack({ 'index.ts': ROUTE })
  const { share, get, root } = await boot()
  writeFileSync(join(root, 'hello-1.0.0.tgz'), release.tarball)
  const result = await share.pull('hello-1.0.0.tgz')
  assert.ok(result.ok, JSON.stringify(result))
  assert.deepEqual((await get('/hello')).body, { text: 'Hello' })
})

test('the digest the source names must be the digest of what arrived', async () => {
  const release = pack({ 'index.ts': ROUTE })
  const good = await boot({ releases: releaseOf(release.tarball) })
  assert.ok((await good.share.pull(`github:someone/hello@1.0.0@sha256:${release.digest}`)).ok)
  const bad = await boot({ releases: releaseOf(release.tarball) })
  refused(
    await bad.share.pull(`github:someone/hello@1.0.0@sha256:${'0'.repeat(64)}`),
    'digest',
    /is not the digest the source names/,
  )
  await bad.untouched()
})

test('a tampered archive is refused and changes nothing', async () => {
  const release = pack({ 'index.ts': ROUTE })
  const tampered = Buffer.from(release.tarball)
  tampered[tampered.length - 20] = (tampered[tampered.length - 20] ?? 0) ^ 0xff
  const { share, untouched } = await boot({ releases: releaseOf(tampered) })
  refused(await share.pull('github:someone/hello@1.0.0'), 'fetch', /not a plugin tarball/)
  await untouched()
})

test('a plugin with a carriage return is refused with its reason and changes nothing', async () => {
  const release = pack({ 'index.ts': ROUTE.replaceAll('\n', '\r\n') })
  const { share, untouched } = await boot({ releases: releaseOf(release.tarball) })
  refused(
    await share.pull('github:someone/hello@1.0.0'),
    'portability',
    /index\.ts.*carriage return/,
  )
  await untouched()
})

test('a plugin with a name Windows reserves is refused with its reason and changes nothing', async () => {
  const release = pack({ 'index.ts': ROUTE, 'aux.txt': 'x\n' })
  const { share, untouched } = await boot({ releases: releaseOf(release.tarball) })
  refused(
    await share.pull('github:someone/hello@1.0.0'),
    'portability',
    /aux\.txt.*reserved by Windows/,
  )
  await untouched()
})

test('a plugin needing a service this app lacks is refused by name, before any of its code runs', async () => {
  const marker = join(scratch('share-marker-'), 'ran')
  const source = `import { writeFileSync } from 'node:fs'\nwriteFileSync(${JSON.stringify(marker)}, 'x')\nexport const name = 'hello'\nexport const inject = ['router', 'noSuchService']\nexport function apply() {}\n`
  const release = pack({ 'index.ts': source })
  const { share, untouched } = await boot({ releases: releaseOf(release.tarball) })
  refused(await share.pull('github:someone/hello@1.0.0'), 'missing-service', /noSuchService/)
  assert.equal(existsSync(marker), false, 'the plugin ran')
  await untouched()
})

test('a plugin that stays pending after a computed inject is taken back out', async () => {
  const source = `const wanted = ['no', 'Such', 'Service'].join('')\nexport const name = 'hello'\nexport { inject }\nconst inject = [wanted]\nexport function apply() {}\n`
  const release = pack({ 'index.ts': source })
  const { share, untouched } = await boot({ releases: releaseOf(release.tarball) })
  refused(await share.pull('github:someone/hello@1.0.0'), 'missing-service', /noSuchService/)
  await untouched()
})

test('a plugin that fails to start is refused and leaves no folder', async () => {
  const release = pack({
    'index.ts': `export const name = 'hello'\nexport function apply() { throw new Error('refuses to start') }\n`,
  })
  const { share, untouched } = await boot({ releases: releaseOf(release.tarball) })
  refused(await share.pull('github:someone/hello@1.0.0'), 'install', /refuses to start/)
  await untouched()
})

test('an inject that cannot be read without running the plugin is refused', async () => {
  const release = pack({
    'index.ts': `const wanted = ['router']\nexport const name = 'hello'\nexport const inject = wanted\nexport function apply() {}\n`,
  })
  const { share, untouched } = await boot({ releases: releaseOf(release.tarball) })
  refused(await share.pull('github:someone/hello@1.0.0'), 'inject', /without running it/)
  await untouched()
})

test('dependencies are refused: nothing is installed for a pulled plugin', async () => {
  const release = pack({ 'index.ts': ROUTE }, { dependencies: { 'left-pad': '1.3.0' } })
  const { share, untouched } = await boot({ releases: releaseOf(release.tarball) })
  refused(await share.pull('github:someone/hello@1.0.0'), 'dependencies', /left-pad/)
  await untouched()
})

test('a package with no entry file or a name no folder can hold is refused', async () => {
  const noEntry = await boot({ releases: releaseOf(pack({ 'lib.ts': 'export {}\n' }).tarball) })
  refused(await noEntry.share.pull('github:someone/hello@1.0.0'), 'entry', /index\.ts/)
  await noEntry.untouched()
  const scoped = await boot({
    releases: releaseOf(pack({ 'index.ts': ROUTE }, { name: '@someone/hello' }).tarball),
  })
  refused(await scoped.share.pull('github:someone/hello@1.0.0'), 'name', /@someone\/hello/)
  await scoped.untouched()
})

test('sources other than a release or a .tgz are refused by name', async () => {
  const { share, untouched } = await boot()
  refused(await share.pull('npm:hello'), 'source', /npm/)
  refused(await share.pull('store:hello'), 'source', /store/)
  refused(await share.pull('hello'), 'source', /github:/)
  refused(await share.pull('git+https://github.com/someone/hello.git'), 'source', /no release/)
  refused(await share.pull('github:someone/hello@1.0.0@sha256:short'), 'source', /64/)
  await untouched()
})

test('a release that does not exist is refused', async () => {
  const { share, untouched } = await boot({
    releases: { release: async () => undefined, download: async () => new Uint8Array() },
  })
  refused(await share.pull('github:someone/hello@9.9.9'), 'fetch', /no release v9\.9\.9/)
  await untouched()
})

test('pulling the same bytes twice is already there; different bytes never overwrite the folder', async () => {
  const first = pack({ 'index.ts': ROUTE })
  const { share, get, root } = await boot({ releases: releaseOf(first.tarball) })
  assert.ok((await share.pull('github:someone/hello@1.0.0')).ok)
  const again = await share.pull('github:someone/hello@1.0.0')
  assert.ok(again.ok, JSON.stringify(again))
  assert.equal(again.action, 'unchanged')

  writeFileSync(join(root, 'plugins', 'hello', 'mine.md'), 'an edit a person made\n')
  refused(await share.pull('github:someone/hello@1.0.0'), 'folder-exists', /plugins\/hello/)
  assert.ok(existsSync(join(root, 'plugins', 'hello', 'mine.md')))
  assert.deepEqual((await get('/hello')).body, { text: 'Hello' })
})

test('the digest is split off the end of a source', () => {
  const digest = 'a'.repeat(64)
  assert.deepEqual(splitDigest(`github:o/r@1.0.0@sha256:${digest}`), {
    source: 'github:o/r@1.0.0',
    digest,
  })
  assert.deepEqual(splitDigest('github:o/r'), { source: 'github:o/r' })
  assert.throws(() => splitDigest('github:o/r@sha256:ABC'), /64/)
})

test('the service leaves with its fiber', async () => {
  const { app, fibers } = await boot()
  assert.ok(app.get('pluginShare'))
  await fibers.at(-1)?.dispose()
  assert.equal(app.get('pluginShare'), undefined)
})
