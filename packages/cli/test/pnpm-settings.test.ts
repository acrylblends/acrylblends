import assert from 'node:assert/strict'
import { test } from 'vitest'
import { parse } from 'yaml'
import { FRAME_ALLOW_BUILDS, withFramePnpmSettings } from '../src/pnpm-settings.ts'

test('an app with no pnpm-workspace.yaml gets the flat layout and every frame build allowed', () => {
  const text = withFramePnpmSettings(undefined)
  const settings = parse(text)
  assert.equal(settings.nodeLinker, 'hoisted')
  assert.deepEqual(Object.keys(settings.allowBuilds).sort(), [...FRAME_ALLOW_BUILDS].sort())
  assert.ok(Object.values(settings.allowBuilds).every((value) => value === true))
  assert.ok(text.endsWith('\n'))
})

test('the frame list names the native builds the host needs', () => {
  assert.ok(FRAME_ALLOW_BUILDS.includes('node-pty'))
  assert.ok(FRAME_ALLOW_BUILDS.includes('@deepseek-ai/dsh-subprocess-local'))
})

test('applying twice changes nothing the second time', () => {
  const once = withFramePnpmSettings(undefined)
  assert.equal(withFramePnpmSettings(once), once)
})

test('a key the person set is kept: their own nodeLinker and an inline allowBuilds are not touched', () => {
  const theirs = 'nodeLinker: isolated\nallowBuilds: {}\n'
  assert.equal(withFramePnpmSettings(theirs), theirs)
})

test('a block allowBuilds gets only the missing names, after its last entry, and a denied name stays denied', () => {
  const theirs = [
    'packages:',
    "  - '.'",
    'allowBuilds:',
    '  esbuild: true',
    '  koffi: false',
    '',
    '# their note',
    'minimumReleaseAgeExclude:',
    '  - foo',
    '',
  ].join('\n')
  const text = withFramePnpmSettings(theirs, ['koffi', 'node-pty', '@google/genai'])
  const settings = parse(text)
  assert.deepEqual(settings.allowBuilds, {
    esbuild: true,
    koffi: false,
    'node-pty': true,
    '@google/genai': true,
  })
  assert.deepEqual(settings.packages, ['.'])
  assert.deepEqual(settings.minimumReleaseAgeExclude, ['foo'])
  assert.equal(settings.nodeLinker, 'hoisted')
  assert.match(text, /# their note\nminimumReleaseAgeExclude:/u)
})

test('a file without a trailing newline is extended cleanly', () => {
  const text = withFramePnpmSettings('packages:\n  - .', [])
  assert.equal(text, `packages:\n  - .\n${text.split('\n').slice(2).join('\n')}`)
  assert.equal(parse(text).nodeLinker, 'hoisted')
  assert.equal(parse(text).allowBuilds, undefined)
})
