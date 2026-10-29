/**
 * The built-in agent (spec 049 slice 14): a chat panel inside the running app. The person says what they want; the app's own agent (`driver: 'agent'`) or a coding
 * agent started in the app folder (`'claude'`, `'codex'`, `'pi'`) builds it through the door, and when a plugin was installed or removed the page reloads, so the new feature
 * shows with no restart. The drivers are entries of the `drivers` service this plugin provides (`drivers.ts`): chat drivers here, and other plugins (`driver-pty`) add more.
 *
 * - A middleware appends one script tag (`/api/agent-panel/panel.js`) to every HTML response of the routes mounted after it, so no page is edited.
 * - `GET /api/agent-panel/session` gives the page the drivers it may use and a token; `POST /api/agent-panel/ask` runs one message and answers server-sent events:
 *   `text`, `tool`, `change`, `done`, `error`.
 * - Only the app's own page may ask (a same-origin request carrying the token), one run at a time, and every ask is written to `.acryl/audit/agent-panel.jsonl`.
 * - Development only: the plugin does nothing with `NODE_ENV=production` or `ACRYL_DOOR=off`.
 */
import { randomBytes } from 'node:crypto'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { clientModules } from '../acryl-node-server/src/client-modules.ts'
import { streamSSE } from '../acryl-router/src/helpers/index.ts'
import { Acryl } from '../acryl-router/src/index.ts'
import type {} from '../agent/index.ts'
import type {} from '../extensions/index.ts'
import type { ChatDriver } from './drivers.ts'
import { agentDriver, availableHeadless, type HeadlessName, headlessDriver } from './headless.ts'
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

const PREFIX = '/api/agent-panel'
const CLIENT_DIR = join(import.meta.dirname, 'client')

export interface PanelConfig {
  /** Headless coding agents to offer besides the app's own agent; default: the ones found on the machine. */
  drivers?: readonly HeadlessName[]
}

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
  const app = new Acryl()
    // The script tag, on every HTML page the routes mounted after this plugin answer.
    .use('*', async (c, next) => {
      await next()
      if (!(c.res.headers.get('content-type') ?? '').includes('text/html')) return
      const html = await c.res.text()
      const headers = new Headers(c.res.headers)
      headers.delete('content-length')
      c.res = new Response(
        html.includes('</body>') ? html.replace('</body>', `${tag}</body>`) : html + tag,
        { status: c.res.status, headers },
      )
    })
    .get(`${PREFIX}/panel.js`, (c) =>
      c.body(`import '${PREFIX}/client/main.ts'\n`, 200, {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'no-cache',
      }),
    )
    .route(`${PREFIX}/client`, clientModules({ root: CLIENT_DIR }))
    .get(`${PREFIX}/session`, (c) => {
      if (!fromOwnPage(c.req.raw.headers))
        return c.json({ error: "only the app's own page may use the panel" }, 403)
      return c.json({
        token,
        drivers: registry.list().map((driver) => ({ name: driver.name, kind: driver.kind })),
      })
    })
    .post(`${PREFIX}/ask`, async (c) => {
      if (!fromOwnPage(c.req.raw.headers) || c.req.header('x-agent-panel-token') !== token)
        return c.json({ error: "only the app's own page may ask" }, 403)
      const body = (await c.req.json().catch(() => ({}))) as { message?: unknown; driver?: unknown }
      const message = typeof body.message === 'string' ? body.message.trim() : ''
      const driverName = typeof body.driver === 'string' ? body.driver : 'agent'
      if (message === '' || message.length > 8000)
        return c.json({ error: 'write a message of at most 8000 characters' }, 400)
      const driver = registry.get(driverName)
      if (driver?.kind !== 'chat')
        return c.json(
          {
            error: `the driver "${driverName}" is not available here (${registry
              .list()
              .filter((d) => d.kind === 'chat')
              .map((d) => d.name)
              .join(', ')})`,
          },
          400,
        )
      if (current !== undefined && !current.ended)
        return c.json({ error: 'a run is already going; wait for it to end' }, 409)
      const run = startRun(driverName, message, driver)
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
  /** One run of an agent: its events as they came, and who is following. It lives in the app, not in a page. */
  interface Run {
    readonly id: number
    readonly driver: string
    readonly message: string
    readonly events: Array<{ event: string; data: unknown }>
    readonly followers: Set<(item: { event: string; data: unknown }) => void>
    readonly cancel: AbortController
    ended: boolean
    endedAt?: number
  }
  let current: Run | undefined
  let runs = 0
  const startRun = (driverName: string, message: string, driver: ChatDriver): Run => {
    runs += 1
    const run: Run = {
      id: runs,
      driver: driverName,
      message,
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
    void (async () => {
      try {
        for await (const { event, data } of driver.start({ message, signal: run.cancel.signal }))
          emit(event, data)
        emit('done', { changed })
      } catch (error) {
        emit('error', { message: error instanceof Error ? error.message : String(error) })
      } finally {
        off()
        run.ended = true
        run.endedAt = Date.now()
        audit({ ask: 'end', driver: driverName, changed })
        for (const follower of [...run.followers]) follower({ event: 'end', data: {} })
      }
    })()
    return run
  }
  /** Follow a run as server-sent events: a `run` event (what it is, whether it already ended), the events so far, then the new ones until it ends. Following does not keep it alive. */
  const follow = (c: Parameters<typeof streamSSE>[0], run: Run, announce: boolean): Response =>
    streamSSE(c, async (stream) => {
      if (announce)
        await stream.writeSSE({
          event: 'run',
          data: JSON.stringify({
            id: run.id,
            driver: run.driver,
            message: run.message,
            ended: run.ended,
            endedAt: run.endedAt ?? null,
          }),
        })
      const queue: Array<{ event: string; data: unknown }> = [...run.events]
      let wake: (() => void) | undefined
      const follower = (item: { event: string; data: unknown }): void => {
        queue.push(item)
        wake?.()
      }
      if (!run.ended) run.followers.add(follower)
      let open = true
      stream.onAbort(() => {
        open = false
        run.followers.delete(follower)
        wake?.()
      })
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
          await stream.writeSSE({ event: item.event, data: JSON.stringify(item.data) })
        }
      } finally {
        run.followers.delete(follower)
      }
    })
  ctx.router.route('/', app)
}
