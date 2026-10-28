/**
 * Starters from a registry: `npm create acrylblends@latest my-app -- --from acryl.example`. A registry is a git repository (or a folder) with an `index.json` and one folder per
 * starter under `blends/<id>/`. Its CI says in the index which runtime an entry is for: only `runtime: acrylblends` entries are apps this package can make (the folder is the
 * app, with an `acryl.template.json`); the others are ACRYL app starters and are refused with one line. Nothing is run: the entry is downloaded, unpacked and copied.
 */
import { existsSync, readFileSync } from 'node:fs'
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
export function registryRoot(unpacked: string): string {
  for (const candidate of [unpacked, join(unpacked, 'registry')])
    if (existsSync(join(candidate, 'index.json'))) return candidate
  throw new SourceError(
    'this registry has no index.json (it is a folder with index.json and blends/<id>/)',
  )
}

/** Read the index of an unpacked registry. */
export function readRegistry(unpacked: string): { root: string; entries: RegistryEntry[] } {
  const root = registryRoot(unpacked)
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
 * not to the app made from it. Changes the `metadata` lines of `blend.yaml` and nothing else; a manifest it cannot read that way is left as it is.
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
  return lines.join('\n')
}
