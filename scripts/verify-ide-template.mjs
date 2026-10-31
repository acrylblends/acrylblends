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
import { chromeFlags, devtools, findChrome } from './lib/door-probe.mjs'
import { frameSpecsEnv } from './lib/ide-specs.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = join(root, 'packages', 'cli', 'bin', 'acrylblends.js')
const template = process.argv[2] ?? 'blank'
const keep = process.argv.includes('--keep')
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
      send('content_block_stop', { type: 'content_block_stop', index: 0 })
      send('message_delta', {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 4 },
      })
      send('message_stop', { type: 'message_stop' })
      response.end()
    })
  })
  return new Promise((done) => {
    mock.listen(0, '127.0.0.1', () => {
      done({
        url: `http://127.0.0.1:${String(mock.address().port)}`,
        requests,
        close: () =>
          new Promise((closed) => {
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
const app = join(scratch, `${template}-app`)
const home = join(scratch, 'home')
let server
let mock
try {
  const env = {
    ...process.env,
    ACRYLBLENDS_FRAME_PACKAGES: frameSpecsEnv(root, { dshVersion: DSH_VERSION, frameworkVersion }),
  }
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

  const install = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
    cwd: app,
    encoding: 'utf8',
    env: { ...process.env, npm_config_loglevel: 'error' },
  })
  if (install.status !== 0)
    fail(`npm install failed:
${install.stdout}${install.stderr}`)
  log('installed the framework, the DSH driver and the frame packages')

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

  let output = ''
  server = spawn('npm', ['run', 'dev'], {
    cwd: app,
    env: bootEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stdout.on('data', (chunk) => (output += chunk))
  server.stderr.on('data', (chunk) => (output += chunk))
  const url = await until(
    async () => /(http:\/\/127\.0\.0\.1:\d+\/?\?token=\S*)/u.exec(output)?.[1],
    180_000,
  )
  if (!url) fail(`the app did not print a tokenized URL:\n${output}`)
  log(`the frame boots on our host at ${url}`)

  const origin = new URL(url).origin
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
    const door = spawnSync(join(app, '.acryl', 'bin', 'acryl'), ['brief', '--json'], {
      cwd: app,
      encoding: 'utf8',
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

  await checkTileInBrowser(url, origin, jar, page, output, mock)
  // The owner's rule: the key lives only in DSH's own store, never in the page or the app folder.
  const keyFiles = filesContaining(bootEnv.ACRYLBLENDS_HOME, GATE_KEY)
  if (keyFiles.length === 0) fail('the host did not store the key in its own home')
  const appFiles = filesContaining(
    app,
    GATE_KEY,
    (file) => !file.includes(`${sep}.acrylblends${sep}`),
  )
  if (appFiles.length > 0) fail(`the key reached the app folder: ${appFiles.join(', ')}`)
  log(
    `the key is in the host's own store (${keyFiles.map((file) => relative(bootEnv.ACRYLBLENDS_HOME, file)).join(', ')}) and nowhere in the app folder`,
  )
  log('OK')
} finally {
  if (mock !== undefined) await mock.close()
  if (server) {
    server.kill('SIGTERM')
    await until(async () => (server.exitCode !== null ? true : undefined), 15_000)
    if (server.exitCode === null) server.kill('SIGKILL')
  }
  if (keep) console.error(`verify-ide-template: kept ${scratch}`)
  else rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}

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
async function checkTileInBrowser(url, origin, jar, page, output, mock) {
  const chrome = findChrome()
  if (chrome === undefined)
    fail('no Chrome or Chromium on this machine (set CHROME_BIN) for the tile check')
  const profile = mkdtempSync(join(tmpdir(), 'ide-template-tile-'))
  const port = 9600 + Math.floor(Math.random() * 300)
  const child = spawn(chrome, [...chromeFlags(profile, port), '--hide-scrollbars'], {
    stdio: 'ignore',
  })
  try {
    for (let i = 0; i < 200; i += 1) {
      if (
        await fetch(`http://127.0.0.1:${port}/json/version`).then(
          (r) => r.ok,
          () => false,
        )
      )
        break
      await sleep(50)
    }
    const cdp = await devtools(port)
    try {
      await cdp.send('Page.enable')
      await cdp.send('Runtime.enable')
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

      // (d) DSH chat as a tab.
      const tabs = await evaluate(
        `[...document.querySelectorAll('[role=tab]')].map(tab => tab.textContent.trim())`,
      )
      if (!Array.isArray(tabs) || !tabs.some((text) => text.includes('AcrylDSH Chat')))
        fail(`the chat tab is not in the tab strip: ${JSON.stringify(tabs)}`)
      log('the chat tab is in the tab strip')

      // (b) The right panel with the workspace's Files/Changes/Review views (DSH's right sidebar, which the workspace fills).
      // The panel opens empty and fills after its tab types register; the toggle button also appears a moment after the frame, so the wait
      // presses it again until the views are there (a press on an already-open panel finds no button and does nothing).
      const right = await until(async () => {
        const snapshot = await evaluate(`(() => {
            const bar = document.querySelector('[data-acryl-slot=rightbar]')
            if (bar === null) return undefined
            const text = bar.innerText
            if (!text.includes('Changes')) return undefined
            const labels = [...bar.querySelectorAll('button,[role=tab]')]
              .map(element => element.getAttribute('aria-label') ?? element.getAttribute('title') ?? element.textContent.trim())
              .filter(Boolean)
            return { text: text.slice(0, 600), labels: labels.slice(0, 60) }
          })()`)
        if (snapshot !== undefined) return snapshot
        await click('Show right panel')
        return undefined
      }, 20_000)
      if (right === undefined) fail('the right panel did not open with its views')
      const rightText = `${right.text}\n${right.labels.join('\n')}`
      for (const label of ['Changes', 'Review'])
        if (!rightText.includes(label))
          fail(`the right panel has no ${label} view: ${JSON.stringify(right)}`)
      if (!rightText.includes('Files') && !rightText.includes('Code'))
        fail(`the right panel has no files view: ${JSON.stringify(right)}`)
      log('the right panel offers Files, Changes and Review')

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
      if (shown === undefined)
        fail(
          `the app's page did not load in the frame's browser tile; server said:\n${output.slice(-2500)}`,
        )
      log(`the app's page is shown in the frame's browser tile: "${shown.trim().split('\n')[0]}"`)

      // The agent template's own plugins run beside the host (the composition check above proves every row active), and the panel's routes belong under
      // the app's mount: /app/api/agent-panel, where the app is served, not the host's own /api. Open the panel in the iframe, let its session load, and
      // ask the app's own offline agent to add two numbers: the run starts and stops, and the answer lands in the panel's own log.
      if (page.panel === true) {
        const panel = await until(
          async () =>
            await evaluate(`(() => {
            const iframe = document.querySelector('iframe.dshWorkspaceBrowserFrame')
            const root = iframe?.contentDocument?.querySelector('#agent-panel')?.shadowRoot
            const open = root?.querySelector('button.open')
            if (!open) return undefined
            open.click()
            const select = root.querySelector('select')
            const drivers = [...select.options].map(option => option.value)
            if (!drivers.includes('agent')) return undefined
            select.value = 'agent'
            const textarea = root.querySelector('textarea')
            textarea.value = 'add 2 3'
            root.querySelector('form').requestSubmit()
            return { drivers }
          })()`),
          30_000,
        )
        if (panel === undefined)
          fail(
            `the agent panel did not appear in the app's page, or its session did not load; server said:\n${output.slice(-2500)}`,
          )
        const answered = await until(
          async () =>
            await evaluate(`(() => {
            const iframe = document.querySelector('iframe.dshWorkspaceBrowserFrame')
            const root = iframe?.contentDocument?.querySelector('#agent-panel')?.shadowRoot
            const log = root?.querySelector('#log')?.innerText ?? ''
            if (!log.includes('The answer is 5.')) return undefined
            return {
              text: log.slice(-300),
              send: root.querySelector('.send').disabled === false,
              stopped: root.querySelector('.stop').disabled === true,
            }
          })()`),
          30_000,
        )
        if (answered === undefined || answered.send !== true || answered.stopped !== true)
          fail(
            `the panel's run did not start and stop in the app's page: ${JSON.stringify(answered)}`,
          )
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

      // (i) The chat, with the local model mock: the first-run card takes the key, the composer sends a message, and the model request carries
      // the key that was entered (the proof of use, not how fast a reply paints).
      await evaluate(
        `(() => { const tab = [...document.querySelectorAll('[role=tab]')].find(candidate => candidate.textContent.includes('AcrylDSH Chat')); tab?.click(); return true })()`,
      )
      await sleep(500)
      const card = await until(
        async () =>
          await evaluate(
            `document.querySelector('section[aria-label="Connect a model"]') !== null`,
          ),
        20_000,
      )
      if (card !== true) {
        const snapshot = await evaluate(
          `({ chat: document.querySelector('.dshWorkspaceChat')?.innerText.slice(0, 300) ?? null, body: document.body.innerText.slice(0, 400) })`,
        )
        fail(`the connect card did not appear in the chat: ${JSON.stringify(snapshot)}`)
      }
      await evaluate(
        `document.querySelector('section[aria-label="Connect a model"] input[aria-label="API key"]')?.focus()`,
      )
      await cdp.send('Input.insertText', { text: GATE_KEY })
      await sleep(250)
      const enabled = await evaluate(
        `(() => { const button = [...document.querySelectorAll('section[aria-label="Connect a model"] button')].find(candidate => candidate.textContent.trim() === 'Connect'); return button !== undefined && !button.disabled })()`,
      )
      if (enabled !== true) fail('the connect action did not enable after a key was typed')
      await evaluate(
        `(() => { const button = [...document.querySelectorAll('section[aria-label="Connect a model"] button')].find(candidate => candidate.textContent.trim() === 'Connect'); button?.click(); return true })()`,
      )
      const connected = await until(
        async () =>
          await evaluate(
            `document.querySelector('section[aria-label="Connect a model"]') === null`,
          ),
        20_000,
      )
      if (connected !== true) fail('the connect card stayed after the key was entered')
      log('the frame takes an API key in its first-run card and the card leaves once it is stored')
      await evaluate(
        `document.querySelector('[contenteditable=true][aria-label^="Describe"]')?.focus()`,
      )
      await cdp.send('Input.insertText', { text: GATE_MESSAGE })
      await sleep(250)
      if (
        (await evaluate(
          `(() => { const button = document.querySelector('button[aria-label="Send message"]'); if (button === null) return false; button.click(); return true })()`,
        )) !== true
      )
        fail('the chat has no send control')
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
        'the chat sent a message with the key entered in the card, and the local model answered; the page does not keep the key',
      )

      if (skipSettings) log('Settings skipped (GATE_SKIP_SETTINGS=1)')
      else {
        // Settings last: it is the one surface another worker owns (the settings registration), so every independent assertion above runs first.
        // (c) Settings: General, Models, Plugins, Support, Shortcuts.
        if ((await click('Settings')) !== true) fail('the frame has no Settings button')
        const settings = await until(
          async () =>
            await evaluate(`(() => {
              const text = document.body.innerText
              const labels = [...document.querySelectorAll('button,[role=tab],[role=menuitem],a')]
                .map(element => element.getAttribute('aria-label') ?? element.textContent.trim())
                .filter(Boolean)
              return { text: text.slice(-4000), labels: labels.slice(0, 120) }
            })()`),
          10_000,
        )
        if (settings === undefined) fail('Settings did not open')
        const settingsText = `${settings.text}\n${settings.labels.join('\n')}`
        const sections = ['General', 'Models', 'Plugins', 'Support', 'Shortcuts']
        // DSH 0.2 labels the plugins section "Built-in plugins"; the section names match case-insensitively.
        const missing = sections.filter((section) => !new RegExp(section, 'iu').test(settingsText))
        if (missing.length > 0)
          fail(
            `Settings is missing ${missing.join(', ')}: ${JSON.stringify(settings).slice(0, 3000)}`,
          )
        log(`Settings has ${sections.join(', ')}`)
        await pressEscape()
      }
    } finally {
      cdp.close()
    }
  } finally {
    child.kill('SIGKILL')
    await new Promise((done) => {
      if (child.exitCode !== null) return done()
      child.once('exit', done)
      setTimeout(done, 5_000)
    })
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}
