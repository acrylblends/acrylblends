/**
 * Cordis Host plugin: the Blends frame's one route, `GET /api/acryl-blends-frame/state` - the app's name and folder, where its page is served,
 * and its local branches. The frame itself is the client half (`./client`).
 *
 * One effect owns the confined git runner and both registrations; disposal unmounts the route and reaps any git call still running. The right
 * panel's terminals, PTY agents, files and git are the workspace's own Host services (`acryl-workspace`), run here as a child plugin: only its
 * Host half, since the frame, not the workbench, owns the page.
 */

import { realpathSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from 'acrylblends/cordis/router'
import type {} from 'acrylblends/cordis/router-http'
import { Acryl } from 'acrylblends'
import { error } from 'acryl-loopback-http'
import { INVALID_JSON, jsonBody, ownPage, privateApi, readJson } from 'acryl-loopback-http/router'
import { GitRunner, Versions } from 'acryl-versions'
import * as workspaceHost from 'acryl-workspace'
// `ctx.loader`: the frame lists its Loader rows and starts the app's plugins again after a switch.
import type { Entry } from '@deepseek-ai/cordis-plugin-loader'
import { readAppPlugins, readFramePlugins, shareAppPlugin, switchAppPlugin, type FrameRow, type ShareAppPluginResult } from './app-plugins.ts'
import { blankChatsFile, createBlankChatsStore } from './blank-chats.ts'
import { lookAtLog, RealChats } from './real-chats.ts'
import { appGeneration } from './app-generation.ts'
import { AppReloader, watchFolder, type AppRow } from './app-reload.ts'
import { AutoSave, SaveStore, type SessionEventLike } from './auto-save.ts'
import { guardToolCalls, type ToolCallEvents } from './tool-call-guard.ts'
import { installSelectionContext, parseSelectionContext, SelectionInbox, sessionOf } from './selection-context.ts'
import { branchChatsFile, createBranchChatsStore } from './branch-chats.ts'
import {
  FRAME_API_PREFIX,
  FRAME_APP_PATH,
  branchNameProblem,
  FRAME_BRANCHES_NEW_PATH,
  FRAME_CHAT_SAVES_PATH,
  FRAME_BLANK_CHAT_PATH,
  FRAME_REAL_CHATS_PATH,
  FRAME_BRANCH_CHATS_PATH,
  FRAME_SELECTION_PATH,
  FRAME_BRANCHES_SWITCH_PATH,
  FRAME_FEEDBACK_PATH,
  FRAME_FEEDBACK_SEEN_PATH,
  FRAME_FEEDBACK_SHOT_PATH,
  FRAME_GIT_PULL_PATH,
  FRAME_GIT_PUSH_PATH,
  FRAME_GIT_REMOTE_PATH,
  FRAME_PLUGINS_PATH,
  FRAME_PLUGINS_SHARE_PATH,
  FRAME_PLUGINS_SWITCH_PATH,
  FRAME_STATE_PATH,
  FRAME_VERSIONS_SHARED_PATH,
  type AppPluginKind,
  type AppReloadView,
  type AppPluginsView,
  type ChatSavesView,
  type FeedbackView,
  parseFeedbackNotes,
  type FrameBranch,
  type FrameState,
  type GitRemoteState,
  type GitSyncResult,
} from './contract.ts'
import { GitSync, upstreamHead } from './git-sync.ts'

/**
 * The part of the runtime's `appInstance` service ACRYL plugins read (a separated interface: plugins do not import the runtime). Every plugin
 * declares exactly this shape, so the Context augmentations agree in a program that loads several; the app's folder (`root`) is read apart.
 */
interface AppInstanceService {
  readonly home: string
  readonly dshHome: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    appInstance: AppInstanceService
  }
}

export interface FrameConfig {
  /** Where the app's own page is served (`/app`); the frame shows no app without it. */
  readonly appPage?: string
  /** The GitHub account or organization a local plugin is shared to; the signed-in `gh` account when absent. */
  readonly shareOwner?: string
}

export const name = 'acryl-blends-frame'
export const inject = ['router', 'routerHttp', 'appInstance']

/** `git for-each-ref` lines `<current marker> <name>`: the checked-out branch first, the rest by name. */
export function parseBranches(stdout: string): FrameBranch[] {
  const branches = stdout.split('\n').filter(line => line.length > 2).map(line => ({ name: line.slice(2), current: line.startsWith('*') }))
  return branches.sort((a, b) => (a.current === b.current ? a.name.localeCompare(b.name) : a.current ? -1 : 1))
}

/** A git call as the state and the shared-versions check use it: the versions runner satisfies it, and a test stands in for it. */
export interface GitLike {
  run(args: readonly string[], cwd: string): Promise<{ readonly stdout: string }>
}

async function readBranches(git: GitLike, root: string): Promise<FrameBranch[]> {
  try {
    const result = await git.run(['for-each-ref', '--format=%(HEAD) %(refname:short)', 'refs/heads'], root)
    return parseBranches(result.stdout)
  } catch {
    // Not a repository (or git missing): the frame shows no branches rather than failing the whole state.
    return []
  }
}

/**
 * The versions that are also on another local branch or a remote-tracking branch: another line of work has them, or they are on the remote, so
 * the list marks them "shared". The current branch's own ref is left out (being on it is not sharing); one `rev-list` per other ref, then an
 * intersection with the listed versions.
 */
export async function sharedVersions(git: GitLike, root: string, hashes: readonly string[]): Promise<string[]> {
  if (hashes.length === 0) return []
  let refs: string[]
  try {
    const current = (await readBranches(git, root)).find(branch => branch.current)?.name
    const currentRef = current === undefined ? undefined : `refs/heads/${current}`
    refs = (await git.run(['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes'], root)).stdout
      .split('\n')
      .filter(ref => ref !== '' && ref !== currentRef)
  } catch {
    return []
  }
  const wanted = new Set(hashes)
  const shared = new Set<string>()
  for (const ref of refs) {
    let stdout: string
    try {
      stdout = (await git.run(['rev-list', ref], root)).stdout
    } catch {
      continue
    }
    for (const line of stdout.split('\n')) {
      const hash = line.trim()
      if (wanted.has(hash)) shared.add(hash)
    }
  }
  return [...shared]
}

/** `git status --porcelain -z` entries: one per changed path (a rename's second, NUL-separated path is not counted twice). */
export function countChanges(stdout: string): number {
  const fields = stdout.split('\0')
  let count = 0
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i] ?? ''
    if (field.length < 4) continue
    count += 1
    // A rename or copy is followed by its source path as a field of its own.
    if (field[0] === 'R' || field[0] === 'C') i += 1
  }
  return count
}

/** The checked-out commit and how many files changed since it; neither outside a repository. */
async function readWorktree(git: GitRunner, root: string): Promise<{ head?: string; unsaved?: number }> {
  let unsaved: number
  try {
    unsaved = countChanges((await git.run(['status', '--porcelain', '-z', '--untracked-files=all'], root)).stdout)
  } catch {
    return {}
  }
  try {
    const head = (await git.run(['rev-parse', '--verify', 'HEAD'], root)).stdout.trim()
    return head === '' ? { unsaved } : { head, unsaved }
  } catch {
    // A repository without a first commit has changes but no head.
    return { unsaved }
  }
}

/** The app's name: its package.json `name`, else its folder's name. */
async function readAppName(root: string): Promise<string> {
  try {
    const manifest: unknown = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    const name = manifest !== null && typeof manifest === 'object' ? (manifest as { name?: unknown }).name : undefined
    if (typeof name === 'string' && name.trim() !== '') return name.trim()
  } catch {
    // No manifest, or not JSON: the folder names the app.
  }
  return basename(root)
}

/** Settings → Plugins: the app's plugins, switching one in `blend.yaml`, and sharing a local one. */
export interface PluginsPort {
  read(): Promise<AppPluginsView>
  switch(kind: AppPluginKind, name: string, on: boolean): Promise<void>
  /** Publish one local plugin to its GitHub repository and release, through the plugin-hub path; `bump` releases the next patch. */
  share(name: string, bump?: boolean): Promise<ShareAppPluginResult>
}

function parseSwitch(body: unknown): { kind: AppPluginKind; name: string; on: boolean } | undefined {
  if (body === null || typeof body !== 'object') return undefined
  const { kind, name, on } = body as Record<string, unknown>
  if ((kind !== 'row' && kind !== 'made') || typeof name !== 'string' || name === '' || name.length > 200 || typeof on !== 'boolean') return undefined
  return { kind, name, on }
}

/** A note's screenshot as the frame serves it: the bytes and their image type. */
export interface FeedbackShot {
  readonly bytes: Uint8Array
  readonly mediaType: 'image/webp' | 'image/png'
}

/** The builder's side of the app's feedback: the notes people sent, marking them seen, and one note's screenshot. */
export interface FeedbackPort {
  read(): Promise<FeedbackView>
  markSeen(ids: readonly string[]): Promise<void>
  screenshot(id: string): Promise<FeedbackShot | undefined>
}

/** The app's `feedback` service as the frame uses it, checked at each call: the plugin may be off, or come and go with a switch. */
interface FeedbackSource {
  list(): Promise<unknown>
  markSeen(ids: readonly string[]): Promise<void>
  screenshot?(id: string): Promise<unknown>
}

function isFeedbackSource(value: unknown): value is FeedbackSource {
  return value !== null && typeof value === 'object'
    && typeof (value as { list?: unknown }).list === 'function' && typeof (value as { markSeen?: unknown }).markSeen === 'function'
}

/** Reads the app's `feedback` service where it is now; `available` false without it. */
export function feedbackPort(source: () => unknown): FeedbackPort {
  return {
    async read() {
      const service = source()
      if (!isFeedbackSource(service)) return { available: false, notes: [] }
      return { available: true, notes: parseFeedbackNotes(await service.list()) }
    },
    async markSeen(ids) {
      const service = source()
      if (isFeedbackSource(service)) await service.markSeen(ids)
    },
    async screenshot(id) {
      const service = source()
      if (!isFeedbackSource(service) || typeof service.screenshot !== 'function') return undefined
      const shot = await service.screenshot(id)
      if (shot === null || typeof shot !== 'object') return undefined
      const { bytes, mediaType } = shot as { bytes?: unknown; mediaType?: unknown }
      if (!(bytes instanceof Uint8Array) || (mediaType !== 'image/webp' && mediaType !== 'image/png')) return undefined
      return { bytes, mediaType }
    },
  }
}

function parseSeen(body: unknown): string[] | undefined {
  if (body === null || typeof body !== 'object') return undefined
  const ids = (body as { ids?: unknown }).ids
  if (!Array.isArray(ids) || ids.length > 500 || !ids.every((id): id is string => typeof id === 'string' && id.length <= 100)) return undefined
  return ids
}

/** What the Branches "New" button asks of the Host. */
export interface BranchesPort {
  /** Make the branch from the checked-out version and switch to it; rejects with git's reason. */
  create(name: string): Promise<void>
  /** Move the app's folder to an existing local branch; rejects with git's reason. */
  switchTo(name: string): Promise<void>
}

/** The Git tab's push and pull for the checked-out branch (./git-sync.ts). Each rejects with the one line to show. */
export interface GitSyncPort {
  state(options: { readonly fetch?: boolean }): Promise<GitRemoteState>
  push(): Promise<GitSyncResult>
  pull(): Promise<GitSyncResult>
}

/** What each turn of a chat saved (the auto-save), for the line under the answer. */
export interface ChatSavesPort {
  read(session: string): Promise<ChatSavesView>
}

/** The chats that have a turn (the left panel lists only those, and the open one). */
export interface RealChatsPort {
  read(): Promise<readonly { readonly id: string; readonly title: string }[]>
}

/** The blank chat of the checked-out branch: the one handed out, and recording another that is found blank. */
export interface BlankChatPort {
  read(): Promise<string | undefined>
  /** @returns false when the chat is not a blank one the Host knows. */
  record(id: string): Promise<boolean>
}

/** The app's code as the Host runs it: what it runs now, and the answer once that changes. */
export interface AppReloadPort {
  view(): AppReloadView
  wait(after: number, timeoutMs: number): Promise<AppReloadView>
}

/** The longest a long poll of the app's code is held before it answers with what it has; the page asks again at once. */
const APP_POLL_MS = 25_000

/** A session id as DSH mints them: letters, digits and dashes, never a path. */
const SESSION_ID = /^[A-Za-z0-9_-]{1,100}$/u

/** The `name` of a branch request, or why it cannot be one. */
export function parseBranchName(body: unknown): { name: string } | { problem: string } {
  const name = body !== null && typeof body === 'object' ? (body as { name?: unknown }).name : undefined
  if (typeof name !== 'string') return { problem: 'Name the branch.' }
  const problem = branchNameProblem(name)
  return problem === undefined ? { name } : { problem }
}

/** Which branch each chat was opened on (the frame lists a branch's own chats; DSH itself knows no branches). */
export interface BranchChatsPort {
  read(): Promise<Record<string, string>>
  /** Records a chat's branch once; a chat stays where it was opened. */
  assign(id: string, branch: string): Promise<void>
}

export interface FrameRoutesDeps {
  readonly state: () => Promise<FrameState>
  readonly report?: (cause: unknown) => void
  readonly plugins?: PluginsPort
  readonly feedback?: FeedbackPort
  readonly branches?: BranchesPort
  readonly branchChats?: BranchChatsPort
  /** What each turn of a chat saved (the auto-save), for the line under the answer. */
  readonly chatSaves?: ChatSavesPort
  /** Which of the listed versions are also on another branch or the remote. */
  readonly shared?: (hashes: readonly string[]) => Promise<string[]>
  readonly realChats?: RealChatsPort
  readonly blankChat?: BlankChatPort
  readonly gitSync?: GitSyncPort
  readonly appReload?: AppReloadPort
  /** The element picks waiting for the step that reads the message they belong to (./selection-context.ts). */
  readonly selection?: SelectionInbox
}

export function frameRoutes({ state, report = () => {}, plugins, feedback, branches, branchChats, chatSaves, shared, realChats, blankChat, gitSync, appReload, selection }: FrameRoutesDeps): Acryl {
  const app = new Acryl()
  if (appReload !== undefined) {
    app.get(FRAME_APP_PATH, ownPage, async (c) => {
      const after = Number(c.req.query('after'))
      return c.json(c.req.query('after') !== undefined && Number.isInteger(after) ? await appReload.wait(after, APP_POLL_MS) : appReload.view())
    })
  }
  if (gitSync !== undefined) {
    const failed = (cause: unknown, fallback: string): string => cause instanceof Error && cause.message !== '' ? cause.message : fallback
    app.get(FRAME_GIT_REMOTE_PATH, ownPage, async (c) => {
      try {
        return c.json(await gitSync.state({ fetch: c.req.query('fetch') === '1' }))
      } catch (cause) {
        return c.json(error(failed(cause, 'the remote state could not be read')), 409)
      }
    })
    app.post(FRAME_GIT_PUSH_PATH, ownPage, jsonBody(), async (c) => {
      try {
        return c.json(await gitSync.push())
      } catch (cause) {
        return c.json(error(failed(cause, 'the branch could not be pushed')), 409)
      }
    })
    app.post(FRAME_GIT_PULL_PATH, ownPage, jsonBody(), async (c) => {
      try {
        return c.json(await gitSync.pull())
      } catch (cause) {
        return c.json(error(failed(cause, 'the branch could not be pulled')), 409)
      }
    })
  }
  if (blankChat !== undefined) {
    app.get(FRAME_BLANK_CHAT_PATH, ownPage, async (c) => {
      try {
        return c.json({ id: (await blankChat.read()) ?? null })
      } catch (cause) {
        report(cause)
        return c.json(error('the blank chat could not be read'), 500)
      }
    })
    app.post(FRAME_BLANK_CHAT_PATH, ownPage, jsonBody(), async (c) => {
      const body: unknown = await readJson(c)
      const id = body !== null && typeof body === 'object' ? (body as { id?: unknown }).id : undefined
      if (typeof id !== 'string' || !SESSION_ID.test(id)) return c.json(error('name the chat'), 400)
      try {
        return c.json({ recorded: await blankChat.record(id) })
      } catch (cause) {
        report(cause)
        return c.json(error('the blank chat could not be recorded'), 500)
      }
    })
  }
  if (realChats !== undefined) {
    app.get(FRAME_REAL_CHATS_PATH, ownPage, async (c) => {
      try {
        return c.json({ chats: await realChats.read() })
      } catch (cause) {
        report(cause)
        return c.json(error('the chats could not be read'), 500)
      }
    })
  }
  if (chatSaves !== undefined) {
    app.get(FRAME_CHAT_SAVES_PATH, ownPage, async (c) => {
      const session = c.req.query('session') ?? ''
      if (!SESSION_ID.test(session)) return c.json(error('name the chat'), 400)
      try {
        return c.json(await chatSaves.read(session))
      } catch (cause) {
        report(cause)
        return c.json(error('the saves could not be read'), 500)
      }
    })
  }
  if (branches !== undefined) {
    app.post(FRAME_BRANCHES_NEW_PATH, ownPage, jsonBody(), async (c) => {
      const parsed = parseBranchName(await readJson(c))
      if ('problem' in parsed) return c.json(error(parsed.problem), 400)
      try {
        await branches.create(parsed.name)
        return c.json({ ok: true })
      } catch (cause) {
        return c.json(error(cause instanceof Error ? cause.message : 'the branch could not be made'), 409)
      }
    })
    app.post(FRAME_BRANCHES_SWITCH_PATH, ownPage, jsonBody(), async (c) => {
      const parsed = parseBranchName(await readJson(c))
      if ('problem' in parsed) return c.json(error(parsed.problem), 400)
      try {
        await branches.switchTo(parsed.name)
        return c.json({ ok: true })
      } catch (cause) {
        return c.json(error(cause instanceof Error ? cause.message : 'the branch could not be switched to'), 409)
      }
    })
  }
  if (branchChats !== undefined) {
    app.get(FRAME_BRANCH_CHATS_PATH, ownPage, async (c) => {
      try {
        return c.json({ chats: await branchChats.read() })
      } catch (cause) {
        report(cause)
        return c.json(error('the branch chats could not be read'), 500)
      }
    })
    app.post(FRAME_BRANCH_CHATS_PATH, ownPage, jsonBody(), async (c) => {
      const body = await readJson(c)
      const record = body !== null && typeof body === 'object' ? (body as { id?: unknown; branch?: unknown }) : {}
      if (typeof record.id !== 'string' || record.id === '' || record.id.length > 200) return c.json(error('invalid chat'), 400)
      if (typeof record.branch !== 'string') return c.json(error('Name the branch.'), 400)
      const problem = branchNameProblem(record.branch)
      if (problem !== undefined) return c.json(error(problem), 400)
      try {
        await branchChats.assign(record.id, record.branch)
        return c.json({ ok: true })
      } catch (cause) {
        return c.json(error(cause instanceof Error ? cause.message : 'the chat could not be recorded'), 409)
      }
    })
  }
  if (feedback !== undefined) {
    app.get(FRAME_FEEDBACK_PATH, ownPage, async (c) => {
      try {
        return c.json(await feedback.read())
      } catch (cause) {
        report(cause)
        return c.json(error('the feedback could not be read'), 500)
      }
    })
    app.post(FRAME_FEEDBACK_SEEN_PATH, ownPage, jsonBody(), async (c) => {
      const body = await readJson(c)
      const ids = body === INVALID_JSON ? undefined : parseSeen(body)
      if (ids === undefined) return c.json(error('invalid seen request'), 400)
      await feedback.markSeen(ids)
      return c.json({ ok: true })
    })
    app.get(FRAME_FEEDBACK_SHOT_PATH, ownPage, async (c) => {
      const id = c.req.query('id') ?? ''
      if (!/^[0-9a-f-]{36}$/u.test(id)) return c.json(error('name one note'), 400)
      try {
        const shot = await feedback.screenshot(id)
        if (shot === undefined) return c.json(error('that note has no screenshot'), 404)
        return c.body(new Uint8Array(shot.bytes), 200, {
          'content-type': shot.mediaType,
          'content-length': String(shot.bytes.length),
          'cache-control': 'private, max-age=3600',
        })
      } catch (cause) {
        report(cause)
        return c.json(error('the screenshot could not be read'), 500)
      }
    })
  }
  if (plugins !== undefined) {
    app.get(FRAME_PLUGINS_PATH, ownPage, async (c) => {
      try {
        return c.json(await plugins.read())
      } catch (cause) {
        report(cause)
        return c.json(error('the plugins could not be read'), 500)
      }
    })
    app.post(FRAME_PLUGINS_SWITCH_PATH, ownPage, jsonBody(), async (c) => {
      const body = await readJson(c)
      const input = body === INVALID_JSON ? undefined : parseSwitch(body)
      if (input === undefined) return c.json(error('invalid switch request'), 400)
      try {
        await plugins.switch(input.kind, input.name, input.on)
        return c.json({ ok: true })
      } catch (cause) {
        return c.json(error(cause instanceof Error ? cause.message : 'the plugin could not be switched'), 409)
      }
    })
    app.post(FRAME_PLUGINS_SHARE_PATH, ownPage, jsonBody(), async (c) => {
      const body = await readJson(c)
      const fields = body === INVALID_JSON || body === null || typeof body !== 'object' ? undefined : body as { name?: unknown; bump?: unknown }
      const name = fields?.name
      if (typeof name !== 'string' || !/^[a-z0-9][a-z0-9-]*$/u.test(name) || (fields?.bump !== undefined && typeof fields.bump !== 'boolean'))
        return c.json(error('name one local plugin'), 400)
      try {
        return c.json(await plugins.share(name, fields?.bump === true))
      } catch (cause) {
        report(cause)
        return c.json(error(cause instanceof Error ? cause.message : 'the plugin could not be shared'), 409)
      }
    })
  }
  if (shared !== undefined) {
    app.post(FRAME_VERSIONS_SHARED_PATH, ownPage, jsonBody(), async (c) => {
      const body = await readJson(c)
      const hashes = body !== null && typeof body === 'object' ? (body as { hashes?: unknown }).hashes : undefined
      if (!Array.isArray(hashes) || hashes.length > 100
        || !hashes.every((hash): hash is string => typeof hash === 'string' && /^[0-9a-f]{7,40}$/iu.test(hash))) {
        return c.json(error('invalid versions request'), 400)
      }
      try {
        return c.json({ shared: await shared(hashes) })
      } catch (cause) {
        report(cause)
        return c.json(error('the shared versions could not be read'), 500)
      }
    })
  }
  if (selection !== undefined) {
    // The composer's send gesture posts the pick here before the message reaches the Host: the next pre-step of that chat takes it once
    // (./selection-context.ts). Answered as accepted, never as applied: the message goes whether or not the pick arrives.
    app.post(FRAME_SELECTION_PATH, ownPage, jsonBody(), async (c) => {
      const body = await readJson(c)
      const session = sessionOf(body)
      const parsed = parseSelectionContext(body)
      if (session === undefined || typeof parsed === 'string') return c.json(error(typeof parsed === 'string' ? parsed : 'the selection needs its chat'), 400)
      selection.add(session, parsed)
      return c.json({ ok: true }, 202)
    })
  }
  app.get(FRAME_STATE_PATH, ownPage, async (c) => {
    try {
      return c.json(await state())
    } catch (cause) {
      report(cause)
      return c.json(error('frame state failed'), 500)
    }
  })
  return privateApi(FRAME_API_PREFIX, app)
}

/** The Loader row that runs the app's own plugins (the app's `cordis.patch.yml`). */
const APP_PLUGINS_ROW = 'app-plugins'
/** The row `src/frame.ts` makes (`packages/cli/src/frame-rows.ts`): the app's own routes. */
const APP_ROUTES_ROW = 'app-routes'

/**
 * The app's rows, plugins first and routes after (the order they start in): each as the reloader drives it. A row's module is imported under the
 * current generation (`./app-generation.ts`) by the loader itself, so `restart` stops the row's plugin and has the loader start the entry again - not
 * `fiber.restart()`, which runs the module the row already has. The plugin leaves the registry (what DSH's own hot reload does) rather than its fiber
 * being disposed: the loader reads a fiber disposed on its own as the person switching the row off, and writes that into the app's `cordis.yml`.
 */
export function appRowsOf(loader: Context['loader'] | undefined): AppRow[] {
  if (loader === undefined) return []
  return [APP_PLUGINS_ROW, APP_ROUTES_ROW].flatMap((id) => {
    const entry: Entry | undefined = [...loader.entries()].find(row => row.options.id === id)
    if (entry === undefined || entry.disabled) return []
    return [{
      id,
      load: async () => { await entry.parent.tree.import(entry.options.name, entry.getOuterStack) },
      restart: async () => {
        const before = entry.fiber
        const callback = before?.runtime?.callback
        if (callback !== undefined) {
          entry.ctx.registry.delete(callback)
          await before?.await().catch(() => {})
        }
        await entry.init()
        // An import that fails is logged by the loader and leaves the old (stopped) fiber in place: that is a row that did not start.
        const fiber = entry.fiber
        if (fiber === undefined || fiber === before) throw new Error(`the ${id} row could not be loaded`)
        await fiber.await()
      },
    }]
  })
}

/**
 * Save the app's folder as a version called `message`, and say which one it is (`v7`: how many versions the branch has then). Only a turn DSH says changed
 * files comes here, but the commit takes the whole folder as a save point does: a file the person changed by hand since the last version goes into it. A folder
 * with nothing to commit (the agent committed itself, or the files are ignored) makes no version.
 */
export async function saveVersion(git: GitRunner, versions: Versions, root: string, message: string): Promise<{ hash: string; version: number; subject: string } | undefined> {
  const { unsaved } = await readWorktree(git, root)
  if (unsaved === undefined || unsaved === 0) return undefined
  const { entry } = await versions.save(root, message)
  const count = Number((await git.run(['rev-list', '--count', entry.hash], root)).stdout.trim())
  return { hash: entry.hash, version: Number.isInteger(count) && count > 0 ? count : 1, subject: entry.subject }
}

/** DSH's `workspaceChanges` service as the frame uses it (the host row `workspace-changes`); undefined when the app composes without it. */
interface WorkspaceChangesService {
  summary(session: string, seq: number): { readonly files: readonly { readonly display: string }[] } | undefined
}

function workspaceChangesOf(value: unknown): WorkspaceChangesService | undefined {
  return value !== null && typeof value === 'object' && typeof (value as { summary?: unknown }).summary === 'function' ? value as WorkspaceChangesService : undefined
}

/** DSH's `sessionQuery` as the frame uses it; undefined when the app composes without it. */
interface SessionQueryService {
  listSessions(): Promise<readonly { readonly header: { readonly id: string } }[]>
  readSession(id: string): Promise<{ readonly events: readonly { readonly type: string; readonly data?: unknown }[] }>
}

function sessionQueryOf(value: unknown): SessionQueryService | undefined {
  return value !== null && typeof value === 'object' && typeof (value as { listSessions?: unknown }).listSessions === 'function' ? value as SessionQueryService : undefined
}

/** `ctx.on('session/event', ...)`: DSH's host emits it with the session object and the event; the frame needs only the id and the event. */
interface SessionEvents {
  on(name: 'session/event', listener: (session: { readonly id: string }, event: SessionEventLike) => void): () => void
}

export function apply(ctx: Context, config: FrameConfig = {}): void {
  const appPage = typeof config.appPage === 'string' && config.appPage.startsWith('/') ? config.appPage : undefined
  // The app's GitHub owner for shares; the signed-in gh account when the app names none.
  const shareOwner = typeof config.shareOwner === 'string' && /^[A-Za-z0-9-]+$/u.test(config.shareOwner) ? config.shareOwner : undefined
  const root = (ctx.appInstance as { readonly root?: unknown }).root
  if (typeof root !== 'string') throw new Error('acryl-blends-frame: the app instance has no app folder (root)')
  ctx.plugin(workspaceHost, appPage === undefined ? {} : { appPage })
  // The chat works in the app's own folder. DSH's first-run workspace is a folder under Documents; with the app's folder registered first, the page's first chat
  // opens in it (DSH makes its default workspace only when it has none), so what the agent writes is the app, and the auto-save can save it.
  ctx.inject(['workspaceController'], (child) => {
    const workspaces = (child as unknown as { workspaceController: { create(request: { readonly path: string }): Promise<unknown> } }).workspaceController
    child.effect(() => {
      workspaces.create({ path: root }).catch((cause: unknown) => {
        child.logger.error(`acryl-blends-frame: the app folder could not be made a workspace: ${cause instanceof Error ? cause.message : String(cause)}`)
      })
      return () => {}
    }, 'acryl-blends-frame: the chat works in the app folder')
  })
  ctx.effect(() => {
    const report = (cause: unknown): void => {
      ctx.logger.error(`acryl-blends-frame: ${cause instanceof Error ? cause.message : String(cause)}`)
    }
    const git = new GitRunner()
    const chatsFile = createBranchChatsStore(branchChatsFile(ctx.appInstance.home))
    const state = async (): Promise<FrameState> => {
      const [appName, branches, worktree, upstream] = await Promise.all([readAppName(root), readBranches(git, root), readWorktree(git, root), upstreamHead(git, root)])
      return { appName, appRoot: root, ...(appPage === undefined ? {} : { appPage }), branches, ...worktree, ...(upstream === undefined ? {} : { upstreamHead: upstream }) }
    }
    const frameRows = (): FrameRow[] => {
      const loader = ctx.get('loader')
      if (loader === undefined) return []
      return [...loader.entries()].map(entry => ({ id: entry.options.id, name: entry.options.name, disabled: entry.disabled, fiberState: entry.fiber?.state }))
    }
    const plugins: PluginsPort = {
      read: async () => {
        const [app, frame] = await Promise.all([readAppPlugins(root, git, join(ctx.appInstance.home, 'shared-plugins.json')), readFramePlugins(root, frameRows())])
        return { plugins: app, frame }
      },
      switch: async (kind, name, on) => {
        await switchAppPlugin(root, kind, name, on)
        // The app's plugins read blend.yaml when they start: start them again so the switch takes effect now.
        // The overlay's rows sit in a group of the composition, so the row is found by its own id, not resolved from the root.
        const loader = ctx.get('loader')
        const entry = loader === undefined ? undefined : [...loader.entries()].find(row => row.options.id === APP_PLUGINS_ROW)
        if (entry?.fiber !== undefined) await entry.fiber.restart()
      },
      // A local plugin goes to GitHub through the plugin-hub path: the same pack, secret check, repository, release and local store an
      // ACRYL plugin share uses, with the user's own gh and git doing the publishing.
      share: async (name, bump) => shareAppPlugin(root, ctx.appInstance.home, name, {
        ...(shareOwner === undefined ? {} : { owner: shareOwner }),
        ...(bump === true ? { bump: true } : {}),
      }),
    }
    // The chat's agent finished a turn that changed files: save a version by itself (./auto-save.ts), and remember which turn it was.
    const store = new SaveStore(join(ctx.appInstance.dshHome, 'chat-saves.json'), report)
    const versions = new Versions(git)
    const autoSave = new AutoSave({
      summary: (session, seq) => workspaceChangesOf(ctx.get('workspaceChanges'))?.summary(session, seq),
      save: message => saveVersion(git, versions, root, message),
      store,
      report,
    })
    // DSH announces every event of every chat session here; `workspace/changes` is the one that says a turn changed files.
    const stopListening = (ctx as unknown as SessionEvents).on('session/event', (session, event) => { autoSave.observe(session.id, event) })
    // No tool call may hold a chat forever (./tool-call-guard.ts).
    const stopGuard = guardToolCalls(ctx as unknown as ToolCallEvents, line => { ctx.logger.warn(line) })
    const realChatList = new RealChats({
      list: async () => (await sessionQueryOf(ctx.get('sessionQuery'))?.listSessions() ?? []).map(record => record.header.id),
      look: async id => lookAtLog((await sessionQueryOf(ctx.get('sessionQuery'))?.readSession(id))?.events ?? []),
      report,
    })
    const blankChats = createBlankChatsStore(blankChatsFile(ctx.appInstance.home))
    const blankChat: BlankChatPort = {
      read: async () => {
        const branch = (await readBranches(git, root)).find(entry => entry.current)?.name
        const id = branch === undefined ? undefined : await blankChats.read(root, branch)
        return id !== undefined && await realChatList.isBlank(id) ? id : undefined
      },
      record: async (id) => {
        const branch = (await readBranches(git, root)).find(entry => entry.current)?.name
        if (branch === undefined || !(await realChatList.isBlank(id))) return false
        await blankChats.record(root, branch, id)
        return true
      },
    }
    const chatSaves: ChatSavesPort = { read: async session => ({ saves: await store.forSession(session) }) }
    // The app's code, loaded again when its files change (./app-reload.ts), whoever changes them: a version restored, a branch switched, the chat, an
    // agent in a terminal, an editor. Only where the launcher installed the generation hook (./app-generation.ts); elsewhere the app's code is as it started.
    const generation = appGeneration()
    const appReload = generation === undefined ? undefined : new AppReloader({ generation, rows: () => appRowsOf(ctx.get('loader')), appRoot: realpathSync(root), report })
    const stopWatching = appReload === undefined ? () => {} : watchFolder(join(root, 'src'), () => { void appReload.reload() }, { report })
    /** git's own line as the message a person reads: the runner keeps it as the failure's detail. */
    const gitReason = (cause: unknown, fallback: string): Error => {
      const detail = (cause as { detail?: unknown }).detail
      return new Error(typeof detail === 'string' && detail !== '' ? detail : fallback)
    }
    // The element a chat message is about: posted by the composer at its send gesture, taken at the step that reads that message, so the
    // person's bubble keeps their words and the agent still gets the page and selector (./selection-context.ts).
    const selectionInbox = new SelectionInbox()
    ctx.effect(
      () => installSelectionContext(ctx, selectionInbox, (cause) => {
        ctx.logger.error(`acryl-blends-frame: the selected element did not reach the chat: ${cause instanceof Error ? cause.message : String(cause)}`)
      }),
      'acryl-blends-frame: the picked element as context',
    )
    ctx.router.route('/', frameRoutes({
      state,
      selection: selectionInbox,
      report: (cause) => {
        ctx.logger.error(`acryl-blends-frame: request failed: ${cause instanceof Error ? cause.message : String(cause)}`)
      },
      plugins,
      // The app's feedback service may be isolated to its own composition (the template isolates it under the app-plugins row); read it from that
      // row's scope first, then from the frame's own, so both an isolated and an unisolated app answer.
      feedback: feedbackPort(() => {
        const loader = ctx.get('loader') as unknown as {
          entries(): Array<{ readonly options: { readonly id: string }; readonly fiber?: { readonly ctx?: { get(key: string): unknown } } }>
        } | undefined
        const appPlugins = loader?.entries().find(row => row.options.id === APP_PLUGINS_ROW)
        return appPlugins?.fiber?.ctx?.get('feedback') ?? ctx.get('feedback')
      }),
      branches: {
        create: async (name) => {
          // git's own rule for a branch name, then the branch from HEAD, switched to: the working files, saved or not, stay as they are.
          try {
            await git.run(['check-ref-format', '--branch', name], root)
            await git.run(['switch', '--create', name], root)
          } catch (cause) {
            throw gitReason(cause, 'git could not make the branch')
          }
        },
        switchTo: async (name) => {
          // Only a local branch is switched to: a commit or `HEAD~2` would leave the folder on no branch, which the frame cannot show.
          const target = (await readBranches(git, root)).find(branch => branch.name === name)
          if (target === undefined) throw new Error(`There is no branch named ${name}.`)
          if (target.current) return
          try {
            await git.run(['switch', name], root)
          } catch (cause) {
            throw gitReason(cause, 'git could not switch branches')
          }
        },
      },
      branchChats: {
        read: () => chatsFile.read(root),
        assign: (id, branch) => chatsFile.assign(root, id, branch),
      },
      chatSaves,
      ...(appReload === undefined ? {} : { appReload }),
      shared: (hashes) => sharedVersions(git, root, hashes),
      realChats: { read: () => realChatList.read() },
      blankChat,
      gitSync: new GitSync(git, root),
    }))
    ctx.routerHttp.mount(FRAME_API_PREFIX)
    return () => {
      stopListening()
      stopGuard()
      stopWatching()
      void autoSave.settled().then(() => git.dispose())
    }
  }, 'acryl-blends-frame: git runner and state route')
}

export { AutoSave, messageText, requestSubject, SaveStore } from './auto-save.ts'
export { FRAME_API_PREFIX, FRAME_STATE_PATH, parseFrameState, type FrameBranch, type FrameState } from './contract.ts'
