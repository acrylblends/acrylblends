import { describe, expect, it } from 'vitest'
import { countChanges, parseBranches, parseFrameState } from '../src/index.ts'
import { chatRows, chatTitle } from '../src/client/chats.ts'
import { savedLabel, versionNumber } from '../src/client/versions.ts'
import { displayMatch, fuzzySearch } from '../src/client/fuzzy.ts'
import { highlightLine, languageOf } from '../src/client/highlight.ts'
import { FILES_TAB, FIRST_RUN_TABS, FrameTabs, fileTab, parseStoredTabs, ptyTab, terminalMeta } from '../src/client/tabs.ts'
import { FIRST_RUN_VIEW, FrameViewState, parseStoredView, type ViewStorage } from '../src/client/view-state.ts'

describe('parseBranches', () => {
  it('puts the checked-out branch first and the rest by name', () => {
    expect(parseBranches('  zeta\n* main\n  alpha\n')).toEqual([
      { name: 'main', current: true },
      { name: 'alpha', current: false },
      { name: 'zeta', current: false },
    ])
  })

  it('reads no branches from an empty repository', () => {
    expect(parseBranches('')).toEqual([])
  })
})

describe('countChanges', () => {
  it('counts each changed path once, a rename as one', () => {
    expect(countChanges(' M src/a.ts\0?? notes.md\0R  new.ts\0old.ts\0')).toBe(3)
    expect(countChanges('')).toBe(0)
  })
})

describe('the bar label', () => {
  it('says saved only when nothing changed since the last version', () => {
    expect(savedLabel(0)).toBe('saved')
    expect(savedLabel(3)).toBe('3 unsaved')
    expect(savedLabel(undefined)).toBeUndefined()
  })
})

describe('parseFrameState', () => {
  const state = { appName: 'todo', appRoot: '/apps/todo', appPage: '/app', branches: [{ name: 'main', current: true }] }

  it('accepts a frame state', () => {
    expect(parseFrameState(state)).toEqual(state)
  })

  it('keeps a state without an app page', () => {
    expect(parseFrameState({ ...state, appPage: undefined })).toEqual({ appName: 'todo', appRoot: '/apps/todo', branches: state.branches })
  })

  it('names the bad field', () => {
    expect(() => parseFrameState({ ...state, appPage: 'app' })).toThrow('appPage')
    expect(() => parseFrameState({ ...state, appName: '' })).toThrow('appName')
    expect(() => parseFrameState({ ...state, branches: [{ name: 'main' }] })).toThrow('branch')
    expect(() => parseFrameState(null)).toThrow('not an object')
    expect(() => parseFrameState({ ...state, unsaved: -1 })).toThrow('unsaved')
    expect(() => parseFrameState({ ...state, head: '' })).toThrow('head')
  })
})

class MemoryStorage implements ViewStorage {
  readonly values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
}

describe('the frame view', () => {
  it('opens both panels in Build on the first run', () => {
    expect(new FrameViewState(new MemoryStorage()).getSnapshot()).toEqual({ left: true, right: true, mode: 'build' })
  })

  it('remembers the person\'s choice for the next page', () => {
    const storage = new MemoryStorage()
    const first = new FrameViewState(storage)
    first.toggleLeft()
    first.setMode('preview')
    expect(new FrameViewState(storage).getSnapshot()).toEqual({ left: false, right: true, mode: 'preview' })
  })

  it('falls back to the first run for a malformed or missing memory', () => {
    expect(parseStoredView('{"left":1}')).toBe(FIRST_RUN_VIEW)
    expect(parseStoredView('not json')).toBe(FIRST_RUN_VIEW)
    expect(parseStoredView(null)).toBe(FIRST_RUN_VIEW)
  })

  it('still changes when the storage throws', () => {
    const throwing: ViewStorage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    const view = new FrameViewState(throwing)
    let told = 0
    view.subscribe(() => { told += 1 })
    view.toggleRight()
    expect(view.getSnapshot().right).toBe(false)
    expect(told).toBe(1)
  })
})

describe('chats', () => {
  it('names a chat by its title, else as a new chat', () => {
    expect(chatTitle({ title: ' Add a due date ' })).toBe('Add a due date')
    expect(chatTitle({ title: '  ' })).toBe('New chat')
    expect(chatTitle({})).toBe('New chat')
  })

  it('marks the chat the main view holds as current', () => {
    const list = {
      ids: ['a', 'b', 'gone'],
      byId: {
        a: { title: 'First', displayTitle: 'First', retainedBy: { mainView: 0 } },
        b: { displayTitle: 'my-project', retainedBy: { mainView: 1 } },
      },
    }
    expect(chatRows(list as never)).toEqual([
      { id: 'a', title: 'First', current: false },
      { id: 'b', title: 'New chat', current: true },
    ])
  })
})

describe('versionNumber', () => {
  it('counts from the first version, newest first in the list', () => {
    const entries = [{}, {}, {}] as never[]
    expect(versionNumber(entries, 0)).toBe(3)
    expect(versionNumber(entries, 2)).toBe(1)
  })
})

describe('fuzzy file search', () => {
  it('matches the letters in order, the file name first, and splits the top folder off for display', () => {
    const [best] = fuzzySearch('brd', ['test/board.test.ts', 'src/board.ts', 'README.md', 'plugins/board-mobile/index.ts'])
    expect(best?.path).toBe('src/board.ts')
    expect(displayMatch(best!)).toEqual({ folder: 'src', parts: [{ text: 'b', hit: true }, { text: 'oa', hit: false }, { text: 'rd', hit: true }, { text: '.ts', hit: false }] })
    expect(fuzzySearch('zzz', ['src/board.ts'])).toEqual([])
  })
})

describe('syntax colours', () => {
  it('colours keywords, calls, strings, types and comments, and leaves a property plain', () => {
    const kinds = highlightLine("export function dueBadge(task: Task) { return task.due ?? 'x' } // note", 'code')
      .filter(token => token.kind !== 'plain').map(token => `${token.kind}:${token.text}`)
    expect(kinds).toEqual(['kw:export', 'kw:function', 'fn:dueBadge', 'pu:(', 'va:task', 'pu::', 'ty:Task', 'pu:)', 'pu:{', 'kw:return', 'va:task', 'pu:.', 'pu:??', "st:'x'", 'pu:}', 'cm:// note'])
    expect(languageOf('blend.yaml')).toBe('hash')
  })
})

describe('the right panel tabs', () => {
  it('keeps the chat first, opens a tab once, and shows the one before a closed tab', () => {
    const storage = new MemoryStorage()
    const tabs = new FrameTabs(storage)
    tabs.open(ptyTab('claude', 't1'))
    tabs.open(FILES_TAB)
    tabs.open(ptyTab('claude', 't1'))
    expect(tabs.getSnapshot().tabs.map(tab => tab.id)).toEqual(['chat', 'pty:t1', 'files'])
    expect(tabs.getSnapshot().active).toBe('pty:t1')
    tabs.close('pty:t1')
    expect(tabs.getSnapshot().active).toBe('chat')
    expect(tabs.close('chat')).toBeUndefined()
    expect(new FrameTabs(storage).getSnapshot()).toEqual({ tabs: [{ kind: 'chat', id: 'chat' }, FILES_TAB], active: 'chat' })
  })

  it('drops what it cannot read back', () => {
    expect(parseStoredTabs('{"tabs":[{"kind":"pty","agent":"nope","terminalId":"x"},{"kind":"file","path":"src/a.ts"}],"active":"gone"}'))
      .toEqual({ tabs: [{ kind: 'chat', id: 'chat' }, fileTab('src/a.ts')], active: 'chat' })
    expect(parseStoredTabs('nonsense')).toBe(FIRST_RUN_TABS)
  })
})

describe('a terminal row', () => {
  it('names the command a shell runs, or the folder of an idle prompt', () => {
    expect(terminalMeta('npm test')).toBe('npm test')
    expect(terminalMeta('ana@laptop:/Users/ana/apps/team-board')).toBe('team-board')
    expect(terminalMeta(undefined)).toBe('')
  })
})

describe('fuzzy ranking', () => {
  it('puts letters close together above letters scattered over a long path', () => {
    const paths = ['docs/framework/cordis/migration-from-0-4.md', 'docs/framework/cordis/acryl-in-a-cordis-app.md', 'src/main.ts', 'plugins/agent-panel/client/main.ts']
    expect(fuzzySearch('mai', paths).map(match => match.path).slice(0, 2)).toEqual(['src/main.ts', 'plugins/agent-panel/client/main.ts'])
  })
})
