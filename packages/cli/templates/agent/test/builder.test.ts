import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createApp } from '../src/app.ts'
import { pinnedInstance, withPort } from '../plugins/instance/index.ts'

/** The agent extends the running app through POST /ask; a restart keeps what it built. */
test('the agent builds, updates, protects and removes a plugin in the running app, and a restart keeps it', async () => {
  const project = await mkdtemp(join(tmpdir(), 'builder-project-'))
  const chosen = withPort(pinnedInstance(join(project, '.acrylblends'), { root: project }), 0)
  let app = await createApp(chosen)
  const ask = async (question: string) => {
    const response = await fetch(`${app.url}/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
    })
    return ((await response.json()) as { output: string }).output
  }
  const hello = async () => {
    const response = await fetch(`${app.url}/hello`)
    return response.status === 200
      ? ((await response.json()) as { text: string }).text
      : response.status
  }
  try {
    assert.equal(await ask('create route hello /hello Hello'), 'hello: installed, active.')
    assert.equal(await hello(), 'Hello')
    assert.equal(await ask('update route hello /hello Bonjour'), 'hello: updated, active.')
    assert.equal(await hello(), 'Bonjour')
    assert.match(await ask('break plugin hello'), /Previous version restored: true/)
    assert.equal(await hello(), 'Bonjour')

    // The broken version stays on disk, so put the working one back before restarting.
    await ask('update route hello /hello Bonjour')
    await app.stop()
    app = await createApp(chosen)
    assert.equal(await hello(), 'Bonjour')

    assert.equal(await ask('remove plugin hello'), 'hello: done.')
    assert.equal(await hello(), 404)

    // Every run is a durable task that owns its tool calls, and the records survived the restart.
    const records = (await (await fetch(`${app.url}/tasks`)).json()) as Array<{
      kind: string
      status: string
      parent?: string
    }>
    const runs = records.filter((record) => record.kind === 'agent-run')
    assert.equal(runs.length, 5)
    assert.ok(runs.every((run) => run.status === 'completed'))
    assert.ok(
      records.some(
        (record) => record.kind === 'tool:install_plugin' && record.parent !== undefined,
      ),
    )
  } finally {
    await app.stop()
    await rm(project, { recursive: true, force: true })
  }
})

test('with approval on, an install waits for the owner; approving it makes it live', async () => {
  const project = await mkdtemp(join(tmpdir(), 'approval-project-'))
  const chosen = withPort(pinnedInstance(join(project, '.acrylblends'), { root: project }), 0)
  const app = await createApp(chosen, { values: { approval: true } })
  const post = async (path: string, body: unknown) =>
    (await (
      await fetch(`${app.url}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    ).json()) as Record<string, unknown>
  try {
    assert.equal(
      (await post('/ask', { question: 'create route hello /hello Hello' })).output,
      "hello: waiting for the owner's approval.",
    )
    assert.equal((await fetch(`${app.url}/hello`)).status, 404)
    const listed = (await (await fetch(`${app.url}/extensions`)).json()) as {
      waitingForApproval: Array<{ name: string }>
    }
    assert.deepEqual(
      listed.waitingForApproval.map((request) => request.name),
      ['hello'],
    )
    assert.equal(
      ((await post('/extensions/approve', { name: 'hello' })) as { state?: string }).state,
      'active',
    )
    assert.deepEqual(await (await fetch(`${app.url}/hello`)).json(), { text: 'Hello' })
    const tasks = (await (await fetch(`${app.url}/tasks`)).json()) as Array<{ manifest?: string }>
    assert.ok(
      tasks.length > 0 && tasks.every((task) => /^sha256:[0-9a-f]{64}$/.test(task.manifest ?? '')),
    )
  } finally {
    await app.stop()
    await rm(project, { recursive: true, force: true })
  }
})

test('the agent builds a sandboxed tool, calls it, and the sandbox refuses a tool that reads outside its folder', async () => {
  const project = await mkdtemp(join(tmpdir(), 'tool-project-'))
  const chosen = withPort(pinnedInstance(join(project, '.acrylblends'), { root: project }), 0)
  const app = await createApp(chosen)
  const ask = async (question: string) =>
    (
      (await (
        await fetch(`${app.url}/ask`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ question }),
        })
      ).json()) as { output: string }
    ).output
  try {
    assert.equal(await ask('create tool triple 3'), 'triple: installed, active.')
    assert.equal(await ask('run tool triple 14'), '{"n":42}')
    const refused = await ask('spy tool snoop')
    assert.match(refused, /^Refused: its check failed: denied:/)
    const listed = (await (await fetch(`${app.url}/extensions`)).json()) as {
      installed: Array<{ name: string }>
    }
    assert.deepEqual(
      listed.installed.map((extension) => extension.name),
      ['triple'],
    )
  } finally {
    await app.stop()
    await rm(project, { recursive: true, force: true })
  }
})

test('what happens is streamed from the state cells: the run as a task, and the install as an extension', async () => {
  const project = await mkdtemp(join(tmpdir(), 'events-project-'))
  const chosen = withPort(pinnedInstance(join(project, '.acrylblends'), { root: project }), 0)
  const app = await createApp(chosen)
  const controller = new AbortController()
  /** Follow one server-sent stream: its text so far. */
  const follow = async (path: string) => {
    const stream = await fetch(`${app.url}${path}`, { signal: controller.signal })
    assert.equal(stream.status, 200, path)
    const reader = stream.body!.getReader()
    const decoder = new TextDecoder()
    const seen = { text: '' }
    const pump = (async () => {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) return
        seen.text += decoder.decode(value, { stream: true })
      }
    })().catch(() => undefined)
    return { seen, pump }
  }
  try {
    const tasksStream = await follow('/api/state/tasks/events')
    const extensionsStream = await follow('/api/state/extensions/events')
    await fetch(`${app.url}/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'create route hello /hello Hello' }),
    })
    const arrived = (stream: { text: string }, what: RegExp) => what.test(stream.text)
    for (
      let waited = 0;
      waited < 3000 && !arrived(extensionsStream.seen, /"name":"hello"[^\n]*"state":"active"/);
      waited += 25
    ) {
      await new Promise((done) => setTimeout(done, 25))
    }
    assert.ok(
      arrived(tasksStream.seen, /event: value\ndata: \[\]/),
      'the stream starts with the current value',
    )
    assert.ok(
      arrived(tasksStream.seen, /"kind":"agent-run"[^\n]*"status":"running"/) ||
        arrived(tasksStream.seen, /"kind":"agent-run"/),
      'the run is a task',
    )
    assert.ok(arrived(tasksStream.seen, /"kind":"tool:install_plugin"/), 'the install is a task')
    assert.ok(
      arrived(extensionsStream.seen, /"name":"hello"[^\n]*"state":"active"/),
      'the extension is reported',
    )
    controller.abort()
    await Promise.all([tasksStream.pump, extensionsStream.pump])
  } finally {
    await app.stop()
    await rm(project, { recursive: true, force: true })
  }
})
