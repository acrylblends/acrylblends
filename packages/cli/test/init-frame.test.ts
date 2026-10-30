/**
 * Slice 6 of the IDE port: a template with a frame row (`src/frame.ts`) is scaffolded with the app's own DSH profile and overlay, so `npm run dev`
 * opens the app inside the ACRYL frame with its page at /app. The frame's client packages are unpublished, so the specs come from
 * ACRYLBLENDS_FRAME_PACKAGES; without it the app stays on the framework only and the CLI says why instead of writing a profile that cannot install.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { type Io, init } from '../src/index'

const scratch = mkdtempSync(join(tmpdir(), 'acrylblends-init-frame-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
afterEach(() => {
  delete process.env.ACRYLBLENDS_FRAME_PACKAGES
})

function fakeIo(cwd: string) {
  const out: string[] = []
  const io: Io = {
    stdout: { write: (text: string) => out.push(text) },
    stderr: { write: () => {} },
    cwd,
    ask: undefined,
    install: async () => 0,
  }
  return { io, out }
}

const FRAME_SPECS = JSON.stringify({
  dshVersion: '0.2.0-rc.2',
  frameworkVersion: '^1.0.10',
  packages: {
    'acryl-app-shell': 'file:/checkout/ide/acryl-app-shell',
    'acryl-web': 'file:/checkout/ide/acryl-web',
  },
})

describe('scaffolding a template into the frame', () => {
  it('writes the profile and overlay with the app row and the frame rows, and points dev at the profile', async () => {
    process.env.ACRYLBLENDS_FRAME_PACKAGES = FRAME_SPECS
    const { io } = fakeIo(scratch)
    const code = await init(
      {
        directory: 'framed',
        template: 'blank',
        yes: true,
        name: 'framed',
        install: false,
        desktop: false,
        quietNext: true,
      },
      io,
    )
    expect(code).toBe(0)
    const root = join(scratch, 'framed')
    const overlay = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
    // The app's own row is in the overlay, at the prefix its frame row mounts.
    expect(overlay).toContain('- id: app-routes')
    expect(overlay).toContain('name: ./src/frame.ts')
    // The frame's rows are there too.
    expect(overlay).toContain('name: acryl-app-shell')
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    expect(String(manifest.scripts.dev)).toMatch(
      /^dsh --profile acrylblends-framed --patch cordis\.patch\.yml/u,
    )
    expect(manifest.scripts.profile).toBe('node scripts/ide-profile.mjs')
    expect(manifest.dependencies['acryl-app-shell']).toBe('file:/checkout/ide/acryl-app-shell')
    expect(existsSync(join(root, 'app', 'runtime.mjs'))).toBe(true)
  })

  it('without frame package specs it writes no profile and says why, leaving the framework-only app runnable', async () => {
    const { io, out } = fakeIo(scratch)
    const code = await init(
      {
        directory: 'plain',
        template: 'blank',
        yes: true,
        name: 'plain',
        install: false,
        desktop: false,
        quietNext: true,
      },
      io,
    )
    expect(code).toBe(0)
    const root = join(scratch, 'plain')
    expect(existsSync(join(root, 'cordis.patch.yml'))).toBe(false)
    expect(out.join('')).toMatch(/the ACRYL frame is not published yet/u)
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    expect(manifest.scripts.dev).not.toMatch(/dsh --profile/u)
  })
})
