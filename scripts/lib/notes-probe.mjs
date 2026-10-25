// The Notes gate's probe: starts the finished app the way a user does (`npm start`, then the desktop window) and walks it over HTTP like a browser.
// Every step names itself, so a failure says what did not work. Returns { ok, steps } and never throws.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { join } from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const freePort = () =>
  new Promise((resolve, reject) => {
    const s = createServer()
    s.once('error', reject)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })

async function until(fn, ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const v = await fn().catch(() => undefined)
    if (v) return v
    await sleep(500)
  }
}

export async function probeNotes(app, env) {
  const steps = []
  const step = (name, ok, detail = '') => {
    steps.push(`${ok ? 'ok' : 'FAIL'} ${name}${detail && !ok ? ` (${detail})` : ''}`)
    return ok
  }
  const port = await freePort()
  const server = spawn('npm', ['start'], {
    cwd: app,
    env: { ...env, PORT: String(port) },
    stdio: 'ignore',
  })
  const base = `http://127.0.0.1:${port}`
  try {
    const up = await until(
      () => fetch(`${base}/`, { redirect: 'manual' }).then((r) => r.status),
      30_000,
    )
    if (!step('npm start serves the port', up !== undefined)) return { ok: false, steps }
    let cookie = ''
    const call = async (path, init = {}) => {
      const r = await fetch(`${base}${path}`, {
        redirect: 'manual',
        ...init,
        headers: { ...(cookie ? { cookie } : {}), ...init.headers },
      })
      const set = r.headers.get('set-cookie')
      if (set) cookie = set.split(';')[0]
      return r
    }
    const form = (data) => ({ method: 'POST', body: new URLSearchParams(data) })
    const email = `gate${Date.now()}@example.com`
    step(
      '/ or /notes sends a visitor to log in',
      (await call('/notes')).status >= 300 || (await call('/notes')).status === 401,
    )
    const bad = await call('/signup', form({ email: 'not-an-email', password: 'x' }))
    step(
      'sign up refuses bad input with a message',
      bad.status === 400 && /\S/.test(await bad.text()),
    )
    const su = await call('/signup', form({ email, password: 'correct horse battery' }))
    step('sign up works and sets a cookie', su.status < 400 && cookie !== '', `status ${su.status}`)
    const notes = await call('/notes')
    step('the notes page shows after sign up', notes.status === 200, `status ${notes.status}`)
    const empty = await call('/notes', form({ title: '', body: 'x' }))
    step(
      'create refuses an empty title with a message',
      empty.status === 400 && /title/i.test(await empty.text()),
      `status ${empty.status}`,
    )
    const made = await call('/notes', form({ title: 'Gate note', body: 'findme body' }))
    step('create works', made.status >= 300 && made.status < 400, `status ${made.status}`)
    const list = await (await call('/notes')).text()
    step('the note is listed', list.includes('Gate note'))
    const found = await (await call('/notes?q=findme')).text()
    const missing = await (await call('/notes?q=zzznotthere')).text()
    step(
      'search finds it and only it',
      found.includes('Gate note') && !missing.includes('Gate note'),
    )
    const api = await call('/api/notes')
    const body = await api.json().catch(() => undefined)
    step(
      'the JSON API lists notes',
      api.status === 200 && JSON.stringify(body).includes('Gate note'),
      `status ${api.status}`,
    )
    const anon = await fetch(`${base}/api/notes`)
    step(
      'the JSON API refuses a visitor',
      anon.status === 401 || anon.status === 403,
      `status ${anon.status}`,
    )
    const id = (list.match(/\/notes\/(\d+)/) ?? [])[1]
    const edited = id
      ? await call(`/notes/${id}`, form({ title: 'Gate renamed', body: 'v2' }))
      : undefined
    step(
      'edit works',
      edited !== undefined && edited.status >= 200 && edited.status < 400,
      `status ${edited?.status}`,
    )
    step('the edit shows', (await (await call('/notes')).text()).includes('Gate renamed'))
    const del = id ? await call(`/notes/${id}/delete`, { method: 'POST' }) : undefined
    step(
      'delete works',
      del !== undefined && del.status >= 200 && del.status < 400,
      `status ${del?.status}`,
    )
    step('the note is gone', !(await (await call('/notes')).text()).includes('Gate renamed'))
    const out = await call('/logout', { method: 'POST' })
    cookie = ''
    step('log out works', out.status < 400)
    const login = await call('/login', form({ email, password: 'correct horse battery' }))
    step('log in works', login.status < 400 && cookie !== '', `status ${login.status}`)
    const wrong = await call('/login', form({ email, password: 'wrong wrong wrong' }))
    step(
      'log in refuses a wrong password with a message',
      wrong.status >= 400 && wrong.status < 500,
    )
    const counter = await (await call('/notes/new')).text().catch(() => '')
    step(
      'the form page carries client JS for a counter or filter',
      /<script/.test(counter) || /<script/.test(list),
    )
  } finally {
    server.kill('SIGTERM')
    spawn('pkill', ['-f', `${app}`], { stdio: 'ignore' })
    await sleep(500)
  }
  // The desktop window: the script exists, the window opens on the app, and closing it ends the process.
  const pkg = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'))
  if (!step('npm run desktop exists', typeof pkg.scripts?.desktop === 'string'))
    return { ok: steps.every((s) => s.startsWith('ok')), steps }
  const debug = await freePort()
  const entry = Object.values(pkg.scripts).find((s) => /electron/.test(s))
  const args = (entry ?? '').split(/\s+/).slice(1)
  const electron = spawn(
    join(app, 'node_modules', '.bin', 'electron'),
    [`--remote-debugging-port=${debug}`, ...args],
    {
      cwd: app,
      env: {
        ...env,
        ACRYLBLENDS_PORT: '0',
        ELECTRON_CACHE: join(homedir(), 'Library', 'Caches', 'electron'),
      },
      stdio: 'ignore',
    },
  )
  let launchError
  electron.on('error', (error) => {
    launchError = error.code ?? error.message
  })
  const target = await until(
    () =>
      fetch(`http://127.0.0.1:${debug}/json/list`)
        .then((r) => r.json())
        .then((l) =>
          l.find(
            (t) => t.type === 'page' && t.url.startsWith('http://127.0.0.1:') && t.title !== '',
          ),
        ),
    launchError ? 1 : 120_000,
  )
  step(
    'the desktop window opens on the app',
    target !== undefined && /login|sign|notes/i.test(`${target.title} ${target.url}`),
    target ? `${target.title} ${target.url}` : `no window${launchError ? `: ${launchError}` : ''}`,
  )
  electron.kill('SIGTERM')
  return { ok: steps.every((s) => s.startsWith('ok')), steps }
}
