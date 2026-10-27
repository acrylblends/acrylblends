import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { pinnedInstance, withPort } from '../plugins/instance/index.ts'
import { type App, createApp } from '../src/app.ts'

// One process at a time serves a folder's door; these tests start several apps in the same folder.
process.env.ACRYL_DOOR = 'off'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

async function withApp(run: (app: App) => Promise<void>) {
  const home = await mkdtemp(join(tmpdir(), 'agent-test-'))
  const app = await createApp(withPort(pinnedInstance(home, { root: projectRoot }), 0))
  try {
    await run(app)
  } finally {
    await app.stop()
    await rm(home, { recursive: true, force: true })
  }
}

const ask = (app: App, body: unknown) =>
  fetch(`${app.url}/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

test('the agent uses a tool and answers over HTTP', () =>
  withApp(async (app) => {
    const answer = (await (await ask(app, { question: 'add 2 3' })).json()) as {
      output: string
      trace: unknown[]
    }
    assert.equal(answer.output, 'The answer is 5.')
    assert.deepEqual(answer.trace, [{ tool: 'add', input: [2, 3], result: 5 }])
  }))

test('a body without a question is refused', () =>
  withApp(async (app) => {
    const response = await ask(app, {})
    assert.equal(response.status, 400)
    await response.body?.cancel()
  }))
