#!/usr/bin/env node
// Manual gate (it uses a model, so it is not part of `pnpm run check`): a headless coding agent works in a freshly generated app with a one-line task and
// only the docs inside the folder, and the task must end with the app's tests and type-check passing.
//
//   node scripts/verify-coding-agent.mjs <acrylblends tarball or version> [template] ["task"]
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const [spec, template = 'blank', task = 'add a /customers/count route with a test'] =
  process.argv.slice(2)
if (!spec) {
  console.error('usage: node scripts/verify-coding-agent.mjs <tarball|version> [template] [task]')
  process.exit(2)
}
const dir = resolve(process.env.GATE_DIR ?? '/tmp/acrylblends-coding-agent-gate')
rmSync(dir, { recursive: true, force: true })
mkdirSync(dir, { recursive: true })
const run = (cmd, args, cwd, options = {}) =>
  spawnSync(cmd, args, { cwd, encoding: 'utf8', ...options })
run('npm', ['init', '-y'], dir)
run(
  'npm',
  [
    'install',
    spec.endsWith('.tgz') ? resolve(spec) : `acrylblends@${spec}`,
    '--no-audit',
    '--no-fund',
  ],
  dir,
)
execFileSync(
  join(dir, 'node_modules/.bin/acrylblends'),
  ['init', 'app', '--template', template, '-y'],
  { cwd: dir },
)
const app = join(dir, 'app')
run('npm', ['install', '--no-audit', '--no-fund'], app)
const before = run('npm', ['test'], app)
if (before.status !== 0) throw new Error(`the fresh app's own tests fail:\n${before.stdout}`)
const agent = run(
  'claude',
  [
    '-p',
    task,
    '--max-turns',
    '40',
    '--permission-mode',
    'acceptEdits',
    '--allowedTools',
    'Read,Edit,Write,Glob,Grep,Bash(npm *),Bash(node *),Bash(ls *),Bash(cat *)',
    '--disallowedTools',
    'WebFetch,WebSearch',
  ],
  app,
  { timeout: 600_000 },
)
console.log(agent.stdout.trim().split('\n').slice(0, 12).join('\n'))
const test = run('npm', ['test'], app)
const check = run('npm', ['run', 'check'], app)
console.log(
  `tests ${test.status === 0 ? 'pass' : 'FAIL'}, type-check ${check.status === 0 ? 'pass' : 'FAIL'}`,
)
process.exit(agent.status === 0 && test.status === 0 && check.status === 0 ? 0 : 1)
