import assert from 'node:assert/strict'
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, test } from 'node:test'
import { frameViewOf, shotSize } from '../client.js'
import { FeedbackStore, LIMITS, parseNewNote, parseScreenshot } from '../store.ts'

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
    assert.deepEqual(
      parseNewNote({
        text: ' Due date is cut off ',
        page: '/app/',
        element: { selector: 'main > li:nth-of-type(2)', label: 'li "Fix the invite link"' },
      }),
      {
        text: 'Due date is cut off',
        page: '/app/',
        element: { selector: 'main > li:nth-of-type(2)', label: 'li "Fix the invite link"' },
      },
    )
    assert.deepEqual(parseNewNote({ text: 'Can I see only my tasks?', page: '/' }), {
      text: 'Can I see only my tasks?',
      page: '/',
    })
  })

  test('says what is wrong with a note it refuses', () => {
    assert.equal(parseNewNote({ text: '  ', page: '/' }), 'write a note')
    assert.equal(parseNewNote({ text: 'x', page: 'https://elsewhere' }), 'the page must be a path')
    assert.equal(
      parseNewNote({ text: 'x'.repeat(2001), page: '/' }),
      'a note has at most 2000 characters',
    )
    assert.equal(
      parseNewNote({ text: 'x', page: '/', element: { selector: '' } }),
      'the element needs a selector',
    )
    assert.equal(parseNewNote('x'), 'send a JSON object')
  })
})

describe('the notes', () => {
  test('lists them newest first, and remembers which the builder has seen', async () => {
    const store = new FeedbackStore(directory())
    const first = await store.add({ text: 'one', page: '/' }, new Date('2026-11-03T10:00:00Z'))
    const second = await store.add({ text: 'two', page: '/' }, new Date('2026-11-03T11:00:00Z'))
    assert.deepEqual(
      (await store.list()).map((note) => [note.text, note.seen]),
      [
        ['two', false],
        ['one', false],
      ],
    )
    await store.markSeen([first.id])
    assert.deepEqual(
      (await store.list()).map((note) => [note.id, note.seen]),
      [
        [second.id, false],
        [first.id, true],
      ],
    )
  })

  test('skips a torn line and reads an empty store as no notes', async () => {
    const dir = directory()
    const store = new FeedbackStore(dir)
    assert.deepEqual(await store.list(), [])
    await store.add({ text: 'kept', page: '/' })
    appendFileSync(join(dir, 'notes.jsonl'), '{"id":"x","te')
    assert.deepEqual(
      (await store.list()).map((note) => note.text),
      ['kept'],
    )
  })
})

describe('the frame view', () => {
  test('is the handle a same-origin parent publishes, and nothing when the page is opened directly', () => {
    const handle = { mode: 'build' }
    assert.equal(frameViewOf({ parent: { [Symbol.for('acryl.frame.view')]: handle } }), handle)
    const top: { parent: unknown } = { parent: undefined }
    top.parent = top
    assert.equal(frameViewOf(top), undefined)
    const crossOrigin = {
      get parent(): unknown {
        throw new Error('cross-origin')
      },
    }
    assert.equal(frameViewOf(crossOrigin), undefined)
  })
})

describe('a screenshot with a note', () => {
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP'), Buffer.from([0, 0, 0, 0])])
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
  const dataUrl = (type: string, bytes: Buffer) => `data:${type};base64,${bytes.toString('base64')}`

  test('reads a WebP or PNG with its size, and refuses anything else with a reason', () => {
    const shot = parseScreenshot({ data: dataUrl('image/webp', webp), width: 800, height: 600 })
    assert.equal(typeof shot === 'string' ? shot : shot.mediaType, 'image/webp')
    assert.deepEqual(parseScreenshot({ data: dataUrl('image/png', png), width: 10, height: 12 }), {
      mediaType: 'image/png', width: 10, height: 12, data: png,
    })
    assert.match(String(parseScreenshot({ data: dataUrl('image/gif', png), width: 1, height: 1 })), /WebP or PNG/)
    assert.match(String(parseScreenshot({ data: dataUrl('image/webp', png), width: 1, height: 1 })), /not the image/)
    assert.match(String(parseScreenshot({ data: dataUrl('image/webp', webp), width: 0, height: 1 })), /size/)
    assert.match(String(parseScreenshot({ data: `data:image/webp;base64,${Buffer.alloc(LIMITS.screenshotBytes + 1).toString('base64')}`, width: 1, height: 1 })), /at most/)
  })

  test('a note carries its screenshot to the store, which serves the bytes back', async () => {
    const dir = directory()
    const store = new FeedbackStore(dir)
    const note = parseNewNote({ text: 'the button is cut', page: '/app/', screenshot: { data: dataUrl('image/webp', webp), width: 800, height: 600 } })
    assert.equal(typeof note, 'object')
    const stored = await store.add(note as Exclude<typeof note, string>)
    assert.equal(stored.screenshot?.mediaType, 'image/webp')
    assert.equal(stored.screenshot?.width, 800)
    assert.equal(stored.screenshot?.bytes, webp.length)
    const listed = await store.list()
    assert.deepEqual(listed[0]?.screenshot, stored.screenshot)
    assert.deepEqual(await store.screenshot(stored.id), { bytes: webp, mediaType: 'image/webp' })
    assert.equal(await store.screenshot('not-an-id'), undefined)
  })

  test('a note without a screenshot stays exactly as it was', async () => {
    const dir = directory()
    const store = new FeedbackStore(dir)
    const stored = await store.add({ text: 'no picture', page: '/' })
    assert.equal(stored.screenshot, undefined)
    assert.equal(await store.screenshot(stored.id), undefined)
  })
})

describe('the screenshot size', () => {
  test('downscales the long side to 1280 and leaves a smaller view alone', () => {
    assert.deepEqual(shotSize(2560, 1440), { width: 1280, height: 720 })
    assert.deepEqual(shotSize(800, 600), { width: 800, height: 600 })
    assert.deepEqual(shotSize(100, 2000), { width: 64, height: 1280 })
  })
})
