/**
 * A staged extension lives in the app's home, which may be anywhere (a pinned home in a temporary folder), so a bare import such as
 * `@deepseek-ai/cordis` would not find the app's `node_modules`. This resolve hook leaves resolution alone, and only when it fails for a
 * module inside the staging folder, resolves the same name from the app's project folder. Uses Node's public `module.registerHooks`
 * (ACRYL needed the same fallback on Deno); the returned function removes the hook.
 *
 * The framework plugins are not packages in an app (they are source under `src/plugins/`), so `aliases` names the files a framework specifier such as
 * `acryl-router` stands for. A staged plugin then imports the same module the app itself runs, so `App` is the very class the router mounts.
 */
import { existsSync, mkdirSync, realpathSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const isBare = (specifier: string) => !/^[./]/.test(specifier) && !specifier.includes(':')

/** The router's specifiers, as files of the vendored plugin that sits beside this one; empty when the app has no router. */
export function routerAliases(): Record<string, string> {
  const src = new URL('../acryl-router/src/', import.meta.url)
  const files = {
    'acryl-router': 'index.ts',
    'acryl-router/middleware': 'middleware/index.ts',
    'acryl-router/helpers': 'helpers/index.ts',
  }
  return Object.fromEntries(
    Object.entries(files)
      .map(([specifier, file]) => [specifier, fileURLToPath(new URL(file, src))] as const)
      .filter(([, path]) => existsSync(path)),
  )
}

export function resolveFromApp(
  stageRoot: string,
  appRoot: string,
  aliases: Record<string, string> = {},
): () => void {
  mkdirSync(stageRoot, { recursive: true })
  const staged = pathToFileURL(`${realpathSync(stageRoot)}/`).href
  const parentURL = pathToFileURL(join(realpathSync(appRoot), 'package.json')).href
  const hook = registerHooks({
    resolve(specifier, context, nextResolve) {
      const alias = aliases[specifier]
      if (alias !== undefined && context.parentURL?.startsWith(staged))
        return nextResolve(pathToFileURL(alias).href, context)
      try {
        return nextResolve(specifier, context)
      } catch (error) {
        if (isBare(specifier) && context.parentURL?.startsWith(staged))
          return nextResolve(specifier, { ...context, parentURL })
        throw error
      }
    },
  })
  return () => hook.deregister()
}
