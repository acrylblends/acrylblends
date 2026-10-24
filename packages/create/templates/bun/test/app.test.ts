import { expect, test } from 'bun:test'
import app from '../src/index.ts'

test('GET / answers __CLASS__!', async () => {
  const response = await app.request('/')
  expect(response.status).toBe(200)
  expect(await response.text()).toBe('__CLASS__!')
})
