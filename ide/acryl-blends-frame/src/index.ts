/**
 * Cordis Host plugin: the Blends frame's one route, `GET /api/acryl-blends-frame/state` - the app's name and folder, where its page is served,
 * and its local branches. The frame itself is the client half (`./client`).
 *
 * One effect owns the confined git runner and both registrations; disposal unmounts the route and reaps any git call still running. The right
 * panel's terminals, PTY agents, files and git are the workspace's own Host services (`acryl-workspace`), run here as a child plugin: only its
 * Host half, since the frame, not the workbench, owns the page.
 */

import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from 'acrylblends/cordis/router'
import type {} from 'acrylblends/cordis/router-http'
import { Acryl } from 'acrylblends'
import { error } from 'acryl-loopback-http'
import { INVALID_JSON, jsonBody, ownPage, privateApi, readJson } from 'acryl-loopback-http/router'
import { GitRunner } from 'acryl-versions'
import * as workspaceHost from 'acryl-workspace'
// `ctx.loader`: the frame lists its Loader rows and starts the app's plugins again after a switch.
import type {} from '@deepseek-ai/cordis-plugin-loader'
import { readAppPlugins, readFramePlugins, switchAppPlugin, type FrameRow } from './app-plugins.ts'
import {
  FRAME_API_PREFIX,
  branchNameProblem,
  FRAME_BRANCHES_NEW_PATH,
  FRAME_FEEDBACK_PATH,
  FRAME_FEEDBACK_SEEN_PATH,
  FRAME_PLUGINS_PATH,
  FRAME_PLUGINS_SWITCH_PATH,
  FRAME_STATE_PATH,
  type AppPluginKind,
  type AppPluginsView,
  type FeedbackView,
  parseFeedbackNotes,
  type FrameBranch,
  type FrameState,
} from './contract.ts'

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
}

export const name = 'acryl-blends-frame'
export const inject = ['router', 'routerHttp', 'appInstance']

/** `git for-each-ref` lines `<current marker> <name>`: the checked-out branch first, the rest by name. */
export function parseBranches(stdout: string): FrameBranch[] {
  const branches = stdout.split('\n').filter(line => line.length > 2).map(line => ({ name: line.slice(2), current: line.startsWith('*') }))
  return branches.sort((a, b) => (a.current === b.current ? a.name.localeCompare(b.name) : a.current ? -1 : 1))
}

async function readBranches(git: GitRunner, root: string): Promise<FrameBranch[]> {
  try {
    const result = await git.run(['for-each-ref', '--format=%(HEAD) %(refname:short)', 'refs/heads'], root)
    return parseBranches(result.stdout)
  } catch {
    // Not a repository (or git missing): the frame shows no branches rather than failing the whole state.
    return []
  }
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

/** Settings → Plugins: the app's plugins, and switching one in `blend.yaml`. */
export interface PluginsPort {
  read(): Promise<AppPluginsView>
  switch(kind: AppPluginKind, name: string, on: boolean): Promise<void>
}

function parseSwitch(body: unknown): { kind: AppPluginKind; name: string; on: boolean } | undefined {
  if (body === null || typeof body !== 'object') return undefined
  const { kind, name, on } = body as Record<string, unknown>
  if ((kind !== 'row' && kind !== 'made') || typeof name !== 'string' || name === '' || name.length > 200 || typeof on !== 'boolean') return undefined
  return { kind, name, on }
}

/** The builder's side of the app's feedback: the notes people sent, and marking them seen. */
export interface FeedbackPort {
  read(): Promise<FeedbackView>
  markSeen(ids: readonly string[]): Promise<void>
}

/** The app's `feedback` service as the frame uses it, checked at each call: the plugin may be off, or come and go with a switch. */
interface FeedbackSource {
  list(): Promise<unknown>
  markSeen(ids: readonly string[]): Promise<void>
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
}

export function frameRoutes(state: () => Promise<FrameState>, report: (cause: unknown) => void = () => {}, plugins?: PluginsPort, feedback?: FeedbackPort, branches?: BranchesPort): Acryl {
  const app = new Acryl()
  if (branches !== undefined) {
    app.post(FRAME_BRANCHES_NEW_PATH, ownPage, jsonBody(), async (c) => {
      const body = await readJson(c)
      const name = body !== INVALID_JSON && body !== null && typeof body === 'object' ? (body as { name?: unknown }).name : undefined
      const problem = typeof name === 'string' ? branchNameProblem(name) : 'Name the branch.'
      if (typeof name !== 'string' || problem !== undefined) return c.json(error(problem ?? 'Name the branch.'), 400)
      try {
        await branches.create(name)
        return c.json({ ok: true })
      } catch (cause) {
        return c.json(error(cause instanceof Error ? cause.message : 'the branch could not be made'), 409)
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

export function apply(ctx: Context, config: FrameConfig = {}): void {
  const appPage = typeof config.appPage === 'string' && config.appPage.startsWith('/') ? config.appPage : undefined
  const root = (ctx.appInstance as { readonly root?: unknown }).root
  if (typeof root !== 'string') throw new Error('acryl-blends-frame: the app instance has no app folder (root)')
  ctx.plugin(workspaceHost, appPage === undefined ? {} : { appPage })
  ctx.effect(() => {
    const git = new GitRunner()
    const state = async (): Promise<FrameState> => {
      const [appName, branches, worktree] = await Promise.all([readAppName(root), readBranches(git, root), readWorktree(git, root)])
      return { appName, appRoot: root, ...(appPage === undefined ? {} : { appPage }), branches, ...worktree }
    }
    const frameRows = (): FrameRow[] => {
      const loader = ctx.get('loader')
      if (loader === undefined) return []
      return [...loader.entries()].map(entry => ({ id: entry.options.id, name: entry.options.name, disabled: entry.disabled, fiberState: entry.fiber?.state }))
    }
    const plugins: PluginsPort = {
      read: async () => {
        const [app, frame] = await Promise.all([readAppPlugins(root, git), readFramePlugins(root, frameRows())])
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
    }
    ctx.router.route('/', frameRoutes(state, (cause) => {
      ctx.logger.error(`acryl-blends-frame: request failed: ${cause instanceof Error ? cause.message : String(cause)}`)
    }, plugins, feedbackPort(() => ctx.get('feedback')), {
      create: async (name) => {
        // git's own rule for a branch name, then the branch from HEAD, switched to: the working files, saved or not, stay as they are.
        try {
          await git.run(['check-ref-format', '--branch', name], root)
          await git.run(['switch', '--create', name], root)
        } catch (cause) {
          // The runner keeps git's own line ("fatal: a branch named 'x' already exists") as the failure's detail.
          const detail = (cause as { detail?: unknown }).detail
          throw new Error(typeof detail === 'string' && detail !== '' ? detail : 'git could not make the branch')
        }
      },
    }))
    ctx.routerHttp.mount(FRAME_API_PREFIX)
    return () => { void git.dispose() }
  }, 'acryl-blends-frame: git runner and state route')
}

export { FRAME_API_PREFIX, FRAME_STATE_PATH, parseFrameState, type FrameBranch, type FrameState } from './contract.ts'
