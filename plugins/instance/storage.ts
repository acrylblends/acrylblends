/**
 * Where a desktop product keeps its apps (specs/049-framework-architecture/app-storage.md in ACRYL): one root per product in the OS per-user application
 * data folder, and one sealed folder per app inside it.
 *
 *   <root>/layout.json             { "layout": 1, "writtenBy": "<product version>" }
 *   <root>/apps.json               the registry: id, name, created, last opened
 *   <root>/apps/<id>/source/       the person's work: a git repository
 *   <root>/apps/<id>/data/         their settings, sessions and notes; data/logs holds the logs (the engine writes `<home>/logs`)
 *   <root>/apps/<id>/cache/        build output: rebuilt on demand
 *   <root>/electron/               Chromium's own user data
 *   <root>/trash/                  an app that was started over, moved here, never deleted
 *
 * The per-OS rule is `platformDataDir`, a pure function, so all three platforms are tested on one machine. Nothing else in the product reads the home
 * folder or asks Electron for a path (scripts/lib/bulkhead.test.mjs). No file written here holds an absolute path: the root and the bundle can move.
 */
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, posix, win32 } from 'node:path'
import { AppInstanceError } from './index.ts'

/** The layout this build writes and reads. A root with a lower one is migrated on open (a later slice); a higher one is refused. */
export const LAYOUT_VERSION = 1
export const LAYOUT_FILE = 'layout.json'
export const REGISTRY_FILE = 'apps.json'
export const APPS_DIR = 'apps'
export const TRASH_DIR = 'trash'
export const ELECTRON_DIR = 'electron'

/** The person's home folder: the one place the product asks the OS for it. `HOME` (or `USERPROFILE` on Windows) wins, so an isolated run moves it. */
export function personHome(
  env: Readonly<Record<string, string | undefined>> = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  const fromEnv = (platform === 'win32' ? env.USERPROFILE : env.HOME)?.trim()
  return fromEnv !== undefined && fromEnv !== '' ? fromEnv : homedir()
}

/**
 * The OS per-user application data folder, without the product's name. macOS: `~/Library/Application Support`. Windows: `%LOCALAPPDATA%` (per machine,
 * never the roaming profile: an app's repository and packages must not sync at logon), else `<home>\AppData\Local`. Linux and the rest:
 * `$XDG_DATA_HOME` when it is absolute (the XDG spec makes a relative one invalid), else `~/.local/share`.
 */
export function platformDataDir(
  platform: NodeJS.Platform,
  env: Readonly<Record<string, string | undefined>>,
  home: string,
): string {
  if (platform === 'darwin') return posix.join(home, 'Library', 'Application Support')
  if (platform === 'win32') {
    const local = env.LOCALAPPDATA?.trim()
    return local !== undefined && win32.isAbsolute(local)
      ? win32.normalize(local)
      : win32.join(home, 'AppData', 'Local')
  }
  const xdg = env.XDG_DATA_HOME?.trim()
  return xdg !== undefined && posix.isAbsolute(xdg)
    ? posix.normalize(xdg)
    : posix.join(home, '.local', 'share')
}

/** The path module of a platform, so a root computed for Windows on a Mac is a Windows path. */
const pathOf = (platform: NodeJS.Platform) => (platform === 'win32' ? win32 : posix)

/** A product's root: its name under the platform's data folder. The name is a folder name the product chose, so it is checked, not cleaned. */
export function productRoot(
  product: string,
  platform: NodeJS.Platform,
  env: Readonly<Record<string, string | undefined>>,
  home: string,
): string {
  if (!isPortableName(product, 64))
    throw new AppInstanceError(`"${product}" cannot be a folder name on every OS`)
  return pathOf(platform).join(platformDataDir(platform, env, home), product)
}

/** Windows refuses these as a file or folder name, whatever the case and whatever follows a dot. */
const RESERVED = /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(\..*)?$/iu

/** A control character (U+0000 to U+001F): never in a file name on Windows, never in a one-line label. */
const hasControlCharacter = (text: string): boolean =>
  [...text].some((character) => (character.codePointAt(0) ?? 0) < 0x20)

/** A name every OS accepts as one path segment: no separators or characters Windows forbids, no trailing dot or space, not reserved, not too long. */
export function isPortableName(name: string, maxLength: number): boolean {
  return (
    name.length > 0 &&
    name.length <= maxLength &&
    name.trim() === name &&
    !name.endsWith('.') &&
    !/[<>:"/\\|?*]/u.test(name) &&
    !hasControlCharacter(name) &&
    !RESERVED.test(name)
  )
}

/** An app id: lower-case ASCII letters, digits and single dashes, 40 characters at most, never reserved. Compared as is (always lower-case). */
export function isAppId(id: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id) && isPortableName(id, 40)
}

/**
 * A new app's id: the name, folded to ASCII lower-case and dashes, cut to 30 characters, then 4 random hex digits (`my-notes-3f2a`). The name stays a label;
 * renaming the app never moves its folder.
 */
export function newAppId(
  name: string,
  random: () => string = () => randomBytes(2).toString('hex'),
): string {
  const base =
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '-')
      .slice(0, 30)
      .replace(/^-+|-+$/gu, '') || 'app'
  const id = `${base}-${random()}`
  if (!isAppId(id))
    throw new AppInstanceError(`could not make an app id from "${name}" (got "${id}")`)
  return id
}

/** One app's folders. `logs` is inside `data` because the engine writes its logs to `<home>/logs`. */
export interface ProductAppFolders {
  readonly id: string
  readonly source: string
  readonly data: string
  readonly cache: string
  readonly logs: string
}

/** The folders of app `id` under `root`, built, never checked. */
export function appFolders(
  root: string,
  id: string,
  platform: NodeJS.Platform = process.platform,
): ProductAppFolders {
  if (!isAppId(id)) throw new AppInstanceError(`"${id}" is not an app id`)
  const path = pathOf(platform)
  const folder = path.join(root, APPS_DIR, id)
  const data = path.join(folder, 'data')
  return Object.freeze({
    id,
    source: path.join(folder, 'source'),
    data,
    cache: path.join(folder, 'cache'),
    logs: path.join(data, 'logs'),
  })
}

/** One app in the registry. Dates are ISO strings; nothing here is a path. */
export interface RegisteredApp {
  readonly id: string
  readonly name: string
  readonly created: string
  readonly lastOpened?: string
}

/** What `openRoot` found: a root this build writes, or one written by a newer build (refused by the caller with the version it names). */
export type RootState =
  | { readonly kind: 'current' }
  | { readonly kind: 'older'; readonly layout: number }
  | { readonly kind: 'newer'; readonly layout: number; readonly writtenBy: string }

/** A JSON file written whole: to a sibling first, then renamed over, so a crash never leaves half a file. */
function writeJson(file: string, value: unknown): void {
  const next = `${file}.next`
  writeFileSync(next, `${JSON.stringify(value, null, 2)}\n`)
  renameSync(next, file)
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8')) as unknown
}

/**
 * Open a product root, creating it on the first start: `layout.json` and an empty `apps.json`. A root written by a newer layout is reported, never
 * changed; an older one is reported for the migration runner. A layout file that is not this format stops with a message, never a guess.
 */
export function openRoot(root: string, writtenBy: string): RootState {
  const file = join(root, LAYOUT_FILE)
  if (!existsSync(file)) {
    mkdirSync(root, { recursive: true })
    writeJson(join(root, REGISTRY_FILE), { apps: [] })
    writeJson(file, { layout: LAYOUT_VERSION, writtenBy })
    return { kind: 'current' }
  }
  const value = readJson(file) as { layout?: unknown; writtenBy?: unknown }
  if (typeof value.layout !== 'number' || !Number.isInteger(value.layout) || value.layout < 1)
    throw new AppInstanceError(`${file} has no layout version; it was not written by this product`)
  if (value.layout > LAYOUT_VERSION)
    return {
      kind: 'newer',
      layout: value.layout,
      writtenBy: typeof value.writtenBy === 'string' ? value.writtenBy : 'a newer version',
    }
  if (value.layout < LAYOUT_VERSION) return { kind: 'older', layout: value.layout }
  return { kind: 'current' }
}

/** The apps the root holds, in the order they were made. */
export function listApps(root: string): RegisteredApp[] {
  const value = readJson(join(root, REGISTRY_FILE)) as { apps?: unknown }
  if (!Array.isArray(value.apps))
    throw new AppInstanceError(`${join(root, REGISTRY_FILE)} has no app list`)
  return value.apps.filter(
    (app): app is RegisteredApp =>
      app !== null &&
      typeof app === 'object' &&
      typeof (app as RegisteredApp).id === 'string' &&
      isAppId((app as RegisteredApp).id) &&
      typeof (app as RegisteredApp).name === 'string',
  )
}

function saveApps(root: string, apps: readonly RegisteredApp[]): void {
  writeJson(join(root, REGISTRY_FILE), { apps })
}

/** A name a person gave: trimmed, one line, not empty, 80 characters at most. It is a label only, so any script is fine. */
function checkedName(name: string): string {
  const trimmed = name.trim()
  if (trimmed === '' || trimmed.length > 80 || hasControlCharacter(trimmed))
    throw new AppInstanceError('an app name is one line of 1 to 80 characters')
  return trimmed
}

/** Make a new app: its id, its four folders, its registry entry. Returns the entry. */
export function createApp(
  root: string,
  name: string,
  options: { now?: () => Date; random?: () => string } = {},
): RegisteredApp {
  const label = checkedName(name)
  const apps = listApps(root)
  const taken = new Set(apps.map((app) => app.id))
  let id = newAppId(label, options.random)
  for (let attempt = 0; taken.has(id) || existsSync(join(root, APPS_DIR, id)); attempt += 1) {
    if (attempt > 16) throw new AppInstanceError(`no free id for "${label}"`)
    id = newAppId(label)
  }
  const folders = appFolders(root, id)
  for (const folder of [folders.source, folders.logs, folders.cache])
    mkdirSync(folder, { recursive: true })
  const entry: RegisteredApp = {
    id,
    name: label,
    created: (options.now?.() ?? new Date()).toISOString(),
  }
  saveApps(root, [...apps, entry])
  return entry
}

/** Give an app a new name. The folder keeps its id. */
export function renameApp(root: string, id: string, name: string): RegisteredApp {
  const label = checkedName(name)
  const apps = listApps(root)
  const found = apps.find((app) => app.id === id)
  if (found === undefined) throw new AppInstanceError(`no app "${id}" in ${root}`)
  const renamed: RegisteredApp = { ...found, name: label }
  saveApps(
    root,
    apps.map((app) => (app.id === id ? renamed : app)),
  )
  return renamed
}

/** Record that an app was opened now. */
export function touchApp(root: string, id: string, now: () => Date = () => new Date()): void {
  const apps = listApps(root)
  if (!apps.some((app) => app.id === id)) throw new AppInstanceError(`no app "${id}" in ${root}`)
  saveApps(
    root,
    apps.map((app) => (app.id === id ? { ...app, lastOpened: now().toISOString() } : app)),
  )
}
