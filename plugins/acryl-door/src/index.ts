/**
 * `acryl-door`: the Door of the five nouns, as a Cordis plugin of a framework app (spec 049 slice 9). An agent working in the app folder
 * looks at the running page, acts on it, and installs plugins live, through `.acryl/bin/acryl`; everything else it does with its own
 * file tools and shell.
 *
 * The page loads `/api/acryl-door/page.js` (one script tag) and keeps an event stream open to the Host; the Host sends it calls. An
 * operator on this machine reaches `/api/acryl-door/call` with the secret from `<app>/.acryl/door.json`. One effect owns the channel and
 * the audit, the routes are mounted after it, and a second effect writes the connection file last, so disposal removes the file first,
 * then the routes (their in-flight calls end), then closes the channel (every pending call settles).
 */

import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Acryl } from 'acryl-router'
import type { UpgradeWebSocket } from 'acryl-router/helpers'
import { clientModules } from 'acryl-node-server/client-modules'
import { auditPath, AuditLog } from './host/audit.ts'
import { UiChannel } from './host/channel.ts'
import { registerChatTools } from './host/chat-tools.ts'
import { Door, type ExtensionsPort, type ToolsPort } from './host/door.ts'
import { newSecret, removeDoorFile, stateDir, writeDoorFile } from './host/door-file.ts'
import { DOOR_PREFIX, privateApi } from './host/http.ts'
import { mcpRoutes } from './host/mcp-routes.ts'
import { operatorRoutes } from './host/operator-routes.ts'
import { pageChannelRoutes } from './host/page-routes.ts'
import { pageSocketRoutes } from './host/page-socket.ts'
import { ShellChannel, shellRoutes } from './host/shell.ts'
import { realNode, writeShims, type ShimTarget } from './host/shim.ts'

/** Stable Cordis plugin name, equal to the package name and the Loader row id. */
export const name = 'acryl-door'

/** The part of acrylblends' `appInstance` the door reads: the app folder and its name. */
interface AppFolder {
  readonly root: string
  readonly name: string
}

/** The part of `acryl-node-server` the door reads: where the app listens. */
interface Listening {
  readonly url: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    door: Door
  }
}

export const inject = ['router', 'appInstance', 'nodeServer']

export interface Config {
  tools?: { expose?: string[] }
  /**
   * The door is a development tool: with `NODE_ENV=production` the plugin starts nothing (no route, no `.acryl/` file, no service), and with `ACRYL_DOOR=off` it never does. A host that means to
   * run it in production (a packaged desktop app whose user drives it with an agent) says so here; `ACRYL_DOOR=off` still wins.
   */
  allowInProduction?: boolean
  /** Reload the open pages after a live plugin change, so an agent that built a feature sees it on the page it has open. Default: true. */
  reloadOnChange?: boolean
}

export const Config: z<Config> = z.object({
  allowInProduction: z.boolean().default(false).description('Run in production too (NODE_ENV=production); ACRYL_DOOR=off still turns it off.'),
  reloadOnChange: z.boolean().default(true).description('Reload the open pages after a plugin was added, removed or reloaded while the app runs.'),
  tools: z.object({
    // Not a `door_` name: those are the door's own verbs in the registry, never offered back as app tools.
    expose: z.array(z.string().pattern(/^(?!door_)[A-Za-z][A-Za-z0-9_-]{0,63}$/u)).description('App tools (from the tools registry) the door offers; none by default.'),
  }),
})

/** The page module, served compiled from source by the app's own TypeScript. */
const PAGE_DIR = join(import.meta.dirname, import.meta.url.endsWith('.ts') ? 'page' : join('..', 'src', 'page'))

/** The operator client this build runs: the source next to this file, or the built `cli.js`. */
const CLIENT = import.meta.url.endsWith('.ts') ? join(import.meta.dirname, 'cli', 'acryl.ts') : join(import.meta.dirname, 'cli.js')

/** How the folder's `.acryl/bin/acryl` starts the client: with the Node that runs the app, and its type-stripping flag when run from source. */
function shimTarget(): ShimTarget {
  const fromSource = CLIENT.endsWith('.ts')
  const inElectron = process.versions.electron !== undefined
  // Inside Electron the command prefers a real Node (no code-signing noise on every call); without one, Electron runs the client.
  const node = inElectron ? realNode() : undefined
  return {
    node: node ?? process.execPath,
    nodeOptions: fromSource ? process.execArgv.filter(option => /^--experimental-(strip|transform)-types$/u.test(option)) : [],
    client: CLIENT,
    electron: inElectron && node === undefined,
  }
}

/** A listening address as one the operator reaches: an any-address bind is reached on loopback. */
function loopbackUrl(url: string): string {
  const parsed = new URL(url)
  if (parsed.hostname === '0.0.0.0' || parsed.hostname === '[::]') parsed.hostname = '127.0.0.1'
  return parsed.origin
}

const escapeHtml = (text: string): string => text.replace(/[&<>"']/gu, char => `&#${char.charCodeAt(0)};`)

/** The page of a path the app does not serve, development only: what is missing, a way back, and the door's script. */
export function notFoundPage(path: string, scriptTag: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>404 Not Found</title></head><body><main><h1>404 Not Found</h1><p>This app has no page at <code>${escapeHtml(path)}</code>.</p><p><a href="/">Back to the app</a></p></main>${scriptTag}</body></html>`
}

export function apply(ctx: Context, rawConfig: Config = {}): void {
  const config = Config(rawConfig)
  // Development only: nothing is started, mounted or written in production, or when switched off.
  if (process.env.ACRYL_DOOR === 'off' || (process.env.NODE_ENV === 'production' && config.allowInProduction !== true)) return
  const app = ctx.get('appInstance') as unknown as AppFolder
  const server = ctx.get('nodeServer') as unknown as Listening
  if (typeof app?.root !== 'string') throw new Error('acryl-door: the appInstance service has no app folder (root)')
  const reportError = (operation: string, cause: unknown): void => {
    ctx.logger?.error?.(`acryl-door: failed to ${operation}: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
  const secret = newSecret()
  // A look right after a navigate or reload waits up to two seconds for the page that is moving to register again, and a read-only call that no page acknowledged gives a page that just registered one more try.
  const channel = new UiChannel({ attachWaitMs: 2000 })
  const shell = new ShellChannel()
  const audit = new AuditLog(auditPath(stateDir(app.root)))
  const door = new Door({
    channel,
    shell,
    audit,
    app: { name: app.name, root: app.root, url: loopbackUrl(server.url) },
    extensions: () => ctx.get('extensions') as unknown as ExtensionsPort | undefined,
    tools: () => ctx.get('tools') as unknown as ToolsPort | undefined,
    expose: config.tools?.expose ?? [],
    reloadOnChange: config.reloadOnChange !== false,
  })
  ctx.effect(() => () => { channel.close() }, 'acryl-door: page channel')
  ctx.effect(() => () => { shell.close() }, 'acryl-door: desktop shell channel')
  // One script tag for the page (`page.js`): it imports the module tree served below it.
  const pageModule = new Acryl()
    .get(`${DOOR_PREFIX}/page.js`, c => c.body(`import '${DOOR_PREFIX}/page/main.ts'\n`, 200, { 'content-type': 'text/javascript; charset=utf-8' }))
    .route(`${DOOR_PREFIX}/page`, clientModules({ root: PAGE_DIR }))
  // The page script on every HTML page the app answers, whenever its plugin was mounted (the pages of a plugin that loaded at boot, before this one, included): a page an agent writes
  // can be looked at and driven without anyone adding the tag. A page that already carries it (the templates' own pages) is left as it is. Development only, like the rest of the door.
  const tag = `<script type="module" src="${DOOR_PREFIX}/page.js"></script>`
  const addScript = async (c: { res: Response; req: { path: string; header(name: string): string | undefined } }, next: () => Promise<void>): Promise<void> => {
    await next()
    if (!(c.res.headers.get('content-type') ?? '').includes('text/html')) {
      // A path the app does not serve, opened as a page: the browser would show a bare "404 Not Found" with no script, and the window would be left where nothing can look at it or
      // act on it (an agent that mistypes a path would need a person to bring the window back). The page says what is missing, carries the script, and keeps the 404.
      if (c.res.status === 404 && (c.req.header('accept') ?? '').includes('text/html') && !(c.res.headers.get('content-type') ?? '').includes('json'))
        c.res = new Response(notFoundPage(c.req.path, tag), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } })
      return
    }
    const html = await c.res.text()
    const headers = new Headers(c.res.headers)
    headers.delete('content-length')
    const carries = html.includes(`${DOOR_PREFIX}/page.js`)
    c.res = new Response(carries ? html : html.includes('</body>') ? html.replace('</body>', `${tag}</body>`) : html + tag, { status: c.res.status, headers })
  }
  const router = ctx.router as unknown as { wrap?: (middleware: typeof addScript) => unknown }
  // An app whose router copy is older than this plugin has no `wrap`: the middleware then covers the routes mounted after the door, as the agent panel's does.
  if (typeof router.wrap === 'function') router.wrap(addScript)
  else ctx.router.route('/', new Acryl().use('*', addScript as never))
  // The page channel also runs over a WebSocket, which is not one of the browser's six connections per host. Without the `ws` package or an adapter that upgrades, the pages use the stream.
  let upgrade: UpgradeWebSocket | undefined
  try {
    upgrade = (ctx as unknown as { nodeServer?: { upgrades?: () => UpgradeWebSocket } }).nodeServer?.upgrades?.()
  } catch (cause) {
    reportError('open the page channel over a WebSocket (the pages use the event stream)', cause)
  }
  ctx.router.route('/', privateApi(
    DOOR_PREFIX,
    pageModule,
    pageChannelRoutes(channel, { prefix: DOOR_PREFIX }),
    ...(upgrade === undefined ? [] : [pageSocketRoutes(channel, { prefix: DOOR_PREFIX, upgrade })]),
    shellRoutes(DOOR_PREFIX, secret, shell),
    operatorRoutes(DOOR_PREFIX, secret, door, reportError),
    mcpRoutes(DOOR_PREFIX, secret, door, reportError),
  ))
  // The built-in chat's agent reads the `tools` registry: the verbs are in it while both are up.
  ctx.inject(['tools'], (inner) => {
    inner.effect(() => registerChatTools(inner.get('tools') as unknown as ToolsPort, door), 'acryl-door: the verbs in the tools registry')
  })
  ctx.effect(function* () {
    yield ctx.reflect.provide('door', door)
    writeDoorFile(app.root, loopbackUrl(server.url), secret)
    // A shim that cannot be replaced (Windows, held open by a running `acryl`) leaves the old one in place; it must not stop the app from starting.
    try { writeShims(app.root, shimTarget()) } catch (cause) { reportError('write .acryl/bin', cause) }
    yield () => { removeDoorFile(app.root, secret) }
  }, 'acryl-door: the door service, .acryl/door.json and .acryl/bin/acryl')
}

export { Door, DoorError, type VerbAnswer } from './host/door.ts'
export { chatToolName, VERB_SPECS, VERBS, type Verb, type VerbSpec } from './host/verbs.ts'
export { mcpTools } from './host/mcp-routes.ts'
export { DOOR_PREFIX } from './host/http.ts'
export { doorFilePath, readDoorFile, STATE_DIR, type DoorFile } from './host/door-file.ts'
export type { CallResponse } from './host/operator-routes.ts'
