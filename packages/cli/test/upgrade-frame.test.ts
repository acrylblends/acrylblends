/**
 * Slice 6 of the IDE port: `acrylblends upgrade` brings the frame to an app made before it. An app scaffolded without ACRYLBLENDS_FRAME_PACKAGES has the
 * template's `src/frame.ts` (so its routes mount at /app) but no profile; the upgrade writes the profile, the overlay, the runtime row and the `dev`/`profile`
 * scripts, exactly as `init` would, and refuses to overwrite a file of the app's own (`cordis.patch.yml` without the generated marker line).
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { type Io, init, parseUpgradeOptions, upgrade } from '../src/index'

const scratch = mkdtempSync(join(tmpdir(), 'acrylblends-upgrade-frame-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
afterEach(() => {
  delete process.env.ACRYLBLENDS_FRAME_PACKAGES
})

function session(cwd: string) {
  const out: string[] = []
  const err: string[] = []
  const io: Io = {
    stdout: { write: (text: string) => out.push(text) },
    stderr: { write: (text: string) => err.push(text) },
    cwd,
    ask: undefined,
    install: async () => 0,
  }
  return { io, out: () => out.join(''), err: () => err.join('') }
}

const FRAME_SPECS = JSON.stringify({
  dshVersion: '0.2.0-rc.2',
  frameworkVersion: '^1.0.10',
  packages: {
    'acryl-app-shell': 'file:/checkout/ide/acryl-app-shell',
    'acryl-web': 'file:/checkout/ide/acryl-web',
  },
})

/** An app as the version before the frame made it: the blank template, scaffolded without frame package specs. */
async function preFrameApp(name: string): Promise<string> {
  delete process.env.ACRYLBLENDS_FRAME_PACKAGES
  const { io } = session(scratch)
  const code = await init(
    {
      directory: name,
      template: 'blank',
      yes: true,
      name,
      install: false,
      desktop: false,
      quietNext: true,
    },
    io,
  )
  expect(code).toBe(0)
  const root = join(scratch, name)
  expect(existsSync(join(root, 'src', 'frame.ts'))).toBe(true)
  expect(existsSync(join(root, 'cordis.patch.yml'))).toBe(false)
  return root
}

const runUpgrade = async (root: string, argv: readonly string[] = []) => {
  const { io, out, err } = session(root)
  const code = await upgrade(parseUpgradeOptions(argv), io)
  return { code, out, err }
}

describe('upgrading a pre-frame app to the frame', () => {
  it('writes the profile, overlay, runtime row and dev/profile scripts, and points dev at the profile', async () => {
    const root = await preFrameApp('framed-later')
    process.env.ACRYLBLENDS_FRAME_PACKAGES = FRAME_SPECS
    const { code, out } = await runUpgrade(root)
    expect(code).toBe(0)
    const overlay = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
    expect(overlay).toContain('- id: app-routes')
    expect(overlay).toContain('name: ./src/frame.ts')
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    expect(manifest.scripts.dev).toBe(
      'node --import ./plugins/acryl-node-server/src/register.ts node_modules/@deepseek-ai/dsh/lib/bin.js --profile acrylblends-framed-later --patch cordis.patch.yml --no-open',
    )
    expect(manifest.scripts.profile).toBe('node scripts/ide-profile.mjs')
    expect(manifest.dependencies['@deepseek-ai/dsh']).toBe('0.2.0-rc.2')
    expect(manifest.dependencies.acrylblends).toBe('^1.0.10')
    expect(manifest.dependencies['acryl-app-shell']).toBe('file:/checkout/ide/acryl-app-shell')
    expect(existsSync(join(root, 'scripts', 'ide-profile.mjs'))).toBe(true)
    expect(existsSync(join(root, 'app', 'runtime.mjs'))).toBe(true)
    expect(out()).toMatch(/frame\s+cordis\.patch\.yml added/u)
    // The standalone start is the app's own and does not move.
    expect(manifest.scripts.start).toBe(
      'node --import ./plugins/acryl-node-server/src/register.ts src/main.ts',
    )
  })

  it('is idempotent: a second run changes no bytes and says everything is up to date', async () => {
    const root = await preFrameApp('already-framed')
    process.env.ACRYLBLENDS_FRAME_PACKAGES = FRAME_SPECS
    expect((await runUpgrade(root)).code).toBe(0)
    const files = ['cordis.patch.yml', 'package.json', 'scripts/ide-profile.mjs', 'app/runtime.mjs']
    const before = files.map((file) => readFileSync(join(root, file), 'utf8'))
    const second = await runUpgrade(root)
    expect(second.code).toBe(0)
    expect(second.out()).toMatch(/everything is up to date/u)
    expect(files.map((file) => readFileSync(join(root, file), 'utf8'))).toEqual(before)
  })

  it('refuses a cordis.patch.yml the app wrote, and changes nothing', async () => {
    const root = await preFrameApp('refuses')
    const own = '# my own overlay\n- insert:\n    - id: mine\n      name: ./mine.mjs\n'
    writeFileSync(join(root, 'cordis.patch.yml'), own)
    const manifestBefore = readFileSync(join(root, 'package.json'), 'utf8')
    process.env.ACRYLBLENDS_FRAME_PACKAGES = FRAME_SPECS
    const { code, err } = await runUpgrade(root)
    expect(code).toBe(1)
    expect(err()).toMatch(/cordis\.patch\.yml.*did not write/u)
    expect(readFileSync(join(root, 'cordis.patch.yml'), 'utf8')).toBe(own)
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(manifestBefore)
    expect(existsSync(join(root, 'scripts', 'ide-profile.mjs'))).toBe(false)
  })

  it('with --force, saves the app file and writes the frame', async () => {
    const root = await preFrameApp('forced')
    const own = '# my own overlay\n'
    writeFileSync(join(root, 'cordis.patch.yml'), own)
    process.env.ACRYLBLENDS_FRAME_PACKAGES = FRAME_SPECS
    const { code, out } = await runUpgrade(root, ['--force'])
    expect(code).toBe(0)
    expect(readFileSync(join(root, 'cordis.patch.yml'), 'utf8')).toContain('- id: app-routes')
    expect(out()).toMatch(/saved in \.acrylblends\/upgrade-backup\//u)
    expect(existsSync(join(root, 'cordis.patch.yml'))).toBe(true)
  })

  it('leaves an app without src/frame.ts standalone, and says so', async () => {
    const root = await preFrameApp('no-row')
    rmSync(join(root, 'src', 'frame.ts'))
    process.env.ACRYLBLENDS_FRAME_PACKAGES = FRAME_SPECS
    const { code, out } = await runUpgrade(root)
    expect(code).toBe(0)
    expect(out()).toMatch(/no src\/frame\.ts/u)
    expect(existsSync(join(root, 'cordis.patch.yml'))).toBe(false)
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    expect(manifest.scripts.dev).not.toMatch(/dsh\/lib\/bin\.js --profile/u)
  })
})
