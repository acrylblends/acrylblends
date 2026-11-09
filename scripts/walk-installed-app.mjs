#!/usr/bin/env node
/**
 * The walk of an installed ACRYL Blends app: does the product keep the two promises of "one OS app per Blend" (specs/049-framework-architecture/app-storage.md
 * in ACRYL)? It launches the app the way a person does, on a scratch data folder, and checks:
 *
 *   1. encapsulation  - the app's bundle is never written (a hash of every file is the same at the end as at the start), and everything the person makes
 *                       lives in the app's own folder in the OS data folder.
 *   2. self-extension - a plugin written into the app's own `plugins/` folder (what the agent does) is served by the running app, with no restart asked for,
 *                       and an edit of it is served again.
 *   3. self-repair    - the host process killed from outside is started again by the app, on the same address, and the plugin is still served.
 *   4. persistence    - quit the app and start it again: the same app, the plugin and its edit are there.
 *   5. update         - the whole bundle replaced by another (`--update-from`): the new Program is served and the app, its plugin and its history are untouched.
 *
 *   node scripts/walk-installed-app.mjs --exe <app executable> --bundle <the folder the update replaces> --scratch <empty folder> [--update-from <bundle folder>]
 *
 * It never touches the real data folder: the child's home is `<scratch>/home` (macOS, Linux) or `<scratch>/local` (Windows). It needs a display where the OS
 * has one (a Linux server without one runs it under `xvfb-run`). Every line is `PASS`, `FAIL` or `INFO`; the exit code is the number of failures.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, relative, resolve } from 'node:path'

const args = process.argv.slice(2)
const option = (name) => {
  const at = args.indexOf(name)
  return at === -1 ? undefined : args[at + 1]
}
const exe = resolve(option('--exe') ?? '')
const bundle = resolve(option('--bundle') ?? '')
const scratch = resolve(option('--scratch') ?? '')
const updateFrom =
  option('--update-from') === undefined ? undefined : resolve(option('--update-from'))
if (!existsSync(exe) || !existsSync(bundle) || option('--scratch') === undefined)
  throw new Error(
    'usage: walk-installed-app.mjs --exe <app executable> --bundle <bundle folder> --scratch <folder> [--update-from <bundle folder>]',
  )
if (existsSync(scratch) && readdirSync(scratch).length > 0)
  throw new Error(
    `--scratch ${scratch} must be empty: the walk writes the app's whole data folder there`,
  )

const win = process.platform === 'win32'
const home = join(scratch, win ? 'local' : 'home')
mkdirSync(home, { recursive: true })
const dataRoot = join(
  home,
  ...(process.platform === 'darwin'
    ? ['Library', 'Application Support', 'ACRYL Blends']
    : win
      ? ['ACRYL Blends']
      : ['.local', 'share', 'ACRYL Blends']),
)
const childEnv = {
  ...process.env,
  HOME: home,
  USERPROFILE: home,
  LOCALAPPDATA: home,
  APPDATA: home,
  XDG_DATA_HOME: join(home, '.local', 'share'),
  XDG_CONFIG_HOME: join(home, '.config'),
  XDG_CACHE_HOME: join(home, '.cache'),
}

let failures = 0
const say = (kind, line) => console.log(`${kind.padEnd(4)} ${line}`)
const check = (ok, line) => {
  if (!ok) failures += 1
  say(ok ? 'PASS' : 'FAIL', line)
  return ok
}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/** One hash for every file of a folder (names and bytes), so any write inside a bundle shows. */
function treeHash(root) {
  const hash = createHash('sha1')
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.isFile()) hash.update(`${relative(root, path)}\n`).update(readFileSync(path))
    }
  }
  walk(root)
  return hash.digest('hex')
}

let child
function launch() {
  child = spawn(exe, process.platform === 'linux' ? ['--no-sandbox'] : [], {
    env: childEnv,
    stdio: 'ignore',
    detached: !win,
  })
  child.unref()
}
const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
function killTree(pid, force) {
  if (win) spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
  else
    try {
      process.kill(-pid, force ? 'SIGKILL' : 'SIGTERM')
    } catch {
      // Already gone.
    }
}

const appsDir = join(dataRoot, 'apps')
const frameRecord = () => {
  try {
    const [id] = readdirSync(appsDir)
    if (id === undefined) return undefined
    const file = join(appsDir, id, 'data', 'frame-url.json')
    return { id, ...JSON.parse(readFileSync(file, 'utf8')) }
  } catch {
    return undefined
  }
}
/** The frame's address once something answers on it, or undefined. `not` is an address that must not be taken (the one the host just lost). */
async function served(waitMs, not) {
  const until = Date.now() + waitMs
  while (Date.now() < until) {
    const record = frameRecord()
    if (record !== undefined && record.url !== not) {
      const base = record.url.split('?')[0]
      const token = new URL(record.url).searchParams.get('token')
      try {
        const answer = await fetch(`${base}app/health?token=${token}`)
        if (answer.ok) return { ...record, base, token }
      } catch {
        // Not listening yet.
      }
    }
    await sleep(300)
  }
  return undefined
}
/** Poll a path of the app until `ok(text)` says so, or the time is out. @returns the seconds it took, or undefined. */
async function until(frame, path, ok, waitMs) {
  const started = Date.now()
  while (Date.now() - started < waitMs) {
    try {
      const answer = await fetch(`${frame.base}${path}?token=${frame.token}`, {
        headers: { accept: 'text/html' },
      })
      if (ok(await answer.text())) return (Date.now() - started) / 1000
    } catch {
      // The host is restarting.
    }
    await sleep(300)
  }
  return undefined
}

const plugin = (note) => `import type { Context } from '@deepseek-ai/cordis'
import { Acryl } from '../acryl-router/src/index.ts'

const items: string[] = ['${note}']

export const name = 'notes'
export const inject = ['router', 'home']

export function apply(ctx: Context): void {
  ctx.router.route('/notes', new Acryl().get('/items', (c) => c.json({ items })))
  ctx.effect(() =>
    ctx.home.widget({
      id: 'notes',
      title: 'Notes',
      render: () => \`<ul id="notes">\${items.map((n) => \`<li>\${n}</li>\`).join('')}</ul>\`,
    }),
  )
}
`

say('INFO', `platform ${process.platform}-${process.arch}, exe ${exe}`)
const bundleBefore = treeHash(bundle)
say('INFO', `bundle hash ${bundleBefore.slice(0, 12)}`)

// --- first start
launch()
let frame = await served(90_000)
if (!check(frame !== undefined, 'the app starts and its host serves the frame')) {
  console.log(`failures: ${String(failures)}`)
  process.exit(failures)
}
const source = join(appsDir, frame.id, 'source')
check(
  existsSync(join(source, '.git')) && existsSync(join(source, 'blend.yaml')),
  `the first app "${frame.id}" is made in the OS data folder with its own repository`,
)
check(
  (await until(frame, 'app/', (text) => text.includes('<h1>'), 5_000)) !== undefined,
  'the first page is served',
)

// --- self-extension: what the agent does, with no restart asked for
mkdirSync(join(source, 'plugins', 'notes'), { recursive: true })
writeFileSync(join(source, 'plugins', 'notes', 'index.ts'), plugin('first note'))
let took = await until(frame, 'app/notes/items', (text) => text.includes('first note'), 25_000)
check(
  took !== undefined,
  `a plugin folder written into the running app is served${took === undefined ? ' (not within 25 s)' : ` after ${took.toFixed(1)} s`}`,
)
took = await until(frame, 'app/', (text) => text.includes('<ul id="notes">'), 5_000)
check(took !== undefined, "the plugin's widget is on the home page")
writeFileSync(join(source, 'plugins', 'notes', 'index.ts'), plugin('edited live'))
took = await until(frame, 'app/notes/items', (text) => text.includes('edited live'), 25_000)
check(
  took !== undefined,
  `an edit of the plugin is served${took === undefined ? ' (not within 25 s)' : ` after ${took.toFixed(1)} s`}`,
)

// --- self-repair: the host is killed from outside
const hostPid = frame.pid
killTree(hostPid, true)
await sleep(500)
const repaired = await served(40_000)
const again = repaired !== undefined && alive(repaired.pid) ? repaired : undefined
check(
  again !== undefined &&
    (await until(again, 'app/notes/items', (t) => t.includes('edited live'), 20_000)) !== undefined,
  'a host killed from outside is started again by the app and serves the plugin',
)
frame = again ?? frame

// --- persistence: quit, start again
killTree(child.pid, false)
const gone = await (async () => {
  for (let i = 0; i < 40; i += 1) {
    if (!alive(frame.pid) && !alive(child.pid)) return true
    await sleep(500)
  }
  return false
})()
check(gone, 'quitting the app ends the app and its host (nothing is left running)')
launch()
frame = await served(90_000)
check(
  frame !== undefined &&
    (await until(frame, 'app/notes/items', (t) => t.includes('edited live'), 20_000)) !== undefined,
  'started again: the same app, the plugin and its edit are there',
)
check(readdirSync(appsDir).length === 1, 'no second app was made')

// --- encapsulation: all of that was done with the bundle only read
check(
  treeHash(bundle) === bundleBefore,
  'the bundle is byte for byte what it was before the first start, after a live edit, a kill, a quit and a restart',
)

// --- update: the whole bundle is replaced while the app is not running
if (updateFrom !== undefined && frame !== undefined) {
  const hashBefore = bundleBefore
  killTree(child.pid, false)
  for (let i = 0; i < 40 && (alive(frame.pid) || alive(child.pid)); i += 1) await sleep(500)
  rmSync(bundle, { recursive: true, force: true })
  cpSync(updateFrom, bundle, { recursive: true, verbatimSymlinks: true })
  say(
    'INFO',
    `bundle replaced by ${updateFrom} (${treeHash(bundle) === hashBefore ? 'same bytes' : 'different bytes'})`,
  )
  launch()
  frame = await served(90_000)
  check(
    frame !== undefined &&
      (await until(frame, 'app/notes/items', (t) => t.includes('edited live'), 20_000)) !==
        undefined,
    'after the update the app starts on the new bundle and its plugin is served',
  )
  check(readdirSync(appsDir).length === 1, 'the update made no second app')
  const log = spawnSync('git', ['status', '--short'], { cwd: source, encoding: 'utf8' })
  say(
    'INFO',
    `person's repository after the update: ${log.stdout.trim().replaceAll('\n', ' | ') || 'clean'}`,
  )
}

// --- the app's folder
killTree(child.pid, false)
await sleep(2_000)
check(
  statSync(join(dataRoot, 'apps', readdirSync(appsDir)[0], 'source')).isDirectory() &&
    readdirSync(join(dataRoot, 'apps', readdirSync(appsDir)[0]))
      .sort()
      .join() === 'cache,data,source',
  "the app's folder holds source, data and cache, and nothing else",
)
console.log(`failures: ${String(failures)}`)
process.exit(failures)
