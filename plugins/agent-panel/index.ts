/**
 * The built-in agent (spec 049 slice 14): a chat panel inside the running app. The person says what they want; the app's own agent (`driver: 'agent'`) or a coding
 * agent started in the app folder (`'claude'`, `'codex'`, `'pi'`) builds it through the door, and when a plugin was installed or removed the page reloads, so the new feature
 * shows with no restart.
 *
 * - A middleware appends one script tag (`/api/agent-panel/panel.js`) to every HTML response of the routes mounted after it, so no page is edited.
 * - `GET /api/agent-panel/session` gives the page the drivers it may use and a token; `POST /api/agent-panel/ask` runs one message and answers server-sent events:
 *   `text`, `tool`, `change`, `done`, `error`.
 * - Only the app's own page may ask (a same-origin request carrying the token), one run at a time, and every ask is written to `.acryl/audit/agent-panel.jsonl`.
 * - Development only: the plugin does nothing with `NODE_ENV=production` or `ACRYL_DOOR=off`.
 */
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { clientModules } from '../acryl-node-server/src/client-modules.ts'
import { streamSSE } from '../acryl-router/src/helpers/index.ts'
import { Acryl } from '../acryl-router/src/index.ts'
import type {} from '../agent/index.ts'
import type {} from '../extensions/index.ts'

export const name = 'agent-panel'
export const inject = ['router', 'agent', 'extensions', 'appInstance']

const PREFIX = '/api/agent-panel'
const CLIENT_DIR = join(import.meta.dirname, 'client')

export type DriverName = 'agent' | 'claude' | 'codex' | 'pi'

export interface PanelConfig {
  /** Driver programs to offer besides the app's own agent; default: the ones found on the machine. */
  drivers?: readonly Exclude<DriverName, 'agent'>[]
}

/** The command line of each coding agent started headless in the app folder (the same ones the product test uses). */
function command(
  driver: Exclude<DriverName, 'agent'>,
  message: string,
  root: string,
): { file: string; args: string[] } {
  switch (driver) {
    case 'claude':
      return {
        file: 'claude',
        args: [
          '-p',
          message,
          '--permission-mode',
          'acceptEdits',
          '--allowedTools',
          'Read,Edit,Write,Glob,Grep,Bash(npm *),Bash(npx *),Bash(node *),Bash(.acryl/bin/acryl *),Bash(curl *)',
        ],
      }
    case 'codex':
      return {
        file: 'codex',
        args: [
          'exec',
          '--skip-git-repo-check',
          '-s',
          'workspace-write',
          '-c',
          'sandbox_workspace_write.network_access=true',
          '-C',
          root,
          message,
        ],
      }
    case 'pi':
      return {
        file: 'pi',
        args: [
          '-p',
          message,
          '--provider',
          'deepseek',
          '--model',
          'deepseek-v4-pro',
          '--no-session',
        ],
      }
  }
}

function onPath(program: string): boolean {
  const found = spawnSync(process.platform === 'win32' ? 'where' : 'which', [program], {
    encoding: 'utf8',
  })
  return found.status === 0
}

/** The drivers this machine can offer: the app's own agent always; a program when it is installed (pi also needs its key in the environment). */
export function availableDrivers(wanted?: readonly Exclude<DriverName, 'agent'>[]): DriverName[] {
  const found: DriverName[] = ['agent']
  for (const driver of wanted ?? (['claude', 'codex', 'pi'] as const)) {
    if (driver === 'pi' && !process.env.DEEPSEEK_API_KEY) continue
    if (onPath(driver)) found.push(driver)
  }
  return found
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
  const drivers = availableDrivers(config.drivers)
  let running = false

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
      return c.json({ token, drivers })
    })
    .post(`${PREFIX}/ask`, async (c) => {
      if (!fromOwnPage(c.req.raw.headers) || c.req.header('x-agent-panel-token') !== token)
        return c.json({ error: "only the app's own page may ask" }, 403)
      const body = (await c.req.json().catch(() => ({}))) as { message?: unknown; driver?: unknown }
      const message = typeof body.message === 'string' ? body.message.trim() : ''
      const driver = (typeof body.driver === 'string' ? body.driver : 'agent') as DriverName
      if (message === '' || message.length > 8000)
        return c.json({ error: 'write a message of at most 8000 characters' }, 400)
      if (!drivers.includes(driver))
        return c.json(
          { error: `the driver "${driver}" is not available here (${drivers.join(', ')})` },
          400,
        )
      if (running) return c.json({ error: 'a run is already going; wait for it to end' }, 409)
      running = true
      return streamSSE(c, async (stream) => {
        const send = (event: string, data: unknown): Promise<void> =>
          stream.writeSSE({ event, data: JSON.stringify(data) })
        let changed = false
        const off = ctx.on('extensions/changed', (extension: string, action: string) => {
          changed = true
          void send('change', { extension, action })
        })
        audit({ ask: 'start', driver, characters: message.length })
        try {
          if (driver === 'agent') {
            // Stop in the page closes the stream; that cancels the run (the model call or tool in flight is dropped).
            const cancel = new AbortController()
            stream.onAbort(() => cancel.abort())
            const result = await ctx.agent.run(message, { signal: cancel.signal })
            for (const call of result.trace)
              await send('tool', {
                tool: call.tool,
                input: call.input,
                ...(call.error ? { error: call.error } : { result: call.result }),
              })
            await send('text', {
              text:
                result.status === 'completed'
                  ? result.output
                  : result.status === 'cancelled'
                    ? 'The run was cancelled.'
                    : `The run stopped after ${result.steps} steps without an answer.`,
            })
          } else {
            const { file, args } = command(driver, message, root)
            const child = spawn(file, args, {
              cwd: root,
              env: process.env,
              stdio: ['ignore', 'pipe', 'pipe'],
            })
            stream.onAbort(() => {
              child.kill('SIGTERM')
            })
            child.stdout.on(
              'data',
              (chunk: Buffer) => void send('text', { text: chunk.toString() }),
            )
            child.stderr.on(
              'data',
              (chunk: Buffer) =>
                void send('tool', { tool: driver, info: chunk.toString().slice(0, 500) }),
            )
            const code = await new Promise<number>((done) => {
              child.on('error', () => done(1))
              child.on('exit', (exit) => done(exit ?? 1))
            })
            if (code !== 0)
              await send('error', { message: `${driver} ended with exit code ${code}` })
          }
          await send('done', { changed })
        } catch (error) {
          await send('error', { message: error instanceof Error ? error.message : String(error) })
        } finally {
          off()
          running = false
          audit({ ask: 'end', driver, changed })
        }
      })
    })
  ctx.router.route('/', app)
}
