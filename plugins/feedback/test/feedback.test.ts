import assert from 'node:assert/strict'
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, test } from 'node:test'
import { frameViewOf } from '../client.js'
import { FeedbackStore, parseNewNote } from '../store.ts'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})
const directory = () => {
  const dir = mkdtempSync(join(tmpdir(), 'feedback-test-'))
  dirs.push(dir)
  return dir
}

describe('a note from a page', () => {
  test('keeps the note, the page and the element it was pinned on', () => {
    assert.deepEqual(parseNewNote({ text: ' Due date is cut off ', page: '/app/', element: { selector: 'main > li:nth-of-type(2)', label: 'li "Fix the invite link"' } }), {
      text: 'Due date is cut off',
      page: '/app/',
      element: { selector: 'main > li:nth-of-type(2)', label: 'li "Fix the invite link"' },
    })
    assert.deepEqual(parseNewNote({ text: 'Can I see only my tasks?', page: '/' }), { text: 'Can I see only my tasks?', page: '/' })
  })

  test('says what is wrong with a note it refuses', () => {
    assert.equal(parseNewNote({ text: '  ', page: '/' }), 'write a note')
    assert.equal(parseNewNote({ text: 'x', page: 'https://elsewhere' }), 'the page must be a path')
    assert.equal(parseNewNote({ text: 'x'.repeat(2001), page: '/' }), 'a note has at most 2000 characters')
    assert.equal(parseNewNote({ text: 'x', page: '/', element: { selector: '' } }), 'the element needs a selector')
    assert.equal(parseNewNote('x'), 'send a JSON object')
  })
})

describe('the notes', () => {
  test('lists them newest first, and remembers which the builder has seen', async () => {
    const store = new FeedbackStore(directory())
    const first = await store.add({ text: 'one', page: '/' }, new Date('2026-11-03T10:00:00Z'))
    const second = await store.add({ text: 'two', page: '/' }, new Date('2026-11-03T11:00:00Z'))
    assert.deepEqual((await store.list()).map(note => [note.text, note.seen]), [['two', false], ['one', false]])
    await store.markSeen([first.id])
    assert.deepEqual((await store.list()).map(note => [note.id, note.seen]), [[second.id, false], [first.id, true]])
  })

  test('skips a torn line and reads an empty store as no notes', async () => {
    const dir = directory()
    const store = new FeedbackStore(dir)
    assert.deepEqual(await store.list(), [])
    await store.add({ text: 'kept', page: '/' })
    appendFileSync(join(dir, 'notes.jsonl'), '{"id":"x","te')
    assert.deepEqual((await store.list()).map(note => note.text), ['kept'])
  })
})

describe('the frame view', () => {
  test('is the handle a same-origin parent publishes, and nothing when the page is opened directly', () => {
    const handle = { mode: 'build' }
    assert.equal(frameViewOf({ parent: { [Symbol.for('acryl.frame.view')]: handle } }), handle)
    const top: { parent: unknown } = { parent: undefined }
    top.parent = top
    assert.equal(frameViewOf(top), undefined)
    const crossOrigin = { get parent(): unknown { throw new Error('cross-origin') } }
    assert.equal(frameViewOf(crossOrigin), undefined)
  })
})
