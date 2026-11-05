/**
 * Starters from a registry: `npm create acrylblends@latest my-app -- --from acryl.example`. A registry is a git repository (or a folder) with an `index.json` and one folder per
 * starter under `blends/<id>/`. Its CI says in the index which runtime an entry is for: only `runtime: acrylblends` entries are apps this package can make (the folder is the
 * app, with an `acryl.template.json`); the others are ACRYL app starters and are refused with one line. Nothing is run: the entry is downloaded, unpacked and copied.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SourceError } from './source'

/** The public registry, read from its repository (the same files the site lists). */
export const DEFAULT_REGISTRY = 'github:acrylblends/acrylblends.github.io'

/** Where ACRYL app starters are opened. */
export const ACRYL_APP = 'https://acryl.dev'

/** A registry id: dotted, lower case (`acryl.gtd`, `acrylblends.notes-desktop`, `login.thing`). */
export const REGISTRY_ID = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/

export interface RegistryEntry {
  readonly id: string
  readonly name: string
  readonly version: string
  /** The entry's folder inside the registry, `blends/<id>`. */
  readonly path: string
  /** `acrylblends` (an app this package makes) or `acryl` (an ACRYL app starter). An index written before the field existed has none: those entries are ACRYL's. */
  readonly runtime: 'acrylblends' | 'acryl'
  readonly description?: string
}

/** The folder of an unpacked registry that holds `index.json`: the root, or its `registry/` folder (the public registry lives in its site's repository). */
/** @param label - the registry as the person named it (a folder's path, `github:owner/repo`), for the one line when it has no index. */
export function registryRoot(unpacked: string, label = 'this registry'): string {
  for (const candidate of [unpacked, join(unpacked, 'registry')])
    if (existsSync(join(candidate, 'index.json'))) return candidate
  throw new SourceError(
    `${label} has no index.json (a registry is a folder with index.json and blends/<id>/, or index.json in its registry/ folder)`,
  )
}

/** Read the index of an unpacked registry. */
export function readRegistry(
  unpacked: string,
  label?: string,
): { root: string; entries: RegistryEntry[] } {
  const root = registryRoot(unpacked, label)
  let data: unknown
  try {
    data = JSON.parse(readFileSync(join(root, 'index.json'), 'utf8'))
  } catch {
    throw new SourceError('the registry index.json is not valid JSON')
  }
  const list = (data as { entries?: unknown }).entries
  if (!Array.isArray(list)) throw new SourceError('the registry index.json has no entries')
  const entries: RegistryEntry[] = []
  for (const item of list as Record<string, unknown>[]) {
    if (typeof item.id !== 'string' || typeof item.path !== 'string') continue
    if (!/^blends\/[^/\\]+$/.test(item.path))
      throw new SourceError(`registry entry ${item.id} has no valid path`)
    entries.push({
      id: item.id,
      name: typeof item.name === 'string' ? item.name : item.id,
      version: typeof item.version === 'string' ? item.version : '0.0.0',
      path: item.path,
      runtime: item.runtime === 'acrylblends' ? 'acrylblends' : 'acryl',
      ...(typeof item.description === 'string' ? { description: item.description } : {}),
    })
  }
  return { root, entries }
}

/** The entry for an id. An ACRYL app starter is refused in one line; an unknown id lists the starters this package can make. */
export function pickEntry(entries: readonly RegistryEntry[], id: string): RegistryEntry {
  const entry = entries.find((candidate) => candidate.id === id)
  if (!entry) {
    const mine = entries
      .filter((candidate) => candidate.runtime === 'acrylblends')
      .map((candidate) => candidate.id)
    throw new SourceError(
      `no starter "${id}" in this registry${mine.length > 0 ? `; starters for create-acrylblends: ${mine.join(', ')}` : ''}`,
    )
  }
  if (entry.runtime !== 'acrylblends')
    throw new SourceError(
      `${entry.id} is an ACRYL app starter: open it in the ACRYL app (${ACRYL_APP}). create-acrylblends makes acrylblends apps.`,
    )
  return entry
}

/**
 * Give a pulled starter to its new owner: the manifest names the app (`acrylblends.<name>`, private), because the registry's id and its public visibility belong to the starter,
 * not to the app made from it. Changes the `metadata` lines of `blend.yaml` (the id, the name, the visibility; the licence is dropped) and nothing else; a manifest it cannot read that way is left as it is.
 */
export function ownManifest(text: string, name: string): string {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => /^metadata:\s*$/.test(line))
  if (start < 0) return text
  let end = start + 1
  while (end < lines.length && /^\s+\S|^\s*$/.test(lines[end] ?? '')) end += 1
  const set = (key: string, value: string) => {
    for (let at = start + 1; at < end; at += 1) {
      const match = new RegExp(`^(\\s+)${key}:.*$`).exec(lines[at] ?? '')
      if (match) {
        lines[at] = `${match[1]}${key}: ${value}`
        return
      }
    }
  }
  set('id', `acrylblends.${name}`)
  set('name', name)
  set('visibility', 'private')
  // The starter's licence is the starter's: the new app names none until its owner chooses one.
  for (let at = end - 1; at > start; at -= 1)
    if (/^\s+license:/.test(lines[at] ?? '')) lines.splice(at, 1)
  return lines.join('\n')
}

/**
 * Keep a pulled starter's `blend.lock.json` true to the app made from it: the lock's origin names the manifest it was written from (its id and the digest of its text,
 * as blends-core's `manifestDigest`), and {@link ownManifest} has just changed both. The plugin folders are copied unchanged, so their digests stand. A lock it cannot
 * read is left as it is (`npm run snapshot capture` writes it again).
 */
export function ownLock(text: string, manifestText: string, name: string): string {
  let lock: unknown
  try {
    lock = JSON.parse(text)
  } catch {
    return text
  }
  const origin = (lock as { origin?: unknown } | null)?.origin
  if (origin === null || typeof origin !== 'object') return text
  const owned = {
    ...(lock as object),
    origin: {
      ...origin,
      id: `acrylblends.${name}`,
      digest: createHash('sha256').update(manifestText).digest('hex'),
    },
  }
  return `${JSON.stringify(owned, null, 2)}\n`
}

/** A DSH profile name for an app, as the framework's scaffold writes it into `scripts/ide-host.mjs` (`acrylblends-<app>`). */
export function profileNameFor(appName: string): string {
  const slug = appName
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-+|-+$/gu, '')
  return `acrylblends-${slug === '' ? 'app' : slug}`
}

/** The app's name as a starter's `blend.yaml` gives it (`metadata.name`), or undefined. */
export function manifestName(text: string): string | undefined {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => /^metadata:\s*$/.test(line))
  if (start < 0) return undefined
  for (let at = start + 1; at < lines.length && /^\s+\S|^\s*$/.test(lines[at] ?? ''); at += 1) {
    const match = /^\s+name:\s*["']?([^"'#\s]+)["']?\s*(?:#.*)?$/.exec(lines[at] ?? '')
    if (match) return match[1]
  }
  return undefined
}

/**
 * Where the scaffold wrote an app's name (its `__APP_NAME__`): the headings and the `description:` line of the agents' instructions and skills,
 * the README's title, and the page's `APP_NAME` constant. A starter made from an app still says that app's name there; the app made from it says its own.
 */
const PROSE_FILES = ['AGENTS.md', 'CLAUDE.md', 'README.md']
/** The lines of those files the scaffold put the name on. */
const NAMED_LINE = /^(?:#{1,6} |description: )/
const SKILL_SCOPES = ['.claude/skills', '.agents/skills']
const CODE_FILES = ['src/routes.ts', 'src/app.ts']

/**
 * Give a starter's scaffold files the new app's name: `from` (the starter's `metadata.name`) becomes `to` where it stands as a whole name on a
 * heading or `description:` line of the agents' instructions, skills and README, and in the `APP_NAME` constant; the host script's DSH profile
 * follows. Nothing else is read for the name, so one that is also a common word (`notes`) never rewrites a route, a string or a sentence. Plugins and the lock stay as the starter
 * recorded them.
 * @returns the files it changed, relative to `dir`.
 */
export function renameApp(dir: string, from: string, to: string): string[] {
  if (from === to || !/^[A-Za-z0-9][\w.-]*$/.test(from)) return []
  const escaped = from.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const whole = new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, 'g')
  const prose = [...PROSE_FILES]
  for (const scope of SKILL_SCOPES) {
    const root = join(dir, scope)
    if (!existsSync(root)) continue
    for (const skill of readdirSync(root, { withFileTypes: true }))
      if (skill.isDirectory()) prose.push(`${scope}/${skill.name}/SKILL.md`)
  }
  const changed: string[] = []
  const rewrite = (file: string, edit: (text: string) => string) => {
    const path = join(dir, file)
    if (!existsSync(path)) return
    const text = readFileSync(path, 'utf8')
    const next = edit(text)
    if (next === text) return
    writeFileSync(path, next)
    changed.push(file)
  }
  for (const file of prose)
    rewrite(file, (text) =>
      text
        .split('\n')
        .map((line) => (NAMED_LINE.test(line) ? line.replace(whole, to) : line))
        .join('\n'),
    )
  const constant = new RegExp(`(\\bAPP_NAME = )(['"])${escaped}\\2`, 'g')
  for (const file of CODE_FILES) rewrite(file, (text) => text.replace(constant, `$1$2${to}$2`))
  // npm's lock names the root package twice (top level and `packages[""]`); a lock it cannot read is left as it is.
  rewrite('package-lock.json', (text) => {
    try {
      const lock = JSON.parse(text) as {
        name?: unknown
        packages?: Record<string, { name?: unknown }>
      }
      const root = lock.packages?.['']
      if (lock.name !== from && root?.name !== from) return text
      if (lock.name === from) lock.name = to
      if (root !== undefined && root.name === from) root.name = to
      return `${JSON.stringify(lock, null, 2)}\n`
    } catch {
      return text
    }
  })
  const profile = profileNameFor(from)
  rewrite('scripts/ide-host.mjs', (text) =>
    text.replaceAll(`'${profile}'`, `'${profileNameFor(to)}'`),
  )
  return changed
}
