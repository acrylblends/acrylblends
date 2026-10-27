import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

/** The browser builds of the DOM renderer and the typed client, shipped by the `acrylblends` package this app depends on (`clientModules` serves them). */
export const runtimeDir = join(
  dirname(createRequire(import.meta.url).resolve('acrylblends/package.json')),
  'lib',
  'browser',
)
