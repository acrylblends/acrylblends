/**
 * App instance: everything one running app owns on this machine, decided in one place and chosen once.
 *
 * Extracted from ACRYL (`runtime/acryl-harness-runtime/src/instance/`): a sealed compartment per app (Release It!'s bulkhead), built by
 * factories that always produce a consistent family (home, port, run lock), chosen once in `main.ts`. `selectInstance` is the only code
 * that reads the environment; every plugin reads the `appInstance` service instead.
 *
 * Pure apart from `selectInstance`, which reads the given environment object. Paths are built, never checked.
 */
import { createHash } from 'node:crypto'
import { basename, join, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'

/** How the instance was chosen: from the project folder, or a home the caller pinned. */
export type AppInstanceKind = 'project' | 'pinned'

/** Where the app listens first, and whether it moves to the next free port when that one is taken. Port 0 means any free port. */
export interface PortPreference {
  readonly start: number
  readonly scan: boolean
}

export interface AppInstance {
  readonly kind: AppInstanceKind
  /** Unique on this machine: seeds the port. */
  readonly id: string
  /** Human name: the project folder's name. */
  readonly name: string
  /** The project folder: its code and its `node_modules`. */
  readonly root: string
  /** The app's own data: settings, installed extensions, the extension ledger. Never shared with another app. */
  readonly home: string
  readonly port: PortPreference
  /** The interface to listen on. Absent means loopback only; a container sets `0.0.0.0` so its published port reaches the app. */
  readonly host?: string
  /** Records the one live process of this instance. */
  readonly runLockFile: string
}

export const HOME_DIR_NAME = '.acrylblends'
export const RUN_LOCK_FILE = 'instance.json'
export const PORT_BASE = 3100
export const PORT_SPAN = 900
export const HOME_ENV = 'ACRYLBLENDS_HOME'
export const PORT_ENV = 'ACRYLBLENDS_PORT'
export const HOST_ENV = 'ACRYLBLENDS_HOST'

export class AppInstanceError extends Error {
  override name = 'AppInstanceError'
}

/** FNV-1a over the id: stable across runs and platforms, spread over the app port range, so two apps rarely start on the same port. */
export function stablePort(id: string): number {
  let hash = 0x811c9dc5
  for (const character of id) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return PORT_BASE + (hash % PORT_SPAN)
}

const digest = (text: string, length: number) =>
  createHash('sha1').update(text).digest('hex').slice(0, length)
const plainName = (folder: string) =>
  basename(folder)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'app'

function family(input: {
  kind: AppInstanceKind
  id: string
  name: string
  root: string
  home: string
  port: PortPreference
}): AppInstance {
  return Object.freeze({
    kind: input.kind,
    id: input.id,
    name: input.name,
    root: input.root,
    home: input.home,
    port: Object.freeze({ ...input.port }),
    runLockFile: join(input.home, RUN_LOCK_FILE),
  })
}

/** The default: the project folder owns its data in `<project>/.acrylblends`. Two folders with one name get different ids. */
export function projectInstance(projectRoot: string): AppInstance {
  const root = resolve(projectRoot)
  const name = plainName(root)
  const id = `${name}-${digest(root, 4)}`
  return family({
    kind: 'project',
    id,
    name,
    root,
    home: join(root, HOME_DIR_NAME),
    port: { start: stablePort(id), scan: true },
  })
}

/**
 * A home the caller pinned (ACRYLBLENDS_HOME): honoured as given. Tests and second copies of an app use it to stay apart. `root` is the
 * project folder (where its packages are installed); it defaults to the current directory.
 */
export function pinnedInstance(
  home: string,
  options: { name?: string; root?: string } = {},
): AppInstance {
  const absolute = resolve(home)
  const root = resolve(options.root ?? process.cwd())
  const id = `pinned-${digest(absolute, 6)}`
  return family({
    kind: 'pinned',
    id,
    name: options.name ?? plainName(root),
    root,
    home: absolute,
    port: { start: stablePort(id), scan: true },
  })
}

/** The same family with an explicit start port. Port 0 asks the system for any free port. */
export function withPort(instance: AppInstance, start: number): AppInstance {
  if (!Number.isInteger(start) || start < 0 || start > 65_535) {
    throw new AppInstanceError(
      `the port must be 0 (any free port) or 1 to 65535, got ${String(start)}`,
    )
  }
  return Object.freeze({ ...instance, port: Object.freeze({ start, scan: start !== 0 }) })
}

/**
 * Choose the instance. The only place that reads the environment: `ACRYLBLENDS_HOME` pins the home, `ACRYLBLENDS_PORT` sets the start port, `ACRYLBLENDS_HOST` the interface;
 * otherwise the project folder decides.
 */
export function selectInstance(options: {
  projectRoot: string
  env?: Record<string, string | undefined>
}): AppInstance {
  const env = options.env ?? {}
  const pinned = env[HOME_ENV]?.trim()
  let instance = pinned
    ? pinnedInstance(pinned, { name: plainName(options.projectRoot), root: options.projectRoot })
    : projectInstance(options.projectRoot)
  const port = env[PORT_ENV]?.trim()
  if (port) instance = withPort(instance, Number(port))
  const host = env[HOST_ENV]?.trim()
  if (host) instance = Object.freeze({ ...instance, host })
  return instance
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    appInstance: AppInstance
  }
}

/** Provides the chosen instance as the `appInstance` service. Mount it first, with the instance as its config. */
export const instance = {
  name: 'instance',
  apply(ctx: Context, chosen: AppInstance) {
    ctx.provide('appInstance', chosen)
  },
}
