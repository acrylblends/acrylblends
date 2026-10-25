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
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { type Io, runCreate, TEMPLATE_MANIFEST } from '../src/index'
import { type Fetchers, parseSource } from '../src/source'

const scratch = mkdtempSync(join(tmpdir(), 'create-source-test-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

let counter = 0
/** A packed template: `top/` holding the files, as `tar.gz`, the way GitHub and `npm pack` lay out an archive. */
function pack(
  files: Record<string, string>,
  top = 'package',
  extra?: (dir: string) => void,
): string {
  const root = join(scratch, `pack-${counter++}`)
  const dir = join(root, top)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  extra?.(dir)
  const out = join(root, 'template.tgz')
  execFileSync('tar', ['-czf', out, '-C', root, top])
  return out
}

const manifest = (extra: object = {}) =>
  JSON.stringify({ name: 'hello', description: 'a hello app', ...extra })
const app = (scripts: Record<string, string> = { test: 'node --test' }) => ({
  [TEMPLATE_MANIFEST]: manifest(),
  'package.json': JSON.stringify({
    name: 'x',
    scripts,
    dependencies: { acrylblends: '^0.0.1' },
  }),
  gitignore: 'node_modules/\n',
  'src/app.ts': "export const hello = '__APP_NAME__ on __PACKAGE__'\n",
})

function fakeIo(fetchers?: Partial<Fetchers>) {
  let out = ''
  let err = ''
  const runs: { command: string; args: string[] }[] = []
  const io: Io = {
    stdout: { write: (t) => (out += t) },
    stderr: { write: (t) => (err += t) },
    cwd: scratch,
    env: {},
    ask: undefined,
    run: async (command, args) => {
      runs.push({ command, args })
      return 0
    },
    fetchers: {
      download: async () => {
        throw new Error('no network in tests')
      },
      pack: () => {
        throw new Error('no npm in tests')
      },
      ...fetchers,
    },
  }
  return { io, out: () => out, err: () => err, runs }
}

describe('template sources', () => {
  it('recognises the three forms and refuses malformed ones', () => {
    expect(parseSource('github:acme/starter#v1', scratch)).toEqual({
      kind: 'github',
      owner: 'acme',
      repo: 'starter',
      ref: 'v1',
    })
    expect(parseSource('github:acme/starter', scratch)).toMatchObject({ ref: undefined })
    expect(parseSource('@acme/starter@1.2.0', scratch)).toEqual({
      kind: 'npm',
      spec: '@acme/starter@1.2.0',
    })
    expect(parseSource('some-name', scratch)).toBeUndefined()
    expect(() => parseSource('github:acme', scratch)).toThrow(/github:owner\/repo/)
    expect(() => parseSource('@acme', scratch)).toThrow(/@scope\/name/)
    expect(() => parseSource('./missing.tgz', scratch)).toThrow(/does not exist/)
  })

  it('creates an app from a packed tarball: files, placeholders, name, framework range, docs; no manifest copied', async () => {
    const tgz = pack(app())
    const s = fakeIo()
    expect(await runCreate(['from-tgz', tgz], s.io)).toBe(0)
    const dir = join(scratch, 'from-tgz')
    expect(readFileSync(join(dir, 'src/app.ts'), 'utf8')).toBe(
      "export const hello = 'from-tgz on acrylblends'\n",
    )
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    expect(pkg.name).toBe('from-tgz')
    expect(pkg.dependencies.acrylblends).toMatch(/^\^\d+\.\d+\.\d+/)
    expect(pkg.dependencies.acrylblends).not.toBe('^0.0.1')
    expect(existsSync(join(dir, '.gitignore'))).toBe(true)
    expect(existsSync(join(dir, TEMPLATE_MANIFEST))).toBe(false)
    expect(existsSync(join(dir, 'docs/framework/README.md'))).toBe(true)
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).toContain('a hello app')
    expect(s.out()).toContain('created from-tgz from hello')
    expect(s.runs).toEqual([]) // nothing installed or run
  })

  it('fetches a GitHub source as a tarball from codeload, never a clone', async () => {
    const tgz = pack(app(), 'starter-main')
    const urls: string[] = []
    const s = fakeIo({
      download: async (url) => {
        urls.push(url)
        return new Uint8Array(readFileSync(tgz))
      },
    })
    expect(await runCreate(['from-github', 'github:acme/starter#v2'], s.io)).toBe(0)
    expect(urls).toEqual(['https://codeload.github.com/acme/starter/tar.gz/v2'])
    expect(existsSync(join(scratch, 'from-github/src/app.ts'))).toBe(true)
    expect(s.runs).toEqual([])
  })

  it('packs an npm source without running its scripts', async () => {
    const tgz = pack(app())
    const packed: string[] = []
    const s = fakeIo({
      pack: (spec) => {
        packed.push(spec)
        return tgz
      },
    })
    expect(await runCreate(['from-npm', '@acme/starter'], s.io)).toBe(0)
    expect(packed).toEqual(['@acme/starter'])
  })

  it('refuses a source without the manifest, with a clear message, and creates nothing', async () => {
    const { [TEMPLATE_MANIFEST]: _omit, ...without } = app()
    const s = fakeIo()
    expect(await runCreate(['no-manifest', pack(without)], s.io)).toBe(1)
    expect(s.err()).toContain(`no ${TEMPLATE_MANIFEST}`)
    expect(s.err()).toContain('nothing was changed')
    expect(existsSync(join(scratch, 'no-manifest'))).toBe(false)
    const bad = fakeIo()
    expect(
      await runCreate(
        ['bad-manifest', pack({ ...app(), [TEMPLATE_MANIFEST]: '{"name":"x"}' })],
        bad.io,
      ),
    ).toBe(1)
    expect(bad.err()).toContain('"description"')
  })

  it('does not run a postinstall script without --install, says it exists, and lists the scripts when --install is given', async () => {
    const tgz = pack(app({ test: 'node --test', postinstall: 'node setup.js' }))
    const without = fakeIo()
    expect(await runCreate(['scripts-off', tgz], without.io)).toBe(0)
    expect(without.runs).toEqual([])
    expect(without.out()).toContain('nothing was installed or run')
    expect(without.out()).toContain('postinstall: node setup.js')

    const withInstall = fakeIo()
    expect(await runCreate(['scripts-on', tgz, '--install', '--pm', 'npm'], withInstall.io)).toBe(0)
    expect(withInstall.runs).toEqual([{ command: 'npm', args: ['install'] }])
    // The list is printed before the install runs.
    expect(withInstall.out()).toContain("runs the template's own lifecycle scripts")
    expect(withInstall.out()).toContain('postinstall: node setup.js')
    expect(withInstall.out()).toContain('This installs: acrylblends')
  })

  it('refuses a template that holds a secret, and one that holds a symbolic link', async () => {
    const secret = fakeIo()
    expect(
      await runCreate(
        [
          'secret',
          pack({
            ...app(),
            'src/config.ts': "export const config = { password: 'hunter2hunter2' }\n",
          }),
        ],
        secret.io,
      ),
    ).toBe(1)
    expect(secret.err()).toContain('secret')
    expect(secret.err()).toContain('src/config.ts')
    expect(secret.err()).not.toContain('hunter2')
    expect(existsSync(join(scratch, 'secret'))).toBe(false)

    const link = fakeIo()
    const tgz = pack(app(), 'package', (dir) => symlinkSync('/etc/passwd', join(dir, 'passwd')))
    expect(await runCreate(['linked', tgz], link.io)).toBe(1)
    expect(link.err()).toContain('symbolic link')
    expect(existsSync(join(scratch, 'linked'))).toBe(false)
  })

  it('refuses a non-empty target, an unknown source, and a source together with --template', async () => {
    const tgz = pack(app())
    mkdirSync(join(scratch, 'busy'))
    writeFileSync(join(scratch, 'busy/x'), '')
    const busy = fakeIo()
    expect(await runCreate(['busy', tgz], busy.io)).toBe(1)
    expect(readdirSync(join(scratch, 'busy'))).toEqual(['x'])
    expect(await runCreate(['odd', 'whatever'], fakeIo().io)).toBe(2)
    expect(await runCreate(['both', tgz, '--template', 'nodejs'], fakeIo().io)).toBe(2)
  })

  it('tells which plugins a template needs', async () => {
    const tgz = pack({ ...app(), [TEMPLATE_MANIFEST]: manifest({ plugins: ['desktop'] }) })
    const s = fakeIo()
    expect(await runCreate(['needs', tgz], s.io)).toBe(0)
    expect(s.out()).toContain('npx acrylblends add desktop')
  })
})
