#!/usr/bin/env node
// The publish pipeline for the frame's packages (docs/plans/ide-port.md, slice 1's last item): build, the original tests, provenance, `npm pack`, a packed
// contents check, the peer rule, and a fresh app installed from those tarballs that boots the frame. Dry run only: this script never publishes and never
// logs in; publishing is the owner's step once the npm org named in frame/packages.json exists.
//
//   node --import ./scripts/workspace-source.mjs scripts/verify-frame-publish.mjs [--skip-tests] [--only <short>] [--keep]
//
// The package names come from frame/packages.json, one `scope` value plus each folder's short name, so a naming decision is a one-line change there.
import { spawn, spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyIdeProfile, FRAME_PACKAGES } from '../packages/cli/src/ide-profile.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(readFileSync(join(root, 'frame', 'packages.json'), 'utf8'))
const scope = config.scope
if (typeof scope !== 'string' || !scope.startsWith('@'))
  fail(
    `frame/packages.json: scope must be an npm scope like "@acrylblends" (got ${JSON.stringify(scope)})`,
  )
const shortOf = config.packages
const folders = Object.keys(shortOf)
const published = new Map(folders.map((folder) => [folder, `${scope}/${shortOf[folder]}`]))
const byPublished = new Map([...published].map(([folder, name]) => [name, folder]))
/** Each frame package's source name (what its own package.json says) to the name it publishes under. */
const sourceToPublished = new Map(
  folders.map((folder) => {
    const manifest = JSON.parse(readFileSync(join(root, 'ide', folder, 'package.json'), 'utf8'))
    return [String(manifest.name), published.get(folder)]
  }),
)

/** Each frame package's version, so a workspace range becomes a range of the package it names, not of the one that depends on it. */
const versionOf = new Map(
  folders.map((folder) => {
    const manifest = JSON.parse(readFileSync(join(root, 'ide', folder, 'package.json'), 'utf8'))
    return [published.get(folder), String(manifest.version ?? '0.0.0')]
  }),
)

const argv = process.argv.slice(2)
const skipTests = argv.includes('--skip-tests')
const keep = argv.includes('--keep')
const onlyAt = argv.indexOf('--only')
const only = onlyAt === -1 ? undefined : argv[onlyAt + 1]
const selected = folders.filter((folder) => only === undefined || shortOf[folder] === only)
if (selected.length === 0) fail(`--only ${String(only)} matches no package in frame/packages.json`)

const scratch = mkdtempSync(join(tmpdir(), 'verify-frame-publish-'))
let devProcess = null
let devStopped = false
let devPort = 0
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const log = (message) => console.log(`verify-frame-publish: ${message}`)

function fail(message) {
  throw new Error(`verify-frame-publish: ${message}`)
}

/** Start a package script in its own process group, so a stop takes npm and everything npm started. */
function start(cwd, args, env) {
  const child = spawn(npm, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  child.output = ''
  child.stdout.on('data', (chunk) => (child.output += chunk))
  child.stderr.on('data', (chunk) => (child.output += chunk))
  return child
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/** Stop the child's whole group and say whether its port is free after it. */
async function stop(child, port) {
  if (child === null || child === undefined) return true
  const alive = (pid) => {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }
  const signal = (name) => {
    try {
      process.kill(-child.pid, name)
    } catch {
      try {
        child.kill(name)
      } catch {
        // Already gone.
      }
    }
  }
  if (alive(child.pid)) {
    signal('SIGTERM')
    const end = Date.now() + 15_000
    while (Date.now() < end && alive(child.pid)) await sleep(200)
  }
  if (alive(child.pid)) {
    signal('SIGKILL')
    const end = Date.now() + 10_000
    while (Date.now() < end && alive(child.pid)) await sleep(200)
  }
  if (port === undefined) return true
  for (let i = 0; i < 60; i += 1) {
    const answered = await fetch(`http://127.0.0.1:${port}/`).then(
      () => true,
      () => false,
    )
    if (!answered) return true
    await sleep(250)
  }
  return false
}

/** Any process still living in the scratch folder: none may be. */
function leftoverProcesses() {
  const result = spawnSync('ps', ['-axo', 'pid,command'], { encoding: 'utf8' })
  return (result.stdout ?? '')
    .split('\n')
    .filter((line) => line.includes(scratch) && !line.includes('ps -axo'))
    .map((line) => line.trim())
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
    env: { ...process.env, npm_config_loglevel: 'error', ...options.env },
  })
  return {
    status: result.status ?? 1,
    out: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

/** Replace every frame package's source name with its published name in a staged package's built files. */
function rewritePublishedNames(dir) {
  const text = /\.[cm]?[jt]s$|\.d\.ts$|\.ya?ml$/u
  const walk = (folder) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      if (!text.test(entry.name)) continue
      let source
      try {
        source = readFileSync(path, 'utf8')
      } catch {
        continue
      }
      let next = source
      for (const [from, to] of sourceToPublished) {
        next = next.replaceAll(
          new RegExp(`(['"])${escapeRegExp(from)}(/[^'"]*)?\\1`, 'gu'),
          (_m, quote, tail) => `${quote}${to}${tail ?? ''}${quote}`,
        )
        // YAML: a scoped name starts with @, which YAML reserves, so the row's name is quoted there.
        next = next.replace(
          new RegExp(`^(\\s*name:\\s*)${escapeRegExp(from)}\\s*$`, 'gmu'),
          (_m, head) => `${head}'${to}'`,
        )
      }
      if (next !== source) writeFileSync(path, next)
    }
  }
  walk(dir)
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')

/** The files a `files` entry names, as paths inside the package folder. */
function expand(folder, entry) {
  if (!entry.includes('*')) return [entry]
  const [head, tail] = entry.split('*')
  const base = join(folder, head.replace(/\/$/u, ''))
  if (!existsSync(base)) return []
  const found = []
  const walk = (dir, prefix) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, name.name)
      const relative = `${prefix}${name.name}`
      if (name.isDirectory()) walk(path, `${relative}/`)
      else if (tail === '' || relative.endsWith(tail.replace(/^\//u, ''))) found.push(relative)
    }
  }
  walk(base, head.endsWith('/') ? head : `${head}/`)
  return found
}

/** The package.json a published tarball carries: the published name, every workspace name mapped, no `workspace:` range left, DSH and the framework as peers only. */
function publishedManifest(folder, key) {
  const manifest = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'))
  const version = String(manifest.version ?? '0.0.0')
  const rename = (name) => sourceToPublished.get(name) ?? name
  const range = (name, value) => {
    if (typeof value !== 'string' || !value.startsWith('workspace:')) return value
    const target = versionOf.get(rename(name)) ?? version
    if (value === 'workspace:*' || value === 'workspace:^') return `^${target}`
    if (value === 'workspace:~') return `~${target}`
    return value.slice('workspace:'.length)
  }
  const fix = (map = {}) =>
    Object.fromEntries(
      Object.entries(map).map(([name, value]) => [rename(name), range(name, value)]),
    )
  const out = { ...manifest, name: published.get(key), dependencies: fix(manifest.dependencies) }
  if (manifest.peerDependencies !== undefined) out.peerDependencies = fix(manifest.peerDependencies)
  if (manifest.optionalDependencies !== undefined)
    out.optionalDependencies = fix(manifest.optionalDependencies)
  if (manifest.devDependencies !== undefined) out.devDependencies = fix(manifest.devDependencies)
  const leftovers = JSON.stringify(out).match(/workspace:/gu)
  if (leftovers !== null)
    fail(`${folder}: ${String(leftovers.length)} workspace: range(s) survived the rewrite`)
  // The rule is about the services and the framework, not about libraries: @deepseek-ai/schemastery is a validation library a package may depend on,
  // while cordis, the dsh-client-/dsh-api- services and acrylblends itself must be peers so one copy is shared with the host.
  // A service is the framework, Cordis, or one of DSH's client/host/api/boot plugins: those must be one copy with the host. DSH's util libraries
  // (@deepseek-ai/dsh-home-paths and friends) are pure helpers and stay ordinary dependencies, as they are in the source plugins.
  const isService = (name) =>
    name === 'acrylblends' ||
    name === '@deepseek-ai/cordis' ||
    /^@deepseek-ai\/dsh-(client|host|api|boot)-/u.test(name)
  for (const name of Object.keys(out.dependencies ?? {}))
    if (isService(name))
      fail(`${key}: ${name} is a dependency; the framework and DSH services are peers`)
  for (const name of Object.keys(out.peerDependencies ?? {}))
    if (byPublished.has(name) && !out.dependencies?.[name])
      fail(`${key}: ${name} is a peer but every frame package ships together; make it a dependency`)
  for (const name of Object.keys(out.peerDependencies ?? {}))
    if (byPublished.has(name) && !out.dependencies?.[name])
      fail(`${key}: ${name} is a peer but every frame package ships together; make it a dependency`)
  return { manifest: out, version }
}

/**
 * A tarball packed from a staged copy: the published manifest, the files the package names, and nothing else. `--ignore-scripts` because a package's own
 * `prepack` (a full check) belongs to the source folder, which the pipeline already built and tested, not to the staged copy that has no dependencies.
 */
function pack(key) {
  const folder = join(root, 'ide', key)
  const short = shortOf[key]
  const stage = join(scratch, 'stage', short)
  mkdirSync(stage, { recursive: true })
  const { manifest, version } = publishedManifest(folder, key)
  const files = manifest.files ?? ['lib']
  const wanted = new Set(['package.json'])
  for (const entry of files) for (const file of expand(folder, entry)) wanted.add(file)
  for (const file of wanted) {
    if (file === 'package.json') continue
    const from = join(folder, file)
    if (!existsSync(from)) continue
    const to = join(stage, file)
    mkdirSync(dirname(to), { recursive: true })
    cpSync(from, to, { recursive: true })
  }
  writeFileSync(join(stage, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  // The source keeps ACRYL's package names (the port rule); the published artifact carries the configured ones everywhere it names a frame package: the
  // built JavaScript's import specifiers and the package's own cordis.patch.yml row names, which are what DSH imports by.
  rewritePublishedNames(stage)
  const result = run(npm, ['pack', '--json', '--ignore-scripts'], { cwd: stage })
  if (result.status !== 0) fail(`${folder}: npm pack failed:\n${result.out}`)
  let packed
  try {
    packed = JSON.parse(result.stdout).at(-1)
  } catch {
    fail(`${folder}: npm pack printed no JSON:\n${result.out}`)
  }
  if (typeof packed?.filename !== 'string')
    fail(`${folder}: npm pack did not name a tarball:\n${result.out}`)
  const tarball = join(stage, packed.filename)
  const listing = run('tar', ['tzf', tarball])
  if (listing.status !== 0) fail(`${folder}: the tarball cannot be listed:\n${listing.out}`)
  const entries = listing.out
    .split('\n')
    .filter((line) => line.startsWith('package/') && !line.endsWith('/'))
    .map((line) => line.slice('package/'.length))
  // A "files" entry may name a directory ("contracts") or a single file; npm packs a directory as its contents.
  const covered = (file) =>
    entries.includes(file) || entries.some((entry) => entry.startsWith(`${file}/`))
  for (const file of wanted)
    if (!covered(file))
      fail(
        `${folder}: ${file} is named by "files" but is not in the tarball (has ${entries.join(', ')})`,
      )
  if (!entries.includes('package.json')) fail(`${folder}: the tarball has no package.json`)
  const packedManifest = JSON.parse(run('tar', ['xzf', tarball, '-O', 'package/package.json']).out)
  if (packedManifest.name !== published.get(key))
    fail(
      `${folder}: packed name is ${String(packedManifest.name)}, expected ${String(published.get(key))}`,
    )
  if (packedManifest.version !== version)
    fail(`${folder}: packed version is ${String(packedManifest.version)}, expected ${version}`)
  return { tarball, entries, manifest: packedManifest }
}

/** The original tests the port brought, run where the package lives. */
function test(folder) {
  const manifest = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'))
  const script = manifest.scripts?.test
  if (script === undefined) return 'no test script'
  const result = run(npm, ['test'], { cwd: folder })
  if (result.status !== 0) fail(`${folder}: its tests failed:\n${result.out.slice(-4000)}`)
  return 'tests pass'
}

const packed = []
try {
  log(
    `the frame's packages publish under ${scope} (frame/packages.json): ${selected.length} to pack`,
  )
  for (const folder of selected) {
    const path = join(root, 'ide', folder)
    if (!existsSync(join(path, 'package.json'))) fail(`${folder}: no package.json under ide/`)
    if (!existsSync(join(path, 'lib'))) fail(`${folder}: lib/ is missing; run pnpm run build first`)
    const provenanceFile = join(path, 'provenance.json')
    if (!existsSync(provenanceFile)) fail(`${folder}: no provenance.json; every port carries one`)
    // Two shapes exist: the slices' {source: {repository, commit}, ported, unchanged} and the spike's {"ported from": {repository, "main at the
    // time", ...}, modified}. Both name where the code came from and at which commit, which is the check.
    const provenance = JSON.parse(readFileSync(provenanceFile, 'utf8'))
    const sourceOf = provenance.source ?? provenance['ported from']
    const commitOf =
      sourceOf?.commit ?? sourceOf?.['main at the time'] ?? sourceOf?.['last commit of the path']
    if (typeof sourceOf?.repository !== 'string' || typeof commitOf !== 'string')
      fail(`${folder}: provenance.json does not name the source repository and commit`)
    const notes = [provenance.ported, provenance.modified, provenance['changes here']]
    if (notes.every((note) => typeof note !== 'string'))
      fail(`${folder}: provenance.json does not say what changed in the port`)
    const tested = skipTests ? 'tests skipped (--skip-tests)' : test(path)
    const result = pack(folder)
    packed.push({ folder, ...result })
    log(
      `${published.get(folder)} ${result.manifest.version}: ${tested}, provenance ok, packed ${String(result.entries.length)} files`,
    )
  }

  if (only !== undefined) {
    log(
      `packed only ${String(only)}; the fresh-install boot needs every frame package, so it is not run`,
    )
    log('OK (dry run: nothing was published, no npm login)')
    process.exit(0)
  }

  // A fresh app from the tarballs: the frame rows mount under the published names, and the app answers at /app.
  const app = join(scratch, 'app')
  const home = join(scratch, 'home')
  mkdirSync(app, { recursive: true })
  const specs = Object.fromEntries(
    packed.map((entry) => [published.get(entry.folder), `file:${entry.tarball}`]),
  )
  // Each frame row names a source package; published, that package is named by frame/packages.json.
  const sourceNameOf = (folder) =>
    JSON.parse(readFileSync(join(root, 'ide', folder, 'package.json'), 'utf8')).name
  const publishedOfSource = new Map(
    folders.map((folder) => [sourceNameOf(folder), published.get(folder)]),
  )
  const packages = FRAME_PACKAGES.map((entry) => {
    if (entry.installed === true) return entry
    const name = publishedOfSource.get(entry.name)
    if (name === undefined) fail(`no ide package answers to the frame row ${entry.name}`)
    // A Loader row id is a plain identifier (DSH rejects "@" and "/" in one), so a scoped package's row is its short name.
    return { ...entry, name, row: name.replace(/^@[^/]+\//u, ''), spec: specs[name] }
  })
  for (const entry of packages)
    if (entry.installed !== true && (entry.spec === undefined || entry.spec === ''))
      fail(`the frame row ${entry.name} has no tarball spec: it was not packed`)
  // One Cordis for the whole tree: the framework's cordis-plugin-include asks for ~4.0.5 and DSH 0.2.0-rc.2 for ~4.0.4, so the app pins the version
  // the frame is built against. (Recorded in docs/plans/frame-publish.md as a coherence question between the framework and DSH, not hidden here.)
  writeFileSync(
    join(app, 'package.json'),
    `${JSON.stringify(
      {
        name: 'publish-check',
        version: '0.1.0',
        private: true,
        type: 'module',
        overrides: { '@deepseek-ai/cordis': '4.0.4' },
      },
      null,
      2,
    )}\n`,
  )
  // The app's own server register, which every scaffolded app carries (the scaffolder copies it from the library): the dev script preloads it so the
  // app's JSX pages import inside the frame host.
  const register = join(root, 'plugins', 'acryl-node-server')
  if (!existsSync(join(register, 'src', 'register.ts')))
    fail(
      'plugins/acryl-node-server is missing; the publish check cannot boot an app without its register',
    )
  cpSync(register, join(app, 'plugins', 'acryl-node-server'), { recursive: true })
  // The profile is the composition: `npm run profile` installs the frame packages into it and DSH mounts them from there. The app's overlay carries
  // only its own row, so no package is applied twice (a second settings row would register the service twice).
  const wrote = applyIdeProfile(app, {
    appName: 'publish-check',
    dshVersion: '0.2.0-rc.2',
    frameworkVersion: '^1.0.10',
    packages: [],
    dependencies: { ...specs, ...frameworksOf(), typescript: '6.0.3' },
  })
  log(`a fresh app's profile is generated from the tarballs (wrote ${wrote.written.join(', ')})`)
  const installed = run(npm, ['install', '--no-audit', '--no-fund'], {
    cwd: app,
    env: { HOME: home, npm_config_cache: join(scratch, 'npm-cache') },
  })
  if (installed.status !== 0)
    fail(`npm install from the tarballs failed:\n${installed.out.slice(-4000)}`)
  for (const entry of packed) {
    const folder = join(app, 'node_modules', ...published.get(entry.folder).split('/'))
    if (!existsSync(join(folder, 'package.json')))
      fail(`${published.get(entry.folder)} did not install into the app's node_modules`)
  }
  log('every tarball installs into a fresh app')
  // This app has no src/frame.ts (it is a package host, not a template), so it has no /app row: the frame boot below is the check here, and the app's own
  // page at /app belongs to verify-upgrade-frame.mjs, which uses a real scaffolded app.
  const overlay = readFileSync(join(app, 'cordis.patch.yml'), 'utf8')
  if (!overlay.includes('app-instance'))
    fail(
      'the app overlay does not carry its own rows; the generated overlay is not the one this module writes',
    )

  const port = await freePort()
  devPort = port
  const env = {
    DSH_HOME: join(scratch, 'dsh'),
    ACRYLBLENDS_HOME: join(app, '.acrylblends'),
    HOME: home,
    npm_config_cache: join(scratch, 'npm-cache'),
  }
  const prepared = run(npm, ['run', 'profile'], { cwd: app, env })
  if (prepared.status !== 0) fail(`npm run profile failed:\n${prepared.out.slice(-4000)}`)
  devProcess = start(app, ['run', 'dev', '--', '--port', String(port)], env)
  const dev = devProcess
  let url
  const deadline = Date.now() + 240_000
  while (Date.now() < deadline) {
    url = /(http:\/\/127\.0\.0\.1:\d+\/?\S*)/u.exec(dev.output)?.[1]
    if (url !== undefined) break
    if (/startup failed/u.test(dev.output)) break
    await sleep(500)
  }
  if (url === undefined) {
    const output = dev.output
    await stop(dev, port)
    fail(`the frame did not boot from the tarballs:\n${output.slice(-4000)}`)
  }
  if (/did not activate|failed to import/u.test(dev.output)) {
    const output = dev.output
    await stop(dev, port)
    fail(`a frame row did not activate from the tarballs:\n${output.slice(0, 4000)}`)
  }
  const origin = new URL(url).origin
  const jar = join(scratch, 'cookies.txt')
  const get = (path) => {
    const result = run('curl', [
      '-sL',
      '-b',
      jar,
      '-c',
      jar,
      '-o',
      '-',
      '-w',
      '\n%{http_code}',
      `${origin}${path}`,
    ])
    const at = result.out.lastIndexOf('\n')
    return { status: Number(result.out.slice(at + 1)), body: result.out.slice(0, at) }
  }
  run('curl', ['-sL', '-b', jar, '-c', jar, '-o', '/dev/null', url])
  const page = get('/')
  if (page.status !== 200) fail(`the frame page answered ${String(page.status)} at ${origin}`)
  log(
    `the frame boots from the tarballs: ${origin} answers ${String(page.status)} and renders its rows`,
  )
  if ((await stop(dev, port)) !== true)
    fail(`port ${String(port)} did not free after the frame was stopped`)
  devStopped = true
  log(
    `all ${String(packed.length)} packages packed; the npm org ${scope.slice(1)} must exist before the owner publishes`,
  )
  log('OK (dry run: nothing was published, no npm login)')
} finally {
  if (!devStopped) await stop(devProcess, devPort > 0 ? devPort : undefined)
  const leftovers = leftoverProcesses()
  for (const line of leftovers) console.error(`verify-frame-publish: leftover process: ${line}`)
  if (leftovers.length > 0) process.exitCode = 1
  const keepIt = keep || process.env.VERIFY_KEEP === '1'
  if (keepIt) console.error(`verify-frame-publish: kept ${scratch}`)
  else rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}

/** The framework and DSH pins a fresh app needs beside the frame packages. */
function frameworksOf() {
  return { '@deepseek-ai/dsh': '0.2.0-rc.2', acrylblends: '^1.0.10' }
}

/** A free port on loopback, never 3080 (the owner's app). */
async function freePort() {
  const { createServer } = await import('node:net')
  for (;;) {
    const probe = createServer()
    const port = await new Promise((done) => {
      probe.once('error', () => done(0))
      probe.listen(0, '127.0.0.1', () => done(probe.address().port))
    })
    await new Promise((done) => probe.close(done))
    if (port > 0 && port !== 3080) return port
  }
}
