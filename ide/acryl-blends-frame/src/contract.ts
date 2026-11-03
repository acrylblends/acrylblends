/** The one route the frame's client reads: what the frame shows around the app, from the Host that serves it. */

export const FRAME_API_PREFIX = '/api/acryl-blends-frame'
export const FRAME_STATE_PATH = `${FRAME_API_PREFIX}/state`
/** POST `{ name }`: a new branch from the checked-out version, switched to (the files stay as they are). */
export const FRAME_BRANCHES_NEW_PATH = `${FRAME_API_PREFIX}/branches/new`
/** POST `{ name }`: the app's folder moves to an existing local branch. */
export const FRAME_BRANCHES_SWITCH_PATH = `${FRAME_API_PREFIX}/branches/switch`
/** GET: `{ chats: { <session id>: <branch> } }`; POST `{ id, branch }`: record which branch a chat was opened on. */
export const FRAME_BRANCH_CHATS_PATH = `${FRAME_API_PREFIX}/branches/chats`
/** POST `{ hashes }`: which of these versions are also on another branch or the remote. */
export const FRAME_VERSIONS_SHARED_PATH = `${FRAME_API_PREFIX}/versions/shared`

/** @throws when the answer is not a list of version hashes. */
export function parseSharedVersions(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.shared)) throw new Error('shared versions: not a list')
  return value.shared.map((hash: unknown) => {
    if (typeof hash !== 'string' || hash === '') throw new Error('shared versions: entry')
    return hash
  })
}

/** @throws when the answer is not a map of chat id to branch name. */
export function parseBranchChats(value: unknown): Record<string, string> {
  if (!isRecord(value) || !isRecord(value.chats)) throw new Error('branch chats: not a map')
  const chats: Record<string, string> = {}
  for (const [id, branch] of Object.entries(value.chats)) {
    if (id === '' || typeof branch !== 'string' || branch === '') throw new Error('branch chats: entry')
    chats[id] = branch
  }
  return chats
}

/**
 * Why a name cannot be a new branch, in words for the person typing it; `undefined` when it can. The Host asks git as well
 * (`check-ref-format --branch`), so this only catches what is plain to see while typing.
 */
export function branchNameProblem(name: string): string | undefined {
  if (name.trim() === '') return 'Name the branch.'
  if (name.length > 100) return 'Use a shorter name.'
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(name)) return 'Use letters, digits, - _ . and /, starting with a letter or digit.'
  if (name.includes('..') || name.includes('//') || name.endsWith('/') || name.endsWith('.') || name.endsWith('.lock')) return 'That is not a name git accepts.'
  return undefined
}

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

export const FRAME_FEEDBACK_PATH = `${FRAME_API_PREFIX}/feedback`
export const FRAME_FEEDBACK_SEEN_PATH = `${FRAME_API_PREFIX}/feedback/seen`

/** One note a person sent from the app (the `feedback` plugin), as the left panel shows it. */
export interface FeedbackNoteView {
  readonly id: string
  /** ISO time it was sent. */
  readonly at: string
  readonly text: string
  /** The page's path it was sent from. */
  readonly page: string
  /** The element it was pinned on; absent for "Nothing specific". */
  readonly element?: { readonly selector: string; readonly label: string }
  readonly seen: boolean
}

/** `available` is false when the app has no `feedback` plugin (or it is switched off): the left panel then shows no section. */
export interface FeedbackView {
  readonly available: boolean
  readonly notes: readonly FeedbackNoteView[]
}

/** @throws when the value is not a list of notes. */
export function parseFeedbackNotes(value: unknown): FeedbackNoteView[] {
  if (!Array.isArray(value)) throw new Error('feedback: not a list')
  return value.map((entry: unknown) => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.at !== 'string' || typeof entry.text !== 'string'
      || typeof entry.page !== 'string' || typeof entry.seen !== 'boolean') throw new Error('feedback: note')
    const element = entry.element
    const pinned = isRecord(element) && typeof element.selector === 'string' && typeof element.label === 'string'
      ? { element: { selector: element.selector, label: element.label } }
      : {}
    return { id: entry.id, at: entry.at, text: entry.text, page: entry.page, ...pinned, seen: entry.seen }
  })
}

/** @throws when the answer is not a feedback view. */
export function parseFeedbackView(value: unknown): FeedbackView {
  if (!isRecord(value) || typeof value.available !== 'boolean') throw new Error('feedback: not a view')
  return { available: value.available, notes: parseFeedbackNotes(value.notes) }
}

/** GET `?session=<id>`: what each of that chat's turns saved (`ChatSavesView`). */
export const FRAME_CHAT_SAVES_PATH = `${FRAME_API_PREFIX}/chat-saves`

/** The save point the frame made by itself when a chat turn changed the app's files. */
export interface TurnSaveView {
  /** The chat turn (DSH's turn number) that changed the files. */
  readonly turn: number
  /** The files the turn changed, relative to the app's folder. */
  readonly files: readonly string[]
  /** The version the turn was saved as: its commit, how many versions the branch had then (`v7`), and what it was called. */
  readonly hash: string
  readonly version: number
  readonly subject: string
}

export interface ChatSavesView {
  readonly saves: readonly TurnSaveView[]
}

/** @throws when the value is not a list of turn saves. */
export function parseChatSaves(value: unknown): ChatSavesView {
  if (!isRecord(value) || !Array.isArray(value.saves)) throw new Error('chat saves: not a list')
  return {
    saves: value.saves.map((entry: unknown) => {
      if (!isRecord(entry) || typeof entry.turn !== 'number' || !Number.isInteger(entry.turn) || !Array.isArray(entry.files)
        || !entry.files.every((file: unknown) => typeof file === 'string') || typeof entry.hash !== 'string' || entry.hash === ''
        || typeof entry.version !== 'number' || !Number.isInteger(entry.version) || entry.version < 1 || typeof entry.subject !== 'string') {
        throw new Error('chat saves: entry')
      }
      return { turn: entry.turn, files: entry.files as string[], hash: entry.hash, version: entry.version, subject: entry.subject }
    }),
  }
}

/** GET: the chats that have at least one turn (`RealChatsView`); a chat nobody has written to is not a chat the frame lists. */
export const FRAME_REAL_CHATS_PATH = `${FRAME_API_PREFIX}/real-chats`

export interface RealChatsView {
  readonly sessions: readonly string[]
}

/** @throws when the value is not a list of chat ids. */
export function parseRealChats(value: unknown): RealChatsView {
  if (!isRecord(value) || !Array.isArray(value.sessions) || !value.sessions.every((id: unknown) => typeof id === 'string')) throw new Error('real chats: not a list')
  return { sessions: value.sessions as string[] }
}
