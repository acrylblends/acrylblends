import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  bumpPackageVersion, commitMaker, docSummary, extensionsOff, frameRowState, isFramePlugin, packageAppPlugin, parseBlendRows, pluginPackageManifest,
  readAppPlugins, readSharedRecords, recordShare, setMadeOn, setRowOn, switchAppPlugin,
} from '../src/app-plugins.ts'
import { appPluginRow, createAppPluginsApi, filterPlugins, framePluginRow, madeWhen } from '../src/client/plugins-navigator.ts'
import { feedbackPlace, feedbackTask } from '../src/client/feedback.ts'
import { parseAppPluginsView, parseFeedbackView } from '../src/contract.ts'

const BLEND = `spec:
  runtime: cordis
  rows:
    - id: tasks
      name: tasks
      config:
        store: "{{parameters.taskStore}}"
    # The agent's model.
    - id: model
      name: model
    - id: extensions
      name: extensions
      config:
        approval: "{{parameters.approval}}"
    # The panel: a chat button on every page.
    - id: agent-panel
      name: agent-panel
`

describe('blend.yaml rows', () => {
  it('reads each row with the comment above it', () => {
    expect(parseBlendRows(BLEND).map(row => [row.id, row.name, row.disabled, row.comment])).toEqual([
      ['tasks', 'tasks', false, ''],
      ['model', 'model', false, "The agent's model."],
      ['extensions', 'extensions', false, ''],
      ['agent-panel', 'agent-panel', false, 'The panel: a chat button on every page.'],
    ])
  })

  it('switches a row off and on again, leaving every other line as it was', () => {
    const off = setRowOn(BLEND, 'model', false)
    expect(off).toContain('    - id: model\n      disabled: true\n      name: model\n')
    expect(parseBlendRows(off).find(row => row.id === 'model')?.disabled).toBe(true)
    expect(setRowOn(off, 'model', true)).toBe(BLEND)
    expect(() => setRowOn(BLEND, 'nope', false)).toThrow('no row')
  })

  it('keeps a plugin from plugins/ off in the extensions row, and drops the list when none is off', () => {
    const off = setMadeOn(BLEND, 'due-dates', false)
    expect(off).toContain('      config:\n        off: [due-dates]\n        approval:')
    expect(extensionsOff(setMadeOn(off, 'board-mobile', false))).toEqual(['due-dates', 'board-mobile'])
    expect(setMadeOn(off, 'due-dates', true)).toBe(BLEND)
  })
})

describe('the plugins navigator', () => {
  it('names the agent of a co-authored commit as the maker', () => {
    expect(commitMaker('Ana', 'feat: due dates\n\nCo-Authored-By: Claude <noreply@anthropic.com>')).toBe('Claude')
    expect(commitMaker('Ana', 'feat: due dates')).toBe('Ana')
  })

  it('lists the frame plugins around the app, not the rows that run it', () => {
    expect(isFramePlugin('acryl-versions', 'acryl-versions')).toBe(true)
    expect(isFramePlugin('./frame/app-plugins.mjs', 'app-plugins')).toBe(false)
    expect(isFramePlugin('@deepseek-ai/dsh-agent', 'agent')).toBe(false)
  })

  it('says when a plugin was made, and filters by group and text', () => {
    const now = new Date('2026-11-03T15:00:00')
    expect(madeWhen('2026-11-03T09:00:00', now)).toBe('today')
    expect(madeWhen('2026-11-02T09:00:00', now)).toBe('yesterday')
    const row = framePluginRow({ id: 'acryl-versions', name: 'acryl-versions', version: '0.1.0', description: 'Versions', state: 'active' })
    expect(row.toggle).toBeUndefined()
    expect(row.by).toBe('frame · v0.1.0')
    expect(filterPlugins([row], 'versions', 'frame')).toEqual([row])
    expect(filterPlugins([row], '', 'made')).toEqual([])
  })

  it('reads a frame row\'s state from its fiber', () => {
    expect(frameRowState({ id: 'a', name: 'acryl-a', disabled: false, fiberState: 2 })).toBe('active')
    expect(frameRowState({ id: 'a', name: 'acryl-a', disabled: false, fiberState: 0 })).toBe('waiting')
    expect(frameRowState({ id: 'a', name: 'acryl-a', disabled: false, fiberState: 3 })).toBe('failed')
    expect(frameRowState({ id: 'a', name: 'acryl-a', disabled: true, fiberState: undefined })).toBe('off')
  })

  it('describes a library plugin by the first sentence of its doc comment', () => {
    expect(docSummary('/**\n * The extensions service (`ctx.extensions`): install and reload plugins. More here.\n *\n * Later.\n */\nexport {}'))
      .toBe('The extensions service (ctx.extensions): install and reload plugins.')
    expect(docSummary('export const x = 1')).toBe('')
  })
})

describe('the app\'s own plugins', () => {
  const noGit = { run: () => Promise.reject(new Error('not a repository')) }

  it('lists a plugin its blend.yaml row mounts once, as made, and switches it by that row', async () => {
    const root = mkdtempSync(join(tmpdir(), 'frame-own-'))
    try {
      for (const name of ['notes', 'loose', 'home']) {
        mkdirSync(join(root, 'plugins', name), { recursive: true })
        writeFileSync(join(root, 'plugins', name, 'index.ts'), `/** The ${name} plugin. */\nexport function apply() {}\n`)
      }
      writeFileSync(join(root, 'plugins', 'library.json'), '{"plugins":["home"]}\n')
      writeFileSync(join(root, 'blend.yaml'), 'spec:\n  rows:\n    - id: home\n      name: home\n    - id: notes\n      name: notes\n    - id: extensions\n      name: extensions\n')
      const listed = await readAppPlugins(root, noGit)
      expect(listed.map(plugin => [plugin.name, plugin.kind, plugin.on])).toEqual([
        ['loose', 'made', true],
        ['notes', 'made', true],
        ['home', 'row', true],
        ['extensions', 'row', true],
      ])
      await switchAppPlugin(root, 'made', 'notes', false)
      const text = readFileSync(join(root, 'blend.yaml'), 'utf8')
      expect(parseBlendRows(text).find(row => row.id === 'notes')?.disabled).toBe(true)
      expect(extensionsOff(text)).toEqual([])
      expect((await readAppPlugins(root, noGit)).find(plugin => plugin.name === 'notes')?.on).toBe(false)
      await switchAppPlugin(root, 'made', 'loose', false)
      expect(extensionsOff(readFileSync(join(root, 'blend.yaml'), 'utf8'))).toEqual(['loose'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('sharing a local plugin', () => {
  const plugin = { name: 'hello-share', kind: 'made' as const, by: 'Ana', at: '2026-11-03T09:00:00', description: 'A shared plugin', on: true }
  const where = { url: 'https://github.com/inboxxobni/hello-share', version: '0.1.0' }

  it('offers Share on a local row, and a shared row shows where it went', () => {
    const share = () => Promise.resolve({ status: 'shared' as const, ...where })
    expect(appPluginRow(plugin, () => Promise.resolve(), share).share).toBe(share)
    expect(appPluginRow({ ...plugin, shared: where }, () => Promise.resolve()).shared).toEqual(where)
    // A library row is already published by its library; it is not shared from the app.
    const library = { name: 'tasks', kind: 'row' as const, description: 'Tasks', version: '1.0.0', on: true }
    expect(appPluginRow(library, () => Promise.resolve(), share).share).toBeUndefined()
  })

  it('packages a local plugin the way the builder does, and remembers only a completed share', async () => {
    const root = mkdtempSync(join(tmpdir(), 'frame-share-'))
    try {
      mkdirSync(join(root, 'plugins', 'hello-share'), { recursive: true })
      writeFileSync(join(root, 'plugins', 'hello-share', 'index.ts'), '/** A shared plugin: says hello. */\nexport function apply() {}\n')
      writeFileSync(join(root, 'plugins', 'library.json'), '{"plugins":[]}\n')
      const dir = await packageAppPlugin(root, 'hello-share')
      const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Record<string, unknown>
      expect(manifest.name).toBe('hello-share')
      expect(manifest.version).toBe('0.1.0')
      expect(manifest.peerDependencies).toEqual({ '@deepseek-ai/cordis': '4.0.4' })
      expect(manifest.dsh).toEqual({ bundle: { patch: './cordis.patch.yml' } })
      expect(readFileSync(join(dir, 'cordis.patch.yml'), 'utf8')).toContain('id: hello-share')
      expect(readFileSync(join(dir, 'index.ts'), 'utf8')).toContain('A shared plugin')
      const records = join(root, 'shared-plugins.json')
      expect(await readSharedRecords(records)).toEqual({})
      await recordShare(records, 'hello-share', where)
      expect(await readSharedRecords(records)).toEqual({ 'hello-share': where })
      expect(await readSharedRecords(join(root, 'missing.json'))).toEqual({})
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
    expect(pluginPackageManifest('hello-share', 'd').keywords).toEqual(['cordis', 'cordis-plugin', 'acrylblends'])
  })

  it('posts a share and keeps only the repository and version the Host answers', async () => {
    const calls: Array<{ url: string; body: string }> = []
    const api = createAppPluginsApi(async (url, init) => {
      calls.push({ url, body: String(init?.body) })
      return new Response(JSON.stringify({ url: where.url, version: where.version, owner: 'inboxxobni', repo: 'hello-share', tag: 'v0.1.0' }), { status: 200 })
    })
    expect(await api.share('hello-share')).toEqual({ status: 'shared', ...where })
    expect(calls[0]?.url).toBe('/api/acryl-blends-frame/plugins/share')
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ name: 'hello-share' })
    const failed = createAppPluginsApi(async () => new Response(JSON.stringify({ error: 'it could not be shared' }), { status: 409 }))
    await expect(failed.share('hello-share')).rejects.toThrow('it could not be shared')
  })

  it('asks before bumping a released version, and sends the bump on the second call', async () => {
    const bodies: string[] = []
    const api = createAppPluginsApi(async (_url, init) => {
      bodies.push(String(init?.body))
      const bump = JSON.parse(String(init?.body)) as { bump?: boolean }
      return new Response(JSON.stringify(bump.bump === true
        ? { status: 'shared', url: where.url, version: '0.1.3' }
        : { status: 'released', version: '0.1.2', nextVersion: '0.1.3' }), { status: 200 })
    })
    expect(await api.share('hello-share')).toEqual({ status: 'released', version: '0.1.2', nextVersion: '0.1.3' })
    expect(await api.share('hello-share', { bump: true })).toEqual({ status: 'shared', url: where.url, version: '0.1.3' })
    expect(JSON.parse(bodies[0] ?? '{}')).toEqual({ name: 'hello-share' })
    expect(JSON.parse(bodies[1] ?? '{}')).toEqual({ name: 'hello-share', bump: true })
  })

  it('bumps a package folder one patch and writes it back', async () => {
    const root = mkdtempSync(join(tmpdir(), 'frame-bump-'))
    try {
      writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'hello-share', version: '1.2.3' }))
      expect(await bumpPackageVersion(root)).toBe('1.2.4')
      expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version).toBe('1.2.4')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('keeps the share record in the plugin list the page reads', () => {
    const view = parseAppPluginsView({
      plugins: [{ name: 'hello-share', kind: 'made', description: 'A shared plugin', on: true, shared: where }],
      frame: [],
    })
    expect(view.plugins[0]?.shared).toEqual(where)
  })
})

describe('feedback screenshots', () => {
  it('keeps a note screenshot in the view, and drops a malformed one', () => {
    const view = parseFeedbackView({
      available: true,
      notes: [{
        id: 'n1', at: '2026-11-03T10:00:00Z', text: 'cut off', page: '/app/', seen: false,
        screenshot: { mediaType: 'image/webp', width: 800, height: 600 },
      }],
    })
    expect(view.notes[0]?.screenshot).toEqual({ mediaType: 'image/webp', width: 800, height: 600 })
    const broken = parseFeedbackView({
      available: true,
      notes: [{ id: 'n2', at: '2026-11-03T10:00:00Z', text: 'x', page: '/', seen: false, screenshot: { mediaType: 'image/gif', width: 1, height: 1 } }],
    })
    expect(broken.notes[0]?.screenshot).toBeUndefined()
  })
})

describe('feedback from users', () => {
  const note = { id: 'n1', at: '2026-11-03T10:00:00Z', text: 'Due date is "cut off"', page: '/app/board?x=1', element: { selector: 'li:nth-of-type(2)', label: 'li "Fix the invite link"' }, seen: false }

  it('names the page a note came from', () => {
    expect(feedbackPlace(note, '/app')).toBe('board page')
    expect(feedbackPlace({ page: '/app/' }, '/app')).toBe('Home page')
  })

  it('hands an agent the page, the element and the note quoted as data', () => {
    const task = feedbackTask(note)
    expect(task).toContain('Page: /app/board?x=1')
    expect(task).toContain('Element: li "Fix the invite link" (selector: li:nth-of-type(2))')
    expect(task).toContain('"Due date is \\"cut off\\""')
    const { element: _pinned, ...general } = note
    expect(feedbackTask(general)).toContain('Element: nothing specific')
  })

  it("reads the Host's answer, and no section without the plugin", () => {
    expect(parseFeedbackView({ available: false, notes: [] })).toEqual({ available: false, notes: [] })
    expect(parseFeedbackView({ available: true, notes: [note] }).notes[0]?.element?.label).toBe('li "Fix the invite link"')
    expect(() => parseFeedbackView({ available: true, notes: [{ id: 1 }] })).toThrow('note')
  })
})
