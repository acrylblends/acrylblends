import assert from 'node:assert/strict'
import { test } from 'node:test'
import app from '../src/app.ts'

test('GET / answers __CLASS__!', async () => {
  const response = await app.request('/')
  assert.equal(response.status, 200)
  assert.equal(await response.text(), '__CLASS__!')
})

test('GET /about renders the JSX page', async () => {
  const response = await app.request('/about')
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') ?? '', /html/)
  assert.match(
    await response.text(),
    /<main><h1>About<\/h1><p>Rendered on the server with __PACKAGE__\/jsx\.<\/p><\/main>/,
  )
})

test('an error thrown in a .tsx file names the .tsx line in its stack', async () => {
  const { failingPage } = await import('../src/page.tsx')
  let stack = ''
  try {
    failingPage()
  } catch (error) {
    stack = String((error as Error).stack)
  }
  assert.match(stack, /page\.tsx:\d+/)
})
