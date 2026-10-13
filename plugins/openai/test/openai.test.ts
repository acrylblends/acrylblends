import assert from 'node:assert/strict'
import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { agent, memory, tools } from '../../agent/index.ts'
import { messagesFor, modelConfigFrom, openai } from '../index.ts'

/** A stand-in for an OpenAI-compatible server: answers with the scripted replies in order, and records what it was sent. */
async function fakeApi(replies: unknown[]) {
  const received: Array<{
    auth?: string
    body: { messages: unknown[]; tools: Array<{ function: { name: string } }> }
  }> = []
  const server = createServer(async (request: IncomingMessage, response) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(chunk as Buffer)
    received.push({
      ...(request.headers.authorization ? { auth: request.headers.authorization } : {}),
      body: JSON.parse(Buffer.concat(chunks).toString()),
    })
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ choices: [{ message: replies.shift() }] }))
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`
  return { url, received, close: () => new Promise<void>((done) => server.close(() => done())) }
}

test('drives a tool call and a final answer through the API, rebuilding the conversation each step', async () => {
  const api = await fakeApi([
    {
      content: null,
      reasoning_content: 'I should add.',
      tool_calls: [{ id: 'x', type: 'function', function: { name: 'add', arguments: '{"0":2}' } }],
    },
    { content: 'Done: 2.' },
  ])
  const root = new Context()
  for (const [plugin, config] of [
    [openai, { baseUrl: api.url, model: 'test', apiKey: 'k' }],
    [tools],
    [memory],
    [agent],
  ] as const) {
    await root.plugin(plugin as never, config as never).await()
  }
  const result = await root.agent.run('what is 2')
  assert.equal(result.status === 'completed' && result.output, 'Done: 2.')
  assert.equal(api.received[0]?.auth, 'Bearer k')
  assert.ok(api.received[0]?.body.tools.some((tool) => tool.function.name === 'add'))
  assert.equal(api.received[1]?.body.messages.length, 4)
  // A thinking model's reasoning for the call is sent back with it on the next step.
  assert.equal(
    ((api.received[1]?.body.messages ?? [])[2] as { reasoning_content?: string } | undefined)
      ?.reasoning_content,
    'I should add.',
  )
  await api.close()
})

test('messages carry each tool call and its result or error', () => {
  const messages = messagesFor(
    {
      question: 'q',
      step: 2,
      trace: [
        { tool: 'a', input: { x: 1 }, result: 3 },
        { tool: 'b', input: {}, error: 'nope' },
      ],
    },
    'sys',
  )
  assert.deepEqual(
    messages.map((message) => message.role),
    ['system', 'user', 'assistant', 'tool', 'assistant', 'tool'],
  )
  assert.equal((messages[5] as { content: string }).content, '{"error":"nope"}')
})

test('the configuration comes from an environment-shaped object, and is absent when not set', () => {
  assert.deepEqual(
    modelConfigFrom({ ACRYLBLENDS_MODEL_URL: 'http://x/v1', ACRYLBLENDS_MODEL: 'm' }),
    {
      baseUrl: 'http://x/v1',
      model: 'm',
    },
  )
  assert.equal(modelConfigFrom({}), undefined)
})
