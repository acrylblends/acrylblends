import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CASCADE_STEP, cascade, windowOptions } from '../window.ts'

const work = { x: 0, y: 25, width: 1920, height: 1055 }
const size = { width: 1100, height: 760 }

test('a new window sits one step down and to the right of the one it was opened from', () => {
  assert.deepEqual(cascade({ x: 100, y: 100, width: 1100, height: 760 }, work, size), {
    x: 100 + CASCADE_STEP,
    y: 100 + CASCADE_STEP,
  })
})

test('a row of windows cascades and then starts again at the top left of the work area', () => {
  let at = { x: 0, y: 25 }
  const seen: { x: number; y: number }[] = []
  for (let count = 0; count < 12; count += 1) {
    at = cascade({ ...at, ...size }, work, size)
    seen.push(at)
  }
  assert.ok(
    seen.every(
      (place) =>
        place.x >= work.x &&
        place.y >= work.y &&
        place.x + size.width <= work.x + work.width &&
        place.y + size.height <= work.y + work.height,
    ),
  )
  assert.ok(
    seen.some((place) => place.x === work.x || place.y === work.y),
    'it went back to an edge of the work area',
  )
  assert.equal(new Set(seen.map((place) => `${place.x},${place.y}`)).size > 3, true)
})

test('two windows are never exactly on top of each other, and a window with no place is left for Electron to center', () => {
  const first = { x: 400, y: 200, width: 1100, height: 760 }
  const second = cascade(first, work, size)
  assert.notDeepEqual(second, { x: first.x, y: first.y })
  assert.equal('x' in windowOptions({ title: 'a' }), false)
  const placed = windowOptions({ title: 'a', x: 5, y: 6 })
  assert.deepEqual([placed.x, placed.y], [5, 6])
})

test('on a screen no bigger than the window the new window is still offset, not stacked on the first (the window sits at the corner of a 1024x768 screen)', () => {
  const small = { x: 0, y: 0, width: 1024, height: 768 }
  const first = { x: 0, y: 0, width: 1024, height: 720 }
  const size = { width: 1100, height: 760 }
  const second = cascade(first, small, size, [first])
  assert.deepEqual(second, { x: CASCADE_STEP, y: CASCADE_STEP })
  // A third window, opened from the second, is at neither place.
  const third = cascade({ ...second, width: 1024, height: 720 }, small, size, [first, second])
  assert.equal(
    [first, second].some((other) => other.x === third.x && other.y === third.y),
    false,
  )
  // Opened from the first again, it still does not land on a taken place.
  const again = cascade(first, small, size, [first, second, third])
  assert.equal(
    [first, second, third].some((other) => other.x === again.x && other.y === again.y),
    false,
  )
})

test('a row of windows on a big screen starts again at the corner, but never on a window that is still there', () => {
  const taken: { x: number; y: number }[] = [{ x: 0, y: 25 }]
  let from = { x: 0, y: 25, width: 1100, height: 760 }
  for (let count = 0; count < 25; count += 1) {
    const place = cascade(from, work, size, taken)
    assert.equal(
      taken.some((other) => other.x === place.x && other.y === place.y),
      false,
      `window ${count + 2} landed on a taken place`,
    )
    taken.push(place)
    from = { ...place, width: 1100, height: 760 }
  }
})
