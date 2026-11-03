#!/usr/bin/env node
// One template, scaffolded the way a person gets it, booted inside the ACRYL frame, and driven in real Chrome:
//
//   node --import ./scripts/workspace-source.mjs scripts/verify-ide-template.mjs blank
//
// 1. `acrylblends init` into an empty folder, with ACRYLBLENDS_FRAME_PACKAGES pointing at this checkout's built ide packages as `file:` specs
//    (the bridge while the frame's client packages are unpublished), and a second init that must refuse and change nothing.
// 2. `npm install` with no registry copy of the frame packages; `npm run profile` creates the app's own DSH profile from nothing.
// 3. `npm run dev` boots the frame: every overlay row must be active (no pending, failed or "did not activate" entry), the page must render the
//    ACRYL frame, the app must answer at /app, the door's page script must be on the page once and a door call must answer, and the app's own page
//    must load in a tile in the frame's main surface (a browser tile opened through the workspace tab strip, driven in headless Chrome).
// 4. It all stops and is removed; --keep leaves the scratch folder for a look.
//
// The template's page and the text it must show come from PAGES below; a template without an entry fails rather than skipping the tile check.
import { spawn, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { devtools, startChrome, stopChrome } from './lib/door-probe.mjs'
import { frameSpecsEnv } from './lib/ide-specs.mjs'
import { doorSpawn, npmSpawn } from './lib/platform.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = join(root, 'packages', 'cli', 'bin', 'acrylblends.js')
const template = process.argv[2] ?? 'blank'
const keep = process.argv.includes('--keep')
/** A gate may check an app it built itself (the upgrade gate): --existing <dir> skips scaffolding and checks that app in place. */
const existing =
  process.argv.indexOf('--existing') === -1
    ? undefined
    : process.argv[process.argv.indexOf('--existing') + 1]
/** Settings is another worker's surface while its registration lands; the rest of the gate still runs and the step says it was skipped. */
const skipSettings = process.env.GATE_SKIP_SETTINGS === '1'
const log = (message) => console.log(`verify-ide-template(${template}): ${message}`)
const fail = (message) => {
  throw new Error(`verify-ide-template(${template}): ${message}`)
}
/** Every file under `folder` whose bytes contain `needle`, optionally skipping paths the filter refuses. */
function filesContaining(folder, needle, include = () => true) {
  const found = []
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const entry of entries) {
      const path = join(dir, entry)
      let info
      try {
        info = statSync(path)
      } catch {
        continue
      }
      if (info.isDirectory()) {
        if (!include(`${path}${sep}`)) continue
        walk(path)
      } else if (info.size < 1024 * 1024 && include(path) && readFileSync(path).includes(needle))
        found.push(path)
    }
  }
  walk(folder)
  return found
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/**
 * Every process on the machine as pid, parent pid and name, from the platform's own tool; empty when the tool cannot answer. A gate that stops a host has
 * to know what the host started, because killing the host does not kill its grandchildren - the PTY's shell and its conhost outlive it on Windows, and the
 * shell's working folder is the app inside the gate's scratch, which then cannot be removed (EPERM after the gate printed OK, run 41560156835, 2026-11-03).
 */
function processSnapshot() {
  const run =
    process.platform === 'win32'
      ? spawnSync(
          'powershell',
          [
            '-NoProfile',
            '-Command',
            'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Json -Compress',
          ],
          { encoding: 'utf8', windowsHide: true },
        )
      : spawnSync('ps', ['-eo', 'pid=,ppid=,comm='], { encoding: 'utf8' })
  if (run.status !== 0 || typeof run.stdout !== 'string' || run.stdout.trim() === '') return []
  try {
    if (process.platform === 'win32') {
      const parsed = JSON.parse(run.stdout)
      const list = Array.isArray(parsed) ? parsed : [parsed]
      return list.map((entry) => ({
        pid: Number(entry.ProcessId),
        ppid: Number(entry.ParentProcessId),
        name: String(entry.Name ?? '?'),
      }))
    }
    return run.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .map((line) => {
        const [pid, ppid, ...rest] = line.split(/\s+/u)
        return { pid: Number(pid), ppid: Number(ppid), name: rest.join(' ') || '?' }
      })
  } catch {
    return []
  }
}

/** The processes below `rootPid` in one snapshot: children, grandchildren, and so on. */
function processTree(rootPid) {
  const snapshot = processSnapshot()
  const found = []
  const queue = [rootPid]
  while (queue.length > 0) {
    const parent = queue.pop()
    for (const entry of snapshot) {
      if (entry.ppid !== parent) continue
      found.push(entry)
      queue.push(entry.pid)
    }
  }
  return found
}

const processNames = (entries) =>
  entries.length === 0 ? 'none' : entries.map((entry) => `${entry.name} (${entry.pid})`).join(', ')

/**
 * Stop a child and everything it started, and wait for all of it to be gone. The child is a process group on POSIX (spawned detached), and Windows gets
 * `taskkill /T`, which ends the tree; either way the wait is on the processes the snapshot saw, not only on the direct child, because a tree kill is
 * asynchronous and a surviving shell holds the scratch. Returns whatever outlived the kill, so the caller can name it.
 */
async function stopTree(child) {
  if (child === undefined || child === null) return []
  const watched = processTree(child.pid)
  const kill = (signal) => {
    if (process.platform === 'win32')
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      })
    else {
      try {
        process.kill(-child.pid, signal)
      } catch {
        child.kill(signal)
      }
    }
  }
  const exited = async () =>
    child.exitCode !== null || child.signalCode !== null ? true : undefined
  if ((await exited()) !== true) {
    kill('SIGTERM')
    if ((await until(exited, 15_000)) !== true) {
      kill('SIGKILL')
      await until(exited, 5_000)
    }
  }
  let survivors = []
  for (const bound of [15_000, 5_000]) {
    const gone = await until(async () => {
      const alive = new Set(processSnapshot().map((entry) => entry.pid))
      survivors = watched.filter((entry) => alive.has(entry.pid))
      return survivors.length === 0 ? true : undefined
    }, bound)
    if (gone === true) break
    // They are this gate's and they hold the scratch: end them by pid, then look again.
    for (const entry of survivors) {
      try {
        process.kill(entry.pid, 'SIGKILL')
      } catch {
        // Already gone.
      }
    }
  }
  return survivors
}

async function until(fn, ms, every = 300) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const value = await fn().catch(() => undefined)
    if (value) return value
    await sleep(every)
  }
}

/**
 * Where each template's own page lives behind the frame prefix, the text that proves it rendered, and (when the template has one) the JSON route that
 * proves its API answers there too. `blank`'s root is its JSON API; its page is /about. The agent template's root answers JSON unless the request takes a
 * page; its /settings page is the one that always renders. `notes` has no unauthenticated JSON route at the prefix, so its page is the proof.
 */
const PAGES = {
  // The blank app's root answers a page to a browser (the first tile) and JSON to an API client, like the agent template.
  blank: { path: '/app/about', text: 'About', api: { path: '/app' } },
  agent: { path: '/app/settings', text: 'Settings', panel: true, api: { path: '/app' } },
  todo: { path: '/app', text: 'Todo', api: { path: '/app/api', list: true } },
  notes: { path: '/app/login', text: 'Log in' },
  chat: { path: '/app', text: 'Chat', api: { path: '/app/health' } },
  nodejs: { path: '/app/about', text: 'About', api: { path: '/app/health' } },
}

const page = PAGES[template]
if (page === undefined) fail(`no page known for template "${template}"`)
if (!existsSync(join(root, 'packages', 'cli', 'dist', 'index.js')))
  fail('the CLI is not built (run pnpm run build)')

/** The key the chat check enters through the frame, and what the local model answers. */
const GATE_KEY = 'sk-acryl-gate-1234567890'
const GATE_MESSAGE = 'Hello from the gate'

/**
 * A local Anthropic-Messages endpoint: it records every request (headers and body) and streams a fixed reply, so the gate proves the key entered
 * through the card is the one the model request carries, without a real provider.
 */
function startMockLlm() {
  const requests = []
  const mock = createServer((request, response) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('end', () => {
      requests.push({ url: request.url, headers: request.headers, body })
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      })
      const send = (event, data) => {
        response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      }
      send('message_start', {
        type: 'message_start',
        message: {
          id: 'msg_gate',
          type: 'message',
          role: 'assistant',
          model: 'deepseek-chat',
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 0 },
        },
      })
      send('content_block_start', {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      })
      send('content_block_delta', {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'pong from the mock' },
      })
      // ACRYL_GATE_STREAM_MS holds the answer open, so a run is still streaming when the next step presses something (the Settings-during-a-run
      // reproduction). Zero by default: the gate's own runs stay as fast as before.
      const streamDelayMs = Number(process.env.ACRYL_GATE_STREAM_MS ?? 0)
      const finish = () => {
        send('content_block_stop', { type: 'content_block_stop', index: 0 })
        send('message_delta', {
          type: 'message_delta',
          delta: { stop_reason: 'end_turn', stop_sequence: null },
          usage: { output_tokens: 4 },
        })
        send('message_stop', { type: 'message_stop' })
        response.end()
      }
      if (Number.isFinite(streamDelayMs) && streamDelayMs > 0) setTimeout(finish, streamDelayMs)
      else finish()
    })
  })
  return new Promise((done) => {
    mock.listen(0, '127.0.0.1', () => {
      done({
        url: `http://127.0.0.1:${String(mock.address().port)}`,
        requests,
        close: () =>
          new Promise((closed) => {
            // A keep-alive socket from the driver can outlive the last answer; closing only the listener would wait for it forever, and the gate
            // would print OK and never exit.
            mock.closeAllConnections()
            mock.close(() => {
              closed()
            })
          }),
      })
    })
  })
}

const DSH_VERSION = process.env.IDE_PROFILE_DSH_VERSION ?? '0.2.0-rc.2'
/** The framework release this CLI scaffolds an app for (`copyTemplate` writes the same range into the app's package.json). */
const cliVersion = JSON.parse(
  readFileSync(join(root, 'packages', 'cli', 'package.json'), 'utf8'),
).version
const frameworkVersion = `^${cliVersion}`

const scratch = mkdtempSync(join(tmpdir(), `ide-template-${template}-`))
const app = existing === undefined ? join(scratch, `${template}-app`) : resolve(existing)
let server
let mock
/** The gate's own failure, kept so cleanup trouble is reported beside it instead of replacing it in the runner's log. */
let failure
/** Cleanup trouble of its own, thrown only when the gate itself passed. */
let cleanupError
try {
  const env = {
    ...process.env,
    ACRYLBLENDS_FRAME_PACKAGES: frameSpecsEnv(root, { dshVersion: DSH_VERSION, frameworkVersion }),
  }
  if (existing === undefined) {
    const init = spawnSync(
      process.execPath,
      [cli, 'init', app, '--name', `${template}-app`, '--template', template, '--yes', '--no-next'],
      { encoding: 'utf8', env },
    )
    if (init.status !== 0)
      fail(`init failed (exit ${String(init.status)}):\n${init.stdout}${init.stderr}`)
    const overlay = readFileSync(join(app, 'cordis.patch.yml'), 'utf8')
    for (const row of [
      '- id: app-routes',
      'name: ./src/frame.ts',
      'name: ./plugins/acryl-door/src/index.ts',
      'name: acryl-app-shell',
      'name: acryl-workspace',
    ])
      if (!overlay.includes(row)) fail(`the generated overlay is missing ${JSON.stringify(row)}`)
    const manifest = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'))
    const dev = String(manifest.scripts?.dev ?? '')
    if (dev !== 'node --import ./plugins/acryl-node-server/src/register.ts scripts/ide-host.mjs')
      fail(`the app's dev script does not boot the host launcher: ${dev}`)
    if (!existsSync(join(app, 'scripts', 'ide-host.mjs')))
      fail('the generated launcher scripts/ide-host.mjs is missing')
    const again = spawnSync(
      process.execPath,
      [cli, 'init', app, '--name', `${template}-app`, '--template', template, '--yes', '--no-next'],
      { encoding: 'utf8', env },
    )
    if (again.status === 0) fail('a second init did not refuse')
    log('scaffolded through the CLI with the frame specs; a second init refused')
  } else {
    for (const file of ['cordis.patch.yml', 'scripts/ide-host.mjs', 'frame/app-plugins.mjs'])
      if (!existsSync(join(app, file))) fail(`the app given to --existing has no ${file}`)
    log(`checking the app at ${app} (--existing)`)
  }

  if (page.panel === true) {
    // The PTY driver is the second app row that serves its own routes: it must live under the app's mount too, and the terminal gate runs `node`
    // itself, so the assertion does not depend on which coding agents are installed on the machine.
    const add = spawnSync(process.execPath, [cli, 'add', 'driver-pty'], {
      cwd: app,
      encoding: 'utf8',
      env,
    })
    if (add.status !== 0)
      fail(`add driver-pty failed (exit ${String(add.status)}):\n${add.stdout}${add.stderr}`)
    const blendFile = join(app, 'blend.yaml')
    const blend = readFileSync(blendFile, 'utf8')
    const configured = blend.replace(
      '    - id: driver-pty\n      name: driver-pty\n',
      '    - id: driver-pty\n      name: driver-pty\n      config:\n        programs:\n          node: []\n',
    )
    if (configured === blend) fail('add did not mount the driver-pty row in blend.yaml')
    writeFileSync(blendFile, configured)
    log('the panel and the PTY driver are added, with node as the terminal program')
  }

  const npm = npmSpawn()
  const install = spawnSync(npm.command, ['install', '--no-audit', '--no-fund'], {
    cwd: app,
    encoding: 'utf8',
    env: { ...process.env, npm_config_loglevel: 'error' },
    ...npm.options,
  })
  if (install.status !== 0)
    fail(`npm install failed:
${install.stdout}${install.stderr}`)
  log('installed the framework, the DSH driver and the frame packages')

  // The precedence fixture of the profile slice (docs/plans/ide-host-inversion.md, section 20): the COMPOSITION also sets the welcome-notice key that
  // Settings writes, so only a settings document that wins over the composition can keep the notice dismissed across a restart.
  const overlayFile = join(app, 'cordis.patch.yml')
  writeFileSync(
    overlayFile,
    `${readFileSync(overlayFile, 'utf8')}\n- id: ui-settings-general\n  config:\n    welcomeNoticeVersion: from-composition\n`,
  )

  const bootEnv = {
    ...process.env,
    ACRYLBLENDS_HOME: join(app, '.acrylblends'),
    // DSH's own home is the app's home too; the launcher sets it in-process, and the environment covers the modules that read it at import.
    DSH_HOME: join(app, '.acrylblends'),
    // Any free port: the gate may share the machine with a person's frame or another worker's run.
    ACRYLBLENDS_PORT: '0',
  }
  // The chat's model is a local Anthropic-Messages mock: the gate proves the key entered through the card is used, without a real provider.
  mock = await startMockLlm()
  bootEnv.DEEPSEEK_BASE_URL = mock.url
  // The composition gate first: every row active, none pending, no DSH web row, a provider removed/restored and two reloads clean.
  const composition = spawnSync(
    process.execPath,
    ['--import', './plugins/acryl-node-server/src/register.ts', 'scripts/ide-host.mjs', '--check'],
    { cwd: app, encoding: 'utf8', env: bootEnv },
  )
  if (composition.status !== 0)
    fail(`the composition check failed:
${composition.stdout}${composition.stderr}`)
  if (!/every row active \(\d+ rows\), no DSH web row mounted/u.test(composition.stdout))
    fail(`the composition check did not report every row active with no DSH web row:
${composition.stdout}`)
  if (
    !/PENDING on provider removal, active on restore, two reloads clean/u.test(composition.stdout)
  )
    fail(`the composition lifecycle check did not pass:
${composition.stdout}`)
  log(
    'composition: every row active, no DSH web row, PENDING on provider removal and active on restore, two reloads clean',
  )

  // The launcher the app's `dev` script names, run with this Node. Through npm on Windows the child would sit under cmd.exe, and stopping the gate would
  // leave it running; this is the same command the script asserts above.
  let output = ''
  let serverUrl
  const startServer = async () => {
    const from = output.length
    server = spawn(
      process.execPath,
      ['--import', './plugins/acryl-node-server/src/register.ts', 'scripts/ide-host.mjs'],
      {
        cwd: app,
        env: bootEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
        // Its own process group on POSIX, so a stop reaches the PTYs the host starts as well as the host (see stopTree). Windows uses taskkill /T.
        detached: process.platform !== 'win32',
      },
    )
    server.stdout.on('data', (chunk) => (output += chunk))
    server.stderr.on('data', (chunk) => (output += chunk))
    const found = await until(
      async () => /(http:\/\/127\.0\.0\.1:\d+\/?\?token=\S*)/u.exec(output.slice(from))?.[1],
      180_000,
    )
    if (!found) fail(`the app did not print a tokenized URL:\n${output}`)
    serverUrl = found
    return found
  }
  const stopServer = async () => {
    if (server === null || server === undefined) return
    // The whole tree, waited for, not only the host: the PTY's shell outlives a killed host on Windows and goes on holding the app folder.
    const started = processTree(server.pid)
    const survivors = await stopTree(server)
    if (survivors.length > 0)
      fail(
        `the host stopped, but processes it started are still running: ${processNames(survivors)} (at the stop: ${processNames(started)})`,
      )
    const port = new URL(serverUrl).port
    // Windows has no lsof: the processes watched above are the check that matters there, and the helper must not crash on a missing tool.
    const holder = () => {
      const found = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
        encoding: 'utf8',
      })
      return typeof found.stdout === 'string' ? found.stdout.trim() : ''
    }
    if (holder() !== '') process.kill(Number(holder()), 'SIGKILL')
    const freed = await until(async () => (holder() === '' ? true : undefined), 15_000)
    if (freed !== true) fail(`port ${port} stayed held after stopping the host`)
  }

  let url = await startServer()
  log(`the frame boots on our host at ${url}`)

  let origin = new URL(url).origin

  /**
   * The workshop's day-one path on a fresh profile: the Preview Notice appears, Continue saves its acknowledgement, and a host restart must find it
   * dismissed (the settings document wins over the composition fixture that sets the same key). Runs its own short Chrome session, then restarts the host
   * on the same port and refreshes the cookie jar through the new launch token.
   */
  const dismissNoticeAndRestart = async () => {
    const profile = mkdtempSync(join(tmpdir(), 'ide-template-notice-'))
    // A unique profile and Chrome's own port (from DevToolsActivePort), never a guessed one; a browser that will not start says why (its stderr and
    // --enable-logging output travel in the error), and its whole process tree is killed before this function fails.
    const launched = await startChrome(profile).catch((error) =>
      fail(
        `the notice check could not start headless Chrome: ${error instanceof Error ? error.message : String(error)}`,
      ),
    )
    let cdp
    try {
      cdp = await devtools(launched.port)
      await cdp.send('Page.enable')
      await cdp.send('Runtime.enable')
      for (const cookie of cookiesOf(jar))
        await cdp.send('Network.setCookie', { ...cookie, url: `${origin}/` }).catch(() => {})
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      })
      const evaluate = async (expression) =>
        (
          await cdp.send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true,
          })
        ).result?.result?.value
      await cdp.send('Page.navigate', { url })
      const notice = await until(
        async () =>
          await evaluate(`(() => {
            const dialog = document.querySelector('[role=dialog]')
            return dialog !== null && dialog.innerText.includes('Preview Notice') ? dialog.innerText.slice(0, 120) : undefined
          })()`),
        120_000,
      )
      // 120 s: on a loaded machine (two frame gates at once) the notice has taken past a minute to mount; alone it is quick. A failure here names the
      // parallel-gate case, which was the whole difference between a red and a green run on the same tree (125-slice2's finding, 2026-11-03).
      if (notice === undefined)
        fail('the Preview Notice did not appear on a fresh profile (is another frame gate running on this machine?)')
      const noticeScroll = await evaluate(
        `Math.max(window.scrollY, document.documentElement.scrollTop, document.body.scrollTop)`,
      )
      if (noticeScroll !== 0)
        fail(
          `the page scrolled to ${String(noticeScroll)} with the Preview Notice shown; the frame must never scroll at the document level`,
        )
      const clicked = await evaluate(`(() => {
        const dialog = document.querySelector('[role=dialog]')
        if (dialog === null) return false
        const button = [...dialog.querySelectorAll('button')].find((candidate) => candidate.textContent.trim() === 'Continue')
        if (button === undefined) return false
        button.click()
        return true
      })()`)
      if (clicked !== true) fail('the Preview Notice has no Continue button')
      const closed = await until(
        async () =>
          await evaluate(`(() => {
            const dialog = document.querySelector('[role=dialog]')
            return dialog === null || !dialog.innerText.includes('Preview Notice')
          })()`),
        20_000,
      )
      if (closed !== true) {
        const detail = await evaluate(
          `document.querySelector('[role=dialog]')?.innerText.slice(0, 400) ?? null`,
        )
        fail(`the Preview Notice did not close after Continue: ${JSON.stringify(detail)}`)
      }
      log('the Preview Notice is dismissed once and its acknowledgement saves')
    } finally {
      cdp?.close()
      // The whole tree, not only the browser process: on Windows renderers and crashpad outlive a killed browser and hold the profile. Chrome keeps
      // writing its profile for a moment after the kill, and removing it then is ENOTEMPTY (run 41352593171), so the removal below keeps its retries.
      await launched.stop()
      try {
        rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 })
      } catch {
        // Windows can still hold a file of the closed browser for a moment; the folder sits in the temp directory, and a passed check stays passed.
      }
    }
    const settingsFile = join(app, '.acrylblends', 'settings.patch.yml')
    if (!existsSync(settingsFile))
      fail('the settings document was not written by the acknowledgement')
    if (!readFileSync(settingsFile, 'utf8').includes('welcomeNoticeVersion'))
      fail('the settings document does not hold the notice acknowledgement')
    // Restart on the same port: the cookie authority stays valid, and only a restart shows whether the acknowledgement persisted.
    const heldPort = new URL(url).port
    await stopServer()
    bootEnv.ACRYLBLENDS_PORT = heldPort
    const again = await startServer()
    spawnSync('curl', ['-sL', '-b', jar, '-c', jar, '-o', '/dev/null', again], { encoding: 'utf8' })
    log('the host restarts on the same port with the acknowledgement in settings.patch.yml')
    return { url: again, origin: new URL(again).origin }
  }
  const jar = join(scratch, 'cookies.txt')
  const fetchPage = (target, into) =>
    spawnSync('curl', ['-sL', '-b', jar, '-c', jar, '-o', into, '-w', '%{http_code}', target], {
      encoding: 'utf8',
    })
  const pageHtml = join(scratch, 'page.html')
  const status = await until(async () => {
    const curl = fetchPage(url, pageHtml)
    const code = Number(curl.stdout)
    return code > 0 && code < 400 ? code : undefined
  }, 30_000)
  if (status === undefined)
    fail(`the page did not answer at ${url}; server said:\n${output.slice(-2500)}`)
  // The page is ours: our title and the client-module boot wire (rendered as the webServer index-injection rows).
  if (!readFileSync(pageHtml, 'utf8').includes('__DSH_BOOT__'))
    fail('the page does not carry the client-module boot wire')
  const html = readFileSync(pageHtml, 'utf8')
  // Every script the page copies from the frontend is closed. An unclosed entry script turns the tags after it (the stylesheet links) into its text:
  // DSH's component stylesheet never loads, and the frame draws its dialogs and buttons with browser defaults. The string check fails here, before a
  // browser can hide the cause.
  for (const match of html.matchAll(/<script\b[^>]*\bsrc=[^>]*>/gu)) {
    const after = html.slice(match.index + match[0].length)
    if (!after.trimStart().startsWith('</script>'))
      fail(
        `the page's script tag ${match[0]} is not closed; the tags after it would be swallowed as its text`,
      )
  }
  if (!html.includes('acryl-workspace/client.js'))
    fail(`the page does not load the workspace client; server said:\n${output.slice(-2500)}`)
  const tags = html.split('/api/acryl-door/page.js').length - 1
  if (tags !== 1)
    fail(`the frame page carries the door script ${String(tags)} times, expected once`)
  log('the page loads the workspace client and carries the door script once')

  // The app answers at its prefix: its API route when the template has one (blank's and the agent's root, todo's list, the chat's and nodejs' health
  // route). Retried, because the app's rows mount a moment after the launcher prints its URL.
  if (page.api !== undefined) {
    const apiFile = join(scratch, 'app-api.json')
    const appApi = await until(async () => {
      const code = Number(
        spawnSync(
          'curl',
          ['-sL', '-o', apiFile, '-w', '%{http_code}', `${origin}${page.api.path}`],
          {
            encoding: 'utf8',
          },
        ).stdout,
      )
      if (code !== 200) return undefined
      const parsed = JSON.parse(readFileSync(apiFile, 'utf8'))
      if (page.api.list === true) return Array.isArray(parsed) ? parsed : undefined
      return parsed?.ok === true ? parsed : undefined
    }, 30_000)
    if (appApi === undefined)
      fail(`the app did not answer at ${page.api.path}; server said:\n${output.slice(-2500)}`)
    log(`the app answers at ${page.api.path}: ${JSON.stringify(appApi).slice(0, 200)}`)
  }

  const brief = await until(async () => {
    const shim = doorSpawn(app)
    const door = spawnSync(shim.command, ['brief', '--json'], {
      cwd: app,
      encoding: 'utf8',
      ...shim.options,
    })
    return door.status === 0 ? door : undefined
  }, 30_000)
  if (brief === undefined) fail('a door call did not answer within 30s')
  log('a door call answers')

  // The app's own page answers directly, so a tile failure is never the app's own route.
  const directFile = join(scratch, 'direct.html')
  const direct = await until(async () => {
    const code = Number(
      spawnSync('curl', ['-sL', '-o', directFile, '-w', '%{http_code}', `${origin}${page.path}`], {
        encoding: 'utf8',
      }).stdout,
    )
    if (code !== 200) return undefined
    return readFileSync(directFile, 'utf8').includes(page.text) ? true : undefined
  }, 30_000)
  if (direct !== true)
    fail(
      `the app's page at ${page.path} did not show "${page.text}"; server said:\n${output.slice(-2500)}`,
    )
  log(`the app's page answers at ${page.path}`)

  // The workshop's day-one path: the Preview Notice appears on a fresh profile, is dismissed once, and stays dismissed after a host restart because
  // its acknowledgement is in the settings document (the precedence fixture above also sets the key in the composition).
  const afterNotice = await dismissNoticeAndRestart()
  url = afterNotice.url
  origin = afterNotice.origin

  // The frame's look, for the workshop's agent template: three day-one states at one fixed viewport, captured here and compared with the committed
  // baseline at 2%. The compare runs only on Linux CI, where the runner's fonts are fixed; macOS and Windows keep the structural assertions (a cross-OS
  // pixel gate would fail on font rendering, not on the product). FRAME_VISUAL_CAPTURE names a folder to write the states into instead: the baseline is
  // regenerated that way on the Linux runner and approved before it is committed.
  if (template === 'agent') {
    const views = 'frame,settings-models,right-panel-open'
    const viewsFile = join(root, 'scripts', 'frame-views-frame.json')
    const captureTo = process.env.FRAME_VISUAL_CAPTURE
    if (captureTo !== undefined && captureTo !== '') {
      const shot = spawnSync(
        process.execPath,
        [
          join(root, 'scripts', 'frame-compare.mjs'),
          'capture',
          serverUrl,
          captureTo,
          '--views',
          views,
          '--views-file',
          viewsFile,
        ],
        { encoding: 'utf8' },
      )
      if (shot.status !== 0)
        fail(
          `the frame's visual states did not capture (exit ${String(shot.status)}):\n${shot.stdout ?? ''}${shot.stderr ?? ''}`,
        )
      log(`the frame's visual states are captured in ${captureTo}`)
    }
    if (process.env.FRAME_VISUAL === '1' && process.platform === 'linux') {
      const baseline = join(root, 'scripts', 'frame-reference-frame')
      if (!existsSync(baseline))
        fail(
          'the frame visual baseline is missing (scripts/frame-reference-frame); capture it on this runner first',
        )
      const looks = spawnSync(
        process.execPath,
        [
          join(root, 'scripts', 'frame-compare.mjs'),
          'check',
          baseline,
          serverUrl,
          join(scratch, 'frame-visual'),
          '--views',
          views,
          '--views-file',
          viewsFile,
        ],
        { encoding: 'utf8' },
      )
      if (looks.status !== 0)
        fail(
          `the frame does not match its visual baseline (exit ${String(looks.status)}):\n${looks.stdout ?? ''}${looks.stderr ?? ''}`,
        )
      log('the frame matches its visual baseline at 1440x900 within 2%')
    }
  }

  // The session banner check needs the same host back on the same origin: the page's cookie is gone, the connection cannot recover, and the frame
  // must say so instead of spinning.
  const restartSamePort = async () => {
    const held = new URL(serverUrl).port
    await stopServer()
    bootEnv.ACRYLBLENDS_PORT = held
    return await startServer()
  }
  await checkTileInBrowser(url, origin, jar, page, output, mock, restartSamePort)
  // The frame's stable launch token end to end (119): verify-frame-token boots this app twice on its own port and asserts the same address after the
  // restart, that the address admits the page (303 and the cookie) and that the cookie admits the frame's WebSocket.
  await stopServer()
  const frameToken = spawnSync(
    process.execPath,
    [join(root, 'scripts', 'verify-frame-token.mjs'), app],
    {
      encoding: 'utf8',
      env: { ...process.env, ...bootEnv, ACRYLBLENDS_PORT: '' },
      // The step boots two apps and has its own watchdog; a child that still hangs must fail this gate with a name instead of holding the job until
      // its timeout (the Ubuntu runner once sat here for over forty minutes, 2026-11-02).
      timeout: 720_000,
    },
  )
  if (frameToken.status !== 0)
    fail(
      `verify-frame-token failed (exit ${String(frameToken.status)}${frameToken.error === undefined ? '' : `: ${frameToken.error.message}`}):\n${frameToken.stdout ?? ''}${frameToken.stderr ?? ''}`,
    )
  log('verify-frame-token: the same address after a restart admits the page and its WebSocket')
  // The owner's rule: the key lives only in DSH's own store, never in the page or the app folder.
  const keyFiles = filesContaining(bootEnv.ACRYLBLENDS_HOME, GATE_KEY)
  if (keyFiles.length === 0) fail('the host did not store the key in its own home')
  const appFiles = filesContaining(
    app,
    GATE_KEY,
    (file) => !file.includes(`${sep}.acrylblends${sep}`),
  )
  if (appFiles.length > 0) fail(`the key reached the app folder: ${appFiles.join(', ')}`)
  // The profile slice's ownership rule: the manifest, the settings document and the composition bundle are files of the profile; the key belongs in none.
  const profileFiles = [
    'package.json',
    'settings.patch.yml',
    join('node_modules', 'acrylblends-frame', 'package.json'),
    join('node_modules', 'acrylblends-frame', 'cordis.patch.yml'),
  ]
  for (const file of profileFiles) {
    const path = join(bootEnv.ACRYLBLENDS_HOME, file)
    if (!existsSync(path)) fail(`the host profile has no ${file}`)
    if (readFileSync(path, 'utf8').includes(GATE_KEY))
      fail(`the key reached the profile file ${file}`)
  }
  log(
    `the key is in the host's own store (${keyFiles.map((file) => relative(bootEnv.ACRYLBLENDS_HOME, file)).join(', ')}) and in no profile file, patch file or app file`,
  )
  log('OK')
} catch (error) {
  failure = error
} finally {
  if (mock !== undefined) await mock.close()
  // What the host started, named before it is stopped: a survivor is what holds the scratch folder open on Windows.
  const started = server === null || server === undefined ? [] : processTree(server.pid)
  if (started.length > 0)
    log(`the host started ${String(started.length)} process(es): ${processNames(started)}`)
  const survivors = await stopTree(server)
  if (keep) console.error(`verify-ide-template: kept ${scratch}`)
  else {
    // Windows releases a process's handles asynchronously after it ends: the bounded retries cover that delay. A folder that is still held fails with the
    // processes that outlived the host named, instead of a bare EPERM with nothing to look for.
    try {
      rmSync(scratch, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 })
    } catch (error) {
      const detail = `the scratch ${scratch} could not be removed (${error instanceof Error ? error.message : String(error)}); processes that outlived the host: ${processNames(survivors)}; the gate's own children now: ${processNames(processTree(process.pid))}`
      // Decided after the block, never thrown from it: a throw here would replace the gate's own failure in the runner's log.
      if (failure === undefined)
        cleanupError = new Error(`verify-ide-template(${template}): ${detail}`)
      else console.error(`verify-ide-template(${template}): ${detail}`)
    }
  }
}
if (failure !== undefined) throw failure
if (cleanupError !== undefined) throw cleanupError

/** The cookies curl was given by the token URL, in the shape the DevTools protocol sets on a browser. */
function cookiesOf(jar) {
  const cookies = []
  for (const line of readFileSync(jar, 'utf8').split('\n')) {
    if (line.trim() === '') continue
    const httpOnly = line.startsWith('#HttpOnly_')
    const body = httpOnly ? line.slice('#HttpOnly_'.length) : line
    if (body.startsWith('#')) continue
    const [domain, , path, secure, , name, value] = body.split('\t')
    if (name === undefined || value === undefined) continue
    cookies.push({ name, value, domain, path, secure: secure === 'TRUE', httpOnly })
  }
  return cookies
}

/** React ignores a plain `input.value = ...`; the native setter plus an input event is what typing does. A function declaration: the gate's top-level try runs before the consts below it. */
function setInputValue(selector, value) {
  return `(() => {
  const input = document.querySelector(${JSON.stringify(selector)})
  if (input === null) return false
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, ${JSON.stringify(value)})
  input.dispatchEvent(new Event('input', { bubbles: true }))
  return true
})()`
}

/**
 * The app's page in the frame's main surface: open the workspace tab strip's browser tile, type the app's absolute URL and press Go, then read the
 * iframe's document (same origin, so the gate sees what a person sees). This is ACRYL's canvas browser tile, not DSH's right-sidebar browser row:
 * that package registers a tab type for DSH's right sidebar, while the owner's requirement is the main surface, which is the workspace canvas.
 */
async function checkTileInBrowser(url, origin, jar, page, output, mock, restartHost) {
  const profile = mkdtempSync(join(tmpdir(), 'ide-template-tile-'))
  // When the tile's request dies (the iframe shows the browser's error page), its net log names why: ERR_CONNECTION_RESET, ERR_EMPTY_RESPONSE or
  // ERR_ABORTED. CI uploads the file as an artifact only when a gate fails, and the failure message carries its path.
  const netLog = join(tmpdir(), `acryl-frame-netlog-${template}.json`)
  let launched
  try {
    launched = await startChrome(profile, { args: [`--log-net-log=${netLog}`] }).catch((error) =>
      fail(
        `the tile check could not start headless Chrome: ${error instanceof Error ? error.message : String(error)}`,
      ),
    )
    const cdp = await devtools(launched.port)
    // What the page itself reported (uncaught exceptions, console errors, the tile iframe's included: it runs in the same target), printed on any
    // failure below - a panel or a tile that fails silently must say why, not only that its expected text was missing.
    const pageReported = () =>
      cdp
        .events()
        .flatMap((message) => {
          if (message.method === 'Runtime.exceptionThrown') {
            const details = message.params?.exceptionDetails ?? {}
            const text = details.exception?.description ?? details.text ?? 'exception'
            return [
              `exception: ${String(text).split('\n')[0]} (${String(details.url ?? '')}:${String(details.lineNumber ?? 0)})`,
            ]
          }
          if (message.method === 'Runtime.consoleAPICalled' && message.params?.type === 'error')
            return [
              `console.error: ${(message.params.args ?? []).map((argument) => argument.value ?? argument.description ?? '').join(' ')}`,
            ]
          if (
            message.method === 'Log.entryAdded' &&
            (message.params?.entry?.level === 'error' || message.params?.entry?.level === 'warning')
          )
            return [
              `${String(message.params.entry.level)}: ${String(message.params.entry.text ?? '')}`,
            ]
          return []
        })
        .slice(-12)
    try {
      await cdp.send('Page.enable')
      await cdp.send('Runtime.enable')
      await cdp.send('Log.enable')
      await cdp.send('Network.enable')
      for (const cookie of cookiesOf(jar))
        await cdp.send('Network.setCookie', { ...cookie, url: `${origin}/` })
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await cdp.send('Page.navigate', { url })
      const evaluate = async (expression) =>
        (
          await cdp.send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true,
          })
        ).result?.result?.value
      const click = async (label) =>
        await evaluate(`(() => {
          const wanted = ${JSON.stringify(label)}
          const element = [...document.querySelectorAll('button,[role=button],[role=menuitem],a')]
            .find(candidate => candidate.getAttribute('aria-label') === wanted || candidate.textContent.trim() === wanted)
          if (element === undefined) return false
          element.click()
          return true
        })()`)
      const frame = await until(
        async () =>
          await evaluate(`(() => {
            const canvas = document.querySelector('.dshWorkspace')
            const side = document.querySelector('.dshWorkspaceSide')
            if (canvas === null || side === null) return undefined
            return {
              mode: document.body.dataset.dshDesktopMode,
              frames: document.querySelectorAll('.dshDesktopFrame').length,
              head: side.querySelector('.dshWorkspaceSideProjectsHead') !== null,
            }
          })()`),
        30_000,
      )
      if (frame === undefined)
        fail(`the ACRYL frame did not render in the page; server said:\n${output.slice(-2500)}`)
      if (frame.mode !== 'advanced' || frame.frames !== 1)
        fail(`the page is not the frame's advanced layout: ${JSON.stringify(frame)}`)
      log('the page renders the ACRYL frame')
      // The frontend's component stylesheet is really in the document, not swallowed as the entry script's text. Without it every DSH dialog, button
      // and input falls back to browser defaults (the owner kit's flat grey buttons and the dialog without a surface or backdrop, 2026-11-02).
      const entry = await evaluate(`(() => {
        const script = document.querySelector('script[src*="/assets/index-"]')
        return {
          links: document.querySelectorAll('link[rel=stylesheet]').length,
          entryText: (script?.textContent ?? '').length,
        }
      })()`)
      if (entry.links === 0)
        fail(
          'the frame document has no stylesheet link: the entry script swallowed the frontend stylesheets',
        )
      if (entry.entryText !== 0)
        fail(
          `the entry script element holds ${String(entry.entryText)} characters of text: the page's tags after it were swallowed`,
        )
      log(
        'the frontend stylesheet is in the document and the entry script holds no swallowed markup',
      )
      // Day one under the frame: the app the person is building is shown in the frame's canvas (125), with no + and no typed address, and the
      // document has not scrolled (a focused first-run card must not move the shell).
      const firstRunTile = await until(async () => {
        const snapshot = await evaluate(`(() => {
          const frame = document.querySelector('iframe.acrylAppCanvasFrame')
          const src = frame?.getAttribute('src') ?? ''
          const text = frame?.contentDocument?.body?.innerText ?? ''
          const tabs = [...document.querySelectorAll('[role=tab]')].map((tab) => tab.textContent.trim())
          if (!src.includes('/app') || text.length === 0) return undefined
          return { src, text: text.slice(0, 120), tabs: tabs.slice(0, 8), scrollTop: Math.max(window.scrollY, document.documentElement.scrollTop, document.body.scrollTop) }
        })()`)
        return snapshot
      }, 20_000)
      if (firstRunTile === undefined)
        fail(
          `the app is not shown in the frame's canvas on first run (no canvas frame at /app with content); tabs: ${JSON.stringify(await evaluate(`[...document.querySelectorAll('[role=tab]')].map((tab) => tab.textContent.trim())`))}`,
        )
      if (firstRunTile.scrollTop !== 0)
        fail(
          `the page scrolled to ${String(firstRunTile.scrollTop)} on first run: ${JSON.stringify(firstRunTile)}`,
        )
      log(
        `the app's page is in the frame's canvas on first run ("${firstRunTile.text.trim().split('\n')[0]}")`,
      )
      if (
        (await evaluate(
          `document.querySelector('[role=dialog]')?.innerText.includes('Preview Notice') ?? false`,
        )) === true
      )
        fail('the Preview Notice came back after the host restart')
      log('the Preview Notice stays dismissed after the host restart')

      // (i) The Settings day-one path: Models loads with no provider-directory error, takes the model key, and the chat then needs no key card.
      // A profile without a key opens DSH's first-run "Add an API key" dialog over the frame; the guide's path is Settings > Models, so it is dismissed the
      // way a user can ("Configure later") before Settings is opened. (Found on the frame jobs: the only dialog there was this one, with no settings nav.)
      const firstRun = await until(async () => {
        const state = await evaluate(`(() => {
          const dialog = [...document.querySelectorAll('[role=dialog]')].find((candidate) => candidate.querySelector('input[aria-label="API key"]') !== null)
          if (dialog === undefined) return 'none'
          const later = [...dialog.querySelectorAll('button')].find((candidate) => candidate.textContent.trim() === 'Configure later')
          if (later === undefined) return 'no-later'
          later.click()
          return 'dismissed'
        })()`)
        return state === 'none' ? undefined : state
      }, 15_000)
      if (firstRun === 'no-later') fail('the first-run key dialog has no "Configure later" button')
      if (firstRun === 'dismissed') {
        const closed = await until(
          async () =>
            (await evaluate(
              `[...document.querySelectorAll('[role=dialog]')].some((candidate) => candidate.querySelector('input[aria-label="API key"]') !== null)`,
            )) === false,
          10_000,
        )
        if (closed !== true) fail('the first-run key dialog did not close after "Configure later"')
        log(
          'the first-run key dialog is dismissed (Configure later), so the key is entered in Settings > Models',
        )
      }
      // Close any palette or menu left open (a command named Settings lives in the palette too), then press the frame's own Settings button.
      for (const type of ['keyDown', 'keyUp'])
        await cdp.send('Input.dispatchKeyEvent', {
          type,
          key: 'Escape',
          code: 'Escape',
          windowsVirtualKeyCode: 27,
          nativeVirtualKeyCode: 27,
        })
      await sleep(300)
      // The frame Settings dialog opens on its Models page on a fresh profile; press the left sidebar's Settings (the chat card has one of its own).
      const settingsOpen = await until(
        async () =>
          await evaluate(`(() => {
            if ([...document.querySelectorAll('[role=dialog]')].some((candidate) => candidate.querySelector('nav') !== null)) return true
            const buttons = [...document.querySelectorAll('.dshWorkspaceSide button')].filter((candidate) =>
              (candidate.getAttribute('aria-label') ?? candidate.textContent.trim()) === 'Settings')
            for (const button of buttons) button.click()
            return false
          })()`),
        20_000,
        500,
      )
      if (settingsOpen !== true) {
        const detail = await evaluate(`document.body.innerText.slice(0, 400)`)
        fail(`Settings did not open a dialog: ${JSON.stringify(detail)}`)
      }
      // The dialog remembers a section (a runner's agent home opened it on General); the Models page is chosen the way the product's own
      // openSettingsSection does it: a button in the dialog's nav, by its accessible name in either shipped language.
      const modelsSection = await until(
        async () =>
          await evaluate(`(() => {
            const item = [...document.querySelectorAll('[role=dialog] nav button')].find((candidate) => {
              const label = (candidate.getAttribute('aria-label') ?? '').trim()
              const text = (candidate.textContent ?? '').replace(/\\s+/g, ' ').trim()
              return ['Models', '模型'].includes(label === '' ? text : label)
            })
            if (item === undefined) return false
            item.click()
            return true
          })()`),
        10_000,
      )
      if (modelsSection !== true) {
        const dump = await evaluate(
          `JSON.stringify([...document.querySelectorAll('[role=dialog]')].map((dialog) => ({ label: dialog.getAttribute('aria-label'), html: dialog.outerHTML.slice(0, 1400) })))`,
        )
        fail(`the Settings dialog has no Models section: ${String(dump).slice(0, 4000)}`)
      }
      const models = await until(
        async () =>
          await evaluate(`(() => {
            const dialogs = [...document.querySelectorAll('[role=dialog]')]
            for (const dialog of dialogs) {
              const text = dialog.innerText
              if (text.includes('Loading the provider directory failed')) return { failed: text.slice(0, 400) }
              const input = dialog.querySelector('input[type=password]') ?? dialog.querySelector('input[aria-label="API key"]')
              if (input !== null) return { text: text.slice(0, 200) }
            }
            return undefined
          })()`),
        20_000,
      )
      if (models === undefined) {
        const detail = await evaluate(
          `document.querySelector('[role=dialog]')?.innerText.slice(0, 500) ?? document.body.innerText.slice(0, 500)`,
        )
        fail(`Settings > Models did not show the API key field: ${JSON.stringify(detail)}`)
      }
      if (models.failed !== undefined)
        fail(`Settings > Models failed: ${JSON.stringify(models.failed)}`)
      // The workshop guide tells attendees a Claude or ChatGPT subscription works through this page: the sign-in rows come from the harness
      // authorization catalog (llm-pi-ai's flows), so a frame composed without that row silently offers DeepSeek alone - the owner's item 9.
      // The rows, not the intro sentence: the sentence already says "Claude, ChatGPT or DeepSeek" whatever is listed.
      const signIn = await until(async () => {
        const rows = await evaluate(`(() => {
          const names = [...document.querySelectorAll('[role=dialog] .acrylSignInName strong')]
            .map((element) => element.textContent.trim())
          return { names }
        })()`)
        return rows?.names.includes('Claude') === true && rows?.names.includes('ChatGPT') === true
          ? rows
          : undefined
      }, 20_000)
      if (signIn === undefined)
        fail(
          'Settings > Models does not offer the Claude and ChatGPT sign-in rows the workshop guide names',
        )
      log('Settings > Models offers the Claude and ChatGPT sign-in rows the guide names')
      await evaluate(`(() => {
        const dialog = document.querySelector('[role=dialog]')
        const input = dialog.querySelector('input[type=password]') ?? dialog.querySelector('input[aria-label="API key"]')
        input?.focus()
        return true
      })()`)
      await cdp.send('Input.insertText', { text: GATE_KEY })
      await sleep(250)
      // The Models page saves a provider key with Apply (the first-run card used Save and continue); both are tried, the page one first.
      if ((await click('Apply')) !== true && (await click('Save and continue')) !== true) {
        const dump = await evaluate(
          `JSON.stringify([...document.querySelectorAll('[role=dialog]')].map((dialog) => ({ label: dialog.getAttribute('aria-label'), text: dialog.innerText.slice(0, 400), buttons: [...dialog.querySelectorAll('button')].map((button) => button.textContent.trim()) })))`,
        )
        fail(`Settings > Models has no save action: ${String(dump).slice(0, 2500)}`)
      }
      const saved = await until(
        async () =>
          await evaluate(`(() => {
            const dialog = document.querySelector('[role=dialog]')
            if (dialog === null) return true
            if (dialog.innerText.includes('Loading the provider directory failed')) return 'failed'
            return dialog.innerText.includes('Add an API key to get started') ? undefined : true
          })()`),
        20_000,
      )
      if (saved === 'failed') fail('Settings > Models failed while saving the key')
      if (saved !== true) fail('Settings > Models did not accept the key')
      for (const type of ['keyDown', 'keyUp'])
        await cdp.send('Input.dispatchKeyEvent', {
          type,
          key: 'Escape',
          code: 'Escape',
          windowsVirtualKeyCode: 27,
          nativeVirtualKeyCode: 27,
        })
      await sleep(300)
      log(
        'Settings > Models loads, takes the DeepSeek key, and the first-run prompt leaves once it is saved',
      )
      const afterSettings = await evaluate(
        `Math.max(window.scrollY, document.documentElement.scrollTop, document.body.scrollTop)`,
      )
      if (afterSettings !== 0)
        fail(`the page scrolled to ${String(afterSettings)} while Settings was open`)

      const pressEscape = async () => {
        for (const type of ['keyDown', 'keyUp'])
          await cdp.send('Input.dispatchKeyEvent', {
            type,
            key: 'Escape',
            code: 'Escape',
            windowsVirtualKeyCode: 27,
            nativeVirtualKeyCode: 27,
          })
        await sleep(300)
      }

      // (a) The left panel: Projects/sessions. The rows arrive after the workspace host answers its projects call, so wait for them.
      const left = await until(async () => {
        const snapshot = await evaluate(`(() => {
            const side = document.querySelector('.dshWorkspaceSide')
            return {
              head: side?.querySelector('.dshWorkspaceSideProjectsHead') !== null,
              rows: side?.querySelectorAll('[role=treeitem]').length ?? 0,
            }
          })()`)
        return snapshot?.head === true && (snapshot.rows ?? 0) >= 1 ? snapshot : undefined
      }, 20_000)
      if (left === undefined) fail('the left panel has no Projects/session rows')
      log(`the left panel shows Projects and ${String(left.rows)} tree rows`)

      // (d) DSH chat as a tab. Its title arrives asynchronously and differs by timing: the frame's own "AcrylDSH Chat" until DSH's session title row
      // names the session "New chat". Match the tab by what it is, not by one of its labels, and wait for it like every other surface here.
      const chatTabs = () =>
        evaluate(`[...document.querySelectorAll('[role=tab]')].map(tab => tab.textContent.trim())`)
      const chatTab = await until(async () => {
        const tabs = await chatTabs()
        return Array.isArray(tabs) ? tabs.find((text) => /chat/iu.test(text)) : undefined
      }, 20_000)
      if (chatTab === undefined)
        fail(`the chat tab is not in the tab strip: ${JSON.stringify(await chatTabs())}`)
      log(`the chat tab is in the tab strip ("${chatTab.trim()}")`)

      // (b) The right panel is the workspace's own strip (125): the tab strip with the chat, the terminals and the file, Files and Git tabs lives
      // in the right column, and DSH's sidebar-right views are no longer composed into the frame. Wait until the strip is there with its tabs.
      const right = await until(async () => {
        const snapshot = await evaluate(`(() => {
            const bar = document.querySelector('[data-acryl-slot=rightbar]')
            if (bar === null) return undefined
            const tabs = [...bar.querySelectorAll('[role=tab]')].map(tab => tab.textContent.trim())
            if (tabs.length === 0) return undefined
            const labels = [...bar.querySelectorAll('button,[role=tab]')]
              .map(element => element.getAttribute('aria-label') ?? element.getAttribute('title') ?? element.textContent.trim())
              .filter(Boolean)
            return { text: bar.innerText.slice(0, 600), tabs, labels: labels.slice(0, 60) }
          })()`)
        if (snapshot !== undefined) return snapshot
        await click('Show right panel')
        return undefined
      }, 20_000)
      if (right === undefined) fail('the right panel did not show the workspace strip')
      log(`the right panel is the workspace strip with ${String(right.tabs.length)} tab(s)`)

      // (f) The command palette (the same window event `acryl-shortcuts` sends when its shortcut runs).
      await evaluate(`window.dispatchEvent(new Event('acryl:toggle-command-palette')), true`)
      const palette = await until(
        async () =>
          await evaluate(
            `document.querySelector('[role=dialog][aria-label="Command palette"]') !== null`,
          ),
        10_000,
      )
      if (palette !== true) fail('the command palette did not open')
      log('the command palette opens')
      await pressEscape()

      // (e) A terminal tab, in a real PTY.
      const terminal = await until(async () => {
        if ((await click('Choose what to open')) !== true) return undefined
        await sleep(300)
        if ((await click('New Terminal')) !== true) return undefined
        return await until(
          async () =>
            await evaluate(`(() => {
                const pane = document.querySelector('.dshWorkspaceXterm')
                return pane === null ? undefined : pane.getAttribute('aria-label')
              })()`),
          20_000,
        )
      }, 15_000)
      if (terminal === undefined) fail('a terminal tab did not open a PTY')
      log(`a terminal tab runs a PTY (${String(terminal)})`)
      if ((await click(`Close ${String(terminal).replace(/ terminal$/u, '')}`)) !== true)
        await click('Close Terminal')

      const opened = await until(async () => {
        if ((await click('Choose what to open')) !== true) return undefined
        await sleep(300)
        return (await click('New Browser Tab')) === true ? true : undefined
      }, 15_000)
      if (opened !== true) {
        const diagnostics = await evaluate(`(() => ({
          menu: document.querySelector('[role=menu]')?.innerText.slice(0, 500) ?? null,
          labels: [...document.querySelectorAll('button')].map(button => button.getAttribute('aria-label')).filter(Boolean).slice(0, 40),
        }))()`)
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
        writeFileSync(
          '/tmp/verify-ide-template-tile.png',
          Buffer.from(shot.result?.data ?? '', 'base64'),
        )
        fail(
          `the tab strip does not offer "New Browser Tab": ${JSON.stringify(diagnostics)} (screenshot /tmp/verify-ide-template-tile.png)`,
        )
      }
      // The new tab is added beside the chat tab, whose "Connect a model" card stays in front: select the browser tab itself before reading its address bar.
      const selected = await until(
        async () =>
          await evaluate(`(() => {
            const tab = [...document.querySelectorAll('[role=tab]')]
              .find(candidate => candidate.textContent.includes('Browser'))
            if (tab === undefined) return undefined
            tab.click()
            return true
          })()`),
        10_000,
      )
      if (selected !== true) fail('the new browser tab is not in the tab strip')
      const address = 'input[aria-label="Browser address"]'
      const typed = await until(
        async () => (await evaluate(setInputValue(address, `${origin}${page.path}`))) === true,
        10_000,
      )
      if (typed !== true) {
        const diagnostics = await evaluate(`(() => {
          const input = document.querySelector(${JSON.stringify(address)})
          let error = null
          try {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
            if (input !== null && setter !== undefined) setter.call(input, 'probe')
          } catch (cause) { error = String(cause) }
          return {
            found: input !== null,
            value: input?.value ?? null,
            error,
            browserPane: document.querySelectorAll('.dshWorkspaceBrowser').length,
            tabs: [...document.querySelectorAll('[role=tab]')].map(tab => tab.textContent.trim()).slice(0, 8),
          }
        })()`)
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
        writeFileSync(
          '/tmp/verify-ide-template-tile.png',
          Buffer.from(shot.result?.data ?? '', 'base64'),
        )
        fail(
          `the browser tile has no address input: ${JSON.stringify(diagnostics)} (screenshot /tmp/verify-ide-template-tile.png)`,
        )
      }
      // One press of Go must load the page (the product reads the address field itself and remounts the frame on every press, and retries a
      // same-origin load the browser replaced with its error page once). A second press here would prove nothing about what an attendee sees.
      if ((await click('Go')) !== true) fail('the browser tile has no Go button')
      const shown = await until(
        async () =>
          await evaluate(`(() => {
            const frame = document.querySelector('iframe.dshWorkspaceBrowserFrame')
            if (frame === null) return undefined
            const text = frame.contentDocument?.body?.innerText ?? ''
            return text.includes(${JSON.stringify(page.text)}) ? text.slice(0, 200) : undefined
          })()`),
        30_000,
      )
      if (shown === undefined) {
        const diagnostics = await evaluate(`(() => {
          const frame = document.querySelector('iframe.dshWorkspaceBrowserFrame')
          return {
            src: frame?.getAttribute('src') ?? null,
            title: frame?.contentDocument?.title ?? null,
            text: frame?.contentDocument?.body?.innerText?.slice(0, 300) ?? null,
            // A null document with a src is the browser's own error page (a same-origin page always exposes its document), so the failure
            // says a request died rather than that the tile rendered nothing.
            documentReadable: frame === null ? null : frame.contentDocument !== null,
            browserPane: document.querySelectorAll('.dshWorkspaceBrowser').length,
          }
        })()`)
        fail(
          `the app's page did not load in the frame's browser tile after one Go: ${JSON.stringify(diagnostics)}; Chrome's net log: ${netLog}; server said:\n${output.slice(-1500)}`,
        )
      }
      log(`the app's page is shown in the frame's browser tile: "${shown.trim().split('\n')[0]}"`)

      // The centre is the app: the frame's canvas shows the app's own page, same-origin, and the panel below runs in it (125 slice 1).
      const canvasPage = await until(
        async () =>
          await evaluate(`(() => {
            const frame = document.querySelector('iframe.acrylAppCanvasFrame')
            const doc = frame?.contentDocument ?? null
            const text = doc?.body?.innerText ?? ''
            return doc !== null && text.trim() !== '' ? text.slice(0, 120) : undefined
          })()`),
        30_000,
      )
      if (canvasPage === undefined) {
        const dump = await evaluate(`(() => {
          const frame = document.querySelector('iframe.acrylAppCanvasFrame')
          const main = document.querySelector('[data-acryl-slot="desktop.main"]')
          let href = null
          let readable = null
          try { href = frame?.contentWindow?.location?.href ?? null; readable = frame === null ? null : frame.contentDocument !== null } catch {}
          return {
            frames: [...document.querySelectorAll('iframe')].map(f => ({ cls: f.className, src: f.getAttribute('src') })),
            href, readable,
            mainText: main?.innerText?.slice(0, 200) ?? null,
            mainFound: main !== null,
            conversationSlots: document.querySelectorAll('[data-acryl-slot="conversation"]').length,
            dialogs: [...document.querySelectorAll('[role="dialog"]')].map(d => (d.getAttribute('aria-label') ?? d.textContent?.slice(0, 40) ?? '')).slice(0, 5),
          }
        })()`)
        fail(`the frame canvas did not show the app page: ${JSON.stringify(dump)}`)
      }
      log(`the app's page is shown in the frame's canvas: "${canvasPage.trim().split('\n')[0]}"`)

      // The agent template's own plugins run beside the host (the composition check above proves every row active), and the panel's routes belong under
      // the app's mount: /app/api/agent-panel, where the app is served, not the host's own /api. Open the panel in the iframe, let its session load, and
      // ask the app's own offline agent to add two numbers: the run starts and stops, and the answer lands in the panel's own log.
      if (page.panel === true) {
        const panel = await until(
          async () =>
            await evaluate(`(() => {
            const iframe = document.querySelector('iframe.acrylAppCanvasFrame') ?? document.querySelector('iframe.dshWorkspaceBrowserFrame')
            const host = iframe?.contentDocument?.querySelector('#agent-panel')
            const root = host?.shadowRoot
            const open = root?.querySelector('button.open')
            if (!open) return undefined
            // The panel marks itself ready once its form is wired; filing a submit before that is the half-wired state the gate saw once.
            if (host.dataset.ready !== '1') return undefined
            open.click()
            const select = root.querySelector('select')
            const drivers = [...select.options].map(option => option.value)
            if (!drivers.includes('agent')) return undefined
            select.value = 'agent'
            const textarea = root.querySelector('textarea')
            // Type the way a person does (the native setter plus an input event), not a bare value assignment the page's own listeners would never see.
            const message = 'add 2 3'
            const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
            if (setter !== undefined) setter.call(textarea, message)
            else textarea.value = message
            textarea.dispatchEvent(new Event('input', { bubbles: true }))
            root.querySelector('form').requestSubmit()
            return {
              drivers,
              value: textarea.value,
              ready: host.dataset.ready ?? null,
              following: host.dataset.following ?? null,
            }
          })()`),
          30_000,
        )
        if (panel === undefined)
          fail(
            `the agent panel did not appear in the app's page, or its session did not load; server said:\n${output.slice(-2500)}`,
          )
        // The offline agent answers in well under a second on a quiet machine; a loaded macOS runner once took longer than the old 30 s bound
        // (run 41358355702) with the panel unchanged, so the wait is 60 s and a failure carries the panel's own log instead of only `undefined`.
        const answered = await until(
          async () =>
            await evaluate(`(() => {
            const iframe = document.querySelector('iframe.acrylAppCanvasFrame') ?? document.querySelector('iframe.dshWorkspaceBrowserFrame')
            const root = iframe?.contentDocument?.querySelector('#agent-panel')?.shadowRoot
            const log = root?.querySelector('#log')?.innerText ?? ''
            if (!log.includes('The answer is 5.')) return undefined
            return {
              text: log.slice(-300),
              send: root.querySelector('.send').disabled === false,
              stopped: root.querySelector('.stop').disabled === true,
            }
          })()`),
          60_000,
        )
        if (answered === undefined || answered.send !== true || answered.stopped !== true) {
          const detail = await evaluate(`(() => {
            const iframe = document.querySelector('iframe.acrylAppCanvasFrame') ?? document.querySelector('iframe.dshWorkspaceBrowserFrame')
            const host = iframe?.contentDocument?.querySelector('#agent-panel')
            const root = host?.shadowRoot
            return {
              log: root?.querySelector('#log')?.innerText?.slice(-600) ?? null,
              send: root === undefined || root === null ? null : root.querySelector('.send')?.disabled,
              stop: root === undefined || root === null ? null : root.querySelector('.stop')?.disabled,
              drivers: root === undefined || root === null ? null : [...(root.querySelector('select')?.options ?? [])].map(option => option.value),
              value: root?.querySelector('textarea')?.value ?? null,
              ready: host?.dataset.ready ?? null,
              following: host?.dataset.following ?? null,
            }
          })()`)
          fail(
            `the panel's run did not start and stop in the app's page: ${JSON.stringify(answered)}; at submit: ${JSON.stringify(panel)}; panel: ${JSON.stringify(detail)}`,
          )
        }
        log(
          "the panel opens in the app, asks the app's own agent, and shows the answer (run started and stopped)",
        )
        // The same admission as the app's own server, never a looser one: the mounted path refuses a cross-site request, and an ask without the token.
        const refused = (target, extra) =>
          spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', ...extra, target], {
            encoding: 'utf8',
          }).stdout
        const crossSite = refused(`${origin}/app/api/agent-panel/session`, [
          '-H',
          'Sec-Fetch-Site: cross-site',
        ])
        const noToken = refused(`${origin}/app/api/agent-panel/ask`, [
          '-H',
          'Sec-Fetch-Site: same-origin',
          '-X',
          'POST',
          '-d',
          '{"message":"add 2 3"}',
        ])
        if (crossSite !== '403' || noToken !== '403')
          fail(
            `the panel's admission is not the app's own: a cross-site session answered ${crossSite} and an ask without the token answered ${noToken}, both expected 403`,
          )
        log("the panel's endpoints keep the app's origin and token admission under the mount")

        // The PTY driver is the second app-owned row with routes of its own: a session starts and stops at /app/api/driver-pty, the panel's session
        // names the terminal view under the same mount, and the view module answers there. The same admission refuses a cross-site or untokened call.
        const pty = await evaluate(`(async () => {
          const session = await (await fetch('/app/api/agent-panel/session')).json()
          const driver = session.drivers.find(entry => entry.kind === 'terminal')
          if (driver === undefined) return { error: 'no terminal driver', drivers: session.drivers }
          const headers = { 'content-type': 'application/json', 'x-agent-panel-token': session.token }
          const view = await fetch(driver.view.module)
          const started = await fetch('/app/api/driver-pty/sessions', { method: 'POST', headers, body: JSON.stringify({ driver: driver.name, cols: 80, rows: 24 }) })
          const created = await started.json().catch(() => ({}))
          if (started.status !== 200 || typeof created.id !== 'string')
            return { error: 'start answered ' + started.status, body: created, view: view.status }
          const stopped = await fetch('/app/api/driver-pty/' + created.id + '/stop', { method: 'POST', headers, body: '{}' })
          return {
            driver: driver.name,
            view: driver.view,
            viewStatus: view.status,
            viewType: view.headers.get('content-type'),
            started: started.status,
            stopped: stopped.status,
          }
        })()`)
        if (
          pty === undefined ||
          pty.started !== 200 ||
          pty.stopped !== 200 ||
          pty.viewStatus !== 200
        )
          fail(
            `the PTY session did not start and stop at the app's mount: ${JSON.stringify(pty)} (server said:\n${output.slice(-1500)})`,
          )
        if (
          pty.view?.prefix !== '/app/api/driver-pty' ||
          !String(pty.view?.module ?? '').startsWith('/app/api/driver-pty/')
        )
          fail(`the terminal view is not under the app's mount: ${JSON.stringify(pty.view)}`)
        log(
          `the PTY starts and stops at /app/api/driver-pty (${pty.driver}); its view answers there`,
        )
        const crossSitePty = refused(`${origin}/app/api/driver-pty/sessions`, [
          '-H',
          'Sec-Fetch-Site: cross-site',
          '-H',
          'Content-Type: application/json',
          '-X',
          'POST',
          '-d',
          '{"driver":"pty:node"}',
        ])
        const noTokenPty = refused(`${origin}/app/api/driver-pty/sessions`, [
          '-H',
          'Sec-Fetch-Site: same-origin',
          '-H',
          'Content-Type: application/json',
          '-X',
          'POST',
          '-d',
          '{"driver":"pty:node"}',
        ])
        if (crossSitePty !== '403' || noTokenPty !== '403')
          fail(
            `the terminal's admission is not the panel's own: a cross-site session answered ${crossSitePty} and an untokened one answered ${noTokenPty}, both expected 403`,
          )
        log("the terminal's endpoints keep the app's origin and token admission under the mount")
      }

      // A settings change is picked up on the next page load. The new chat is asked as soon as the frame is back - inside the window in which the frame
      // restores the shown chat's worktree (the session list arrives, then the tree discovers the chat's folder). The product keeps that new chat waiting
      // with a visible state and opens it on the restored worktree (ide/acryl-workspace: WorkspaceShellState.waitForSelection and
      // WorkspaceCanvas.openChat); the gate neither waits for a selection first, clicks a fallback nor retries - the composer below is the proof.
      await cdp.send('Page.navigate', { url: `${origin}/` })
      const reloaded = await until(
        async () => await evaluate(`document.querySelector('.dshWorkspaceSide') !== null`),
        60_000,
      )
      if (reloaded !== true) fail('the frame did not come back after the settings reload')

      // The workshop runs on the agent template; the blank app has no chat worktree, so its chat send is not checked here.
      if (template === 'agent') {
        // A fresh chat from the tab menu: a session started after the key was saved shows no first-run card.
        // The toolbar renders a moment after the frame; the worktree does not wait to be restored before this click - only the button has to be there.
        const hasMenu = await until(
          async () =>
            await evaluate(
              `[...document.querySelectorAll('button')].some((candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent.trim()) === 'Choose what to open')`,
            ),
          15_000,
        )
        if (hasMenu !== true) fail('the frame has no "Choose what to open" button')
        // The menu is opened and the item is pressed when it appears; if the first press did not open it (the toolbar was still rendering), press again -
        // a bounded retry of the menu, not of the worktree (which the product waits for on its own).
        let chatOpened = false
        for (let attempt = 0; attempt < 3 && chatOpened !== true; attempt += 1) {
          await evaluate(
            `(() => { const button = [...document.querySelectorAll('button')].find((candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent.trim()) === 'Choose what to open'); button?.click(); return true })()`,
          )
          chatOpened = await until(
            async () =>
              await evaluate(`(() => {
            const item = [...document.querySelectorAll('[role=menuitem],button,a')].find((candidate) => (candidate.textContent.trim()) === 'AcrylDSH Chat')
            if (item === undefined) return false
            item.click()
            return true
          })()`),
            3_000,
          )
          if (chatOpened !== true) await sleep(500)
        }
        if (chatOpened !== true) fail('the tab menu has no AcrylDSH Chat item')
        if (
          (await evaluate(
            `document.body.innerText.includes('Restoring the worktree of the open chat')`,
          )) === true
        )
          log(
            'the new chat was asked while the worktree was restoring, and opened on it once it was there',
          )
        await sleep(1500)
        await sleep(1200)
        await sleep(1500)
        await evaluate(
          `(() => { const tab = [...document.querySelectorAll('[role=tab]')].find(candidate => /chat/iu.test(candidate.textContent)); tab?.click(); return true })()`,
        )
        await sleep(800)
        if (
          (await evaluate(
            `document.querySelector('section[aria-label="Connect a model"]') !== null`,
          )) === true
        )
          fail('the chat still asks for a key after it was saved in Settings > Models')
        log('the chat does not ask for a key again after Settings > Models saved it')
        const composer = await until(
          async () =>
            await evaluate(
              `document.querySelector('[contenteditable=true][aria-label^="Describe"]') !== null`,
            ),
          20_000,
        )
        if (composer !== true) {
          const detail = await evaluate(`document.body.innerText.slice(0, 500)`)
          fail(`the chat has no composer after the settings reload: ${JSON.stringify(detail)}`)
        }
        // The composer takes the text through the focused contenteditable; a re-render can drop the focus before the insert, so the text is verified and the
        // insert repeated. The send control is then waited for, and a failure names the buttons that are there.
        let typed = false
        for (let attempt = 0; attempt < 3 && !typed; attempt += 1) {
          await evaluate(
            `document.querySelector('[contenteditable=true][aria-label^="Describe"]')?.focus()`,
          )
          await cdp.send('Input.insertText', { text: GATE_MESSAGE })
          await sleep(250)
          typed = await until(
            async () =>
              (await evaluate(
                `(document.querySelector('[contenteditable=true][aria-label^="Describe"]')?.textContent ?? '').includes(${JSON.stringify(GATE_MESSAGE)})`,
              )) === true,
            5_000,
          )
        }
        if (typed !== true) fail('the chat composer did not take the message text')
        const sendEnabled = await until(
          async () =>
            await evaluate(`(() => {
              const button = document.querySelector('button[aria-label="Send message"]')
              return button !== null && !button.disabled
            })()`),
          15_000,
        )
        if (sendEnabled !== true) {
          const detail = await evaluate(`JSON.stringify({
            text: document.body.innerText.slice(0, 400),
            buttons: [...document.querySelectorAll('button')].map((candidate) => candidate.getAttribute('aria-label') ?? candidate.textContent.trim()).filter(Boolean).slice(0, 40),
            composer: (document.querySelector('[contenteditable=true][aria-label^="Describe"]')?.textContent ?? '').slice(0, 120),
          })`)
          fail(`the chat has no send control: ${JSON.stringify(detail)}`)
        }
        await evaluate(
          `(() => { document.querySelector('button[aria-label="Send message"]')?.click(); return true })()`,
        )
        const used = await until(
          async () =>
            mock.requests.some((request) => request.headers['x-api-key'] === GATE_KEY) || undefined,
          30_000,
        )
        if (!used)
          fail(
            `the model request did not carry the entered key; requests: ${JSON.stringify(mock.requests.map((request) => ({ url: request.url, key: request.headers['x-api-key'] ?? null })))}`,
          )
        const inPage = await evaluate(
          `document.documentElement.outerHTML.includes(${JSON.stringify(GATE_KEY)}) || document.body.innerText.includes(${JSON.stringify(GATE_KEY)})`,
        )
        if (inPage === true) fail('the API key is still in the page after it was stored')
        log(
          'the chat sent a message with the key saved in Settings, and the local model answered; the page does not keep the key',
        )
      }

      if (skipSettings) log('Settings skipped (GATE_SKIP_SETTINGS=1)')
      else {
        // Settings last: it is the one surface another worker owns (the settings registration), so every independent assertion above runs first.
        // (c) Settings: General, Models, Plugins, Support, Shortcuts.
        // A person presses Settings once and waits for it; only a visible dialog whose nav carries a real section counts, so a stale or hidden dialog
        // cannot be mistaken for Settings. Pressing again before the dialog has rendered toggles the open panel closed again, which is how a slow runner
        // livelocked this step on 2026-11-02 (both triggers present, no dialog, no exception, forty presses in twenty seconds): each press here is
        // followed by a bounded wait for the render, and only then is the next press allowed.
        const settingsOpenExpression = `(() => {
          const sectionLabels = ['Models', '模型']
          const isSection = (button) => {
            const label = (button.getAttribute('aria-label') ?? '').trim()
            const text = (button.textContent ?? '').replace(/\\s+/g, ' ').trim()
            return sectionLabels.includes(label === '' ? text : label)
          }
          return [...document.querySelectorAll('[role=dialog]')].some((dialog) =>
            dialog.getClientRects().length > 0 &&
            dialog.querySelector('nav') !== null &&
            [...dialog.querySelectorAll('nav button')].some(isSection))
        })()`
        const pressSettingsExpression = `(() => {
          // Press the product's own trigger once. The visible foot button goes through the frame's openSettings path (which activates the DSH trigger
          // itself); pressing the hidden upstream trigger as well can toggle the just-opened dialog straight back shut, so it is only the fallback.
          const labelOf = (element) => (element.getAttribute('aria-label') ?? element.textContent.trim())
          const foot = [...document.querySelectorAll('.dshWorkspaceSideFoot button')].filter((candidate) => labelOf(candidate) === 'Settings')
          const buttons = foot.length > 0 ? foot : [...document.querySelectorAll('.dshWorkspaceSide button')].filter((candidate) => labelOf(candidate) === 'Settings')
          for (const button of buttons.slice(0, 1)) button.click()
          if (buttons.length === 0) {
            const trigger = [...document.querySelectorAll('button[aria-haspopup="dialog"]')]
              .find((button) => ['Settings', '设置'].includes(button.getAttribute('aria-label') ?? ''))
            trigger?.click()
          }
          return buttons.length
        })()`
        let opened = false
        let presses = 0
        for (let attempt = 0; attempt < 6 && !opened; attempt += 1) {
          presses += 1
          if ((await evaluate(settingsOpenExpression)) === true) {
            opened = true
            break
          }
          await evaluate(pressSettingsExpression)
          opened =
            (await until(
              async () => ((await evaluate(settingsOpenExpression)) === true ? true : undefined),
              3_000,
              200,
            )) === true
        }
        if (opened !== true) {
          const detail = await evaluate(`(() => {
            const candidates = [...document.querySelectorAll('button,[role=button],[role=menuitem],a')]
              .filter((candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent.trim()) === 'Settings')
              .map((candidate) => ({
                tag: candidate.tagName,
                className: String(candidate.className).slice(0, 80),
                inFoot: candidate.closest('.dshWorkspaceSideFoot') !== null,
                inUpstreamHost: candidate.closest('.dshWorkspaceUpstreamHost') !== null,
                inDialog: candidate.closest('[role=dialog]') !== null,
                visible: candidate.getClientRects().length > 0,
                disabled: candidate.disabled === true,
                ariaDisabled: candidate.getAttribute('aria-disabled'),
                ariaExpanded: candidate.getAttribute('aria-expanded'),
                ariaHaspopup: candidate.getAttribute('aria-haspopup'),
              }))
            // The run state at the failure: a DSH chat that is still streaming shows its Stop control and no enabled Send.
            const controls = [...document.querySelectorAll('button')]
              .map((button) => button.getAttribute('aria-label') ?? button.textContent.trim())
              .filter((label) => /stop|send|cancel|interrupt/iu.test(label))
              .slice(0, 8)
            const dialogs = [...document.querySelectorAll('[role=dialog]')].map((dialog) => ({
              visible: dialog.getClientRects().length > 0,
              label: dialog.getAttribute('aria-label'),
              nav: dialog.querySelector('nav') !== null,
            }))
            return JSON.stringify({ presses: ${presses}, body: document.body.innerText.slice(-1200), candidates, controls, dialogs })
          })()`)
          fail(`Settings did not open: ${String(detail)}`)
        }
        // The record of the product answer: Settings must open while a chat run streams. The Success log says whether one was still going at the
        // moment the dialog was found, so a regression is visible even when this step passes.
        const runAtOpen = await evaluate(`(() => {
          const labels = [...document.querySelectorAll('button')].map((button) => button.getAttribute('aria-label') ?? button.textContent.trim())
          return labels.filter((label) => /stop|interrupt|cancel/iu.test(label)).slice(0, 5)
        })()`)
        log(`Settings opened; stop/interrupt controls at that moment: ${JSON.stringify(runAtOpen)}`)
        // The dialog is up; its sections register asynchronously, and on a slow runner a layout settle can close it again right after it opens (the blank
        // gate's Node 22 check, run 41491427783, found the dialog and then lost it during this wait). Keep reading the dialog itself; if it vanishes,
        // press Settings once more - a person does the same - and never press while it is up, so a late render cannot be toggled shut.
        const sections = ['General', 'Models', 'Plugins', 'Support', 'Shortcuts']
        let settings
        let sectionPresses = 0
        const sectionDeadline = Date.now() + 20_000
        while (Date.now() < sectionDeadline && settings === undefined) {
          const snapshot = await evaluate(`(() => {
            const dialog = [...document.querySelectorAll('[role=dialog]')]
              .find((candidate) => candidate.getClientRects().length > 0 && candidate.querySelector('nav') !== null)
            if (dialog === undefined) return { open: false }
            const labels = [...dialog.querySelectorAll('button,[role=tab],[role=menuitem],a')]
              .map((element) => element.getAttribute('aria-label') ?? element.textContent.trim())
              .filter(Boolean)
            return { open: true, text: dialog.innerText.slice(0, 4000), labels: labels.slice(0, 160) }
          })()`)
          if (snapshot?.open === true) {
            const text = `${snapshot.text}\n${snapshot.labels.join('\n')}`
            if (/Shortcuts/iu.test(text)) settings = { text, labels: snapshot.labels }
            else await sleep(300)
            continue
          }
          sectionPresses += 1
          await evaluate(pressSettingsExpression)
          await sleep(800)
        }
        if (settings === undefined) {
          const detail = await evaluate(`(() => {
            const dialogs = [...document.querySelectorAll('[role=dialog]')].map((dialog) => ({
              visible: dialog.getClientRects().length > 0,
              label: dialog.getAttribute('aria-label'),
              nav: dialog.querySelector('nav') !== null,
              text: dialog.innerText.slice(0, 300),
            }))
            const controls = [...document.querySelectorAll('button')]
              .map((button) => button.getAttribute('aria-label') ?? button.textContent.trim())
              .filter((label) => /stop|send|cancel|interrupt/iu.test(label))
              .slice(0, 8)
            return JSON.stringify({ presses: ${presses + sectionPresses}, dialogs, controls, body: document.body.innerText.slice(-1200) })
          })()`)
          fail(`Settings did not stay open with its sections: ${String(detail)}`)
        }
        const settingsText = `${settings.text}\n${settings.labels.join('\n')}`
        // DSH 0.2 labels the plugins section "Built-in plugins"; the section names match case-insensitively.
        const missing = sections.filter((section) => !new RegExp(section, 'iu').test(settingsText))
        if (missing.length > 0)
          fail(
            `Settings is missing ${missing.join(', ')}: ${JSON.stringify(settings).slice(0, 3000)}`,
          )
        log(`Settings has ${sections.join(', ')}`)
        await pressEscape()
      }
      // The session banner (119): the browser's session is gone (its cookie is deleted, as Chrome loses it after a restart inside its flush window)
      // and the host restarts under the open page. The connection cannot recover, so the frame must name the command instead of spinning - and the
      // document must not scroll while it does.
      const cookies = (await cdp.send('Network.getAllCookies')).result?.cookies ?? []
      for (const cookie of cookies)
        await cdp.send('Network.deleteCookies', {
          name: cookie.name,
          domain: cookie.domain,
          path: cookie.path,
        })
      const restartedUrl = await restartHost()
      if (restartedUrl === undefined) fail('the host did not restart for the session banner check')
      const banner = await until(async () => {
        return await evaluate(`(() => {
          const alert = [...document.querySelectorAll('[role=alert]')].find((element) => element.innerText.includes('session ended'))
          if (alert === undefined) return undefined
          return { text: alert.innerText.slice(0, 300), scrollTop: Math.max(window.scrollY, document.documentElement.scrollTop, document.body.scrollTop) }
        })()`)
      }, 30_000)
      if (banner === undefined) {
        const detail = await evaluate(`document.body.innerText.slice(0, 400)`)
        fail(
          `the session banner did not appear after the host restarted without the browser's session: ${JSON.stringify(detail)}; server said:\n${output.slice(-1500)}`,
        )
      }
      if (!banner.text.includes('npx acrylblends open'))
        fail(`the session banner does not name the command: ${JSON.stringify(banner.text)}`)
      if (banner.scrollTop !== 0)
        fail(`the page scrolled to ${String(banner.scrollTop)} while the session banner showed`)
      log(
        'the session banner names `npx acrylblends open` after the browser session ended, with the page unscrolled',
      )
    } catch (error) {
      const reported = pageReported()
      if (reported.length > 0)
        console.error(
          `verify-ide-template(${template}): the page reported:\n${reported.join('\n')}`,
        )
      throw error
    } finally {
      cdp.close()
    }
  } finally {
    // The whole tree, not only the browser process: on Windows renderers and crashpad outlive a killed browser and hold the profile.
    await stopChrome(launched?.child)
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 })
    } catch {
      // Windows can still hold a file of the closed browser for a moment. The folder sits in the temp directory, and a page that passed stays passed;
      // the run's own scratch is removed by the caller, which reports a failure of its own.
    }
  }
}
