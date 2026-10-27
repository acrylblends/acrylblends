#!/usr/bin/env node
// What a user gets, from the tarballs alone: pack acrylblends and create-acrylblends, install ONLY those into an empty folder (the repository's sources are not on the path), run the
// installed `create-acrylblends` for each web template and `acrylblends init` for the agent template, install the new app and run ITS tests and type-check. The other gates run the
// repository's own command line; this one runs the installed one, so a file the package leaves out, or an import that is only right inside the repository, fails here.
//
//   node scripts/verify-packed.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const log = (message) => console.log(`verify-packed: ${message}`)
const run = (command, args, cwd, env = {}) =>
  execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
    timeout: 900_000,
  })
const scratch = mkdtempSync(join(tmpdir(), 'verify-packed-'))
try {
  const packed = join(scratch, 'packed')
  mkdirSync(packed)
  for (const dir of ['cli', 'create'])
    run('pnpm', ['pack', '--pack-destination', packed], join(root, 'packages', dir))
  const tarball = (prefix) =>
    join(
      packed,
      readdirSync(packed).find((f) => f.startsWith(prefix) && f.endsWith('.tgz')),
    )
  const tools = join(scratch, 'tools')
  mkdirSync(tools)
  writeFileSync(join(tools, 'package.json'), '{"name":"tools","private":true}\n')
  run(
    'npm',
    ['install', '--no-audit', '--no-fund', tarball('acrylblends-'), tarball('create-acrylblends-')],
    tools,
  )
  const bin = (name) => join(tools, 'node_modules', '.bin', name)
  log('installed acrylblends and create-acrylblends from their tarballs')

  for (const template of ['nodejs', 'notes', 'chat', 'acryl-app']) {
    const app = join(scratch, `app-${template}`)
    run(bin('create-acrylblends'), [app, '--template', template, '-y'], scratch)
    // The new app asks for the version of acrylblends it was made with, which may not be published yet: install the tarball (npm then records it).
    run('npm', ['install', '--no-audit', '--no-fund', tarball('acrylblends-')], app)
    run('npm', ['test'], app, { ACRYL_DOOR: 'off' })
    run('npm', ['run', 'check'], app)
    log(`${template}: made by the installed command, its tests and type-check pass`)
  }
  const blank = join(scratch, 'app-blank')
  run(bin('acrylblends'), ['init', blank, '--template', 'todo', '-y'], scratch)
  run('npm', ['install', '--no-audit', '--no-fund'], blank)
  run('npm', ['test'], blank, { ACRYL_DOOR: 'off' })
  log('todo: made by the installed command, its tests pass')
  // The agent panel and the PTY driver, added by the installed command: copied, installed (node-pty from the registry) and type-checked.
  const agentApp = join(scratch, 'app-agent')
  run(bin('acrylblends'), ['init', agentApp, '--template', 'agent', '-y'], scratch)
  run(bin('acrylblends'), ['add', 'agent-panel'], agentApp)
  run(bin('acrylblends'), ['add', 'driver-pty'], agentApp)
  run('npm', ['install', '--no-audit', '--no-fund', tarball('acrylblends-')], agentApp)
  run('npm', ['run', 'check'], agentApp)
  log(
    'agent: agent-panel and driver-pty added by the installed command, installed and type-checked',
  )
  log('OK')
} catch (error) {
  console.error(
    `verify-packed: FAILED: ${error.stdout ?? ''}${error.stderr ?? ''}${error.message}`.slice(
      0,
      4000,
    ),
  )
  process.exitCode = 1
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
