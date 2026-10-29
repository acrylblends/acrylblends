#!/usr/bin/env node
// The gate of the desktop door: an agent that lives in the app opens a window, drives it, resizes it, presses a menu item, and cannot end its own session by accident. A real Electron.
//   node scripts/verify-desktop-door.mjs [--npm <version>]
// Not part of `pnpm run check` (it downloads Electron and opens windows); run it before a release that touches plugins/desktop or the door's window verbs.
// A fresh agent app made with --desktop, started with `npm run dev`, then `npm run desktop` attaches to it. Through `.acryl/bin/acryl`:
//   window list sees the window; window open --path /two makes a second one and look --window drives that page (not the first); act click --window changes it;
//   window resize and menu click work; the last window and Quit are refused without force; after the dev server restarts (a change of src/) the shell reconnects
//   and the same windows are still driven; closing the last window with force ends the desktop app and leaves the dev server running.
// Then the same without a dev server: `npm run desktop` starts the app itself, and closing the last window with force stops that server too.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { freePort } from './lib/port.mjs'
import { startGroup, stopGroup } from './lib/proc.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = join(root, 'packages/cli/bin/acrylblends.js')
const log = (message) => console.log(`verify-desktop-door: ${message}`)
const fail = (message) => {
  throw new Error(`verify-desktop-door: ${message}`)
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
const npmArg =
  process.argv.indexOf('--npm') === -1 ? undefined : process.argv[process.argv.indexOf('--npm') + 1]

if (
  process.platform === 'linux' &&
  !process.env.DISPLAY &&
  spawnSync('which', ['xvfb-run']).status !== 0
) {
  log('skipped: no display (set DISPLAY or install xvfb)')
  process.exit(0)
}
const scratch = mkdtempSync(join(tmpdir(), 'desktop-door-'))
const env = { ...process.env, npm_config_loglevel: 'error' }
delete env.ACRYL_DOOR
// npm is a .cmd file on Windows: it needs the shell.
const isWindows = process.platform === 'win32'
const run = (command, args, cwd) => {
  const r = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    shell: isWindows && command === 'npm',
  })
  if (r.status !== 0) fail(`${command} ${args.join(' ')} failed:\n${r.stdout}${r.stderr}`)
  return r.stdout
}

/** Two pages with nothing else between them: /one and /two (a button that changes its heading). */
const pages = `import { Acryl } from 'acryl-router'
export const name = 'pages'
export const inject = ['router']
export function apply(ctx: { router: { route(path: string, app: unknown): void } }) {
  const app = new Acryl()
  app.get('/one', (c) => c.html('<!doctype html><html><head><title>One</title></head><body><main><h1>Page one</h1></main></body></html>'))
  app.get('/two', (c) => c.html('<!doctype html><html><head><title>Two</title></head><body><main><h1>Page two</h1><button type="button" id="b">Press me</button></main><script>document.getElementById("b").onclick=()=>{document.querySelector("h1").textContent="Pressed"}</script></body></html>'))
  ctx.router.route('/', app)
}
`

const processes = []
try {
  const app = join(scratch, 'app')
  if (npmArg === undefined)
    run(process.execPath, [cli, 'init', app, '--template', 'agent', '--desktop', '-y'], scratch)
  else
    run(
      'npx',
      ['--yes', `acrylblends@${npmArg}`, 'init', app, '--template', 'agent', '--desktop', '-y'],
      scratch,
    )
  run('npm', ['install', '--no-audit', '--no-fund'], app)
  if (!existsSync(join(app, 'node_modules', 'electron', 'dist'))) {
    const installed = spawnSync(
      process.execPath,
      [join(app, 'node_modules', 'electron', 'install.js')],
      { cwd: app, encoding: 'utf8' },
    )
    if (installed.status !== 0) {
      log(`skipped: Electron could not be downloaded:\n${installed.stderr.slice(-300)}`)
      process.exit(0)
    }
  }
  mkdirSync(join(app, 'plugins', 'pages'))
  writeFileSync(join(app, 'plugins', 'pages', 'index.ts'), pages)

  const acryl = (...args) => {
    const r = spawnSync(
      join(app, '.acryl', 'bin', process.platform === 'win32' ? 'acryl.cmd' : 'acryl'),
      // Through cmd.exe on Windows a bare `>` (a menu path) is a redirect, and a space splits an argument: quote what needs it.
      isWindows
        ? args.map((arg) => (/[\s<>&|^"]/u.test(String(arg)) ? `"${String(arg)}"` : String(arg)))
        : args,
      {
        cwd: app,
        env,
        encoding: 'utf8',
        shell: process.platform === 'win32',
      },
    )
    return { code: r.status, out: r.stdout, err: r.stderr }
  }
  const start = (script, extra = {}) => {
    const command = process.platform === 'linux' && !process.env.DISPLAY ? 'xvfb-run' : 'npm'
    const args = command === 'xvfb-run' ? ['-a', 'npm', 'run', script] : ['run', script]
    const child = startGroup(command, args, {
      cwd: app,
      env: { ...env, ...extra },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWindows,
    })
    const proc = { child, output: '' }
    child.stdout.on('data', (c) => (proc.output += c))
    child.stderr.on('data', (c) => (proc.output += c))
    processes.push(proc)
    return proc
  }
  const windowList = () => {
    const listed = acryl('window', 'list')
    if (listed.code !== 0) return undefined
    return listed.out
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [id, , , size] = /^(\d+)\s+"([^"]*)"\s+(\S*)\s+(\d+x\d+)/u.exec(line)?.slice(1) ?? []
        return { id: Number(id), size, line }
      })
  }
  const look = (windowId) => acryl('look', '--window', String(windowId))

  // 1. The attached case: a dev server, then the desktop app on it.
  const dev = start('dev', { PORT: String(await freePort()) })
  const base = await until(async () => /listening on (http:\/\/\S+)/u.exec(dev.output)?.[1], 40_000)
  if (!base) fail(`the dev server did not start:\n${dev.output}`)
  const desktop = start('desktop')
  const first = await until(async () => {
    const list = windowList()
    return list?.length === 1 && Number.isInteger(list[0].id) && list[0]
  }, 60_000)
  if (!first)
    fail(
      `the desktop shell did not connect to the door (window list):\n${acryl('window', 'list').err}\n${desktop.output}\n${dev.output}`,
    )
  // The line comes from Electron's own stdout, which a Windows pipe delivers a moment after the window works.
  if (
    !(await until(
      async () => desktop.output.includes('attached to the app already running'),
      20_000,
    ))
  )
    fail(`the desktop app did not attach:\n${desktop.output}`)
  log(`attached: window list sees window ${first.id}`)

  const opened = acryl('window', 'open', '--path', '/two')
  const second = /window (\d+)/u.exec(opened.out)?.[1]
  if (opened.code !== 0 || second === undefined)
    fail(`window open failed:\n${opened.out}${opened.err}`)
  const bothPages = await until(async () => {
    const a = look(first.id)
    const b = look(second)
    return a.code === 0 && b.code === 0 && { a: a.out, b: b.out }
  }, 30_000)
  if (!bothPages)
    fail(`look --window did not reach both windows:\n${look(first.id).err}${look(second).err}`)
  if (!bothPages.b.includes('Page two'))
    fail(`look --window ${second} did not read the second window's page:\n${bothPages.b}`)
  if (bothPages.a.includes('Page two'))
    fail(`look --window ${first.id} read the second window's page:\n${bothPages.a}`)
  const button = /button "Press me" \[ref=([\d.]+)\]/u.exec(bothPages.b)?.[1]
  if (button === undefined) fail(`no button on the second window:\n${bothPages.b}`)
  const pressed = acryl('act', 'click', '--window', second, '--ref', button)
  if (pressed.code !== 0) fail(`act click --window failed:\n${pressed.out}${pressed.err}`)
  if (!look(second).out.includes('Pressed')) fail('the click did not change the second window')
  if (look(first.id).out.includes('Pressed')) fail('the click reached the first window')
  log(
    'a window the agent opened is driven with --window (look and click), the first is not touched',
  )

  const resized = acryl('window', 'resize', '--id', second, '--width', '900', '--height', '640')
  if (resized.code !== 0 || windowList()?.find((w) => String(w.id) === second)?.size !== '900x640')
    fail(`window resize did not take:\n${resized.out}${resized.err}`)
  const menu = acryl('menu', 'list')
  if (menu.code !== 0 || !/\n?View>Actual Size/u.test(menu.out))
    fail(`menu list has no View>Actual Size:\n${menu.out}${menu.err}`)
  const pressedMenu = acryl('menu', 'click', '--path', 'View>Actual Size')
  if (pressedMenu.code !== 0) fail(`menu click failed:\n${pressedMenu.out}${pressedMenu.err}`)
  log('window resize and menu click work')

  // The session cannot be ended by accident.
  const quitPath = menu.out
    .split('\n')
    .find((line) => line.includes('(ends the app; needs force)') && /Quit/u.test(line))
    ?.split('  ')[0]
  if (quitPath === undefined) fail(`menu list does not mark Quit as ending the app:\n${menu.out}`)
  const quit = acryl('menu', 'click', '--path', quitPath)
  if (quit.code === 0 || !/force/u.test(quit.err))
    fail(`menu click ${quitPath} was not refused:\n${quit.out}${quit.err}`)
  const closed = acryl('window', 'close', '--id', second)
  if (closed.code !== 0 || windowList()?.length !== 1)
    fail(`window close did not close the second window:\n${closed.out}${closed.err}`)
  const last = acryl('window', 'close', '--id', first.id)
  if (last.code === 0 || !/last window/u.test(last.err))
    fail(`closing the last window was not refused:\n${last.out}${last.err}`)
  if (windowList()?.length !== 1) fail('the refused close closed the window anyway')
  log('Quit and the last window are refused without force')

  // 2. The dev server restarts (a change of src/): the shell follows it and the same window is driven again.
  const main = join(app, 'src', 'main.ts')
  const listening = (dev.output.match(/listening on http/gu) ?? []).length
  writeFileSync(main, `${readFileSync(main, 'utf8')}\n// touched by the gate\n`)
  if (
    !(await until(
      async () => (dev.output.match(/listening on http/gu) ?? []).length > listening,
      30_000,
    ))
  )
    fail(`the dev server did not restart:\n${dev.output}`)
  const again = await until(async () => {
    const list = windowList()
    if (list?.length !== 1) return undefined
    const seen = look(list[0].id)
    return seen.code === 0 && seen.out
  }, 60_000)
  if (!again)
    fail(
      `after the dev server restarted the shell did not reconnect:\n${acryl('window', 'list').err}\n${desktop.output}\n${dev.output}`,
    )
  log('after a dev restart the shell reconnected and the window is driven again')

  // 3. Closing the last window with force ends the desktop app; the dev server it attached to stays.
  const forced = acryl('window', 'close', '--id', first.id, '--force')
  if (forced.code !== 0) fail(`window close --force failed:\n${forced.out}${forced.err}`)
  if (
    !(await until(
      async () => desktop.child.exitCode !== null || desktop.child.signalCode !== null,
      20_000,
    ))
  )
    fail('the desktop app did not end after the last window was closed with force')
  if (
    !(await fetch(base).then(
      (r) => r.ok,
      () => false,
    ))
  )
    fail('the dev server stopped with the desktop window it was attached to')
  log(
    'window close --force on the last window ends the desktop app and leaves the dev server running',
  )
  await stopGroup(dev.child)
  await until(async () => !existsSync(join(app, '.acryl', 'door.json')), 15_000)

  // 4. Without a dev server the desktop app starts the app itself, and the same verbs work; ending it stops that server.
  const alone = start('desktop')
  const only = await until(async () => {
    const list = windowList()
    return list?.length === 1 && Number.isInteger(list[0].id) && list[0]
  }, 60_000)
  if (!only)
    fail(`the desktop app that started its own server did not answer window list:\n${alone.output}`)
  const own = acryl('window', 'open', '--path', '/one')
  const ownId = /window (\d+)/u.exec(own.out)?.[1]
  if (own.code !== 0 || ownId === undefined)
    fail(`window open failed on the app's own server:\n${own.out}${own.err}`)
  if (!(await until(async () => look(ownId).out.includes('Page one'), 30_000)))
    fail(`look --window ${ownId} did not read the new window on the app's own server`)
  if (acryl('window', 'close', '--id', only.id).code !== 0)
    fail('closing one of two windows failed')
  const ended = acryl('window', 'close', '--id', ownId, '--force')
  if (ended.code !== 0) fail(`window close --force failed:\n${ended.out}${ended.err}`)
  if (
    !(await until(
      async () => alone.child.exitCode !== null || alone.child.signalCode !== null,
      20_000,
    ))
  )
    fail('the desktop app did not end after its last window was closed with force')
  if (existsSync(join(app, '.acryl', 'door.json')))
    fail('the server the desktop app started is still up (door.json remains)')
  log('the app that started its own server answers the same verbs, and ending it stops that server')
  log('OK')
} finally {
  for (const { child } of processes.reverse()) {
    // Windows has no process groups: the whole tree (npm, node, Electron) goes by its root.
    if (isWindows && child.pid !== undefined)
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    await stopGroup(child)
  }
  await sleep(500)
  rmSync(scratch, { recursive: true, force: true })
}
