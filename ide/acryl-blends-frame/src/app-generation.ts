/**
 * The app's code, loaded again in the running dev host. Node keeps every module it has imported under its URL, so the app's routes row, imported once at
 * boot, keeps serving the code it was started with: a version the person went back to, a file the chat wrote, a line typed in an editor would all stay
 * invisible until the host restarts (which would also end every terminal and agent running in the right panel).
 *
 * The launcher (`scripts/ide-host.mjs`) installs a resolve hook here, before anything of the app loads. While the generation is 0 it does nothing. When
 * the Host raises the generation, every file of the app's `src/` (and the generated `frame/` rows that import it) resolves with `?gen=N` appended, so an
 * import made now gets a fresh copy of the file and, because each of its own imports resolves through the same hook, of everything it imports. Nothing
 * else gets a query: `node_modules`, the framework's `plugins/` and the frame itself stay single instances, so the services the app uses are not
 * duplicated.
 *
 * Development only: the old copies of a module stay in memory (Node cannot unload a module), which a dev host that restarts at the end of the day can
 * carry. Production never loads this file: `npm start` has no frame and no launcher.
 *
 * The state sits on `globalThis` under a registered symbol, not in this module: the launcher and the Host plugin load this code as two separate files.
 */

import { realpathSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { join, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const KEY = Symbol.for('acrylblends.app-generation')

/** The generation the app's files resolve under: 0 is the files as they are (no query), each later number is a fresh copy of them all. */
export interface AppGeneration {
  current(): number
  set(generation: number): void
}

/** The folders of an app whose files take a generation: its own code, and the generated rows that import it. */
const APP_FOLDERS = ['src', 'frame']

/** `url` with the generation as its query when it is a file of the app's folders (`scopes`, as folder URLs ending in `/`) and has none yet. */
export function generationUrl(url: string, scopes: readonly string[], generation: number): string {
  if (generation === 0 || url.includes('?') || !scopes.some(scope => url.startsWith(scope))) return url
  return `${url}?gen=${String(generation)}`
}

function isAppGeneration(value: unknown): value is AppGeneration {
  return value !== null && typeof value === 'object'
    && typeof (value as { current?: unknown }).current === 'function' && typeof (value as { set?: unknown }).set === 'function'
}

/** The generation switch the launcher installed in this process; undefined when it did not (the app's code is then never loaded again). */
export function appGeneration(): AppGeneration | undefined {
  const value = (globalThis as Record<symbol, unknown>)[KEY]
  return isAppGeneration(value) ? value : undefined
}

/** Install the hook for the app at `appRoot` once per process; a second call returns the first one's switch. */
export function installAppGeneration({ appRoot }: { readonly appRoot: string }): AppGeneration {
  const installed = appGeneration()
  if (installed !== undefined) return installed
  let generation = 0
  // Node resolves a module to its real path, so the folders are matched by theirs: an app under a symlinked directory still gets its generations.
  const real = (path: string): string => {
    try {
      return realpathSync(path)
    } catch {
      return path
    }
  }
  const scopes = APP_FOLDERS.map(folder => pathToFileURL(real(join(appRoot, folder)) + sep).href)
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context)
      const url = generationUrl(resolved.url, scopes, generation)
      return url === resolved.url ? resolved : { ...resolved, url }
    },
  })
  const created: AppGeneration = {
    current: () => generation,
    set: (next) => { generation = next },
  };
  (globalThis as Record<symbol, unknown>)[KEY] = created
  return created
}
