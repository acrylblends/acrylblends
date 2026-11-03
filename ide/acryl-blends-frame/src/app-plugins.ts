/**
 * The app's plugins for Settings → Plugins, read and switched in the app's own files: `blend.yaml` (a row is off with `disabled: true`; a plugin
 * from `plugins/` is off when the `extensions` row's `off` list names it) and the `plugins/` folder (what was written after the app was made, as the
 * `extensions` row finds it). `blend.yaml` is edited by lines, so its comments and layout stay as the person wrote them. The running app takes a
 * switch when its Loader row (`app-plugins`) loads again, which the client asks for.
 */

import { existsSync } from 'node:fs'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import type { AppPluginView, FramePluginState, FramePluginView } from './contract.ts'

/** One row of `blend.yaml`'s `spec.rows`: where its block starts and ends (line indexes, end exclusive). */
export interface BlendRow {
  readonly id: string
  readonly name: string
  readonly disabled: boolean
  /** The comment lines right above the row, joined: what the row is for. */
  readonly comment: string
  readonly start: number
  readonly end: number
}

const ROW_START = /^(\s*)- id:\s*["']?([\w.@/-]+)["']?\s*$/

export function parseBlendRows(text: string): BlendRow[] {
  const lines = text.split('\n')
  const rows: BlendRow[] = []
  const rowsAt = lines.findIndex(line => /^\s*rows:\s*$/.test(line))
  if (rowsAt < 0) return rows
  for (let index = rowsAt + 1; index < lines.length; index += 1) {
    const match = ROW_START.exec(lines[index] as string)
    if (match === null) continue
    const indent = (match[1] as string).length
    let end = index + 1
    while (end < lines.length) {
      const line = lines[end] as string
      if (line.trim() !== '' && !line.trim().startsWith('#') && line.search(/\S/) <= indent) break
      end += 1
    }
    // A comment line right before the next row belongs to that row: end the block before it.
    while (end > index + 1 && (lines[end - 1] as string).trim().startsWith('#')) end -= 1
    const block = lines.slice(index + 1, end)
    const name = block.map(line => /^\s*name:\s*["']?([^"'#\s]+)/.exec(line)?.[1]).find(found => found !== undefined) ?? match[2] as string
    const comment: string[] = []
    for (let above = index - 1; above > rowsAt && (lines[above] as string).trim().startsWith('#'); above -= 1)
      comment.unshift((lines[above] as string).trim().replace(/^#\s?/, ''))
    rows.push({
      id: match[2] as string,
      name,
      disabled: block.some(line => /^\s*disabled:\s*true\s*(#.*)?$/.test(line)),
      comment: comment.join(' '),
      start: index,
      end,
    })
  }
  return rows
}

/** `blend.yaml` with one row switched: `disabled: true` added under its id, or removed. */
export function setRowOn(text: string, id: string, on: boolean): string {
  const row = parseBlendRows(text).find(entry => entry.id === id)
  if (row === undefined) throw new Error(`blend.yaml has no row "${id}"`)
  const lines = text.split('\n')
  if (on) {
    const kept = lines.filter((line, index) => !(index > row.start && index < row.end && /^\s*disabled:\s*true\s*(#.*)?$/.test(line)))
    return kept.join('\n')
  }
  if (row.disabled) return text
  const indent = ' '.repeat((lines[row.start] as string).search(/-/) + 2)
  lines.splice(row.start + 1, 0, `${indent}disabled: true`)
  return lines.join('\n')
}

/** The plugins from `plugins/` the `extensions` row's `off` list names. */
export function extensionsOff(text: string): string[] {
  const row = parseBlendRows(text).find(entry => entry.name === 'extensions')
  if (row === undefined) return []
  const line = text.split('\n').slice(row.start, row.end).find(entry => /^\s*off:\s*\[/.test(entry))
  const list = line === undefined ? undefined : /\[(.*)\]/.exec(line)?.[1]
  return list === undefined ? [] : list.split(',').map(name => name.trim().replace(/^["']|["']$/g, '')).filter(name => name !== '')
}

/** `blend.yaml` with a plugin from `plugins/` switched: its name taken out of, or put in, the `extensions` row's `off` list. */
export function setMadeOn(text: string, name: string, on: boolean): string {
  const row = parseBlendRows(text).find(entry => entry.name === 'extensions')
  if (row === undefined) throw new Error('blend.yaml has no extensions row, which starts the plugins in plugins/')
  const current = extensionsOff(text)
  const next = on ? current.filter(entry => entry !== name) : current.includes(name) ? current : [...current, name]
  const lines = text.split('\n')
  const block = lines.slice(row.start, row.end)
  const offAt = block.findIndex(entry => /^\s*off:\s*\[/.test(entry))
  const configAt = block.findIndex(entry => /^\s*config:\s*$/.test(entry))
  const fieldIndent = ' '.repeat((lines[row.start] as string).search(/-/) + 2)
  if (offAt >= 0) {
    const at = row.start + offAt
    const indent = (lines[at] as string).slice(0, (lines[at] as string).search(/\S/))
    if (next.length === 0) lines.splice(at, 1)
    else lines[at] = `${indent}off: [${next.join(', ')}]`
  } else if (next.length > 0) {
    if (configAt >= 0) lines.splice(row.start + configAt + 1, 0, `${fieldIndent}  off: [${next.join(', ')}]`)
    else lines.splice(row.end, 0, `${fieldIndent}config:`, `${fieldIndent}  off: [${next.join(', ')}]`)
  }
  return lines.join('\n')
}

const ENTRIES = ['index.ts', 'index.js', 'index.mjs']
const NAME = /^[a-z0-9][a-z0-9-]*$/

/** The folders in `plugins/` the `extensions` row starts: not a library copy (`library.json`), and with an entry file. */
export async function madePlugins(root: string): Promise<string[]> {
  const dir = join(root, 'plugins')
  if (!existsSync(dir)) return []
  let library = new Set<string>()
  try {
    const listed = (JSON.parse(await readFile(join(dir, 'library.json'), 'utf8')) as { plugins?: unknown }).plugins
    if (Array.isArray(listed)) library = new Set(listed.filter((entry): entry is string => typeof entry === 'string'))
  } catch {
    // No library list: every folder is the app's own.
  }
  const entries = await readdir(dir, { withFileTypes: true })
  return entries
    .filter(entry => entry.isDirectory() && NAME.test(entry.name) && !library.has(entry.name) && ENTRIES.some(file => existsSync(join(dir, entry.name, file))))
    .map(entry => entry.name)
    .sort()
}

/** The first sentence of a file's leading doc comment, without its code marks. */
export function docSummary(source: string): string {
  const comment = /^\s*\/\*\*([\s\S]*?)\*\//.exec(source)?.[1]
  if (comment === undefined) return ''
  const paragraph = comment.split('\n').map(line => line.replace(/^\s*\*\s?/, '').trim())
  const end = paragraph.indexOf('', paragraph.findIndex(line => line !== ''))
  return firstSentence(paragraph.slice(0, end < 0 ? undefined : end).join(' '))
}

/** The first sentence of a text, without code marks, cut to a line's length. */
export function firstSentence(text: string): string {
  const plain = text.replace(/`/g, '').trim()
  const sentence = /^.+?[.!?](\s|$)/.exec(plain)?.[0].trim() ?? plain
  return sentence.length > 160 ? `${sentence.slice(0, 157).trimEnd()}...` : sentence
}

async function packageDescription(dir: string): Promise<string> {
  try {
    const parsed = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as { description?: unknown }
    if (typeof parsed.description === 'string') return parsed.description
  } catch {
    // No package.json: try the entry's doc comment, then the README.
  }
  for (const entry of [...ENTRIES, ...ENTRIES.map(file => join('src', file))]) {
    try {
      const summary = docSummary(await readFile(join(dir, entry), 'utf8'))
      if (summary !== '') return summary
    } catch {
      // Not this entry file.
    }
  }
  try {
    const readme = await readFile(join(dir, 'README.md'), 'utf8')
    return readme.split('\n').map(line => line.trim()).find(line => line !== '' && !line.startsWith('#')) ?? ''
  } catch {
    return ''
  }
}

/** Who a commit says made it: an agent named in a `Co-Authored-By` trailer, else the commit's author. */
export function commitMaker(author: string, body: string): string {
  const trailer = /^co-authored-by:\s*([^<\n]+?)\s*(<|$)/im.exec(body)?.[1]
  return trailer ?? author
}

export interface GitPort {
  run(args: readonly string[], cwd: string): Promise<{ readonly stdout: string }>
}

async function firstCommit(git: GitPort, root: string, path: string): Promise<{ by: string; at: string } | undefined> {
  try {
    const { stdout } = await git.run(['log', '--diff-filter=A', '--format=%an%x00%aI%x00%B%x1e', '--', path], root)
    const records = stdout.split('\x1e').map(record => record.trim()).filter(record => record !== '')
    const oldest = records.at(-1)
    if (oldest === undefined) return undefined
    const [author = '', at = '', body = ''] = oldest.split('\0')
    return { by: commitMaker(author, body), at }
  } catch {
    return undefined
  }
}

/** The library release each library copy in `plugins/` came from (`library.lock.json`). */
async function libraryVersions(root: string): Promise<Map<string, string>> {
  const versions = new Map<string, string>()
  try {
    const plugins = (JSON.parse(await readFile(join(root, 'plugins', 'library.lock.json'), 'utf8')) as { plugins?: unknown }).plugins
    if (plugins !== null && typeof plugins === 'object') {
      for (const [name, entry] of Object.entries(plugins)) {
        const from = entry !== null && typeof entry === 'object' ? (entry as { from?: unknown }).from : undefined
        if (typeof from === 'string') versions.set(name, from)
      }
    }
  } catch {
    // No lock: no versions to show.
  }
  return versions
}

/** Every plugin of the app: the `blend.yaml` rows in their order, then the plugins written into `plugins/`. */
export async function readAppPlugins(root: string, git: GitPort): Promise<AppPluginView[]> {
  const text = await readFile(join(root, 'blend.yaml'), 'utf8')
  const off = new Set(extensionsOff(text))
  const versions = await libraryVersions(root)
  const rows = await Promise.all(parseBlendRows(text).map(async (row): Promise<AppPluginView> => {
    const description = row.comment !== '' ? firstSentence(row.comment) : await packageDescription(join(root, 'plugins', row.name))
    const version = versions.get(row.name)
    return { name: row.name, kind: 'row', ...(version === undefined ? {} : { version }), description, on: !row.disabled }
  }))
  const made = await Promise.all((await madePlugins(root)).map(async (name): Promise<AppPluginView> => {
    const [description, first] = await Promise.all([packageDescription(join(root, 'plugins', name)), firstCommit(git, root, `plugins/${name}`)])
    return {
      name,
      kind: 'made',
      ...(first === undefined ? { unsaved: true } : { by: first.by, at: first.at }),
      description,
      on: !off.has(name),
    }
  }))
  return [...made, ...rows]
}

/** Switch one plugin in `blend.yaml`. @throws when there is no such plugin. */
export async function switchAppPlugin(root: string, kind: 'row' | 'made', name: string, on: boolean): Promise<void> {
  const file = join(root, 'blend.yaml')
  const text = await readFile(file, 'utf8')
  let next: string
  if (kind === 'made') {
    if (!(await madePlugins(root)).includes(name)) throw new Error(`plugins/ has no plugin "${name}"`)
    next = setMadeOn(text, name, on)
  } else {
    const row = parseBlendRows(text).find(entry => entry.name === name)
    if (row === undefined) throw new Error(`blend.yaml has no row "${name}"`)
    next = setRowOn(text, row.id, on)
  }
  if (next !== text) await writeFile(file, next)
}

/** The frame's own Loader rows the list shows: ACRYL's plugins around the app, not DSH's engine rows nor the rows that run the app. */
export function isFramePlugin(moduleName: string, entryId: string): boolean {
  if (entryId.startsWith('app-') || entryId === 'acryl-door') return false
  return moduleName.startsWith('acryl-') || moduleName.startsWith('dsh-client-ui-brand-acryl')
}

/** A Loader row as the frame reads it: its id, module, whether it is switched off, and its fiber's state (Cordis `FiberState`). */
export interface FrameRow {
  readonly id: string
  readonly name: string
  readonly disabled: boolean
  readonly fiberState: number | undefined
}

/** Cordis `FiberState`: PENDING 0, LOADING 1, ACTIVE 2, FAILED 3. */
export function frameRowState(row: FrameRow): FramePluginState {
  if (row.disabled) return 'off'
  if (row.fiberState === 3) return 'failed'
  if (row.fiberState === 2) return 'active'
  return 'waiting'
}

/** A module's package.json, found from the app folder. */
async function modulePackage(root: string, name: string): Promise<{ version?: string; description?: string } | undefined> {
  let file: string
  try {
    file = createRequire(join(root, 'package.json')).resolve(name)
  } catch {
    return undefined
  }
  for (let dir = dirname(file); dir !== dirname(dir); dir = dirname(dir)) {
    try {
      const parsed = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as { name?: unknown; version?: unknown; description?: unknown }
      if (parsed.name !== name) continue
      return {
        ...(typeof parsed.version === 'string' ? { version: parsed.version } : {}),
        ...(typeof parsed.description === 'string' ? { description: parsed.description } : {}),
      }
    } catch {
      // No package.json here: one folder up.
    }
  }
  return undefined
}

/** The frame's own plugins, in Loader order, each with its release and what it does. */
export async function readFramePlugins(root: string, rows: readonly FrameRow[]): Promise<FramePluginView[]> {
  return Promise.all(rows.filter(row => isFramePlugin(row.name, row.id)).map(async (row): Promise<FramePluginView> => {
    const manifest = await modulePackage(root, row.name)
    return {
      id: row.id,
      name: row.name,
      ...(manifest?.version === undefined ? {} : { version: manifest.version }),
      description: manifest?.description ?? '',
      state: frameRowState(row),
    }
  }))
}
