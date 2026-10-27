import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
// @ts-expect-error plain module shared with the scripts
import * as shared from '../../../scripts/lib/names.mjs'
import {
  CLASS,
  CREATE,
  type Io,
  nameFrom,
  PACKAGE,
  parseCreateOptions,
  runCreate,
  TEMPLATE_MANIFEST,
  TEMPLATES,
  UsageError,
} from '../src/index'

const repo = resolve(import.meta.dirname, '..', '..', '..')
const _cliVersion = (
  JSON.parse(readFileSync(join(repo, 'packages', 'cli', 'package.json'), 'utf8')) as {
    version: string
  }
).version
const scratch = mkdtempSync(join(tmpdir(), 'create-acrylblends-test-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

function fakeIo(answers: string[] = [], interactive = false) {
  let out = ''
  let err = ''
  const runs: { command: string; args: string[]; cwd: string }[] = []
  const io: Io = {
    stdout: { write: (t) => (out += t) },
    stderr: { write: (t) => (err += t) },
    cwd: scratch,
    env: {},
    ask: interactive ? async () => answers.shift() ?? '' : undefined,
    run: async (command, args, cwd) => {
      runs.push({ command, args, cwd })
      return 0
    },
  }
  return { io, out: () => out, err: () => err, runs }
}

describe('names', () => {
  it('are the ones scripts/lib/names.mjs holds, so a rename is one change in each', () => {
    expect([PACKAGE, CLASS, CREATE, TEMPLATE_MANIFEST]).toEqual([
      shared.PACKAGE,
      shared.CLASS,
      shared.CREATE,
      shared.TEMPLATE_MANIFEST,
    ])
  })
})

describe('README', () => {
  it('shows the one command with the current names', () => {
    const readme = readFileSync(join(repo, 'packages', 'create', 'README.md'), 'utf8')
    expect(readme).toContain(`npm create ${PACKAGE}@latest my-app`)
    expect(readme).toContain(`import { ${CLASS} } from '${PACKAGE}'`)
    expect(readme).toContain(`# ${CREATE}`)
  })
})

describe('options', () => {
  it('parses the flags and rejects bad ones', () => {
    expect(
      parseCreateOptions(['my-app', '--template', 'notes', '--install', '--pm', 'pnpm', '-y']),
    ).toEqual({
      directory: 'my-app',
      template: 'notes',
      install: true,
      pm: 'pnpm',
      yes: true,
      source: undefined,
    })
    expect(() => parseCreateOptions(['--template', 'vercel'])).toThrow(UsageError)
    expect(() => parseCreateOptions(['--template', 'bun'])).toThrow(UsageError)
    expect(() => parseCreateOptions(['--pm', 'pip'])).toThrow(UsageError)
    expect(parseCreateOptions(['a', 'github:o/r']).source).toBe('github:o/r')
    // A bare name that is a built-in template means --template; only github:, @scope/ and .tgz are sources.
    for (const name of TEMPLATES) {
      const bare = parseCreateOptions(['a', name])
      expect(bare.template).toBe(name)
      expect(bare.source).toBeUndefined()
    }
    expect(parseCreateOptions(['a', '@scope/tpl']).source).toBe('@scope/tpl')
    expect(parseCreateOptions(['a', './t.tgz']).source).toBe('./t.tgz')
    expect(() => parseCreateOptions(['a', 'notes', '--template', 'chat'])).toThrow(UsageError)
    expect(() => parseCreateOptions(['a', 'b', 'c'])).toThrow(UsageError)
    expect(() => parseCreateOptions(['--nope'])).toThrow(UsageError)
  })
  it('derives a valid name from a directory', () => {
    expect(nameFrom('/x/My App!')).toBe('my-app')
    expect(nameFrom('/x/123')).toBe('acryl-app')
  })
})

describe('create', () => {
  it.each(TEMPLATES)(
    "%s: is made by the framework package's own init, as a Cordis app (blend.yaml, plugins/)",
    async (template) => {
      const s = fakeIo()
      expect(await runCreate([`app-${template}`, '--template', template, '-y'], s.io)).toBe(0)
      expect(s.runs).toHaveLength(1)
      expect(s.runs[0]?.args.slice(1)).toEqual([
        'init',
        join(scratch, `app-${template}`),
        '--template',
        template === 'acryl-app' ? 'agent' : template,
        '--name',
        `app-${template}`,
        '--yes',
      ])
      expect(s.out()).toContain(`cd app-${template}`)
    },
  )

  it('a bare template name after the directory is the same as --template', async () => {
    const s = fakeIo()
    expect(await runCreate(['my-app', 'notes'], s.io)).toBe(0)
    expect(s.err()).toBe('')
    expect(s.runs[0]?.args.slice(1)).toEqual([
      'init',
      join(scratch, 'my-app'),
      '--template',
      'notes',
      '--name',
      'my-app',
      '--yes',
    ])
  })

  it('refuses a folder that is not empty and changes nothing', async () => {
    mkdirSync(join(scratch, 'full'), { recursive: true })
    writeFileSync(join(scratch, 'full', 'x.txt'), 'x')
    const s = fakeIo()
    expect(await runCreate(['full', '-y'], s.io)).toBe(1)
    expect(readdirSync(join(scratch, 'full'))).toEqual(['x.txt'])
    expect(s.runs).toEqual([])
  })

  it('installs with the chosen package manager, and asks when it can', async () => {
    const s = fakeIo(['asked-app', 'chat'], true)
    expect(await runCreate(['--install', '--pm', 'pnpm'], s.io)).toBe(0)
    expect(s.runs[0]?.args).toContain('chat')
    expect(s.runs[1]).toMatchObject({
      command: 'pnpm',
      args: ['install'],
      cwd: join(scratch, 'asked-app'),
    })
  })

  it('exits 2 with help on a usage error, and prints help and version', async () => {
    const s = fakeIo()
    expect(await runCreate(['--template', 'vercel'], s.io)).toBe(2)
    expect(s.err()).toContain('unknown template')
    const h = fakeIo()
    expect(await runCreate(['--help'], h.io)).toBe(0)
    expect(h.out()).toContain(`npm create ${PACKAGE}@latest`)
    expect(TEMPLATES).toEqual(['nodejs', 'notes', 'chat', 'acryl-app'])
  })
})
