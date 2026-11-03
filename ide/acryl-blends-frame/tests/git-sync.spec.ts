import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { GitRunner } from 'acryl-versions'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { frameRoutes } from '../src/index.ts'
import { FRAME_GIT_PUSH_PATH, FRAME_GIT_REMOTE_PATH, parseGitRemoteState, type GitRemoteState } from '../src/contract.ts'
import { GitSync, upstreamHead } from '../src/git-sync.ts'
import { createGitSyncApi, remoteLabel, syncActions } from '../src/client/git-sync.ts'

const run = promisify(execFile)
/** A git of the test's own: no global config, a fixed author, and no prompt. */
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@example.invalid' }
const git = async (cwd: string, ...args: string[]): Promise<string> => (await run('git', args, { cwd, env })).stdout.trim()
const commit = async (cwd: string, file: string, text: string): Promise<void> => {
  await writeFile(join(cwd, file), text)
  await git(cwd, 'add', file)
  await git(cwd, 'commit', '-q', '-m', `edit ${file}`)
}

describe('push and pull of the checked-out branch', () => {
  const runner = new GitRunner()
  let dir: string
  let app: string
  let remote: string
  let other: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'git-sync-'))
    app = join(dir, 'app')
    remote = join(dir, 'remote.git')
    other = join(dir, 'other')
    await git(dir, 'init', '-q', '--bare', '-b', 'main', remote)
    await git(dir, 'init', '-q', '-b', 'main', app)
    await commit(app, 'a.txt', 'one')
  })
  afterEach(async () => { await rm(dir, { recursive: true, force: true }) })
  afterAll(async () => { await runner.dispose() })

  it('says there is no remote, and a push says so in one line', async () => {
    const sync = new GitSync(runner, app)
    expect(await sync.state()).toEqual({ kind: 'no-remote' })
    await expect(sync.push()).rejects.toThrow('This app has no remote to push to.')
    await expect(sync.pull()).rejects.toThrow('no remote to pull from')
  })

  it('sets the upstream on the first push, then counts and pushes what is ahead', async () => {
    await git(app, 'remote', 'add', 'origin', remote)
    const sync = new GitSync(runner, app)
    expect(await sync.state()).toEqual({ kind: 'unpublished', branch: 'main', remote: 'origin' })
    expect(await upstreamHead(runner, app)).toBeUndefined()
    await expect(sync.pull()).rejects.toThrow('main is not on origin yet')

    const first = await sync.push()
    expect(first.message).toBe('Pushed main to origin; it now follows origin/main.')
    expect(first.remote).toEqual({ kind: 'tracking', branch: 'main', upstream: 'origin/main', ahead: 0, behind: 0 })
    expect(await git(app, 'config', '--get', 'branch.main.merge')).toBe('refs/heads/main')
    expect(await upstreamHead(runner, app)).toBe(await git(app, 'rev-parse', 'HEAD'))

    await commit(app, 'b.txt', 'two')
    await commit(app, 'c.txt', 'three')
    expect(await sync.state()).toMatchObject({ kind: 'tracking', ahead: 2, behind: 0 })
    expect((await sync.push()).message).toBe('Pushed 2 versions to origin/main.')
    expect(await git(remote, 'rev-parse', 'main')).toBe(await git(app, 'rev-parse', 'HEAD'))
    expect((await sync.push()).message).toBe('Nothing to push: origin/main already has every version.')
  })

  it('pulls by fast-forward what another clone pushed, and says when there is nothing new', async () => {
    await git(app, 'remote', 'add', 'origin', remote)
    const sync = new GitSync(runner, app)
    await sync.push()
    await git(dir, 'clone', '-q', remote, other)
    await commit(other, 'b.txt', 'from the other clone')
    await git(other, 'push', '-q')

    // Without a fetch the app does not know yet; asking the remote shows it behind.
    expect(await sync.state()).toMatchObject({ ahead: 0, behind: 0 })
    expect(await sync.state({ fetch: true })).toMatchObject({ kind: 'tracking', ahead: 0, behind: 1 })
    await expect(sync.push()).rejects.toThrow('The remote has 1 version this branch does not. Pull first, then push.')

    const pulled = await sync.pull()
    expect(pulled.message).toBe('Pulled 1 version from origin/main.')
    expect(pulled.remote).toMatchObject({ ahead: 0, behind: 0 })
    expect(await git(app, 'show', 'HEAD:b.txt')).toBe('from the other clone')
    expect((await sync.pull()).message).toBe('Already up to date with origin/main.')
  })

  it('leaves a branch that moved on both sides exactly as it is, and never forces', async () => {
    await git(app, 'remote', 'add', 'origin', remote)
    const sync = new GitSync(runner, app)
    await sync.push()
    await git(dir, 'clone', '-q', remote, other)
    await commit(other, 'b.txt', 'there')
    await git(other, 'push', '-q')
    await commit(app, 'c.txt', 'here')
    const head = await git(app, 'rev-parse', 'HEAD')
    const remoteHead = await git(remote, 'rev-parse', 'main')

    const both = 'This branch and the remote have both moved on (1 version here, 1 version there). Nothing was changed'
    await expect(sync.pull()).rejects.toThrow(both)
    await expect(sync.push()).rejects.toThrow(both)
    expect(await git(app, 'rev-parse', 'HEAD')).toBe(head)
    expect(await git(remote, 'rev-parse', 'main')).toBe(remoteHead)
    expect(await sync.state()).toMatchObject({ ahead: 1, behind: 1 })
  })

  it('carries git\'s own line when the remote cannot be reached', async () => {
    await git(app, 'remote', 'add', 'origin', join(dir, 'missing.git'))
    const sync = new GitSync(runner, app)
    await expect(sync.push()).rejects.toThrow(/does not appear to be a git repository|Could not read from remote repository/u)
    // Once it has an upstream, a fetch that fails rides along with the last known counts.
    await git(app, 'remote', 'set-url', 'origin', remote)
    await sync.push()
    await git(app, 'remote', 'set-url', 'origin', join(dir, 'missing.git'))
    const state = await sync.state({ fetch: true })
    expect(state).toMatchObject({ kind: 'tracking', ahead: 0, behind: 0 })
    expect(state.kind === 'tracking' ? state.fetchError : undefined).toMatch(/does not appear to be a git repository|Could not read/u)
  })

  it('says a folder on no branch has nothing to push', async () => {
    await git(app, 'remote', 'add', 'origin', remote)
    await git(app, 'switch', '-q', '--detach', 'HEAD')
    const sync = new GitSync(runner, app)
    expect(await sync.state()).toEqual({ kind: 'detached' })
    await expect(sync.push()).rejects.toThrow('The app is not on a branch, so there is nothing to push.')
  })

  it('refuses to guess between several remotes when none is origin', async () => {
    await git(app, 'remote', 'add', 'a', remote)
    await git(app, 'remote', 'add', 'b', remote)
    const sync = new GitSync(runner, app)
    expect(await sync.state()).toEqual({ kind: 'unpublished', branch: 'main' })
    await expect(sync.push()).rejects.toThrow('several remotes and none is called origin')
  })
})

describe('the remote state as the Git tab reads it', () => {
  const tracking = (ahead: number, behind: number, fetchError?: string): GitRemoteState => ({
    kind: 'tracking', branch: 'main', upstream: 'origin/main', ahead, behind, ...(fetchError === undefined ? {} : { fetchError }),
  })

  it('writes ahead and behind, up to date, and no remote', () => {
    expect(remoteLabel(tracking(2, 1))).toBe('origin/main · ahead 2 · behind 1')
    expect(remoteLabel(tracking(0, 0))).toBe('up to date with origin/main')
    expect(remoteLabel({ kind: 'no-remote' })).toBe('no remote')
    expect(remoteLabel({ kind: 'unpublished', branch: 'main', remote: 'origin' })).toBe('main is not on origin yet')
  })

  it('turns on only the buttons that would do something', () => {
    expect(syncActions(tracking(1, 0))).toEqual({ push: true, pull: false })
    expect(syncActions(tracking(0, 2))).toEqual({ push: false, pull: true })
    expect(syncActions(tracking(0, 0))).toEqual({ push: false, pull: false })
    expect(syncActions(tracking(0, 0, 'fatal: unable to access'))).toEqual({ push: true, pull: true })
    expect(syncActions({ kind: 'unpublished', branch: 'main', remote: 'origin' })).toEqual({ push: true, pull: false })
    expect(syncActions({ kind: 'unpublished', branch: 'main' })).toEqual({ push: false, pull: false })
    expect(syncActions({ kind: 'no-remote' })).toEqual({ push: false, pull: false })
  })

  it('refuses an answer that is not a remote state', () => {
    expect(parseGitRemoteState(tracking(1, 2))).toEqual(tracking(1, 2))
    expect(() => parseGitRemoteState({ kind: 'tracking', branch: 'main', upstream: 'origin/main', ahead: -1, behind: 0 })).toThrow('counts')
    expect(() => parseGitRemoteState({ kind: 'elsewhere' })).toThrow('kind')
  })
})

describe('the git sync API and routes', () => {
  const call = (path: string, method = 'GET') => new Request(`http://127.0.0.1:43120${path}`, {
    method,
    headers: { host: '127.0.0.1:43120', origin: 'http://127.0.0.1:43120', 'sec-fetch-site': 'same-origin', ...(method === 'POST' ? { 'content-type': 'application/json' } : {}) },
    ...(method === 'POST' ? { body: '{}' } : {}),
  })
  const connection = { connection: { remoteAddress: '127.0.0.1', localPort: 43120 } }
  const state = () => Promise.reject(new Error('not asked'))
  const fetched: boolean[] = []
  const app = frameRoutes({
    state,
    gitSync: {
      state: async ({ fetch }) => { fetched.push(fetch === true); return { kind: 'no-remote' } },
      push: () => Promise.reject(new Error('fatal: Authentication failed for \'https://github.com/x/y.git/\'')),
      pull: async () => ({ message: 'Pulled 1 version from origin/main.', remote: { kind: 'tracking', branch: 'main', upstream: 'origin/main', ahead: 0, behind: 0 } }),
    },
  })
  const api = createGitSyncApi(async (input, init) => app.fetch(call(input, init?.method ?? 'GET'), connection))

  it('reads the state, fetching only when asked', async () => {
    expect(await api.remote(true)).toEqual({ kind: 'no-remote' })
    expect(await api.remote(false)).toEqual({ kind: 'no-remote' })
    expect(fetched).toEqual([true, false])
  })

  it('answers git\'s line when a push is refused, and the result of a pull', async () => {
    await expect(api.push()).rejects.toThrow('fatal: Authentication failed for')
    expect((await api.pull()).message).toBe('Pulled 1 version from origin/main.')
  })

  it('takes a push or pull only from the app\'s own page', async () => {
    const elsewhere = new Request(`http://127.0.0.1:43120${FRAME_GIT_PUSH_PATH}`, { method: 'POST', headers: { host: '127.0.0.1:43120', origin: 'http://evil.example', 'content-type': 'application/json' }, body: '{}' })
    expect((await app.fetch(elsewhere, connection)).status).toBe(403)
    expect((await app.fetch(call(FRAME_GIT_REMOTE_PATH), connection)).status).toBe(200)
  })
})
