#!/usr/bin/env node
// The upgrade gate of the IDE port: an app made by the previous published release (1.1.0 layout) gets the frame-hosted layout from `acrylblends upgrade`, and
// the page gate then checks that app in place (the frame boots, the app answers at /app, the panel and the PTY work under the mount). A second upgrade run must
// change nothing.
//
//   node --import ./scripts/workspace-source.mjs scripts/verify-upgrade-frame.mjs [--keep]
//
// The fixture is scaffolded by this checkout's CLI (so it carries the plugin copies), then its scaffold is replaced by the released files, its frame row and
// host plugins are removed, and a file of the app's own is added: the upgrade must replace none of the app's code and no blend.yaml byte.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { frameSpecsEnv } from './lib/ide-specs.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = join(root, 'packages/cli/bin/acrylblends.js')
const keep = process.argv.includes('--keep')
const log = (message) => console.log(`verify-upgrade-frame: ${message}`)
const fail = (message) => {
  throw new Error(`verify-upgrade-frame: ${message}`)
}
const DSH_VERSION = process.env.IDE_PROFILE_DSH_VERSION ?? '0.2.0-rc.2'
const cliVersion = JSON.parse(
  readFileSync(join(root, 'packages', 'cli', 'package.json'), 'utf8'),
).version
const frameworkVersion = `^${cliVersion}`

if (!existsSync(join(root, 'packages', 'cli', 'dist', 'index.js')))
  fail('the CLI is not built (run pnpm run build)')

const scratch = mkdtempSync(join(tmpdir(), 'upgrade-frame-'))
const app = join(scratch, 'legacy-app')
const name = 'legacy-app'
const released = join(root, 'packages', 'cli', 'legacy', '1.1.0', 'agent')
const env = { ...process.env, npm_config_loglevel: 'error' }
const run = (command, args, cwd, extraEnv = {}) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...env, ...extraEnv },
  })
  if (result.status !== 0)
    fail(
      `${command} ${args.join(' ')} failed (exit ${String(result.status)}):\n${result.stdout}${result.stderr}`,
    )
  return result.stdout
}

try {
  // 1. The previous published layout: the current scaffold (which brings the plugin copies), then the released files, no frame row, no host plugins.
  const initEnv = { ...env }
  delete initEnv.ACRYLBLENDS_FRAME_PACKAGES
  spawnSync(
    process.execPath,
    [cli, 'init', app, '--name', name, '--template', 'agent', '--yes', '--no-next'],
    {
      cwd: scratch,
      encoding: 'utf8',
      env: initEnv,
    },
  )
  if (!existsSync(join(app, 'blend.yaml'))) fail('init did not scaffold the fixture app')
  if (existsSync(join(app, 'cordis.patch.yml')))
    fail(
      'the fixture was scaffolded with a frame profile; init must not write one without the specs',
    )
  for (const file of ['src/app.ts', 'src/routes.ts']) {
    const text = readFileSync(join(released, file), 'utf8').replaceAll('__APP_NAME__', name)
    writeFileSync(join(app, file), text)
  }
  rmSync(join(app, 'src', 'frame.ts'))
  // The composition row is part of the frame layout too: the released release had neither it nor its folder.
  rmSync(join(app, 'frame'), { recursive: true, force: true })
  for (const plugin of ['acryl-page', 'acryl-web-server'])
    rmSync(join(app, 'plugins', plugin), { recursive: true, force: true })
  // A file of the app's own, which the upgrade must keep byte for byte.
  const mine = join(app, 'src', 'mine.txt')
  writeFileSync(mine, 'a file of the app\n')
  const blendBefore = readFileSync(join(app, 'blend.yaml'), 'utf8')
  log('the fixture carries the 1.1.0 layout (released scaffold, no frame row, no host plugins)')

  // 2. The upgrade, with this checkout's frame package specs.
  const frameEnv = {
    ACRYLBLENDS_FRAME_PACKAGES: frameSpecsEnv(root, { dshVersion: DSH_VERSION, frameworkVersion }),
  }
  const report = run(process.execPath, [cli, 'upgrade'], app, frameEnv)
  for (const expected of [
    'cordis.patch.yml added',
    'cordis.yml added',
    'scripts/ide-host.mjs added',
    'app/runtime.mjs added',
    'src/frame.ts added',
    'src/app.ts updated',
    'src/routes.ts updated',
    'frame/app-plugins.mjs added',
    'plugins/acryl-web-server added',
    'plugins/acryl-page added',
    'package.json merged',
  ])
    if (!report.includes(expected)) fail(`the upgrade did not report "${expected}":\n${report}`)
  log('the upgrade wrote the frame layout and printed every file it changed')

  const overlay = readFileSync(join(app, 'cordis.patch.yml'), 'utf8')
  for (const row of [
    '- id: app-plugins',
    'name: ./frame/app-plugins.mjs',
    'isolate:',
    '- id: app-routes',
    'name: ./src/frame.ts',
  ])
    if (!overlay.includes(row))
      fail(`the upgraded overlay is missing ${JSON.stringify(row)}:\n${overlay}`)
  const appTs = readFileSync(join(app, 'src', 'app.ts'), 'utf8')
  if (!appTs.includes('export async function composeInto'))
    fail('src/app.ts was not brought up to date')
  if (!appTs.includes("'agent-panel': { mount: FRAME_MOUNT_PREFIX }"))
    fail('src/app.ts does not pass the mount to the panel')
  const manifest = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'))
  if (
    manifest.scripts?.dev !==
    'node --import ./plugins/acryl-node-server/src/register.ts scripts/ide-host.mjs'
  )
    fail(`the app's dev script does not boot the host launcher: ${String(manifest.scripts?.dev)}`)
  if (
    manifest.scripts?.start !==
    'node --import ./plugins/acryl-node-server/src/register.ts src/main.ts'
  )
    fail('the standalone start moved')
  // The app's own code and configuration are untouched.
  if (readFileSync(join(app, 'blend.yaml'), 'utf8') !== blendBefore)
    fail('the upgrade changed blend.yaml')
  if (readFileSync(mine, 'utf8') !== 'a file of the app\n')
    fail('the upgrade changed a file of the app')
  log(
    'the app code and blend.yaml are byte-identical; the composition now carries the mount config',
  )

  // 3. The dependencies the upgrade added have to install, and a second run must change nothing.
  run('npm', ['install', '--no-audit', '--no-fund'], app)
  log('the upgraded app installs')
  const files = [
    'cordis.patch.yml',
    'cordis.yml',
    'package.json',
    'scripts/ide-host.mjs',
    'app/runtime.mjs',
    'src/frame.ts',
    'src/app.ts',
    'src/routes.ts',
    'frame/app-plugins.mjs',
  ]
  const before = files.map((file) => readFileSync(join(app, file), 'utf8'))
  const second = run(process.execPath, [cli, 'upgrade'], app, frameEnv)
  if (!/everything is up to date/u.test(second))
    fail(`a second upgrade did not report everything up to date:\n${second}`)
  files.forEach((file, index) => {
    if (readFileSync(join(app, file), 'utf8') !== before[index])
      fail(`a second upgrade changed ${file}`)
  })
  log('a second upgrade changes nothing and says so')

  // 4. The page gate on the result: the frame boots, the app answers at /app, the panel and the PTY run under the mount.
  log('running the page gate on the upgraded app')
  const gate = spawnSync(
    process.execPath,
    [
      '--import',
      './scripts/workspace-source.mjs',
      'scripts/verify-ide-template.mjs',
      'agent',
      '--existing',
      app,
    ],
    { cwd: root, encoding: 'utf8', env: { ...process.env, ...frameEnv, ...{} } },
  )
  if (gate.status !== 0)
    fail(
      `the page gate on the upgraded app failed (exit ${String(gate.status)}):\n${gate.stdout}${gate.stderr}`,
    )
  for (const line of gate.stdout.split('\n'))
    if (line.startsWith('verify-ide-template(agent): '))
      log(`page gate: ${line.replace('verify-ide-template(agent): ', '')}`)
  log('OK')
} finally {
  if (keep) log(`kept ${scratch}`)
  else rmSync(scratch, { recursive: true, force: true })
}
