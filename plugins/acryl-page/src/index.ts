/**
 * The page of a framework-hosted app. The document is ours: a minimal index (doctype, title, the root div) with the index taps applied per request,
 * which is where the client-module row inserts `window.__DSH_BOOT__` and its registration scripts. DSH's built frontend is used only as the client
 * runtime library the frame's client plugins load through: its own index is read for the entry script and stylesheet tags it genuinely needs, and its
 * `dist/assets/` files are served beside our document. No DSH web server, web runtime or web-startup row is involved.
 */
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, extname, join, normalize, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from 'acryl-web-server'

/** Stable Cordis plugin name, equal to the package name and the Loader row id. */
export const name = 'acryl-page'

/** The page is served through the host's webServer port. */
export const inject = ['webServer']

export interface Config {
  /** The document's title. */
  title: string
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
}

/** The frontend package's `dist` directory: anchored on its manifest, as DSH itself does. */
export function frontendDist(): string {
  const require = createRequire(import.meta.url)
  return join(dirname(require.resolve('@deepseek-ai/dsh-web-frontend/package.json')), 'dist')
}

/** The tags the built client runtime genuinely needs from the frontend's own index: the entry script, its preloads and its stylesheets. */
export function clientAssetTags(indexHtml: string): string {
  const tags = [...indexHtml.matchAll(/<(?:script|link)\b[^>]*>/gu)]
    .map((match) => match[0])
    .filter(
      (tag) =>
        /^<script\b[^>]*\bsrc=/u.test(tag) ||
        /^<link\b[^>]*\brel="(?:stylesheet|modulepreload)"/u.test(tag),
    )
  return tags.join('\n    ')
}

/** Our document: minimal on purpose; the frame renders into `#root`, and the taps add the boot wire before `</head>`. */
export function pageDocument(tags: string, title: string, taps: (html: string) => string): string {
  const document = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    ${tags}
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`
  return taps(document)
}

/** The slice of the chat driver's connection the page needs: the process-token exchange that sets the browser's session cookie. */
interface ConnectionPort {
  /** True when the caller may serve the index; false when it already answered (a token redirect or 401). */
  authorizeIndex(req: IncomingMessage, res: ServerResponse): boolean
}

/** Answer with a file under `root`, or 404: a path that escapes `root` and a missing file both 404. */
async function serveFile(root: string, target: string, response: ServerResponse, method: string): Promise<void> {
  const path = normalize(join(root, target))
  if (path !== root && !path.startsWith(root + sep)) {
    response.writeHead(404).end('not found')
    return
  }
  try {
    const bytes = await readFile(path)
    response.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
      'content-length': String(bytes.byteLength),
      'cache-control': 'no-cache',
    })
    response.end(method === 'HEAD' ? undefined : bytes)
  } catch {
    response.writeHead(404).end('not found')
  }
}

/** Serve `/` (our document), `/index.html`, the built assets and the root files the index names. */
export function apply(ctx: Context, config: Partial<Config> = {}): void {
  const title = config.title ?? 'ACRYL'
  const dist = frontendDist()
  const assets = join(dist, 'assets')
  ctx.webServer.register({
    kind: 'exact',
    path: '/',
    handler: async (req, res) => {
      // The chat's remote RPC is authenticated by the connection's process token: the page's root request is where the token is exchanged
      // for the session cookie. A composition without the driver has no connection and serves the page directly.
      const connection = (ctx as unknown as { get(name: string): unknown }).get('connection') as ConnectionPort | undefined
      if (connection !== undefined && !connection.authorizeIndex(req, res)) return
      const index = await readFile(join(dist, 'index.html'), 'utf8')
      const document = pageDocument(clientAssetTags(index), title, (html) => ctx.webServer.index(html))
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      res.end(req.method === 'HEAD' ? undefined : document)
    },
  })
  ctx.webServer.register({
    kind: 'exact',
    path: '/index.html',
    handler: async (req, res) => {
      const index = await readFile(join(dist, 'index.html'), 'utf8')
      const document = pageDocument(clientAssetTags(index), title, (html) => ctx.webServer.index(html))
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      res.end(req.method === 'HEAD' ? undefined : document)
    },
  })
  ctx.webServer.register({
    kind: 'prefix',
    path: '/assets',
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      const pathname = new URL(req.url ?? '/', 'http://page.invalid').pathname
      await serveFile(assets, pathname.slice('/assets'.length), res, req.method ?? 'GET')
    },
  })
  for (const file of ['favicon.svg', 'favicon-dark.svg', 'manifest.webmanifest']) {
    ctx.webServer.register({
      kind: 'exact',
      path: `/${file}`,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        await serveFile(dist, file, res, req.method ?? 'GET')
      },
    })
  }
}
