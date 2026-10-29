#!/usr/bin/env node
// The gate of 1.0.4's door: an agent that builds a page can look at it and click through it in the same run.
//   node scripts/verify-door-reload.mjs
// In a fresh agent app, a plugin serves a page that has NO door script tag, a real (headless) Chrome opens it, and the folder's own command (`.acryl/bin/acryl`) is used as an agent
// uses it: `look` sees the page (the door adds its script to every HTML page in development); a change to the plugin followed by `plugin reload` shows the new page without anyone
// reloading it (the door reloads the open pages and answers once they are back); a change the plugin system does not know about is picked up by `act reload`; `act navigate --path`
// goes to another page of the app and refuses a path that would leave it. Offline: no model, no key.
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromeFlags, devtools, findChrome } from './lib/door-probe.mjs'
import { freePort } from './lib/port.mjs'
import { startGroup, stopGroup } from './lib/proc.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = join(root, 'packages/cli/bin/acrylblends.js')
const log = (message) => console.log(`verify-door-reload: ${message}`)
const fail = (message) => {
  throw new Error(`verify-door-reload: ${message}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function until(fn, ms, every = 300) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const value = await fn().catch(() => undefined)
    if (value) return value
    await sleep(every)
  }
}

const chrome = findChrome()
if (!chrome) {
  log('skipped: no Chrome or Chromium on this machine (set CHROME_BIN)')
  process.exit(0)
}
const scratch = mkdtempSync(join(tmpdir(), 'door-reload-'))
const env = { ...process.env, npm_config_loglevel: 'error' }
delete env.ACRYL_DOOR
const run = (command, args, cwd) => {
  const r = spawnSync(command, args, { cwd, env, encoding: 'utf8' })
  if (r.status !== 0) fail(`${command} ${args.join(' ')} failed:\n${r.stdout}${r.stderr}`)
  return r.stdout
}

/** A plugin whose pages carry no door script: /p1 shows a version and the contents of page.txt (read on each request), /p2 is another page. */
const plugin = (version) => `import { readFileSync } from 'node:fs'
import { Acryl } from 'acryl-router'

export const name = 'pages'
export const inject = ['router']

export function apply(ctx: { router: { route(path: string, app: unknown): void } }) {
  const app = new Acryl()
  app.get('/p1', (c) => c.html('<!doctype html><html><head><title>One</title></head><body><main><h1>Version ${version}</h1><p>' + readFileSync('page.txt', 'utf8') + '</p><a href="/p2">Next page</a></main></body></html>'))
  app.get('/p2', (c) => c.html('<!doctype html><html><head><title>Two</title></head><body><main><h1>Second page</h1></main></body></html>'))
  ctx.router.route('/', app)
}
`

let server
let browser
try {
  const app = join(scratch, 'app')
  run(process.execPath, [cli, 'init', app, '--template', 'agent', '-y'], scratch)
  run('npm', ['install', '--no-audit', '--no-fund'], app)
  mkdirSync(join(app, 'plugins', 'pages'))
  writeFileSync(join(app, 'plugins', 'pages', 'index.ts'), plugin('one'))
  writeFileSync(join(app, 'page.txt'), 'first text')

  const port = await freePort()
  server = startGroup('npm', ['start'], {
    cwd: app,
    env: { ...env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  server.stdout.on('data', (c) => (output += c))
  server.stderr.on('data', (c) => (output += c))
  const base = await until(async () => /listening on (http:\/\/\S+)/u.exec(output)?.[1], 40_000)
  if (!base) fail(`the app did not start:\n${output}`)
  const acryl = (...args) => {
    const r = spawnSync(
      join(app, '.acryl', 'bin', process.platform === 'win32' ? 'acryl.cmd' : 'acryl'),
      args,
      { cwd: app, env, encoding: 'utf8', shell: process.platform === 'win32' },
    )
    return { code: r.status, out: r.stdout, err: r.stderr }
  }
  const added = acryl('plugin', 'add', 'plugins/pages')
  if (added.code !== 0) fail(`plugin add failed:\n${added.out}${added.err}`)

  const devPort = await freePort()
  let cdp
  for (let attempt = 0; attempt < 2 && cdp === undefined; attempt++) {
    browser = spawn(chrome, chromeFlags(join(scratch, 'chrome'), devPort), { stdio: 'ignore' })
    cdp = await until(() => devtools(devPort), 30_000)
    if (cdp === undefined) browser.kill('SIGKILL')
  }
  if (!cdp) fail('headless Chrome did not open')
  const evaluate = async (expression) =>
    (await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))
      .result?.result?.value
  await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: `${base}/p1` })

  // B: the page has no script tag, and the door can still look at it.
  const seen = await until(async () => {
    const r = acryl('look')
    return r.code === 0 && r.out.includes('Version one') ? r.out : undefined
  }, 20_000)
  if (!seen)
    fail(`look did not see the page (it carries no door script tag):\n${acryl('brief').out}`)
  if (!seen.includes('first text')) fail(`look lacks the page's text:\n${seen}`)
  log('B: look sees a page that carries no door script tag (the door added it)')

  // A, the plugin way: change the plugin, `plugin reload`; the open page is reloaded by the door and the verb answers when it is back.
  await evaluate('window.__before = true; true')
  writeFileSync(join(app, 'plugins', 'pages', 'index.ts'), plugin('two'))
  const reloaded = acryl('plugin', 'reload')
  if (reloaded.code !== 0) fail(`plugin reload failed:\n${reloaded.out}${reloaded.err}`)
  const afterPlugin = acryl('look')
  if (afterPlugin.code !== 0 || !afterPlugin.out.includes('Version two'))
    fail(`after plugin reload the page was not the new one:\n${afterPlugin.out}${afterPlugin.err}`)
  if ((await evaluate('window.__before')) !== undefined)
    fail('the page was not reloaded after the plugin change')
  log('A: plugin reload reloads the open page by itself, and look at once sees the new one')

  // A, the verb: a change the plugin system does not see (a file the page reads) needs `act reload`.
  writeFileSync(join(app, 'page.txt'), 'second text')
  const stale = acryl('look')
  if (!stale.out.includes('first text')) fail(`the page changed without a reload:\n${stale.out}`)
  const reload = acryl('act', 'reload')
  if (reload.code !== 0 || !reload.out.includes('the page is back'))
    fail(`act reload failed:\n${reload.out}${reload.err}`)
  const afterReload = acryl('look')
  if (!afterReload.out.includes('second text'))
    fail(`act reload did not bring the new text:\n${afterReload.out}`)
  log(
    'A: act reload brings a change the plugin system does not know about, and answers once the page is back',
  )

  // A, navigate: another page of the app by a link or by path, and a path that leaves the app is refused.
  const moved = acryl('act', 'navigate', '--path', '/p2')
  if (moved.code !== 0 || !moved.out.includes('the page is back'))
    fail(`act navigate failed:\n${moved.out}${moved.err}`)
  if (!acryl('look').out.includes('Second page')) fail('navigate did not reach /p2')
  const outside = acryl('act', 'navigate', '--path', '//evil.example')
  if (outside.code === 0 || !/invalid/u.test(outside.err))
    fail(`a path that leaves the app was not refused: ${outside.out}${outside.err}`)
  if (!acryl('look').out.includes('Second page')) fail('the refused navigate moved the page')
  log('A: act navigate --path goes to another page of the app, and refuses a path that leaves it')
  cdp.close()
  log('OK')
} finally {
  browser?.kill('SIGKILL')
  if (server) await stopGroup(server)
  await sleep(300)
  rmSync(scratch, { recursive: true, force: true })
}
