import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Plugins that `acrylblends add` mounts itself: a row in `blend.yaml` (after the row it needs, before the `routes` row) and an entry in the `registry` of `src/app.ts`.
 * `needs` are the rows the plugin cannot run without; an app that lacks them is refused before anything is copied.
 */
export interface Mounted {
  readonly name: string
  /** The identifier of the registry import, and the plugin names (the `name:` of a row) it needs. */
  readonly local: string
  readonly needs: readonly string[]
  /** The row this one goes after (it goes before `routes` otherwise). */
  readonly after?: string
  /** The `id:` of its row, when it is not the plugin's name (`db` for acryl-db-sqlite). */
  readonly row?: string
  /** Its entry file inside the plugin's folder (`index.ts`, or `src/index.ts` for the plugins that keep their source in `src/`). */
  readonly entry?: string
}

export const MOUNTED: readonly Mounted[] = [
  { name: 'agent-panel', local: 'panel', needs: ['agent', 'extensions'] },
  { name: 'driver-pty', local: 'driverPty', needs: ['agent-panel'], after: 'agent-panel' },
  { name: 'driver-acp', local: 'driverAcp', needs: ['agent-panel'], after: 'agent-panel' },
  { name: 'acryl-db-sqlite', local: 'dbSqlite', needs: [], row: 'db', entry: 'src/index.ts' },
  { name: 'acryl-kv-json', local: 'kvJson', needs: [], row: 'kv', entry: 'src/index.ts' },
]

const ROW = /^( *)- id: ?(\S+)\n\1 {2}name: ?(\S+)\n/gmu

/** The `name:` of every row of the app's `blend.yaml`, or `undefined` when it has none. */
export function rowNames(appDir: string): string[] | undefined {
  const file = join(appDir, 'blend.yaml')
  if (!existsSync(file)) return undefined
  return [...readFileSync(file, 'utf8').matchAll(ROW)].map((match) => match[3] as string)
}

/** What a plugin to be mounted is missing: the rows it needs that neither the app nor this same command brings. */
export function missingRows(
  appDir: string,
  plugin: Mounted,
  alsoAdded: readonly string[],
): string[] {
  const have = rowNames(appDir) ?? []
  return plugin.needs.filter((need) => !have.includes(need) && !alsoAdded.includes(need))
}

export interface MountResult {
  readonly done: boolean
  /** What was edited, or why it was not (the person finishes by hand). */
  readonly note: string
}

/** Add the row to `blend.yaml` and the entry to `src/app.ts`; each only when it is not there yet and its place is where the template puts it. */
export function mount(appDir: string, plugin: Mounted): MountResult {
  const done: string[] = []
  const failed: string[] = []
  const manifestFile = join(appDir, 'blend.yaml')
  if (existsSync(manifestFile)) {
    let text = readFileSync(manifestFile, 'utf8')
    if ([...text.matchAll(ROW)].some((match) => match[3] === plugin.name))
      done.push('blend.yaml (already has the row)')
    else {
      const anchor = plugin.after
        ? new RegExp(
            `^( *)- id: ?\\S+\\n\\1 {2}name: ?${plugin.after}\\n(?:\\1 {2}config:\\n(?:\\1 {4}.*\\n|\\1 {2}\\s*\\n)*)?`,
            'mu',
          )
        : /^( *)- id: ?routes\n/mu
      const found = anchor.exec(text)
      if (found) {
        const indent = found[1] as string
        const row = `${indent}- id: ${plugin.row ?? plugin.name}\n${indent}  name: ${plugin.name}\n`
        const at = plugin.after ? found.index + found[0].length : found.index
        text = text.slice(0, at) + row + text.slice(at)
        writeFileSync(manifestFile, text)
        done.push(`blend.yaml (row ${plugin.name})`)
      } else
        failed.push(
          `blend.yaml: add a row \`- id: ${plugin.name}\` / \`name: ${plugin.name}\` ${plugin.after ? `after the ${plugin.after} row` : 'before the `routes` row'}`,
        )
    }
  }
  const appFile = join(appDir, 'src', 'app.ts')
  if (existsSync(appFile)) {
    let text = readFileSync(appFile, 'utf8')
    const entry = `'${plugin.name}': ${plugin.local}`
    if (text.includes(entry)) done.push('src/app.ts (already registered)')
    else {
      const imports = [...text.matchAll(/^import .* from '\.\.\/plugins\/[^']+'\n/gmu)]
      const last = imports.at(-1)
      // The registry as the templates write it: one entry per line, or all on one line (`{ 'acryl-router': router, routes }`).
      const table = /^export const registry = \{(\s)/mu.exec(text)
      if (last && table) {
        const file = plugin.entry ?? 'index.ts'
        const line = `import * as ${plugin.local} from '../plugins/${plugin.name}/${file}'\n`
        const at = table.index + table[0].length
        text =
          text.slice(0, at) + (table[1] === '\n' ? `  ${entry},\n` : `${entry}, `) + text.slice(at)
        const lastEnd = last.index + last[0].length
        text = text.slice(0, lastEnd) + line + text.slice(lastEnd)
        writeFileSync(appFile, text)
        done.push(`src/app.ts (registered as ${plugin.local})`)
      } else
        failed.push(
          `src/app.ts: import it as \`${plugin.local}\` from '../plugins/${plugin.name}/${plugin.entry ?? 'index.ts'}' and add \`${entry}\` to the registry`,
        )
    }
  } else failed.push(`src/app.ts: not found; register ${entry(plugin)} in the app's registry`)
  return {
    done: failed.length === 0,
    note: [
      done.length > 0 ? `mounted in ${done.join(' and ')}` : '',
      ...failed.map((line) => `could not edit ${line}`),
    ]
      .filter(Boolean)
      .join('\n'),
  }
}

const entry = (plugin: Mounted) => `'${plugin.name}': ${plugin.local}`
