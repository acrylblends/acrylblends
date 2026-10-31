/**
 * The built-in agent (spec 049 slice 14): a chat panel inside the running app. The person says what they want; the app's own agent (`driver: 'agent'`) or a coding
 * agent started in the app folder (`'claude'`, `'codex'`, `'pi'`) builds it through the door, and when a plugin was installed or removed the page reloads, so the new feature
 * shows with no restart. The drivers are entries of the `drivers` service this plugin provides (`drivers.ts`): chat drivers here, and other plugins (`driver-pty`) add more.
 *
 * - A middleware appends one script tag (`/api/agent-panel/panel.js`) to every HTML response of the routes mounted after it, so no page is edited.
 * - `GET /api/agent-panel/session` gives the page the drivers it may use and a token; `POST /api/agent-panel/ask` runs one message and answers server-sent events:
 *   `text`, `tool`, `change`, `done`, `error`.
 * - Only the app's own page may ask (a same-origin request carrying the token), one run at a time, and every ask is written to `.acryl/audit/agent-panel.jsonl`.
 * - The routes live under the app's mount: the root of the app's own server, or the frame's prefix (`/app`) when the frame hosts it, where the host's own
 *   `/api` routes would otherwise answer first. The row's `mount` config names it.
 * - Development only: the plugin does nothing with `NODE_ENV=production` or `ACRYL_DOOR=off`.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { clientModules } from '../acryl-node-server/src/client-modules.ts'
import { streamSSE, type UpgradeWebSocket } from '../acryl-router/src/helpers/index.ts'
import { Acryl, type MiddlewareHandler } from '../acryl-router/src/index.ts'
import { loopbackAuthority } from '../acryl-router/src/middleware/index.ts'
import type {} from '../agent/index.ts'
import type {} from '../extensions/index.ts'
import type { ChatDriver } from './drivers.ts'
import {
  agentDriver,
  availableHeadless,
  type HeadlessName,
  headlessDriver,
  whyNotChat,
} from './headless.ts'
import { mountedPrefix } from './mount.ts'
import { provideDrivers } from './registry.ts'

export type {
  ChatDriver,
  ChatEvent,
  Driver,
  Drivers,
  TerminalDriver,
  TerminalSession,
} from './drivers.ts'

export const name = 'agent-panel'
export const inject = ['router', 'agent', 'extensions', 'appInstance']

/** The panel's own routes, fixed relative to the app's mount. */
const PANEL_PATH = '/api/agent-panel'

/** The slice of the door the panel uses; the door is optional (it is a development plugin, and a different row). */
interface DoorPort {
  driveFor(windowId: string): () => void
}
const CLIENT_DIR = join(import.meta.dirname, 'client')

export interface PanelConfig {
  /** Headless coding agents to offer besides the app's own agent; default: the ones found on the machine. */
  drivers?: readonly HeadlessName[]
  /**
   * The URL prefix the app is mounted at: empty on the app's own server, `/app` when the ACRYL frame hosts it (the same prefix `makeApp` and
   * `routerHttp.mount` take). The panel's routes, script tag and client live under it, so they belong to the app and are served wherever it is.
   */
  mount?: string
}

/** The panel's routes under a checked mount: empty, or an absolute path such as `/app` with no trailing slash (the `routerHttp.mount` rule). */
const panelPrefix = (mount: string | undefined): string =>
  mountedPrefix(mount, PANEL_PATH, 'agent-panel')

/** Whether a request comes from the app's own page: a browser says so itself (`Sec-Fetch-Site: same-origin`), or the Origin is the Host. */
export function fromOwnPage(headers: Headers): boolean {
  const site = headers.get('sec-fetch-site')
  if (site !== null) return site === 'same-origin'
  const origin = headers.get('origin')
  const host = headers.get('host')
  return origin !== null && host !== null && new URL(origin).host === host
}

export function apply(ctx: Context, config: PanelConfig = {}): void {
  if (process.env.NODE_ENV === 'production' || process.env.ACRYL_DOOR === 'off') return
  const PREFIX = panelPrefix(config.mount)
  const root = ctx.appInstance.root
  const token = randomBytes(24).toString('hex')
  const auditFile = join(root, '.acryl', 'audit', 'agent-panel.jsonl')
  const audit = (entry: Record<string, unknown>): void => {
    try {
      mkdirSync(dirname(auditFile), { recursive: true })
      appendFileSync(auditFile, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`)
    } catch {
      // The audit never stops a run.
    }
  }
  const registry = provideDrivers(
    ctx,
    (headers) => fromOwnPage(headers) && headers.get('x-agent-panel-token') === token,
  )
  ctx.effect(() => registry.register(agentDriver(ctx)))
  for (const program of availableHeadless(config.drivers))
    ctx.effect(() => registry.register(headlessDriver(program, root)))

  const tag = `<script type="module" src="${PREFIX}/panel.js"></script>`
  const addScript = async (c: { res: Response }, next: () => Promise<void>): Promise<void> => {
    await next()
    if (!(c.res.headers.get('content-type') ?? '').includes('text/html')) return
    const html = await c.res.text()
    if (html.includes(`${PREFIX}/panel.js`)) {
      c.res = new Response(html, c.res)
      return
    }
    const headers = new Headers(c.res.headers)
    headers.delete('content-length')
    c.res = new Response(
      html.includes('</body>') ? html.replace('</body>', `${tag}</body>`) : html + tag,
      { status: c.res.status, headers },
    )
  }
  // The script tag on every HTML page the app answers, whenever the plugin that serves the page was mounted (a plugin an agent built loads at boot, before this one, after a restart).
  // An app whose router copy is older has no `wrap`: the tag is then added to the pages of the routes mounted after this plugin only.
  const router = ctx.router as unknown as { wrap?: (middleware: typeof addScript) => unknown }
  const wrapped = typeof router.wrap === 'function'
  if (wrapped) router.wrap?.(addScript)
  const app = new Acryl()
    .use('*', async (c, next) => {
      if (wrapped) return next()
      await addScript(c, next)
    })
    .get(`${PREFIX}/panel.js`, (c) =>
      c.body(
        `import { start } from '${PREFIX}/client/main.ts'\nstart(${JSON.stringify(PREFIX)})\n`,
        200,
        {
          'content-type': 'text/javascript; charset=utf-8',
          'cache-control': 'no-cache',
        },
      ),
    )
    .route(`${PREFIX}/client`, clientModules({ root: CLIENT_DIR, mount: `${PREFIX}/client` }))
    .get(`${PREFIX}/session`, (c) => {
      if (!fromOwnPage(c.req.raw.headers))
        return c.json({ error: "only the app's own page may use the panel" }, 403)
      return c.json({
        token,
        // A terminal driver names the browser module that draws its view and the prefix its endpoints live under: the plugin that owns the view
        // also knows where the app is mounted, so the panel never guesses either.
        drivers: registry.list().map((driver) => ({
          name: driver.name,
          kind: driver.kind,
          ...(driver.kind === 'terminal' ? { view: driver.view } : {}),
        })),
      })
    })
    .post(`${PREFIX}/ask`, async (c) => {
      if (!fromOwnPage(c.req.raw.headers) || c.req.header('x-agent-panel-token') !== token)
        return c.json({ error: "only the app's own page may ask" }, 403)
      const body = (await c.req.json().catch(() => ({}))) as {
        message?: unknown
        driver?: unknown
        page?: unknown
      }
      const checked = checkAsk(body.message, body.driver)
      if ('error' in checked) return c.json({ error: checked.error }, checked.status)
      const run = startRun(checked.driverName, checked.message, checked.driver, pageOf(body.page))
      return follow(c, run, false)
    })
    // Stop: the only thing that cancels a run. A page that goes away (a reload, a move to another page, a closed tab) does not: the agent goes on, and the page picks it up again.
    .post(`${PREFIX}/stop`, (c) => {
      if (!fromOwnPage(c.req.raw.headers) || c.req.header('x-agent-panel-token') !== token)
        return c.json({ error: "only the app's own page may stop a run" }, 403)
      current?.cancel.abort()
      return c.json({ ok: true })
    })
    // The latest run, for a page that just loaded: what was asked, then every event so far, then the rest as it happens (until the run ends).
    .get(`${PREFIX}/run`, (c) => {
      if (!fromOwnPage(c.req.raw.headers) || c.req.header('x-agent-panel-token') !== token)
        return c.json({ error: "only the app's own page may read the run" }, 403)
      return current === undefined ? c.json({ run: null }) : follow(c, current, true)
    })
  /** What `/ask` and the socket's `ask` both check: a message of a sensible size, a chat driver that is here, and no run going. */
  const checkAsk = (
    rawMessage: unknown,
    rawDriver: unknown,
  ):
    | { message: string; driverName: string; driver: ChatDriver }
    | { error: string; status: 400 | 409 } => {
    const message = typeof rawMessage === 'string' ? rawMessage.trim() : ''
    const driverName = typeof rawDriver === 'string' ? rawDriver : 'agent'
    if (message === '' || message.length > 8000)
      return { error: 'write a message of at most 8000 characters', status: 400 }
    const driver = registry.get(driverName)
    if (driver?.kind !== 'chat') {
      const chat = registry
        .list()
        .filter((d) => d.kind === 'chat')
        .map((d) => d.name)
        .join(', ')
      const why = whyNotChat(driverName, driver?.kind)
      return {
        error: `the driver "${driverName}" is not available here${why === undefined ? '' : `: ${why}`} (chat drivers: ${chat})`,
        status: 400,
      }
    }
    if (current !== undefined && !current.ended)
      return { error: 'a run is already going; wait for it to end', status: 409 }
    return { message, driverName, driver }
  }
  /** One run of an agent: its events as they came, and who is following. It lives in the app, not in a page. */
  interface Run {
    readonly id: number
    readonly driver: string
    readonly message: string
    readonly startedAt: number
    readonly events: Array<{ event: string; data: unknown }>
    readonly followers: Set<(item: { event: string; data: unknown }) => void>
    readonly cancel: AbortController
    ended: boolean
    endedAt?: number
  }
  let current: Run | undefined
  let runs = 0
  /** The door's id of the page that asked, when it sent one that looks like it. */
  const pageOf = (raw: unknown): string | undefined =>
    typeof raw === 'string' && /^[A-Za-z0-9-]{1,80}$/u.test(raw) ? raw : undefined
  const startRun = (
    driverName: string,
    message: string,
    driver: ChatDriver,
    page?: string,
  ): Run => {
    runs += 1
    const run: Run = {
      id: runs,
      driver: driverName,
      message,
      startedAt: Date.now(),
      events: [],
      followers: new Set(),
      cancel: new AbortController(),
      ended: false,
    }
    current = run
    const emit = (event: string, data: unknown): void => {
      const item = { event, data }
      run.events.push(item)
      for (const follower of [...run.followers]) follower(item)
    }
    let changed = false
    const off = ctx.on('extensions/changed', (extension: string, action: string) => {
      changed = true
      emit('change', { extension, action })
    })
    ctx.effect(() => () => run.cancel.abort(), `agent-panel: run ${runs}`)
    audit({ ask: 'start', driver: driverName, characters: message.length })
    // The agent's door calls name no window: while this run goes, they are for the page whose panel asked, not for another tab or window that happens to be open.
    const door = page === undefined ? undefined : (ctx.get('door') as DoorPort | undefined)
    const releasePage = door?.driveFor(page as string)
    void (async () => {
      try {
        for await (const { event, data } of driver.start({ message, signal: run.cancel.signal }))
          emit(event, data)
        emit('done', { changed })
      } catch (error) {
        emit('error', { message: error instanceof Error ? error.message : String(error) })
      } finally {
        off()
        releasePage?.()
        run.ended = true
        run.endedAt = Date.now()
        audit({ ask: 'end', driver: driverName, changed })
        for (const follower of [...run.followers]) follower({ event: 'end', data: {} })
      }
    })()
    return run
  }
  /**
   * Follow a run into `write`: a `run` event (what it is, whether it already ended) when `announce`, the events so far, then the new ones until it ends. Following does not keep the
   * run alive. `detach` stops following (the page went away); `done` settles when the run ended or the following was detached.
   */
  const pump = (
    run: Run,
    announce: boolean,
    write: (event: string, data: unknown) => void | Promise<void>,
  ): { done: Promise<void>; detach(): void } => {
    const queue: Array<{ event: string; data: unknown }> = [...run.events]
    if (announce)
      queue.unshift({
        event: 'run',
        data: {
          id: run.id,
          driver: run.driver,
          message: run.message,
          startedAt: run.startedAt,
          ended: run.ended,
          endedAt: run.endedAt ?? null,
        },
      })
    let wake: (() => void) | undefined
    const follower = (item: { event: string; data: unknown }): void => {
      queue.push(item)
      wake?.()
    }
    if (!run.ended) run.followers.add(follower)
    let open = true
    const done = (async () => {
      try {
        while (open) {
          const item = queue.shift()
          if (item === undefined) {
            if (run.ended) break
            await new Promise<void>((resolve) => {
              wake = resolve
            })
            wake = undefined
            continue
          }
          if (item.event === 'end') break
          await write(item.event, item.data)
        }
      } finally {
        run.followers.delete(follower)
      }
    })()
    return {
      done,
      detach: () => {
        open = false
        run.followers.delete(follower)
        wake?.()
      },
    }
  }
  /** Follow a run as server-sent events. */
  const follow = (c: Parameters<typeof streamSSE>[0], run: Run, announce: boolean): Response =>
    streamSSE(c, async (stream) => {
      const following = pump(run, announce, (event, data) =>
        stream.writeSSE({ event, data: JSON.stringify(data) }),
      )
      stream.onAbort(following.detach)
      await following.done
    })
  // The same runs over a WebSocket, which is not one of the browser's six connections per host: a page that streams its own state in two windows, with a run going, would otherwise
  // queue the panel's Stop and the door's answers behind them. A WebSocket has no CORS and cannot set a header, so the Origin must be this app's own and the first frame carries the
  // token. Frames: up `{ t: 'hello', token }`, then `{ t: 'ask', message, driver }`, `{ t: 'follow' }` or `{ t: 'stop' }`; down `{ e: <event>, d: <data> }`, as the stream's events.
  // The server row comes after this plugin in a blend, so the WebSocket form is mounted when the server appears (and not at all without one that upgrades or without the `ws` package).
  ctx.inject(['nodeServer'], (inner) => {
    let upgrade: UpgradeWebSocket
    try {
      upgrade = (
        inner as unknown as { nodeServer: { upgrades(): UpgradeWebSocket } }
      ).nodeServer.upgrades()
    } catch {
      return
    }
    const ws = new Acryl()
    const own: MiddlewareHandler = async (c, next) => {
      const authority = loopbackAuthority(c)
      const origin = c.req.header('origin')
      const site = c.req.header('sec-fetch-site')
      if (
        authority === undefined ||
        origin === undefined ||
        origin !== authority.origin ||
        (site !== undefined && site !== 'same-origin')
      )
        return c.json({ error: "only the app's own page may use the panel" }, 403)
      await next()
    }
    const sameToken = (presented: unknown): boolean => {
      if (typeof presented !== 'string') return false
      const a = Buffer.from(presented)
      const b = Buffer.from(token)
      return a.length === b.length && timingSafeEqual(a, b)
    }
    ws.get(
      `${PREFIX}/run/ws`,
      own,
      upgrade(
        () => {
          let authed = false
          let following: { detach(): void } | undefined
          let hello: NodeJS.Timeout | undefined
          return {
            onOpen(_event, ws) {
              hello = setTimeout(() => ws.close(4401, 'no token'), 5000)
            },
            onMessage(event, ws) {
              if (typeof event.data !== 'string') return
              let message: {
                t?: unknown
                token?: unknown
                message?: unknown
                driver?: unknown
                page?: unknown
              }
              try {
                message = JSON.parse(event.data) as typeof message
              } catch {
                return
              }
              if (!authed) {
                if (message.t !== 'hello' || !sameToken(message.token)) {
                  ws.close(4401, 'token')
                  return
                }
                authed = true
                if (hello !== undefined) clearTimeout(hello)
                // The page waits for this before it counts the socket as open: a token it was given by an earlier start of the app is refused (4401) and it asks for a new one.
                ws.send(JSON.stringify({ e: 'accepted', d: {} }))
                return
              }
              const send = (e: string, d: unknown): void => {
                ws.send(JSON.stringify({ e, d }))
              }
              if (message.t === 'stop') {
                current?.cancel.abort()
                return
              }
              if (following !== undefined) return
              const watch = (run: Run, announce: boolean): void => {
                const pumped = pump(run, announce, send)
                following = pumped
                void pumped.done.then(() => ws.close(1000, 'run ended'))
              }
              if (message.t === 'ask') {
                const checked = checkAsk(message.message, message.driver)
                if ('error' in checked) {
                  send('error', { message: checked.error })
                  ws.close(1000, 'refused')
                  return
                }
                watch(
                  startRun(
                    checked.driverName,
                    checked.message,
                    checked.driver,
                    pageOf(message.page),
                  ),
                  false,
                )
              } else if (message.t === 'follow') {
                if (current === undefined) {
                  send('idle', {})
                  ws.close(1000, 'no run')
                } else watch(current, true)
              }
            },
            onClose() {
              if (hello !== undefined) clearTimeout(hello)
              following?.detach()
            },
          }
        },
        { textOnly: true },
      ),
    )
    inner.router.route('/', ws)
  })
  ctx.router.route('/', app)
}
