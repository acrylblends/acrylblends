// The one place that names the framework package. The docs, the code-block docs test, the create-acrylblends templates and the export map read it,
// so a later rename (for example to `acryl`) is a change here plus `node scripts/rename-package.mjs <from> <to>` over the docs.
export const PACKAGE = 'acrylblends'
export const CLASS = 'Acryl'
export const REQUEST = 'AcrylRequest'
export const CREATE = 'create-acrylblends'

/**
 * Subpaths the docs show but the package does not export yet. A code block that imports one of them is not type-checked; remove an entry when the subpath lands.
 * An entry matches itself and everything below it (`jsx` covers `jsx/dom`).
 */
export const NOT_YET_AVAILABLE = [
  'bun',
  'deno',
  'cloudflare-workers',
  'cloudflare-pages',
  'aws-lambda',
  'vercel',
  'netlify',
  'lambda-edge',
  'service-worker',
  'node-ws',
]
