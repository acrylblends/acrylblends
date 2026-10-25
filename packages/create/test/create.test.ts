import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
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
  TEMPLATES,
  UsageError,
} from '../src/index'

const repo = resolve(import.meta.dirname, '..', '..', '..')
const cliVersion = (
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
    expect([PACKAGE, CLASS, CREATE]).toEqual([shared.PACKAGE, shared.CLASS, shared.CREATE])
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
      parseCreateOptions(['my-app', '--template', 'bun', '--install', '--pm', 'pnpm', '-y']),
    ).toEqual({
      directory: 'my-app',
      template: 'bun',
      install: true,
      pm: 'pnpm',
      yes: true,
    })
    expect(() => parseCreateOptions(['--template', 'vercel'])).toThrow(UsageError)
    expect(() => parseCreateOptions(['--template', 'deno'])).toThrow(UsageError)
    expect(() => parseCreateOptions(['--pm', 'pip'])).toThrow(UsageError)
    expect(() => parseCreateOptions(['a', 'b'])).toThrow(UsageError)
    expect(() => parseCreateOptions(['--nope'])).toThrow(UsageError)
  })
  it('derives a valid name from a directory', () => {
    expect(nameFrom('/x/My App!')).toBe('my-app')
    expect(nameFrom('/x/123')).toBe('acryl-app')
  })
})

describe('create', () => {
  it.each(['nodejs', 'notes', 'chat', 'bun'] as const)(
    '%s: files, no placeholders, AGENTS.md, CLAUDE.md and the docs inside',
    async (template) => {
      const s = fakeIo()
      expect(await runCreate([`app-${template}`, '--template', template, '-y'], s.io)).toBe(0)
      const dir = join(scratch, `app-${template}`)
      const all = (d: string): string[] =>
        readdirSync(d, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? all(join(d, e.name)) : [join(d, e.name)],
        )
      for (const file of all(dir).filter((f) => !f.includes('/docs/')))
        expect(readFileSync(file, 'utf8'), file).not.toMatch(/__[A-Z_]+__/)
      expect(readFileSync(join(dir, 'CLAUDE.md'), 'utf8')).toBe('@AGENTS.md\n')
      expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).toContain('docs/framework/README.md')
      expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).toContain(
        "jsx('h1', { class: 'title' }, 'Hello')",
      )
      expect(existsSync(join(dir, 'docs/framework/README.md'))).toBe(true)
      expect(existsSync(join(dir, 'docs/framework/UPSTREAM.md'))).toBe(false)
      expect(s.out()).toContain(`created app-${template}`)
    },
  )

  it('notes: AGENTS.md describes the structure and points at the deploy page; nodejs has no such section', async () => {
    await runCreate(['shipped', '--template', 'notes', '-y'], fakeIo().io)
    const notes = readFileSync(join(scratch, 'shipped', 'AGENTS.md'), 'utf8')
    expect(notes).toContain('## Before you ship')
    expect(notes).toContain('docs/framework/getting-started/deploy.md')
    expect(notes).toContain('src/notes-app.ts')
    await runCreate(['plain', '--template', 'nodejs', '-y'], fakeIo().io)
    expect(readFileSync(join(scratch, 'plain', 'AGENTS.md'), 'utf8')).not.toContain(
      'Before you ship',
    )
  })

  it('nodejs: the generated app type-checks against the real framework package', async () => {
    await runCreate(['typed', '--template', 'nodejs', '-y'], fakeIo().io)
    const dir = join(scratch, 'typed')
    // The real package, resolved through its own exports map as an installed app would.
    mkdirSync(join(dir, 'node_modules'), { recursive: true })
    symlinkSync(join(repo, 'packages', 'cli'), join(dir, 'node_modules', PACKAGE), 'dir')
    const config = JSON.parse(readFileSync(join(dir, 'tsconfig.json'), 'utf8'))
    config.compilerOptions.typeRoots = [join(repo, 'node_modules', '@types')]
    config.include = ['src', 'test']
    writeFileSync(join(dir, 'tsconfig.check.json'), JSON.stringify(config))
    execFileSync(join(repo, 'node_modules/.bin/tsc'), ['-p', join(dir, 'tsconfig.check.json')], {
      encoding: 'utf8',
      stdio: 'pipe',
    })
  })

  it('nodejs: the dependency range is stamped from the framework release this package carries, so a new app never installs an older one', async () => {
    await runCreate(['ranged', '--template', 'nodejs', '-y'], fakeIo().io)
    const pkg = JSON.parse(readFileSync(join(scratch, 'ranged', 'package.json'), 'utf8'))
    expect(pkg.dependencies).toEqual({ [PACKAGE]: `^${cliVersion}`, typescript: '6.0.3' })
  })

  it('refuses a folder that is not empty and changes nothing', async () => {
    mkdirSync(join(scratch, 'full'), { recursive: true })
    writeFileSync(join(scratch, 'full', 'x.txt'), 'x')
    const s = fakeIo()
    expect(await runCreate(['full', '-y'], s.io)).toBe(1)
    expect(readdirSync(join(scratch, 'full'))).toEqual(['x.txt'])
  })

  it('acryl-app: delegates to the acrylblends command with the agent template', async () => {
    const s = fakeIo()
    expect(await runCreate(['agentic', '--template', 'acryl-app', '-y'], s.io)).toBe(0)
    expect(s.runs[0]?.args.slice(1)).toEqual([
      'init',
      join(scratch, 'agentic'),
      '--template',
      'agent',
      '--name',
      'agentic',
      '--yes',
    ])
  })

  it('installs with the chosen package manager, and asks when it can', async () => {
    const s = fakeIo(['asked-app', 'bun'], true)
    expect(await runCreate(['--install', '--pm', 'pnpm'], s.io)).toBe(0)
    expect(s.runs[0]).toMatchObject({
      command: 'pnpm',
      args: ['install'],
      cwd: join(scratch, 'asked-app'),
    })
    expect(existsSync(join(scratch, 'asked-app', 'src', 'index.ts'))).toBe(true)
  })

  it('exits 2 with help on a usage error, and prints help and version', async () => {
    const s = fakeIo()
    expect(await runCreate(['--template', 'vercel'], s.io)).toBe(2)
    expect(s.err()).toContain('unknown template')
    const h = fakeIo()
    expect(await runCreate(['--help'], h.io)).toBe(0)
    expect(h.out()).toContain(`npm create ${PACKAGE}@latest`)
    expect(TEMPLATES).toEqual(['nodejs', 'notes', 'chat', 'bun', 'acryl-app'])
  })
})
