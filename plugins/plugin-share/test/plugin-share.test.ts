import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { digestFiles } from '@webboxes/blends-core'
import {
  integrityOf,
  type PublishGitPort,
  packFolder,
  type ReleasePort,
  type RepositoryHostPort,
  readTarball,
} from '@webboxes/plugin-hub'
import * as router from '../../acryl-router/src/index.ts'
import { routeSource } from '../../builder/script.ts'
import { extensions } from '../../extensions/index.ts'
import { instance, pinnedInstance } from '../../instance/index.ts'
import { captureApp, verifyApp } from '../../manifest/snapshot.ts'
import {
  type PublishOptions,
  type PublishPlan,
  type PublishPorts,
  type PublishRefused,
  type PublishResult,
  type PullResult,
  pluginShare,
  type RestoreOutcome,
  type SharedPluginInfo,
  type SharedRemoveResult,
} from '../index.ts'
import { splitDigest } from '../pull-check.ts'
import { pulledRecords } from '../pulled-records.ts'

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

async function boot({
  root = scratch('share-root-'),
  ...config
}: {
  releases?: ReleasePort
  publish?: PublishPorts
  root?: string
} = {}) {
  const app = new Context()
  const fibers = [
    app.plugin(instance, pinnedInstance(join(root, '.acrylblends'), { root })),
    app.plugin(router),
    app.plugin(extensions, { sources: [{ dir: join(root, 'plugins'), trust: 'install' }] }),
    app.plugin(pluginShare, config),
  ]
  for (const fiber of fibers) await fiber.await()
  const stop = async () => {
    for (const fiber of [...fibers].reverse()) await fiber.dispose()
  }
  cleanup.push(stop)
  const share = (
    app as unknown as {
      pluginShare: {
        pull(source: string): Promise<PullResult>
        list(): SharedPluginInfo[]
        remove(name: string): Promise<SharedRemoveResult>
        planPublish(name: string, options?: PublishOptions): Promise<PublishPlan | PublishRefused>
        publish(
          name: string,
          confirmed: PublishPlan,
          options?: PublishOptions,
        ): Promise<PublishResult>
      }
    }
  ).pluginShare
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
  const restored = () =>
    (app as unknown as { pluginShare: { restored: Promise<readonly RestoreOutcome[]> } })
      .pluginShare.restored
  return { app, fibers, root, share, get, installed, untouched, stop, restored }
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

// Publishing. The host and git are stand-ins: no test here can reach GitHub.
function fakeHost(login = 'someone') {
  const sent: string[] = []
  const repos = new Set<string>()
  const releases = new Map<string, Buffer>()
  const host: RepositoryHostPort = {
    login: () => login,
    repository: (owner, repo) =>
      repos.has(`${owner}/${repo}`)
        ? { visibility: 'public', url: `https://github.com/${owner}/${repo}` }
        : undefined,
    createRepository(owner, repo, visibility) {
      sent.push(`create ${owner}/${repo} ${visibility}`)
      repos.add(`${owner}/${repo}`)
    },
    setVisibility: () => {},
    addTopics(owner, repo, topics) {
      sent.push(`topics ${owner}/${repo} ${topics.join(',')}`)
    },
    releaseExists: (owner, repo, tag) => releases.has(`${owner}/${repo}@${tag}`),
    createRelease(owner, repo, tag, _title, _notes, asset) {
      sent.push(`release ${owner}/${repo} ${tag}`)
      releases.set(`${owner}/${repo}@${tag}`, readFileSync(asset))
      return `https://github.com/${owner}/${repo}/releases/tag/${tag}`
    },
    cloneUrl: (owner, repo) => `https://github.com/${owner}/${repo}.git`,
  }
  const git: PublishGitPort = {
    clone: (_url, dir) => mkdirSync(dir, { recursive: true }),
    commitAll: () => true,
    tag: () => {},
    push: () => sent.push('push'),
  }
  return { host, git, sent, releases }
}

async function bootWithPlugin(hub: ReturnType<typeof fakeHost>) {
  const booted = await boot({ publish: { host: hub.host, git: hub.git } })
  mkdirSync(join(booted.root, 'plugins', 'hello'), { recursive: true })
  writeFileSync(join(booted.root, 'plugins', 'hello', 'index.ts'), ROUTE)
  return booted
}

const refusedPublish = (answer: PublishPlan | PublishRefused, reason: RegExp) => {
  assert.ok('ok' in answer && answer.ok === false, JSON.stringify(answer))
  assert.match(answer.reason, reason)
}

const planned = (plan: PublishPlan | PublishRefused): PublishPlan => {
  assert.ok('owner' in plan, JSON.stringify(plan))
  return plan
}

test('a plan names the account, repository and version and sends nothing', async () => {
  const hub = fakeHost()
  const { share } = await bootWithPlugin(hub)
  const plan = planned(await share.planPublish('hello'))
  assert.deepEqual(
    [plan.owner, plan.repo, plan.version, plan.visibility, plan.license, plan.createsRepository],
    ['someone', 'hello', '0.1.0', 'public', 'MIT', true],
  )
  assert.deepEqual(hub.sent, [])
})

test('the person can choose the license before the yes, and it is what is released', async () => {
  const hub = fakeHost()
  const { share } = await bootWithPlugin(hub)
  refusedPublish(await share.planPublish('hello', { license: 'not a license' }), /not a license id/)
  const plan = planned(await share.planPublish('hello', { license: 'Apache-2.0' }))
  assert.equal(plan.license, 'Apache-2.0')
  const result = await share.publish('hello', plan, { license: 'Apache-2.0' })
  assert.ok(result.ok, JSON.stringify(result))
  const bytes = hub.releases.get('someone/hello@v0.1.0')
  assert.ok(bytes)
  const manifest = readTarball(bytes).find((file) => file.path === 'package.json')
  assert.equal(
    JSON.parse(Buffer.from(manifest?.content ?? []).toString('utf8')).license,
    'Apache-2.0',
  )
})

test('publishing exactly the confirmed plan releases those bytes, and the pull line carries their digest', async () => {
  const hub = fakeHost()
  const { share } = await bootWithPlugin(hub)
  const plan = planned(await share.planPublish('hello', { owner: 'inboxxobni' }))
  const result = await share.publish('hello', plan, { owner: 'inboxxobni' })
  assert.ok(result.ok, JSON.stringify(result))
  assert.deepEqual(hub.sent, [
    'create inboxxobni/hello public',
    'push',
    'release inboxxobni/hello v0.1.0',
    'topics inboxxobni/hello cordis-plugin',
  ])
  const bytes = hub.releases.get('inboxxobni/hello@v0.1.0')
  assert.ok(bytes)
  assert.equal(result.integrity, plan.integrity)
  assert.equal(integrityOf(bytes), plan.integrity, 'the released bytes are the planned bytes')
  assert.equal(
    result.pullLine,
    `npm run acryl -- plugin pull github:inboxxobni/hello@0.1.0@sha256:${plan.digest}`,
  )
})

test("what another person pulls is the plan's digest", async () => {
  const hub = fakeHost()
  const { share } = await bootWithPlugin(hub)
  const plan = planned(await share.planPublish('hello'))
  assert.ok((await share.publish('hello', plan)).ok)
  const bytes = hub.releases.get('someone/hello@v0.1.0')
  assert.ok(bytes)
  const other = await boot({
    releases: {
      release: async () => ({
        tag: 'v0.1.0',
        assets: [{ name: 'hello-0.1.0.tgz', url: 'fixture:hello' }],
      }),
      download: async () => bytes,
    },
  })
  const pulled = await other.share.pull(`github:someone/hello@0.1.0@sha256:${plan.digest}`)
  assert.ok(pulled.ok, JSON.stringify(pulled))
  assert.deepEqual((await other.get('/hello')).body, { text: 'Hello' })
})

test('nothing is sent when the plugin, the account or the version changed since the person said yes', async () => {
  const hub = fakeHost()
  const { share, root } = await bootWithPlugin(hub)
  const plan = planned(await share.planPublish('hello'))
  writeFileSync(join(root, 'plugins', 'hello', 'note.md'), 'one more file\n')
  const edited = await share.publish('hello', plan)
  assert.equal(edited.ok, false)
  assert.match(edited.ok ? '' : edited.reason, /changed since you confirmed/)
  const elsewhere = planned(await share.planPublish('hello'))
  const other = await share.publish('hello', { ...elsewhere, owner: 'someone-else' })
  assert.equal(other.ok, false)
  assert.deepEqual(hub.sent, [])
})

test('a released version is not released again: the plan names the next patch', async () => {
  const hub = fakeHost()
  const { share, root } = await bootWithPlugin(hub)
  assert.ok((await share.publish('hello', planned(await share.planPublish('hello')))).ok)
  writeFileSync(join(root, 'plugins', 'hello', 'note.md'), 'a change\n')
  const next = planned(await share.planPublish('hello'))
  assert.deepEqual([next.version, next.released, next.createsRepository], ['0.1.1', '0.1.0', false])
  const result = await share.publish('hello', next)
  assert.ok(result.ok, JSON.stringify(result))
  assert.ok(hub.releases.has('someone/hello@v0.1.1'))
})

test('a plugin holding a secret, or not on disk, is refused and nothing is sent', async () => {
  const hub = fakeHost()
  const { share, root } = await bootWithPlugin(hub)
  refusedPublish(await share.planPublish('ghost'), /no plugin "ghost"/)
  writeFileSync(
    join(root, 'plugins', 'hello', 'config.ts'),
    `export const key = 'ghp_${'a'.repeat(36)}'\n`,
  )
  const plan = await share.planPublish('hello')
  refusedPublish(plan, /secret/)
  assert.deepEqual(hub.sent, [])
})

// Remembering a pull: the source and digests stand in the app's own definition, so a copy of the app can fetch the same bytes.
const BLEND = `# What this app is.
apiVersion: blends.acryl.dev/v1alpha1
kind: Blueprint
metadata: { id: acme.board, name: board, version: 0.1.0 }
spec:
  runtime: cordis
  rows:
    - id: router # the routes every plugin mounts on
      name: acryl-router
    - id: extensions
      name: extensions
    - id: plugin-share
      name: plugin-share
`

function appFolder(): string {
  const root = scratch('share-app-')
  writeFileSync(join(root, 'blend.yaml'), BLEND)
  return root
}

const recordsIn = (root: string) => pulledRecords(readFileSync(join(root, 'blend.yaml'), 'utf8'))

test('a pull is written into blend.yaml and the lock, the comments stay, and removing the plugin removes the record', async () => {
  const release = pack({ 'index.ts': ROUTE })
  const root = appFolder()
  captureApp(root)
  const { app, share } = await boot({ releases: releaseOf(release.tarball), root })
  const result = await share.pull('github:someone/hello')
  assert.ok(result.ok, JSON.stringify(result))
  const record = {
    source: 'github:someone/hello@1.0.0',
    integrity: release.integrity,
    digest: release.digest,
  }
  assert.deepEqual(recordsIn(root), { hello: record })
  const text = readFileSync(join(root, 'blend.yaml'), 'utf8')
  assert.match(text, /# the routes every plugin mounts on/)
  const lock = JSON.parse(readFileSync(join(root, 'blend.lock.json'), 'utf8'))
  assert.deepEqual(
    lock.rows.find((row: { id: string }) => row.id === 'plugin-share').config.pulled.hello,
    record,
  )
  assert.equal(verifyApp(root).ok, true, verifyApp(root).problems.join('; '))

  await (
    app as unknown as { extensions: { remove(name: string): Promise<unknown> } }
  ).extensions.remove('hello')
  assert.deepEqual(recordsIn(root), {})
  assert.equal(
    verifyApp(join(root)).problems.filter((problem) => problem.includes('blend.yaml')).length,
    0,
  )
})

test('a local .tgz has no source another machine could fetch, so nothing is recorded, and the answer says so', async () => {
  const release = pack({ 'index.ts': ROUTE })
  const root = appFolder()
  const { share } = await boot({ root })
  writeFileSync(join(root, 'hello-1.0.0.tgz'), release.tarball)
  const result = await share.pull('hello-1.0.0.tgz')
  assert.ok(result.ok, JSON.stringify(result))
  assert.equal(result.remembered, false)
  assert.deepEqual(recordsIn(root), {})
})

test('a refused pull records nothing', async () => {
  const release = pack({
    'index.ts': `export const name = 'hello'\nexport function apply() { throw new Error('refuses to start') }\n`,
  })
  const root = appFolder()
  const { share } = await boot({ releases: releaseOf(release.tarball), root })
  assert.equal((await share.pull('github:someone/hello@1.0.0')).ok, false)
  assert.deepEqual(recordsIn(root), {})
  assert.equal(readFileSync(join(root, 'blend.yaml'), 'utf8'), BLEND)
})

test('a copy of the app without the folder fetches the recorded plugin, verified, and runs it', async () => {
  const release = pack({ 'index.ts': ROUTE })
  const root = appFolder()
  const first = await boot({ releases: releaseOf(release.tarball), root })
  assert.ok((await first.share.pull('github:someone/hello@1.0.0')).ok)
  await first.stop()
  rmSync(join(root, 'plugins', 'hello'), { recursive: true })

  const copy = await boot({ releases: releaseOf(release.tarball), root })
  assert.deepEqual(await copy.restored(), [{ name: 'hello', ok: true }])
  assert.deepEqual((await copy.get('/hello')).body, { text: 'Hello' })
})

test('bytes changed since the record are refused, not silently replaced, and the record stays', async () => {
  const release = pack({ 'index.ts': ROUTE })
  const root = appFolder()
  const first = await boot({ releases: releaseOf(release.tarball), root })
  assert.ok((await first.share.pull('github:someone/hello@1.0.0')).ok)
  await first.stop()
  rmSync(join(root, 'plugins', 'hello'), { recursive: true })

  const replaced = pack({ 'index.ts': `${ROUTE}// the same version, other bytes\n` })
  const copy = await boot({ releases: releaseOf(replaced.tarball), root })
  const [outcome] = await copy.restored()
  assert.equal(outcome?.ok, false)
  assert.match(outcome?.reason ?? '', /checksum/)
  assert.equal(existsSync(join(root, 'plugins', 'hello')), false)
  assert.equal(recordsIn(root).hello?.digest, release.digest)
})

test('a plugin whose folder is there is not fetched at the start', async () => {
  const release = pack({ 'index.ts': ROUTE })
  const root = appFolder()
  const first = await boot({ releases: releaseOf(release.tarball), root })
  assert.ok((await first.share.pull('github:someone/hello@1.0.0')).ok)
  await first.stop()
  let asked = 0
  const counting: ReleasePort = {
    release: async () => {
      asked += 1
      return undefined
    },
    download: async () => new Uint8Array(),
  }
  const again = await boot({ releases: counting, root })
  assert.deepEqual(await again.restored(), [])
  assert.equal(asked, 0)
})

test('the list says where each pulled plugin came from and who released it; one made in the app has neither', async () => {
  const release = pack({ 'index.ts': ROUTE })
  const root = appFolder()
  const { app, share } = await boot({ releases: releaseOf(release.tarball), root })
  assert.ok((await share.pull('github:someone/hello@1.0.0')).ok)
  mkdirSync(join(root, 'plugins', 'mine'))
  writeFileSync(join(root, 'plugins', 'mine', 'index.ts'), routeSource('mine', '/mine', 'Mine'))
  const installed = await (
    app as unknown as { extensions: { install(dir: string): Promise<{ ok: boolean }> } }
  ).extensions.install(join(root, 'plugins', 'mine'))
  assert.ok(installed.ok)
  assert.deepEqual(
    share
      .list()
      .map(({ name, state, pulledFrom, author }) => ({ name, state, pulledFrom, author })),
    [
      {
        name: 'hello',
        state: 'active',
        pulledFrom: 'github:someone/hello@1.0.0',
        author: 'someone',
      },
      { name: 'mine', state: 'active', pulledFrom: undefined, author: undefined },
    ],
  )
})

test('removing a pulled plugin takes its folder and record when the folder is the release as pulled', async () => {
  const release = pack({ 'index.ts': ROUTE })
  const root = appFolder()
  const { share, get } = await boot({ releases: releaseOf(release.tarball), root })
  assert.ok((await share.pull('github:someone/hello@1.0.0')).ok)
  assert.deepEqual(await share.remove('hello'), { ok: true, name: 'hello', folder: 'deleted' })
  assert.equal(existsSync(join(root, 'plugins', 'hello')), false)
  assert.deepEqual(recordsIn(root), {})
  assert.equal((await get('/hello')).status, 404)
  // The pull line brings it back.
  assert.ok((await share.pull('github:someone/hello@1.0.0')).ok)
})

test('removing a pulled plugin changed since the pull keeps the folder and says why', async () => {
  const release = pack({ 'index.ts': ROUTE })
  const root = appFolder()
  const { share } = await boot({ releases: releaseOf(release.tarball), root })
  assert.ok((await share.pull('github:someone/hello@1.0.0')).ok)
  writeFileSync(join(root, 'plugins', 'hello', 'mine.md'), 'an edit a person made\n')
  const removed = await share.remove('hello')
  assert.equal(removed.ok && removed.folder, 'kept')
  assert.match(
    removed.ok ? (removed.note ?? '') : '',
    /plugins\/hello was changed after the pull, so it stays/,
  )
  assert.ok(existsSync(join(root, 'plugins', 'hello', 'mine.md')))
  assert.deepEqual(recordsIn(root), {})
})

test('a different copy of the same name is refused, naming where the copy in the app came from', async () => {
  const ana = pack({ 'index.ts': ROUTE })
  const fay = pack({ 'index.ts': routeSource('hello', '/hello', 'Hi from fay') })
  // Two people's releases of a plugin named hello: the port serves whichever is being pulled.
  let serving = ana.tarball
  const releases: ReleasePort = { ...releaseOf(ana.tarball), download: async () => serving }
  const root = appFolder()
  const { share } = await boot({ releases, root })
  assert.ok((await share.pull('github:ana/hello@1.0.0')).ok)
  serving = fay.tarball
  const result = await share.pull('github:fay/hello@1.0.0')
  refused(
    result,
    'folder-exists',
    /^plugins\/hello holds a different copy of this plugin, pulled from github:ana\/hello@1\.0\.0$/,
  )
  assert.match(result.ok ? '' : result.next, /plugin remove hello/)
})
