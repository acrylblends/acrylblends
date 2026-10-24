import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  closure,
  copyPlugin,
  type Io,
  isOmitted,
  nameFrom,
  parseInitOptions,
  readLibrary,
  readTemplatePlugins,
  runCli,
  TEMPLATES,
  templatesRoot,
  UsageError,
  VERSION,
} from '../src/index'

const scratch = mkdtempSync(join(tmpdir(), 'acrylblends-cli-test-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

/** A test Io: captures output, answers prompts from a list, and records install calls. */
function fakeIo(options: { answers?: string[]; installCode?: number } = {}) {
  const out: string[] = []
  const err: string[] = []
  const installed: string[] = []
  const answers = options.answers ? [...options.answers] : undefined
  const io: Io = {
    stdout: { write: (text: string) => out.push(text) },
    stderr: { write: (text: string) => err.push(text) },
    cwd: scratch,
    ask: answers ? async () => answers.shift() ?? '' : undefined,
    install: async (directory) => {
      installed.push(directory)
      return options.installCode ?? 0
    },
  }
  return { io, out: () => out.join(''), err: () => err.join(''), installed }
}

const manifest = (dir: string) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))

describe('templates', () => {
  it('are exactly blank, todo and agent', () => {
    expect(readdirSync(templatesRoot()).sort()).toEqual([...TEMPLATES].sort())
  })

  it.each(TEMPLATES)(
    '%s lists library plugins that exist, and declares no dependency of its own',
    (template) => {
      const library = readLibrary()
      for (const name of readTemplatePlugins(join(templatesRoot(), template)))
        expect(library.has(name)).toBe(true)
      expect(manifest(join(templatesRoot(), template)).dependencies).toEqual({})
    },
  )
})

describe('a coding agent in a generated app', () => {
  it.each(TEMPLATES)(
    '%s: docs/framework is inside the app, and AGENTS.md and CLAUDE.md point to it',
    async (template) => {
      const session = fakeIo()
      expect(
        await runCli(['init', `app-${template}`, '--template', template, '-y'], session.io),
      ).toBe(0)
      const dir = join(scratch, `app-${template}`)
      const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf8')
      expect(agents).toContain(`# app-${template}`)
      expect(agents).toContain('docs/framework/README.md')
      expect(agents).not.toContain('__APP_NAME__')
      expect(agents).toContain(`## This app (${template})`)
      expect(readFileSync(join(dir, 'CLAUDE.md'), 'utf8')).toBe('@AGENTS.md\n')
      for (const page of [
        'README.md',
        'api/routing.md',
        'api/request.md',
        'api/context.md',
        'api/summary.md',
        'guides/validation.md',
        'guides/helpers.md',
        'cordis/migration-from-0-4.md',
      ])
        expect(existsSync(join(dir, 'docs/framework', page))).toBe(true)
      expect(existsSync(join(dir, 'docs/framework/upstream.json'))).toBe(false)
      expect(existsSync(join(dir, 'docs/framework/UPSTREAM.md'))).toBe(false)
      expect(existsSync(join(dir, 'AGENTS.md.bak'))).toBe(false)
      // every page the README links exists in the copy
      for (const [, target] of readFileSync(join(dir, 'docs/framework/README.md'), 'utf8').matchAll(
        /\]\((?!http|#)([^)#]+)/g,
      ))
        expect(existsSync(join(dir, 'docs/framework', target as string)), String(target)).toBe(true)
    },
  )
})

describe('library', () => {
  it('orders each plugin after what it requires, without duplicates', () => {
    const names = closure(['acryl-node-server', 'instance', 'acryl-router'], readLibrary()).map(
      (plugin) => plugin.name,
    )
    expect(names).toEqual(['acryl-router', 'acryl-router-http', 'acryl-node-server', 'instance'])
  })

  it('refuses an unknown plugin and names who required it', () => {
    expect(() => closure(['nope'], readLibrary())).toThrow(/no plugin "nope"/)
  })

  it('every plugin states the services it provides and injects, and every injected service has a provider', () => {
    const library = [...readLibrary().values()] as unknown as Array<{
      name: string
      inject: string[]
      provides: string[]
    }>
    const provided = new Set(library.flatMap((plugin) => plugin.provides))
    for (const plugin of library) {
      expect(Array.isArray(plugin.provides) && Array.isArray(plugin.inject), plugin.name).toBe(true)
      for (const service of plugin.inject)
        expect(provided.has(service), `${plugin.name} injects ${service}`).toBe(true)
    }
  })

  it('every plugin depends only on the named run-time packages', () => {
    const allowed = new Set([
      '@deepseek-ai/cordis',
      '@deepseek-ai/schemastery',
      '@webboxes/app-persistence',
      '@webboxes/blends-core',
      'yaml',
    ])
    for (const plugin of readLibrary().values()) {
      for (const name of Object.keys(plugin.dependencies)) expect(allowed.has(name)).toBe(true)
    }
  })
})

describe('vendored framework plugins', () => {
  it('copy their source with the plugins they require, and leave out tests and what an app cannot type-check', () => {
    const library = readLibrary()
    const names = closure(['acryl-state'], library).map((plugin) => plugin.name)
    expect(names).toEqual(['acryl-router', 'acryl-state'])
    const app = mkdtempSync(join(tmpdir(), 'vendored-copy-'))
    try {
      for (const plugin of closure(['acryl-state'], library)) copyPlugin(plugin, app)
      const copied = (path: string) => existsSync(join(app, 'src', 'plugins', path))
      expect(copied('acryl-router/src/index.ts')).toBe(true)
      expect(copied('acryl-state/src/index.ts')).toBe(true)
      expect(copied('acryl-state/upstream.json')).toBe(true)
      expect(copied('acryl-state/src/react.ts')).toBe(false)
      expect(copied('acryl-state/tests')).toBe(false)
      expect(copied('acryl-state/plugin.json')).toBe(false)
    } finally {
      rmSync(app, { recursive: true, force: true })
    }
  })
})

describe('omit patterns', () => {
  it('match exact paths and globs: * within a folder name, ** across folders', () => {
    const omit = ['src/react.ts', '**/*.test.*', '**/*.case.ts', 'fixtures/**']
    for (const path of [
      'src/react.ts',
      'a.test.ts',
      'src/core/app.test.ts',
      'src/core/helper/streaming/sse.test.tsx',
      'src/core/router/common.case.ts',
      'fixtures/data.json',
      'fixtures/deep/er/data.json',
    ])
      expect(isOmitted(path, omit), path).toBe(true)
    for (const path of [
      'src/index.ts',
      'src/core/app.ts',
      'src/core/latest.tsx',
      'src/core/testing.ts',
      'src/core/test/helper.ts',
      'src/react.tsx',
      'fixtures.ts',
    ])
      expect(isOmitted(path, omit), path).toBe(false)
    expect(isOmitted('anything', undefined)).toBe(false)
    expect(isOmitted('a.b', ['a.b'])).toBe(true)
    expect(isOmitted('axb', ['a.b'])).toBe(false)
  })

  it('keep colocated test files out of an app while the sources arrive', () => {
    const library = mkdtempSync(join(tmpdir(), 'omit-lib-'))
    const app = mkdtempSync(join(tmpdir(), 'omit-app-'))
    try {
      const folder = join(library, 'demo')
      mkdirSync(join(folder, 'src', 'core'), { recursive: true })
      writeFileSync(join(folder, 'plugin.json'), '{}')
      writeFileSync(join(folder, 'src', 'index.ts'), 'export {}')
      writeFileSync(join(folder, 'src', 'core', 'app.ts'), 'export {}')
      writeFileSync(join(folder, 'src', 'core', 'app.test.ts'), 'export {}')
      writeFileSync(join(folder, 'src', 'core', 'view.test.tsx'), 'export {}')
      writeFileSync(join(folder, 'src', 'core', 'router.case.ts'), 'export {}')
      copyPlugin(
        {
          name: 'demo',
          description: '',
          requires: [],
          dependencies: {},
          omit: ['**/*.test.*', '**/*.case.ts'],
        },
        app,
        library,
      )
      const copied = (path: string) => existsSync(join(app, 'src', 'plugins', 'demo', path))
      expect(copied('src/index.ts')).toBe(true)
      expect(copied('src/core/app.ts')).toBe(true)
      expect(copied('src/core/app.test.ts')).toBe(false)
      expect(copied('src/core/view.test.tsx')).toBe(false)
      expect(copied('src/core/router.case.ts')).toBe(false)
    } finally {
      rmSync(library, { recursive: true, force: true })
      rmSync(app, { recursive: true, force: true })
    }
  })
})

describe('command line', () => {
  it('prints help and version', async () => {
    const help = fakeIo()
    expect(await runCli(['--help'], help.io)).toBe(0)
    expect(help.out()).toContain('acrylblends init [dir]')
    const version = fakeIo()
    expect(await runCli(['--version'], version.io)).toBe(0)
    expect(version.out()).toBe(`${VERSION}\n`)
  })

  it('exits 2 with help on no command or an unknown one', async () => {
    expect(await runCli([], fakeIo().io)).toBe(2)
    const unknown = fakeIo()
    expect(await runCli(['graph'], unknown.io)).toBe(2)
    expect(unknown.err()).toContain('unknown command "graph"')
  })

  it('parses init flags and rejects bad ones', () => {
    expect(parseInitOptions(['shop', '--agent', '--name', 'my-shop', '-y'])).toEqual({
      directory: 'shop',
      name: 'my-shop',
      template: 'agent',
      install: undefined,
      yes: true,
    })
    expect(parseInitOptions(['--no-agent']).template).toBe('blank')
    expect(parseInitOptions(['x', '--template', 'blank']).template).toBe('blank')
    expect(parseInitOptions(['x', '--template', 'agent', '--agent']).template).toBe('agent')
    expect(parseInitOptions(['x']).template).toBeUndefined()
    expect(() => parseInitOptions(['--agent', '--no-agent'])).toThrow(/not both/)
    expect(() => parseInitOptions(['--template', 'wiki'])).toThrow(/unknown template "wiki"/)
    expect(() => parseInitOptions(['--template', 'blank', '--agent'])).toThrow(/contradicts/)
    expect(() => parseInitOptions(['a', 'b'])).toThrow(UsageError)
    expect(() => parseInitOptions(['--host', 'x'])).toThrow(UsageError)
  })

  it('derives a valid name from a directory', () => {
    expect(nameFrom('/tmp/My Cool_App')).toBe('my-cool-app')
    expect(nameFrom('/tmp/123')).toBe('my-app')
  })
})

describe('init', () => {
  it('copies the blank template with the name filled in', async () => {
    const session = fakeIo()
    expect(await runCli(['init', 'plain', '-y'], session.io)).toBe(0)
    const dir = join(scratch, 'plain')
    expect(manifest(dir).name).toBe('plain')
    expect(readFileSync(join(dir, 'src/routes.ts'), 'utf8')).toContain("APP_NAME = 'plain'")
    expect(existsSync(join(dir, 'src/plugins/instance/index.ts'))).toBe(true)
    for (const plugin of ['acryl-router', 'acryl-router-http', 'acryl-node-server'])
      expect(existsSync(join(dir, 'src/plugins', plugin, 'src/index.ts'))).toBe(true)
    expect(existsSync(join(dir, 'src/plugins/agent'))).toBe(false)
    expect(existsSync(join(dir, 'src/plugins/acryl-router/plugin.json'))).toBe(false)
    expect(existsSync(join(dir, 'src/plugins/acryl-router/tests'))).toBe(false)
    expect(existsSync(join(dir, 'src/plugins/acryl-router/upstream.json'))).toBe(true)
    expect(existsSync(join(dir, '.gitignore'))).toBe(true)
    expect(existsSync(join(dir, 'template.json'))).toBe(false)
    expect(manifest(dir).dependencies).toEqual({
      '@deepseek-ai/cordis': '4.0.4',
      '@deepseek-ai/schemastery': '3.18.4',
      '@webboxes/app-persistence': '0.1.0',
      '@webboxes/blends-core': '0.4.0',
      yaml: '2.9.0',
    })
    expect(existsSync(join(dir, 'blend.yaml'))).toBe(true)
    expect(session.out()).toContain('created plain (blank)')
    expect(session.out()).toContain('cd plain\n  npm install\n  npm run dev')
    expect(session.installed).toEqual([])
  })

  it('copies the template named on the terminal, and refuses an unknown one', async () => {
    const unknown = fakeIo({ answers: ['', 'wiki', 'n'] })
    expect(await runCli(['init', 'nope'], unknown.io)).toBe(2)
    expect(unknown.err()).toContain('unknown template "wiki"')
    expect(existsSync(join(scratch, 'nope'))).toBe(false)
  })

  it('copies the agent template when asked on the terminal', async () => {
    const session = fakeIo({ answers: ['', 'agent', 'n'] })
    expect(await runCli(['init', 'asked'], session.io)).toBe(0)
    expect(existsSync(join(scratch, 'asked/src/plugins/agent/agent.ts'))).toBe(true)
    expect(session.out()).toContain('created asked (agent)')
  })

  it('refuses a non-empty directory and changes nothing', async () => {
    const dir = join(scratch, 'full')
    mkdirSync(dir)
    writeFileSync(join(dir, 'notes.md'), 'mine')
    const session = fakeIo()
    expect(await runCli(['init', 'full', '-y'], session.io)).toBe(1)
    expect(session.err()).toContain('refusing to write')
    expect(readdirSync(dir)).toEqual(['notes.md'])
  })

  it('rejects an invalid name before writing', async () => {
    const session = fakeIo()
    expect(await runCli(['init', 'bad', '--name', 'Bad Name', '-y'], session.io)).toBe(2)
    expect(existsSync(join(scratch, 'bad'))).toBe(false)
  })

  it('installs when asked and reports a failed install', async () => {
    const ok = fakeIo()
    expect(await runCli(['init', 'installed', '-y', '--install'], ok.io)).toBe(0)
    expect(ok.installed).toEqual([join(scratch, 'installed')])
    expect(ok.out()).not.toContain('npm install')
    const failing = fakeIo({ installCode: 1 })
    expect(await runCli(['init', 'install-fails', '-y', '--install'], failing.io)).toBe(1)
    expect(failing.err()).toContain('npm install failed')
  })
})

describe('add and plugins', () => {
  it('adds a plugin to an app, refuses it twice, and refuses a folder that is not an app', async () => {
    expect(await runCli(['init', 'grows', '-y'], fakeIo().io)).toBe(0)
    const dir = join(scratch, 'grows')
    const first = fakeIo()
    expect(await runCli(['add', 'agent', '--dir', dir], first.io)).toBe(0)
    expect(existsSync(join(dir, 'src/plugins/agent/index.ts'))).toBe(true)
    expect(first.out()).toContain('added agent')
    const again = fakeIo()
    expect(await runCli(['add', 'agent', '--dir', dir], again.io)).toBe(1)
    expect(again.err()).toContain('already has src/plugins/agent')
    const nowhere = fakeIo()
    expect(await runCli(['add', 'agent', '--dir', join(scratch, 'missing')], nowhere.io)).toBe(1)
    expect(nowhere.err()).toContain('is not an app')
  })

  it('brings an external plugin folder into the app extensions, and refuses one without an entry', async () => {
    expect(await runCli(['init', 'outside', '-y'], fakeIo().io)).toBe(0)
    const app = join(scratch, 'outside')
    const external = join(scratch, 'my-plugin')
    mkdirSync(external)
    writeFileSync(
      join(external, 'index.ts'),
      "export const name = 'my-plugin'\nexport function apply() {}\n",
    )
    writeFileSync(
      join(external, 'package.json'),
      JSON.stringify({ name: '@me/my-plugin', dependencies: { left: '1.0.0' } }),
    )
    const session = fakeIo()
    expect(await runCli(['add', external, '--dir', app], session.io)).toBe(0)
    expect(existsSync(join(app, 'extensions/my-plugin/index.ts'))).toBe(true)
    expect(session.out()).toContain('it uses left')
    const again = fakeIo()
    expect(await runCli(['add', external, '--dir', app], again.io)).toBe(1)
    const empty = join(scratch, 'empty-plugin')
    mkdirSync(empty)
    const refused = fakeIo()
    expect(await runCli(['add', empty, '--dir', app], refused.io)).toBe(1)
    expect(refused.err()).toContain('has no index.ts')
  })

  it('lists the library', async () => {
    const session = fakeIo()
    expect(await runCli(['plugins'], session.io)).toBe(0)
    expect(session.out()).toMatch(/^acryl-node-server .*requires acryl-router, acryl-router-http/m)
  })
})
