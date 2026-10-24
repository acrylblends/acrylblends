#!/usr/bin/env node
// Manual gate (it uses models, so it is not part of `pnpm run check`): a headless coding agent works in a freshly generated app with a one-line task and
// only the docs inside the folder, and the task must end with the app's tests and type-check passing.
//
//   node scripts/verify-coding-agent.mjs <acrylblends tarball or version> [--agent claude|codex|pi|all] [--template blank] [--task "..."]
//
// Each agent gets its own fresh app, a scratch HOME and a PATH that holds only node, npm and npx (as links) plus the folder of that agent's own program,
// so no global `acryl` or `acrylblends` can reach the owner's real apps. `pi` is driven with DeepSeek: the key is read from
// ~/.secure-storage/llmproviders/deepseek/deepseek.json into that one process's environment and is never printed. Exit code 0 when every agent passed.
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    agent: { type: 'string', default: 'claude' },
    template: { type: 'string', default: 'blank' },
    task: { type: 'string', default: 'add a /customers/count route with a test' },
  },
})
const [spec] = positionals
const AGENTS = ['claude', 'codex', 'pi']
if (!spec || (values.agent !== 'all' && !AGENTS.includes(values.agent))) {
  console.error(
    'usage: node scripts/verify-coding-agent.mjs <tarball|version> [--agent claude|codex|pi|all] [--template t] [--task "..."]',
  )
  process.exit(2)
}
const base = resolve(process.env.GATE_DIR ?? '/tmp/acrylblends-coding-agent-gate')
const which = (program) => {
  const found = spawnSync('zsh', ['-lc', `whence -p ${program}`], {
    encoding: 'utf8',
  }).stdout.trim()
  if (found === '') throw new Error(`${program} is not installed`)
  return found
}
const run = (cmd, args, cwd, options = {}) =>
  spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...options })

/** The real program of an agent where a wrapper script of the caller's own tooling shadows it on PATH. */
const PROGRAM_PATHS = {
  codex: ['/opt/homebrew/bin/codex', '/usr/local/bin/codex'],
  claude: [
    join(homedir(), '.local/bin/claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
  ],
}

/** What each agent runs, and how its output says how much work it did. */
const DRIVERS = {
  claude: {
    args: (task) => [
      '-p',
      task,
      '--output-format',
      'stream-json',
      '--verbose',
      '--max-turns',
      '40',
      '--setting-sources',
      'project',
      '--permission-mode',
      'acceptEdits',
      '--allowedTools',
      'Read,Edit,Write,Glob,Grep,Bash(npm *),Bash(node *),Bash(ls *),Bash(cat *)',
      '--disallowedTools',
      'WebFetch,WebSearch',
    ],
    steps: (out) => {
      const result = out
        .split('\n')
        .filter((line) => line.includes('"type":"result"'))
        .at(-1)
      return result ? `${JSON.parse(result).num_turns} turns` : 'no result'
    },
  },
  codex: {
    args: (task, app) => [
      'exec',
      '--json',
      '--skip-git-repo-check',
      '--ephemeral',
      '-s',
      'workspace-write',
      '-C',
      app,
      task,
    ],
    steps: (out) =>
      `${(out.match(/"type":"turn.completed"/g) ?? []).length} turns, ${(out.match(/"type":"item.completed","item":\{"id":"item_\d+","type":"(command_execution|file_change)"/g) ?? []).length} commands and edits`,
  },
  pi: {
    args: (task) => [
      '-p',
      task,
      '--mode',
      'json',
      '--provider',
      'deepseek',
      '--model',
      'deepseek-v4-pro',
      '--no-session',
    ],
    steps: (out) => `${(out.match(/"type":"turn_start"/g) ?? []).length} turns`,
  },
}

const DEFAULT_TASK = 'add a /customers/count route with a test'

/** The last error the agent printed, without anything that looks like a key. */
function failureText(result) {
  const text = `${result.stderr}\n${result.stdout}`.replace(
    /(sk-|Bearer )[A-Za-z0-9._-]+/g,
    '$1<hidden>',
  )
  const line = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /error|unauthorized|login|auth|denied|not found/i.test(l))
    .at(-1)
  return (line ?? text.trim().split('\n').at(-1) ?? 'no output').slice(0, 220)
}

/** Start the generated app and ask the default task's route; `ok` when it answers 200 with a JSON count. */
function probeRoute(app, env) {
  const script = `import { createApp } from './src/app.ts'
import { pinnedInstance, withPort } from './src/plugins/instance/index.ts'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const home = mkdtempSync(join(tmpdir(), 'gate-probe-'))
const app = await createApp(withPort(pinnedInstance(home, { root: process.cwd() }), 0))
const reply = await fetch(app.url + '/customers/count')
const body = await reply.json()
await app.stop()
process.exit(reply.status === 200 && typeof body.count === 'number' ? 0 : 1)
`
  const file = join(app, 'gate-probe.ts')
  writeFileSync(file, script)
  const probe = run('node', [file], app, { env, timeout: 60_000 })
  rmSync(file, { force: true })
  return probe.status === 0 ? 'ok' : 'FAIL'
}

/** The environment of one agent: the caller's, with a scratch HOME and a PATH that cannot reach a global `acryl` or `acrylblends`. */
function environment(dir, programDir) {
  const bin = join(dir, 'bin')
  mkdirSync(bin, { recursive: true })
  const nodeDir = dirname(which('node'))
  for (const tool of ['node', 'npm', 'npx']) symlinkSync(join(nodeDir, tool), join(bin, tool))
  const home = join(dir, 'home')
  mkdirSync(home, { recursive: true })
  // Only what a program needs to run: nothing of the caller's session (its agent variables, hooks or credentials) is inherited.
  const env = {
    ...Object.fromEntries(
      ['TERM', 'LANG', 'USER', 'LOGNAME', 'TMPDIR']
        .filter((k) => process.env[k] !== undefined)
        .map((k) => [k, process.env[k]]),
    ),
    HOME: home,
    PATH: [bin, programDir, '/usr/bin', '/bin', '/usr/sbin', '/sbin'].join(':'),
  }
  delete env.ZDOTDIR
  for (const program of ['acryl', 'acrylblends']) {
    const reached = run('zsh', ['-lc', `command -v ${program}`], dir, { env })
    if (reached.stdout.trim() !== '')
      throw new Error(`${program} is reachable on the agent's PATH: ${reached.stdout.trim()}`)
  }
  return env
}

function attempt(name) {
  const dir = join(base, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const program = PROGRAM_PATHS[name]?.find((path) => existsSync(path)) ?? which(name)
  const programDir = dirname(program)
  const env = environment(dir, programDir)
  const clean = { ...env }
  run('npm', ['init', '-y'], dir, { env: clean })
  run(
    'npm',
    [
      'install',
      spec.endsWith('.tgz') ? resolve(spec) : `acrylblends@${spec}`,
      '--no-audit',
      '--no-fund',
    ],
    dir,
    { env: clean },
  )
  const created = run(
    join(dir, 'node_modules/.bin/acrylblends'),
    ['init', 'app', '--template', values.template, '-y'],
    dir,
    { env: clean },
  )
  if (created.status !== 0) return { name, pass: false, note: `init failed: ${created.stderr}` }
  const app = join(dir, 'app')
  run('npm', ['install', '--no-audit', '--no-fund'], app, { env: clean })
  if (run('npm', ['test'], app, { env: clean }).status !== 0)
    return { name, pass: false, note: "the fresh app's own tests fail" }
  const agentEnv = { ...env }
  const secrets = []
  let isolation = 'scratch HOME, minimal environment, PATH scrubbed'
  if (name === 'claude') {
    // Claude Code keeps its login in the operating system's keychain, bound to the real HOME: nothing is copied, so this agent runs with the real HOME
    // for authentication only, user and local settings are not loaded (--setting-sources project), and its tools are limited (see DRIVERS).
    agentEnv.HOME = homedir()
    isolation =
      'real HOME for login only, project settings only, tools npm/node/ls/cat + edits, PATH scrubbed'
    for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'])
      if (process.env[key]) agentEnv[key] = process.env[key]
  }
  if (name === 'codex') {
    // Codex keeps its login in a file: copy that one file into a scratch CODEX_HOME, and delete it afterwards.
    const source = join(homedir(), '.codex', 'auth.json')
    if (!existsSync(source)) return { name, pass: false, note: `no Codex login at ${source}` }
    const codexHome = join(env.HOME, '.codex')
    mkdirSync(codexHome, { recursive: true, mode: 0o700 })
    copyFileSync(source, join(codexHome, 'auth.json'))
    chmodSync(join(codexHome, 'auth.json'), 0o600)
    writeFileSync(join(codexHome, 'config.toml'), 'cli_auth_credentials_store = "file"\n')
    agentEnv.CODEX_HOME = codexHome
    secrets.push(codexHome)
  }
  if (name === 'pi') {
    const file = join(homedir(), '.secure-storage/llmproviders/deepseek/deepseek.json')
    if (!existsSync(file)) return { name, pass: false, note: `no DeepSeek key at ${file}` }
    agentEnv.DEEPSEEK_API_KEY = JSON.parse(readFileSync(file, 'utf8')).deepseek_api_key
  }
  run('git', ['init', '-q'], app)
  run('git', ['add', '-A'], app)
  run(
    'git',
    ['-c', 'user.name=gate', '-c', 'user.email=gate@example.com', 'commit', '-qm', 'base'],
    app,
  )
  const driver = DRIVERS[name]
  const started = Date.now()
  const result = run(program, driver.args(values.task, app), app, {
    env: agentEnv,
    timeout: 900_000,
    input: '',
  })
  const seconds = Math.round((Date.now() - started) / 1000)
  for (const path of secrets) rmSync(path, { recursive: true, force: true })
  const test = run('npm', ['test'], app, { env: clean })
  const check = run('npm', ['run', 'check'], app, { env: clean })
  // Tests that passed before the task prove nothing: the agent must have added a test and a source file, and the default task's route must answer.
  const changed = run('git', ['status', '--porcelain', '--untracked-files=all'], app)
    .stdout.split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3))
  const touchedTests = changed.some((file) => file.startsWith('test/'))
  const touchedSource = changed.some((file) => file.startsWith('src/') || file === 'blend.yaml')
  const route = values.task === DEFAULT_TASK ? probeRoute(app, clean) : 'not probed'
  const pass =
    result.status === 0 &&
    test.status === 0 &&
    check.status === 0 &&
    touchedTests &&
    touchedSource &&
    route !== 'FAIL'
  const reason = result.status === 0 ? '' : ` [${failureText(result)}]`
  return {
    name,
    pass,
    note: `${driver.steps(result.stdout)}, ${seconds} s; agent exit ${result.status}${reason}; isolation: ${isolation}; tests ${test.status === 0 ? 'pass' : 'FAIL'}, type-check ${check.status === 0 ? 'pass' : 'FAIL'}, test added ${touchedTests}, source changed ${touchedSource}, route ${route}`,
    app,
  }
}

const results = (values.agent === 'all' ? AGENTS : [values.agent]).map((name) => {
  try {
    return attempt(name)
  } catch (error) {
    return { name, pass: false, note: error.message }
  }
})
for (const r of results)
  console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}: ${r.note}${r.app ? ` (${r.app})` : ''}`)
process.exit(results.every((r) => r.pass) ? 0 : 1)
