#!/usr/bin/env node
// The frame's stable launch token, end to end: boot an installed app twice, and check that the second boot prints the SAME address, that the address
// admits the page (303 and the auth cookie) and that the cookie admits the frame's WebSocket (/api/remote.mux). This is the restart that must keep an
// open page working; it needs an app whose dependencies are installed, so it takes the folder as its argument:
//
//   node scripts/verify-frame-token.mjs ~/acryl-workshop/my-app
//
// It boots the app twice (npm run dev, the address the launcher prints), and never uses a fixed port: the app's own stable port is the point.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const app = process.argv[2]
if (app === undefined) throw new Error('usage: node scripts/verify-frame-token.mjs <app-dir>')
const require = createRequire(join(app, 'package.json'))
const WebSocket = require('ws')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const env = { ...process.env, ACRYLBLENDS_HOME: join(app, '.acrylblends') }
delete env.ACRYLBLENDS_PORT

async function boot() {
  const child = spawn('npm', ['run', 'dev'], { cwd: app, env, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', (chunk) => (output += chunk))
  child.stderr.on('data', (chunk) => (output += chunk))
  for (let i = 0; i < 240; i += 1) {
    const match = /acrylblends host: (http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+)/u.exec(
      output,
    )
    if (match !== null) return { child, url: match[1], output: () => output }
    await sleep(250)
  }
  throw new Error(`the frame did not print its address:\n${output.slice(-800)}`)
}

function stop(child) {
  return new Promise((done) => {
    child.once('exit', () => done())
    child.kill('SIGTERM')
    setTimeout(() => child.kill('SIGKILL'), 4000).unref()
  })
}

async function pageAndSocket(url) {
  const response = await fetch(url, { redirect: 'manual' })
  const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0]
  const origin = new URL(url).origin
  const socket = await new Promise((done) => {
    const ws = new WebSocket(`${origin.replace('http', 'ws')}/api/remote.mux`, {
      headers: { cookie },
    })
    const timer = setTimeout(() => done({ open: false, reason: 'timeout' }), 6000)
    ws.once('open', () => {
      clearTimeout(timer)
      ws.close()
      done({ open: true })
    })
    ws.once('error', (error) => {
      clearTimeout(timer)
      done({ open: false, reason: error.message })
    })
  })
  return { status: response.status, cookie: cookie !== '', socket }
}

const first = await boot()
const firstCheck = await pageAndSocket(first.url)
console.log(
  'FIRST',
  JSON.stringify({ url: first.url.replace(/token=.*/u, 'token=<redacted>'), ...firstCheck }),
)
await stop(first.child)
await sleep(1200)
const second = await boot()
const secondCheck = await pageAndSocket(second.url)
console.log(
  'SECOND',
  JSON.stringify({ url: second.url.replace(/token=.*/u, 'token=<redacted>'), ...secondCheck }),
)
console.log('STABLE', first.url === second.url)
const ok =
  first.url === second.url &&
  firstCheck.status === 303 &&
  firstCheck.cookie === true &&
  firstCheck.socket.open === true &&
  secondCheck.status === 303 &&
  secondCheck.cookie === true &&
  secondCheck.socket.open === true
await stop(second.child)
console.log(ok ? 'verify-frame-token: OK' : 'verify-frame-token: FAILED')
process.exitCode = ok ? 0 : 1
