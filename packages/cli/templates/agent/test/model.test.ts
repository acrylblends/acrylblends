import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createApp } from '../src/app.ts'
import { pinnedInstance, withPort } from '../src/plugins/instance/index.ts'

/** A plugin no scripted command knows: the model writes it from scratch. */
const COUNTER = `import type { Context } from '@deepseek-ai/cordis'
import { App } from 'acryl-router'
export const name = 'counter'
export const inject = ['router']
export function apply(ctx: Context) {
  let count = 0
  ctx.router.route('/', new App().get('/count', (c) => c.json({ count: ++count })))
}
`

/** Stands in for a real model API: plans write_plugin, then install_plugin, then answers. */
async function modelApi() {
  const replies = [
    {
      tool_calls: [
        {
          id: '1',
          type: 'function',
          function: {
            name: 'write_plugin',
            arguments: JSON.stringify({ name: 'counter', files: { 'index.ts': COUNTER } }),
          },
        },
      ],
    },
    {
      tool_calls: [
        {
          id: '2',
          type: 'function',
          function: { name: 'install_plugin', arguments: '{"name":"counter"}' },
        },
      ],
    },
    { content: 'I built a counter: GET /count.' },
  ]
  const server = createServer(async (request, response) => {
    for await (const _ of request) {
      // the body is not needed: the replies are in order
    }
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(
      JSON.stringify({ choices: [{ message: replies.shift() ?? { content: 'no more' } }] }),
    )
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
    close: () => new Promise<void>((done) => server.close(() => done())),
  }
}

test('with a real model, the agent writes a new Cordis plugin and the running app serves it', async () => {
  const api = await modelApi()
  const project = await mkdtemp(join(tmpdir(), 'model-project-'))
  const app = await createApp(
    withPort(pinnedInstance(join(project, '.acrylblends'), { root: project }), 0),
    {
      model: { baseUrl: api.url, model: 'test' },
    },
  )
  try {
    const answer = await (
      await fetch(`${app.url}/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: 'add a counter route' }),
      })
    ).json()
    assert.equal((answer as { output: string }).output, 'I built a counter: GET /count.')
    assert.deepEqual(await (await fetch(`${app.url}/count`)).json(), { count: 1 })
    assert.deepEqual(await (await fetch(`${app.url}/count`)).json(), { count: 2 })
  } finally {
    await app.stop()
    await api.close()
    await rm(project, { recursive: true, force: true })
  }
})
