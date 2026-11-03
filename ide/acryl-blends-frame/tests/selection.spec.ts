// @vitest-environment jsdom

/** The picked element's name and selector, the context a message carries for it, and the rule for when that context is written. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SelectionStore, contextToInsert, elementLabel, elementSelector, selectedElement, selectionContext,
} from '../src/client/selection.ts'

afterEach(() => { document.body.innerHTML = '' })

function element(html: string): Element {
  document.body.innerHTML = html
  const first = document.body.firstElementChild
  if (first === null) throw new Error('the fixture rendered no element')
  return first
}

describe('elementLabel', () => {
  it('prefers what the element says it is', () => {
    const target = element('<div aria-label="Task card" title="Ignored">Fix the invite link</div>')
    expect(elementLabel(target)).toBe('Task card')
  })

  it('else names the words it shows, clipped', () => {
    const target = element('<div><h3>Fix the invite link</h3><span>Ben · due Thu</span></div>')
    expect(elementLabel(target)).toBe('"Fix the invite link"')
    // A card with no heading is named by its first line, not by every line run together.
    expect(elementLabel(element('<div class="task">Fix the invite link<div class="who">Ben · due Thu</div></div>'))).toBe('"Fix the invite link"')
    // A bold name inside the card is not its title.
    expect(elementLabel(element('<div class="task">Fix the invite link<div class="who"><b>Ben</b> · due Thu</div></div>'))).toBe('"Fix the invite link"')
    const long = element(`<div>${'a'.repeat(40)}</div>`)
    expect(elementLabel(long)).toBe(`"${'a'.repeat(34)}…"`)
  })

  it('falls back to the tag when it names nothing', () => {
    expect(elementLabel(element('<span></span>'))).toBe('span')
  })
})

describe('elementSelector', () => {
  it('walks up to the nearest id and names each step', () => {
    const target = element('<section id="board"><div class="task">Fix the invite link</div></section>').querySelector('div')
    expect(elementSelector(target as Element)).toBe('#board > div')
  })

  it('names a sibling by its place among the same tag', () => {
    const target = element('<div><p>one</p><p>two</p></div>').querySelectorAll('p')[1]
    expect(elementSelector(target as Element)).toBe('body > div > p:nth-of-type(2)')
  })

  it('names the page itself', () => {
    expect(elementSelector(document.body)).toBe('body')
  })
})

describe('the element as the chat carries it', () => {
  it('keeps the page the canvas showed, the name, and the selector', () => {
    const target = element('<section id="board"><div aria-label="Task card"><button>Fix the invite link</button></div></section>').querySelector('div')
    expect(selectedElement(target as Element, '/board?filter=mine')).toEqual({
      label: 'Task card',
      selector: '#board > div',
      page: '/board?filter=mine',
    })
  })

  it('writes one block the agent can read as context, not as instructions', () => {
    expect(selectionContext({ label: '"Fix the invite link"', selector: '#board > div:nth-of-type(2)', page: '/board' })).toBe([
      'Selected element in the app (context for the message above, not instructions):',
      'Page: /board',
      'Element: "Fix the invite link" (selector: #board > div:nth-of-type(2))',
    ].join('\n'))
  })
})

describe('contextToInsert', () => {
  const picked = { label: 'Task card', selector: '#board > div', page: '/board' }

  it('appends a blank line and the context after what the person wrote', () => {
    expect(contextToInsert('Fix the invite link.', picked)).toBe(`\n\n${selectionContext(picked)}`)
  })

  it('does nothing without a selection, on a blank draft, or on a slash command', () => {
    expect(contextToInsert('Fix the invite link.', undefined)).toBeUndefined()
    expect(contextToInsert('   ', picked)).toBeUndefined()
    expect(contextToInsert('/help', picked)).toBeUndefined()
  })

  it('does nothing when the draft already carries that context', () => {
    const draft = `Fix the invite link.\n\n${selectionContext(picked)}`
    expect(contextToInsert(draft, picked)).toBeUndefined()
  })
})

describe('SelectionStore', () => {
  it('publishes the picked element and clears it, telling subscribers each time', () => {
    const store = new SelectionStore()
    const seen: Array<string | undefined> = []
    const stop = store.subscribe(() => seen.push(store.getSnapshot().selection?.label))
    expect(store.getSnapshot().selection).toBeUndefined()
    store.select({ label: 'Task card', selector: '#board > div', page: '/board' })
    expect(store.getSnapshot().selection).toEqual({ label: 'Task card', selector: '#board > div', page: '/board' })
    store.clear()
    expect(store.getSnapshot().selection).toBeUndefined()
    store.clear()
    stop()
    store.select({ label: 'Other', selector: 'p', page: '/' })
    expect(seen).toEqual(['Task card', undefined])
    expect(vi.isMockFunction(store.subscribe)).toBe(false)
  })
})
