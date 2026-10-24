import { assertEquals } from 'jsr:@std/assert'
import app from './app.ts'

Deno.test('GET / answers __CLASS__!', async () => {
  const response = await app.request('/')
  assertEquals(response.status, 200)
  assertEquals(await response.text(), '__CLASS__!')
})
