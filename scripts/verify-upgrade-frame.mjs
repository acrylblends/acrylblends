#!/usr/bin/env node
// An app made before the frame, upgraded to it, and booted both ways: `acrylblends upgrade` on a blank template scaffolded WITHOUT the frame package specs
// must write the profile, the overlay, the runtime row and the `dev`/`profile` scripts, and then
//   - `npm run dev` opens the frame with the app's page at /app, and
//   - `npm start` (the app's own server) still serves the app's old URLs.
//
//   node --import ./scripts/workspace-source.mjs scripts/verify-upgrade-frame.mjs
//
// Everything runs in a throwaway folder with its own DSH home; `pnpm run build` must have built `packages/cli` and `ide/` first (the gate's build does).
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { FRAME_PACKAGES } from '../packages/cli/src/ide-profile.ts'
import { VERSION } from '../packages/cli/src/version.ts'
import { chromeFlags, devtools, findChrome } from './lib/door-probe.mjs'

const root = resolve(import.meta.dirname, '..')
const cli = join(root, 'packages', 'cli', 'bin', 'acrylblends.js')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const scratch = mkdtempSync(join(tmpdir(), 'verify-upgrade-frame-'))
const home = join(scratch, 'home')
const app = join(scratch, 'app')
const log = (message) => console.log(`verify-upgrade-frame: ${message}`)
const fail = (message) => {
  throw new Error(`verify-upgrade-frame: ${message}`)
}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/** A free port on loopback for the frame's server: never 3080, which is the owner's own app. */
async function freePort() {
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

/** Start a package script in its own process group, so stopping it stops npm and everything npm started (dsh included). */
function start(cwd, args, env) {
  const child = spawn(npm, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  child.stdout.on('data', (chunk) => (child.output += chunk))
  child.stderr.on('data', (chunk) => (child.output += chunk))
  child.output = ''
  return child
}

/** Stop a started child's whole group, and say whether its port is free after it. */
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
    await until(() => (alive(child.pid) ? undefined : true), 15_000, 200)
  }
  if (alive(child.pid)) {
    signal('SIGKILL')
    await until(() => (alive(child.pid) ? undefined : true), 10_000, 200)
  }
  if (port === undefined) return true
  return (
    (await until(
      () =>
        fetch(`http://127.0.0.1:${port}/`).then(
          () => undefined,
          () => true,
        ),
      15_000,
      250,
    )) === true
  )
}

/** Any process still living in the scratch folder after the cleanup: none may be. */
function leftoverProcesses() {
  const result = spawnSync('ps', ['-axo', 'pid,command'], { encoding: 'utf8' })
  return (result.stdout ?? '')
    .split('\n')
    .filter((line) => line.includes(scratch) && !line.includes('ps -axo'))
    .map((line) => line.trim())
}
async function until(fn, ms, every = 300) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const value = await Promise.resolve()
      .then(() => fn())
      .catch(() => undefined)
    if (value !== undefined && value !== false) return value
    await sleep(every)
  }
}

const DSH_VERSION = process.env.IDE_PROFILE_DSH_VERSION ?? '0.2.0-rc.2'
const FRAMEWORK_VERSION = `^${VERSION}`

/** The `ide/` packages as a published release would present them: every package in the frame's closure, as `file:` specs from this checkout. */
function frameSpecs() {
  const folders = new Map()
  for (const name of readdirSync(join(root, 'ide'))) {
    const folder = join(root, 'ide', name)
    const manifest = join(folder, 'package.json')
    if (!existsSync(manifest)) continue
    const parsed = JSON.parse(readFileSync(manifest, 'utf8'))
    if (!existsSync(join(folder, 'lib')))
      fail(`${parsed.name} is not built; run pnpm run build first`)
    folders.set(parsed.name, folder)
  }
  const closure = []
  const seen = new Set()
  const need = (name) => {
    if (seen.has(name) || !folders.has(name)) return
    seen.add(name)
    const parsed = JSON.parse(readFileSync(join(folders.get(name), 'package.json'), 'utf8'))
    for (const field of ['dependencies', 'peerDependencies'])
      for (const [dependency, range] of Object.entries(parsed[field] ?? {}))
        if (String(range).startsWith('workspace:')) need(dependency)
    closure.push(name)
  }
  for (const entry of FRAME_PACKAGES) if (entry.installed !== true) need(entry.name)
  return Object.fromEntries(closure.map((name) => [name, `file:${folders.get(name)}`]))
}

function install(cwd) {
  const result = spawnSync(npm, ['install', '--no-audit', '--no-fund'], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_config_loglevel: 'error',
      HOME: home,
      npm_config_cache: join(scratch, 'npm-cache'),
    },
  })
  if (result.status !== 0) fail(`npm install failed in ${cwd}:\n${result.stdout}${result.stderr}`)
}

const run = (args, env = {}) => {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: scratch,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, PATH: process.env.PATH, ...env },
  })
  return { status: result.status, out: `${result.stdout}${result.stderr}` }
}

let dev = null
let prod = null
let framePort = 0
let prodPort = 0
try {
  // 1. The app as a release before the frame made it: the template's src/frame.ts is there, the profile is not.
  const before = spawnSync(
    process.execPath,
    [cli, 'init', 'app', '--template', 'blank', '--name', 'upgraded', '--yes'],
    { cwd: scratch, encoding: 'utf8', env: { ...process.env, HOME: home, PATH: process.env.PATH } },
  )
  if (before.status !== 0) fail(`init failed:\n${before.stdout}${before.stderr}`)
  if (!existsSync(join(app, 'src', 'frame.ts'))) fail('the blank template has no src/frame.ts')
  if (existsSync(join(app, 'cordis.patch.yml')))
    fail('the pre-frame app already has an overlay; the scaffold was not made without frame specs')
  log('a pre-frame app is scaffolded without the frame (src/frame.ts present, no overlay)')
  install(app)

  // 2. The upgrade adds the frame.
  const specs = frameSpecs()
  const env = {
    ACRYLBLENDS_FRAME_PACKAGES: JSON.stringify({
      dshVersion: DSH_VERSION,
      frameworkVersion: FRAMEWORK_VERSION,
      packages: specs,
    }),
  }
  const upgraded = run(['upgrade', '--dir', 'app'], env)
  if (upgraded.status !== 0) fail(`upgrade failed:\n${upgraded.out}`)
  if (!/frame\s+cordis\.patch\.yml added/u.test(upgraded.out))
    fail(`upgrade did not report the frame files:\n${upgraded.out}`)
  const overlay = readFileSync(join(app, 'cordis.patch.yml'), 'utf8')
  if (!overlay.includes('- id: app-routes') || !overlay.includes('name: ./src/frame.ts'))
    fail(`the overlay does not mount the app row:\n${overlay}`)
  const manifest = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'))
  if (
    manifest.scripts.dev !==
    'node --import ./plugins/acryl-node-server/src/register.ts node_modules/@deepseek-ai/dsh/lib/bin.js --profile acrylblends-upgraded --patch cordis.patch.yml --no-open'
  )
    fail(`dev was not rewritten onto the profile: ${String(manifest.scripts.dev)}`)
  if (manifest.scripts.profile !== 'node scripts/ide-profile.mjs')
    fail(`the profile script is missing: ${String(manifest.scripts.profile)}`)
  if (manifest.dependencies['@deepseek-ai/dsh'] !== DSH_VERSION)
    fail('the DSH pin was not merged into package.json')
  if (
    manifest.scripts.start !==
    'node --import ./plugins/acryl-node-server/src/register.ts src/main.ts'
  )
    fail(`the standalone start was changed: ${String(manifest.scripts.start)}`)
  log('upgrade wrote the profile, the overlay, the runtime row and the dev/profile scripts')
  const again = run(['upgrade', '--dir', 'app'], env)
  if (again.status !== 0 || !/everything is up to date/u.test(again.out))
    fail(`a second upgrade was not a no-op:\n${again.out}`)
  log('a second upgrade changes nothing')
  install(app)

  // 3. The frame boot: the page renders the frame, and the app answers at /app on the frame's origin.
  const runEnv = {
    DSH_HOME: home,
    ACRYLBLENDS_HOME: join(app, '.acrylblends'),
    HOME: home,
    npm_config_cache: join(scratch, 'npm-cache'),
  }
  const prepared = spawnSync(npm, ['run', 'profile'], {
    cwd: app,
    env: { ...process.env, ...runEnv },
    encoding: 'utf8',
  })
  if (prepared.status !== 0) fail(`npm run profile failed:\n${prepared.stdout}${prepared.stderr}`)
  framePort = await freePort()
  dev = start(app, ['run', 'dev', '--', '--port', String(framePort)], runEnv)
  const url = await until(() => /(http:\/\/127\.0\.0\.1:\d+\/?\S*)/u.exec(dev.output)?.[1], 180_000)
  if (!url) fail(`the frame did not boot:\n${dev.output.slice(-3000)}`)
  if (Number(new URL(url).port) !== framePort)
    fail(`the frame did not take the free port ${String(framePort)}: it answered at ${url}`)
  const output = () => dev.output
  const origin = new URL(url).origin
  log(`the upgraded app boots on its profile at ${url}`)

  // The token URL sets a cookie and redirects, so the page (and every later request) goes through a jar, as a browser would.
  const jar = join(scratch, 'cookies.txt')
  const get = (path) => {
    const result = spawnSync(
      'curl',
      ['-sL', '-b', jar, '-c', jar, '-o', '-', '-w', '\n%{http_code}', `${origin}${path}`],
      { encoding: 'utf8' },
    )
    const body = result.stdout ?? ''
    const at = body.lastIndexOf('\n')
    const status = Number(body.slice(at + 1))
    return { status, body: body.slice(0, at) }
  }
  spawnSync('curl', ['-sL', '-b', jar, '-c', jar, '-o', '/dev/null', url], { encoding: 'utf8' })
  const page = await until(() => {
    const result = get('/')
    return result.status > 0 && result.status < 400 ? result.body : undefined
  }, 30_000)
  if (!page) fail(`the frame page did not answer at ${url}:\n${output().slice(-3000)}`)
  writeFileSync(join(scratch, 'dev-output.txt'), output())
  for (const gone of [/did not activate/u, /\bpending\b/u, /\bfailed\b/u])
    if (gone.test(output())) fail(`a row did not activate:\n${output().slice(0, 4000)}`)

  const appAtPrefix = await until(() => {
    for (const path of ['/app/', '/app']) {
      const result = get(path)
      if (result.status < 200 || result.status >= 300) continue
      if (result.body.includes('"app"') && result.body.includes('"ok":true'))
        return { path, body: result.body }
    }
    return undefined
  }, 20_000)
  if (!appAtPrefix) fail(`the app does not answer at /app inside the frame; the page was ${url}`)
  log(`the app answers at ${appAtPrefix.path} inside the frame: ${appAtPrefix.body.trim()}`)

  const chrome = findChrome()
  if (chrome === undefined) fail('no Chrome or Chromium on this machine (set CHROME_BIN)')
  const profile = mkdtempSync(join(tmpdir(), 'upgrade-frame-chrome-'))
  const port = 9600 + Math.floor(Math.random() * 300)
  const child = spawn(chrome, [...chromeFlags(profile, port), '--hide-scrollbars'], {
    stdio: 'ignore',
  })
  try {
    await until(
      () =>
        fetch(`http://127.0.0.1:${port}/json/version`).then(
          (r) => r.ok,
          () => false,
        ),
      15_000,
    )
    const cdp = await devtools(port)
    try {
      await cdp.send('Page.enable')
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      })
      // The token URL is the browser's way in: it sets the session cookie and redirects to the frame.
      await cdp.send('Page.navigate', { url })
      const rendered = await until(
        async () =>
          (
            await cdp.send('Runtime.evaluate', {
              expression: `(() => {
                const canvas = document.querySelector('.dshWorkspace')
                if (canvas === null) return undefined
                return { frames: document.querySelectorAll('.dshDesktopFrame').length, mode: document.body.dataset.dshDesktopMode }
              })()`,
              returnByValue: true,
            })
          ).result?.result?.value,
        30_000,
      )
      if (rendered === undefined)
        fail(`the frame did not render in the page:\n${output.slice(-2500)}`)
      log(
        `the page renders the ACRYL frame (mode ${String(rendered.mode)}, ${String(rendered.frames)} frame)`,
      )
    } finally {
      cdp.close()
    }
  } finally {
    child.kill('SIGKILL')
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }

  // 4. The standalone app is unchanged: its own server serves the old URLs.
  dev.kill('SIGTERM')
  await until(() => (dev.exitCode !== null ? true : undefined), 15_000)
  if (dev.exitCode === null) dev.kill('SIGKILL')
  dev = null
  await until(
    async () =>
      !(await fetch(url).then(
        () => true,
        () => false,
      )),
    15_000,
  )

  const standalonePort = await freePort()
  prod = start(app, ['start'], { ...runEnv, ACRYLBLENDS_PORT: String(standalonePort) })
  const prodOutput = () => prod.output
  const prodUrl = await until(
    () => /(http:\/\/127\.0\.0\.1:\d+\/?\S*)/u.exec(prodOutput())?.[1],
    120_000,
  )
  if (!prodUrl) fail(`the standalone app did not boot:\n${prodOutput().slice(-3000)}`)
  prodPort = Number(new URL(prodUrl).port)
  const standalone = await until(async () => {
    const response = await fetch(prodUrl)
    return response.ok ? await response.text() : undefined
  }, 20_000)
  if (!standalone || !standalone.includes('"app":"upgraded"') || !standalone.includes('"ok":true'))
    fail(`the standalone app does not answer at ${prodUrl}:\n${prodOutput().slice(-3000)}`)
  const health = await fetch(new URL('/health', prodUrl))
  if (!health.ok) fail(`the standalone app does not answer at /health: ${String(health.status)}`)
  log(`the standalone start is unchanged: ${prodUrl} answers the app's own URLs`)
  log('OK')
} finally {
  // Whatever happened above, nothing of this gate may outlive it: both servers stop with their whole process group, their ports freed, and no
  // process whose command line names this scratch folder may remain.
  const freed = [
    await stop(dev, framePort > 0 ? framePort : undefined),
    await stop(prod, prodPort > 0 ? prodPort : undefined),
  ]
  dev = null
  prod = null
  await sleep(500)
  const leftovers = leftoverProcesses()
  for (const line of leftovers) console.error(`verify-upgrade-frame: leftover process: ${line}`)
  if (freed.includes(false) || leftovers.length > 0) process.exitCode = 1
  if (process.env.VERIFY_KEEP === '1') console.error(`verify-upgrade-frame: kept ${scratch}`)
  else rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}
