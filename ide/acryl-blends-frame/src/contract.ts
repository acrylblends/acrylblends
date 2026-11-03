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
