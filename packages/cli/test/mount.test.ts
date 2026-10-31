/** `acrylblends add` reads and edits an app's blend.yaml and registry; a Windows checkout writes both with CRLF, and the rows must still be found and kept in that style. */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MOUNTED, mount, rowNames } from '../src/mount.ts'

const panel = MOUNTED.find((plugin) => plugin.name === 'agent-panel')
if (panel === undefined) throw new Error('agent-panel is not a mounted plugin')

const BLEND = [
  'apiVersion: blends.acryl.dev/v1alpha1',
  'kind: Blueprint',
  'metadata:',
  '  id: example',
  'spec:',
  '  rows:',
  '    - id: agent',
  '      name: agent',
  '    - id: extensions',
  '      name: extensions',
  '    - id: routes',
  '      name: routes',
]

const APP = [
  "import type { Context } from '@deepseek-ai/cordis'",
  "import * as routes from '../plugins/routes/index.ts'",
  '',
  'export const registry = {',
  '  routes,',
  '}',
]

/** An app folder holding the two files `add` edits, joined with `eol`. */
function app(eol: '\n' | '\r\n'): string {
  const dir = mkdtempSync(join(tmpdir(), 'mount-test-'))
  mkdirSync(join(dir, 'src'))
  writeFileSync(join(dir, 'blend.yaml'), `${BLEND.join(eol)}${eol}`)
  writeFileSync(join(dir, 'src', 'app.ts'), `${APP.join(eol)}${eol}`)
  return dir
}

describe('a Blend written with CRLF', () => {
  it('has the same rows as one with LF', () => {
    expect(rowNames(app('\n'))).toEqual(['agent', 'extensions', 'routes'])
    expect(rowNames(app('\r\n'))).toEqual(['agent', 'extensions', 'routes'])
  })

  for (const [name, eol] of [
    ['LF', '\n'],
    ['CRLF', '\r\n'],
  ] as const) {
    it(`mounts a row and its registry entry in a ${name} app, keeping that line ending`, () => {
      const dir = app(eol)
      const result = mount(dir, panel)
      expect(result.done, result.note).toBe(true)
      const blend = readFileSync(join(dir, 'blend.yaml'), 'utf8')
      expect(blend).toContain(
        `    - id: agent-panel${eol}      name: agent-panel${eol}    - id: routes`,
      )
      const source = readFileSync(join(dir, 'src', 'app.ts'), 'utf8')
      expect(source).toContain(`import * as panel from '../plugins/agent-panel/index.ts'${eol}`)
      expect(source).toContain(`  'agent-panel': panel,${eol}`)
    })
  }
})
