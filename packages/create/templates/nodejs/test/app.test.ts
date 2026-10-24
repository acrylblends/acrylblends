import assert from 'node:assert/strict'
import { test } from 'node:test'
import app from '../src/app.ts'

test('GET / answers __CLASS__!', async () => {
  const response = await app.request('/')
  assert.equal(response.status, 200)
  assert.equal(await response.text(), '__CLASS__!')
})
