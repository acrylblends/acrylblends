#!/usr/bin/env node
// Manual gate (it opens a real window, so it needs a display and an Electron binary, and is not part of `pnpm run check`): generate a todo app with --desktop in a scratch HOME,
// run `npm run desktop`, check that the window shows the app's own route content, a second launch hands over to the first, closing the window ends the process and frees the
// port, nothing was written to the real user's application-data folder, and nothing is left running.
//
//   node scripts/verify-desktop.mjs [screenshot.png]
//
// Electron's binary comes from ELECTRON_CACHE (default: the platform's electron cache), so a cached download is reused.
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const cli = join(root, 'packages', 'cli', 'bin', 'acrylblends.js')
const args = process.argv.slice(2)
const npmAt = args.indexOf('--from-npm')
/** With `--from-npm <version>` the published package is used instead of this checkout: a blank app, then `acrylblends add desktop` on it, as a user would. */
const fromNpm = npmAt >= 0 ? args[npmAt + 1] : undefined
const positional = args.filter((a, i) => !a.startsWith('--') && i !== npmAt + 1)
const shot = resolve(positional[0] ?? join(tmpdir(), 'acrylblends-desktop-window.png'))
const log = (m) => console.log(`verify-desktop: ${m}`)
const fail = (m) => {
  throw new Error(`verify-desktop: ${m}`)
}
const scratch = mkdtempSync(join(tmpdir(), 'acrylblends-desktop-'))
const home = join(scratch, 'home')
mkdirSync(home)
const env = {
  ...process.env,
  HOME: home,
  ELECTRON_CACHE: process.env.ELECTRON_CACHE ?? join(homedir(), 'Library', 'Caches', 'electron'),
}
const appSupport =
  process.platform === 'darwin'
    ? join(homedir(), 'Library', 'Application Support')
    : join(homedir(), '.config')
const marker = join(scratch, 'marker')
writeFileSync(marker, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const port = 9455 + Math.floor(Math.random() * 40)
let child
try {
  if (fromNpm) {
    const npx = (...rest) => run('npx', ['--yes', `acrylblends@${fromNpm}`, ...rest], scratch)
    npx('init', 'app', '--name', 'verify-desktop-window', '--template', 'blank', '-y')
    npx('add', 'desktop', '--dir', 'app')
  } else
    run(
      process.execPath,
      [
        cli,
        'init',
        'app',
        '--name',
        'verify-desktop-window',
        '--template',
        'todo',
        '--desktop',
        '-y',
      ],
      scratch,
    )
  const app = join(scratch, 'app')
  run('npm', ['install', '--no-audit', '--no-fund'], app)
  // A plain install must not have downloaded the binary (Electron 44 has no install script): the first `electron` run does, and this gate launches without installing it by hand.
  if (existsSync(join(app, 'node_modules', 'electron', 'dist')))
    fail(
      'npm install downloaded the Electron binary; the lazy first-run download was not exercised',
    )
  const launchStarted = Date.now()
  child = spawn(
    join(app, 'node_modules', '.bin', 'electron'),
    [`--remote-debugging-port=${port}`, 'src/plugins/desktop/main.ts'],
    {
      cwd: app,
      env: { ...env, ACRYLBLENDS_PORT: '0' },
      stdio: 'ignore',
    },
  )
  let target
  for (let i = 0; i < 240 && target === undefined; i++) {
    await sleep(500)
    target = await fetch(`http://127.0.0.1:${port}/json/list`)
      .then((r) => r.json())
      .then((l) => l.find((t) => t.type === 'page' && t.url.startsWith('http://127.0.0.1:')))
      .catch(() => undefined)
  }
  if (!target) fail('no window opened on the app within 2 minutes')
  if (!existsSync(join(app, 'node_modules', 'electron', 'dist')))
    fail('the window opened but the binary is not in node_modules/electron/dist')
  log(
    `the first launch fetched the Electron binary and opened the window in ${Math.round((Date.now() - launchStarted) / 1000)} s`,
  )
  const url = new URL(target.url)
  const expectedPath = fromNpm ? '/' : '/todo'
  if (url.pathname !== expectedPath)
    fail(`the window opened on ${url.pathname}, not ${expectedPath}`)
  if (!fromNpm) {
    const created = await fetch(`${url.origin}/todo/api`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Desktop window works' }),
    })
    if (created.status !== 201) fail(`the app's own API answered ${created.status}`)
  }
  await sleep(500)
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r) => {
    ws.onopen = r
  })
  let id = 0
  const pending = new Map()
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id) pending.get(m.id)?.(m.result)
  }
  const call = (method, params = {}) =>
    new Promise((r) => {
      const i = ++id
      pending.set(i, r)
      ws.send(JSON.stringify({ id: i, method, params }))
    })
  const text = (
    await call('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true })
  ).result.value
  const wanted = fromNpm ? '"ok":true' : 'Desktop window works'
  if (!text.includes(wanted))
    fail(`the window does not show the app's content: ${JSON.stringify(text)}`)
  const png = await call('Page.captureScreenshot', { format: 'png' })
  writeFileSync(shot, Buffer.from(png.data, 'base64'))
  log(`the window shows the app's own page and the todo it just got (${shot})`)
  // A second launch of the same app hands over to the first one and ends.
  const second = spawnSync(
    join(app, 'node_modules', '.bin', 'electron'),
    ['src/plugins/desktop/main.ts'],
    { cwd: app, env: { ...env, ACRYLBLENDS_PORT: '0' }, timeout: 30_000 },
  )
  if (second.status !== 0) fail(`the second launch did not end cleanly (${second.status})`)
  const windows = (await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())).filter(
    (t) => t.type === 'page',
  )
  if (windows.length !== 1) fail(`${windows.length} windows after a second launch`)
  log('a second launch of the same app ended and left one window')
  // Closing the window ends the process, after the server stopped.
  const exited = new Promise((r) => child.once('exit', (code) => r(code)))
  await call('Runtime.evaluate', { expression: 'window.close()' })
  const code = await Promise.race([exited, sleep(15_000).then(() => 'timeout')])
  if (code === 'timeout') fail('closing the window did not end the process within 15 s')
  ws.close()
  if (
    await fetch(url.origin).then(
      () => true,
      () => false,
    )
  )
    fail('the app server still answers after the window closed')
  const left = spawnSync('pgrep', ['-f', join(app, 'node_modules', 'electron')], {
    encoding: 'utf8',
  }).stdout.trim()
  if (left) fail(`processes are left running: ${left}`)
  if (!existsSync(join(app, '.acrylblends', 'electron')))
    fail("Electron's user data is not inside the app's own home")
  // Only what this app's Electron could have created: other programs write to the application-data folder all the time, so any new entry there is not evidence.
  const touched = spawnSync('find', [appSupport, '-maxdepth', '1', '-newer', marker], {
    encoding: 'utf8',
  })
    .stdout.split('\n')
    .filter((entry) =>
      /electron|verify-desktop-window|acrylblends/i.test(entry.slice(appSupport.length)),
    )
    .join('\n')
    .trim()
  if (touched) fail(`something was written to ${appSupport}: ${touched}`)
  log(
    `closing the window ended the process (exit ${code}) and freed the port; nothing left running; user data is in the app's home; nothing written to ${appSupport}`,
  )
  log('OK')
} finally {
  if (child && child.exitCode === null) child.kill('SIGKILL')
  rmSync(scratch, { recursive: true, force: true })
}
