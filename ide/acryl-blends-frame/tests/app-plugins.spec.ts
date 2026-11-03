import { describe, expect, it } from 'vitest'
import { commitMaker, docSummary, extensionsOff, frameRowState, isFramePlugin, parseBlendRows, setMadeOn, setRowOn } from '../src/app-plugins.ts'
import { filterPlugins, framePluginRow, madeWhen } from '../src/client/plugins-navigator.ts'

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
