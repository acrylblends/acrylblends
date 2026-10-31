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
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromeFlags, devtools, findChrome } from './lib/door-probe.mjs'
import { frameSpecsEnv } from './lib/ide-specs.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = join(root, 'packages', 'cli', 'bin', 'acrylblends.js')
const template = process.argv[2] ?? 'blank'
const keep = process.argv.includes('--keep')
const log = (message) => console.log(`verify-ide-template(${template}): ${message}`)
const fail = (message) => {
  throw new Error(`verify-ide-template(${template}): ${message}`)
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

/** Where each template's own page lives behind the frame prefix, and the text that proves it rendered. `blank`'s root is its JSON API; its page is /about. */
const PAGES = {
  blank: { path: '/app/about', text: 'About' },
}

const page = PAGES[template]
if (page === undefined) fail(`no page known for template "${template}"`)
if (!existsSync(join(root, 'packages', 'cli', 'dist', 'index.js')))
  fail('the CLI is not built (run pnpm run build)')

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
    // Any free port: the gate may share the machine with a person's frame or another worker's run.
    ACRYLBLENDS_PORT: '0',
  }
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

  // The app answers at its prefix: /app is the app's root (blank answers JSON there). Retried, because the app's row claims the prefix a moment after DSH
  // prints its URL.
  const appFile = join(scratch, 'app.json')
  const appJson = await until(async () => {
    const code = Number(
      spawnSync('curl', ['-sL', '-o', appFile, '-w', '%{http_code}', `${origin}/app`], {
        encoding: 'utf8',
      }).stdout,
    )
    if (code !== 200) return undefined
    const parsed = JSON.parse(readFileSync(appFile, 'utf8'))
    return parsed.ok === true ? parsed : undefined
  }, 30_000)
  if (appJson === undefined)
    fail(`the app did not answer at /app; server said:\n${output.slice(-2500)}`)
  log(`the app answers at /app: ${JSON.stringify(appJson)}`)

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

  await checkTileInBrowser(url, origin, jar, page, output)
  log('OK')
} finally {
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
async function checkTileInBrowser(url, origin, jar, page, output) {
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

      // (a) The left panel: Projects/sessions.
      const left = await evaluate(`(() => {
        const side = document.querySelector('.dshWorkspaceSide')
        return {
          head: side?.querySelector('.dshWorkspaceSideProjectsHead') !== null,
          rows: side?.querySelectorAll('[role=treeitem]').length ?? 0,
        }
      })()`)
      if (left?.head !== true || (left.rows ?? 0) < 1)
        fail(`the left panel has no Projects/session rows: ${JSON.stringify(left)}`)
      log(`the left panel shows Projects and ${String(left.rows)} tree rows`)

      // (d) DSH chat as a tab.
      const tabs = await evaluate(
        `[...document.querySelectorAll('[role=tab]')].map(tab => tab.textContent.trim())`,
      )
      if (!Array.isArray(tabs) || !tabs.some((text) => text.includes('AcrylDSH Chat')))
        fail(`the chat tab is not in the tab strip: ${JSON.stringify(tabs)}`)
      log('the chat tab is in the tab strip')

      // (b) The right panel with the workspace's Files/Changes/Review views (DSH's right sidebar, which the workspace fills).
      await click('Show right panel')
      // The panel opens empty and fills after its tab types register: wait for the views themselves, not the first non-null snapshot.
      const right = await until(
        async () =>
          await evaluate(`(() => {
            const bar = document.querySelector('[data-acryl-slot=rightbar]')
            if (bar === null) return undefined
            const text = bar.innerText
            if (!text.includes('Changes')) return undefined
            const labels = [...bar.querySelectorAll('button,[role=tab]')]
              .map(element => element.getAttribute('aria-label') ?? element.getAttribute('title') ?? element.textContent.trim())
              .filter(Boolean)
            return { text: text.slice(0, 600), labels: labels.slice(0, 60) }
          })()`),
        15_000,
      )
      if (right === undefined) fail('the right panel did not open with its views')
      const rightText = `${right.text}\n${right.labels.join('\n')}`
      for (const label of ['Changes', 'Review'])
        if (!rightText.includes(label))
          fail(`the right panel has no ${label} view: ${JSON.stringify(right)}`)
      if (!rightText.includes('Files') && !rightText.includes('Code'))
        fail(`the right panel has no files view: ${JSON.stringify(right)}`)
      log('the right panel offers Files, Changes and Review')

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
      const missing = sections.filter((section) => !settingsText.includes(section))
      if (missing.length > 0)
        fail(
          `Settings is missing ${missing.join(', ')}: ${JSON.stringify(settings).slice(0, 3000)}`,
        )
      log(`Settings has ${sections.join(', ')}`)
      await pressEscape()

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
