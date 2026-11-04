import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { createAppSnapshot, loadSnapshotVerbs, type SnapshotVerbs, type VersionRemote } from '../src/app-snapshot.ts'
import { FRAME_SNAPSHOT_CAPTURE_PATH, parseSnapshotCapture } from '../src/contract.ts'
import { captureText, createSnapshotApi } from '../src/client/snapshot.ts'
import { frameRoutes } from '../src/index.ts'

/** The repository root holds the template's `plugins/manifest/snapshot.ts`: the verbs every new app is made with. */
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})
const temp = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'frame-snapshot-'))
  dirs.push(dir)
  return dir
}

const remote: VersionRemote = {
  state: async () => ({ kind: 'no-remote' }),
  push: () => Promise.reject(new Error('This app has no remote to push to.')),
  pull: () => Promise.reject(new Error('This app has no remote to pull from.')),
}

describe('the app snapshot service', () => {
  it('runs the app\'s own verbs: a new plugin folder gets its row and the lock records it', async () => {
    const app = temp()
    writeFileSync(join(app, 'blend.yaml'), [
      'apiVersion: blends.acryl.dev/v1alpha1',
      'kind: Blueprint',
      'metadata: { id: acme.board, name: board, version: 0.1.0 }',
      'spec:',
      '  runtime: cordis',
      '  rows:',
      '    - id: extensions',
      '      name: extensions',
      '',
    ].join('\n'))
    mkdirSync(join(app, 'plugins', 'notes'), { recursive: true })
    writeFileSync(join(app, 'plugins', 'notes', 'index.ts'), "export const name = 'notes'\nexport function apply() {}\n")
    const verbs = await loadSnapshotVerbs(repoRoot)
    const snapshot = createAppSnapshot(app, remote, async () => verbs)
    const captured = await snapshot.capture()
    expect(captured.addedRows).toEqual(['notes'])
    expect(readFileSync(join(app, 'blend.yaml'), 'utf8')).toMatch(/id: notes/)
    expect(await snapshot.verify()).toEqual({ ok: true, problems: [], checked: 2 })
    await expect(snapshot.apply('.')).rejects.toThrow('another folder than the app itself')
  })

  it('says plainly when the app was made before the snapshot verbs', async () => {
    await expect(loadSnapshotVerbs(temp())).rejects.toThrow('made before the snapshot verbs')
  })

  it('runs the writing verbs one at a time and reads the app\'s verbs once', async () => {
    let loads = 0
    const order: string[] = []
    let release: () => void = () => {}
    const held = new Promise<void>((done) => { release = done })
    const verbs: SnapshotVerbs = {
      captureApp: () => { order.push('capture'); return { addedRows: [], modules: 1 } },
      verifyApp: dir => { order.push(`verify ${dir}`); return { ok: true, problems: [], checked: 1 } },
      applySnapshot: () => { order.push('apply'); return { ok: true, problems: [], modules: [], manifestChanged: false, extra: [] } },
    }
    const snapshot = createAppSnapshot('/apps/board', remote, async () => {
      loads += 1
      await held
      return verbs
    })
    const pending = [snapshot.apply('../older'), snapshot.capture(), snapshot.verify('/snapshots/one')]
    release()
    await Promise.all(pending)
    expect(order).toEqual(['apply', 'capture', 'verify /snapshots/one'])
    expect(loads).toBe(1)
    await expect(snapshot.pushVersion()).rejects.toThrow('no remote to push to')
  })

  it('tries the app\'s verbs again after a failed load', async () => {
    let tries = 0
    const snapshot = createAppSnapshot('/apps/board', remote, async () => {
      tries += 1
      if (tries === 1) throw new Error('not yet')
      return { captureApp: () => ({ addedRows: [], modules: 0 }), verifyApp: () => ({ ok: true, problems: [], checked: 0 }), applySnapshot: () => { throw new Error('unused') } }
    })
    await expect(snapshot.capture()).rejects.toThrow('not yet')
    expect(await snapshot.capture()).toEqual({ addedRows: [], modules: 0 })
  })
})

describe('the Capture route and its line', () => {
  const call = (path: string) => new Request(`http://127.0.0.1:43120${path}`, {
    method: 'POST',
    headers: { host: '127.0.0.1:43120', origin: 'http://127.0.0.1:43120', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
    body: '{}',
  })
  const connection = { connection: { remoteAddress: '127.0.0.1', localPort: 43120 } }
  const state = () => Promise.reject(new Error('not asked'))

  it('answers what the capture did, or the Host\'s one line', async () => {
    let fail = false
    const app = frameRoutes({
      state,
      snapshot: { capture: async () => { if (fail) throw new Error('This app has no plugins/manifest/snapshot.ts'); return { addedRows: ['notes'], modules: 3 } } },
    })
    const api = createSnapshotApi(async input => app.fetch(call(input), connection))
    expect(await api.capture()).toEqual({ addedRows: ['notes'], modules: 3 })
    fail = true
    await expect(api.capture()).rejects.toThrow('no plugins/manifest/snapshot.ts')
    const elsewhere = new Request(`http://127.0.0.1:43120${FRAME_SNAPSHOT_CAPTURE_PATH}`, { method: 'POST', headers: { host: '127.0.0.1:43120', origin: 'http://evil.example', 'content-type': 'application/json' }, body: '{}' })
    expect((await app.fetch(elsewhere, connection)).status).toBe(403)
  })

  it('reads as one line', () => {
    expect(captureText({ addedRows: ['notes'], modules: 4 })).toBe('Captured: notes got a row; 4 plugins locked.')
    expect(captureText({ addedRows: ['notes', 'todo'], modules: 5 })).toBe('Captured: notes, todo got rows; 5 plugins locked.')
    expect(captureText({ addedRows: [], modules: 1 })).toBe('Captured: every plugin already had a row; 1 plugin locked.')
    expect(() => parseSnapshotCapture({ addedRows: 'notes', modules: 1 })).toThrow('not a result')
  })
})
