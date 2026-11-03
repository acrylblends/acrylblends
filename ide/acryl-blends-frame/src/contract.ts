/** The one route the frame's client reads: what the frame shows around the app, from the Host that serves it. */

export const FRAME_API_PREFIX = '/api/acryl-blends-frame'
export const FRAME_STATE_PATH = `${FRAME_API_PREFIX}/state`

/** A local branch of the app's repository. */
export interface FrameBranch {
  readonly name: string
  /** The branch the app's folder has checked out. */
  readonly current: boolean
}

export interface FrameState {
  /** The app's name: its folder's name. */
  readonly appName: string
  /** The app's folder, which the versions calls take as their path. */
  readonly appRoot: string
  /** Where the app's own page is served, an absolute path on the frame's origin (`/app`); absent when the Host serves no app. */
  readonly appPage?: string
  /** Local branches, the checked-out one marked; empty when the folder is not a git repository. */
  readonly branches: readonly FrameBranch[]
  /** The checked-out commit; absent before the first version or outside a repository. A change means the versions changed. */
  readonly head?: string
  /** Files changed since the last version; absent outside a repository. */
  readonly unsaved?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** @throws an Error naming the field when the answer is not a frame state. */
export function parseFrameState(value: unknown): FrameState {
  if (!isRecord(value)) throw new Error('frame state: not an object')
  const { appName, appRoot, appPage, branches, head, unsaved } = value
  if (typeof appName !== 'string' || appName === '') throw new Error('frame state: appName')
  if (typeof appRoot !== 'string' || appRoot === '') throw new Error('frame state: appRoot')
  if (appPage !== undefined && (typeof appPage !== 'string' || !appPage.startsWith('/'))) throw new Error('frame state: appPage')
  if (!Array.isArray(branches)) throw new Error('frame state: branches')
  if (head !== undefined && (typeof head !== 'string' || head === '')) throw new Error('frame state: head')
  if (unsaved !== undefined && (typeof unsaved !== 'number' || !Number.isInteger(unsaved) || unsaved < 0)) throw new Error('frame state: unsaved')
  const parsed = branches.map((branch: unknown) => {
    if (!isRecord(branch) || typeof branch.name !== 'string' || typeof branch.current !== 'boolean') throw new Error('frame state: branch')
    return { name: branch.name, current: branch.current }
  })
  return {
    appName,
    appRoot,
    ...(appPage === undefined ? {} : { appPage }),
    branches: parsed,
    ...(head === undefined ? {} : { head }),
    ...(unsaved === undefined ? {} : { unsaved }),
  }
}

export const FRAME_PLUGINS_PATH = `${FRAME_API_PREFIX}/plugins`
export const FRAME_PLUGINS_SWITCH_PATH = `${FRAME_API_PREFIX}/plugins/switch`

/**
 * Where a plugin of the app comes from: a row of the app's `blend.yaml` (the library plugins the app was made with), or a plugin written into the
 * app's `plugins/` folder after it was made (what agents build; the `extensions` row starts them).
 */
export type AppPluginKind = 'row' | 'made'

/** One plugin of the app, as Settings → Plugins lists it. */
export interface AppPluginView {
  readonly name: string
  readonly kind: AppPluginKind
  /** Who wrote it: the agent or person of its first commit; absent for a library row. */
  readonly by?: string
  /** When it was first committed (ISO time); absent when it is not saved yet or a library row. */
  readonly at?: string
  /** Not committed yet: it runs, but no version has it. */
  readonly unsaved?: boolean
  /** The library release a library row was copied from (`plugins/library.lock.json`). */
  readonly version?: string
  readonly description: string
  readonly on: boolean
}

/** How one of the frame's own Loader rows runs: started, waiting for a service it needs, failed to start, or switched off. */
export type FramePluginState = 'active' | 'waiting' | 'failed' | 'off'

/** One of the frame's own plugins (its Loader rows around the app): shown, not switched here. */
export interface FramePluginView {
  readonly id: string
  readonly name: string
  readonly version?: string
  readonly description: string
  readonly state: FramePluginState
}

export interface AppPluginsView {
  readonly plugins: readonly AppPluginView[]
  readonly frame: readonly FramePluginView[]
}

const FRAME_PLUGIN_STATES: readonly string[] = ['active', 'waiting', 'failed', 'off'] satisfies FramePluginState[]

/** @throws when the answer is not a plugin list. */
export function parseAppPluginsView(value: unknown): AppPluginsView {
  if (!isRecord(value) || !Array.isArray(value.plugins)) throw new Error('plugins: not a list')
  return {
    plugins: value.plugins.map((entry: unknown) => {
      if (!isRecord(entry) || typeof entry.name !== 'string' || (entry.kind !== 'row' && entry.kind !== 'made')
        || typeof entry.description !== 'string' || typeof entry.on !== 'boolean') throw new Error('plugins: entry')
      return {
        name: entry.name,
        kind: entry.kind,
        ...(typeof entry.by === 'string' ? { by: entry.by } : {}),
        ...(typeof entry.at === 'string' ? { at: entry.at } : {}),
        ...(entry.unsaved === true ? { unsaved: true } : {}),
        ...(typeof entry.version === 'string' ? { version: entry.version } : {}),
        description: entry.description,
        on: entry.on,
      }
    }),
    frame: (Array.isArray(value.frame) ? value.frame : []).map((entry: unknown) => {
      if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.name !== 'string' || typeof entry.description !== 'string'
        || typeof entry.state !== 'string' || !FRAME_PLUGIN_STATES.includes(entry.state)) throw new Error('plugins: frame entry')
      return {
        id: entry.id,
        name: entry.name,
        ...(typeof entry.version === 'string' ? { version: entry.version } : {}),
        description: entry.description,
        state: entry.state as FramePluginState,
      }
    }),
  }
}
