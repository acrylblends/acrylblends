import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'vitest'
import {
  applyIdeProfile,
  FRAME_PACKAGES,
  ideProfilePlan,
  profileNameFor,
} from '../src/ide-profile.ts'

const cleanups: Array<() => void> = []
afterEach(() => {
  for (const step of cleanups.splice(0).reverse()) step()
})

function folder(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ide-profile-'))
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

const SPECS: Record<string, string> = Object.fromEntries(
  FRAME_PACKAGES.map((entry) => [
    entry.row ?? entry.name,
    `file:../${entry.name.replaceAll('/', '-')}`,
  ]),
)
const input = {
  appName: 'My App',
  dshVersion: '0.2.0-rc.2',
  frameworkVersion: '^1.0.10',
  spec: (name: string) => SPECS[name],
}

test('one profile per app, named from the app and safe for a DSH profile', () => {
  assert.equal(profileNameFor('My App'), 'acrylblends-my-app')
  assert.equal(profileNameFor('notes'), 'acrylblends-notes')
  assert.notEqual(profileNameFor('a'), profileNameFor('b'))
  assert.match(
    ideProfilePlan(input).packageJson,
    /"dev": "dsh --profile acrylblends-my-app --patch cordis.patch.yml --no-open"/u,
  )
})

test("the overlay mounts the frame rows and leaves DSH's own brand row out", () => {
  const overlay = ideProfilePlan(input).overlay
  for (const entry of FRAME_PACKAGES)
    assert.match(
      overlay,
      new RegExp(
        `- id: ${entry.row ?? entry.name}\\n\\s+name: ${entry.name.replaceAll('/', '\\/')}`,
        'u',
      ),
    )
  assert.match(overlay, /- id: ui-brand-official\n {2}disabled: true/u)
})

test("the manifest carries the DSH pin, the framework, the frame packages, and keeps the app's own keys", () => {
  const existing = JSON.stringify({
    name: 'my-app',
    scripts: { start: 'node src/main.ts' },
    dependencies: { yaml: '^2.9.0' },
  })
  const manifest = JSON.parse(ideProfilePlan(input, existing).packageJson)
  assert.equal(manifest.dependencies['@deepseek-ai/dsh'], '0.2.0-rc.2')
  assert.equal(manifest.dependencies.acrylblends, '^1.0.10')
  assert.equal(manifest.dependencies['acryl-web'], 'file:../acryl-web')
  assert.equal(manifest.dependencies.yaml, '^2.9.0')
  assert.equal(manifest.scripts.start, 'node src/main.ts')
})

test('applying twice changes nothing the second time', () => {
  const root = folder()
  const first = applyIdeProfile(root, input)
  assert.deepEqual([...first.written].sort(), [
    'app/runtime.mjs',
    'cordis.patch.yml',
    'package.json',
    'scripts/ide-profile.mjs',
  ])
  const bytes = [
    'app/runtime.mjs',
    'cordis.patch.yml',
    'package.json',
    'scripts/ide-profile.mjs',
  ].map((file) => readFileSync(join(root, file), 'utf8'))
  const second = applyIdeProfile(root, input)
  assert.deepEqual(second.written, [])
  assert.deepEqual([...second.unchanged].sort(), [
    'app/runtime.mjs',
    'cordis.patch.yml',
    'package.json',
    'scripts/ide-profile.mjs',
  ])
  assert.deepEqual(
    bytes,
    ['app/runtime.mjs', 'cordis.patch.yml', 'package.json', 'scripts/ide-profile.mjs'].map((file) =>
      readFileSync(join(root, file), 'utf8'),
    ),
  )
})

test('a hand edit to an unrelated key survives, and the generated fields are put back', () => {
  const root = folder()
  applyIdeProfile(root, input)
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  manifest.version = '0.2.0'
  writeFileSync(join(root, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  const again = applyIdeProfile(root, input)
  assert.deepEqual(again.written, [])
  assert.equal(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version, '0.2.0')
})
