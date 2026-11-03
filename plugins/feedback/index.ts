/**
 * Feedback from the people who use the app (docs/design/blends-frame-mockup.html, scenario 9): a Feedback button on every page of the app, in
 * production too. Pressing it turns a picker on: the person clicks the element where they hit a problem or had an idea, or chooses "Nothing
 * specific", writes a note and sends it. The notes are kept in the app's own data and read through the `feedback` service, which the ACRYL frame
 * shows in the builder's left panel ("Feedback from users"), where one click hands a note to an agent.
 *
 * - A middleware appends one script tag (`<mount>/api/feedback/feedback.js`) to every HTML response, so no page is edited (agent-panel's way).
 * - `POST <mount>/api/feedback/notes` takes one note from the app's own page (same origin), at most 30 a minute across the app.
 * - Nobody reads the notes over HTTP here: the builder reads them through the service. Opt-in: `acrylblends add feedback`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { Acryl } from '../acryl-router/src/index.ts'
import type {} from '../instance/index.ts'
import { type FeedbackNote, FeedbackStore, parseNewNote } from './store.ts'

export type { FeedbackNote, PinnedElement } from './store.ts'

export const name = 'feedback'
export const inject = ['router', 'appInstance']

/** What the builder's tools read: every note, newest first, and marking notes seen. */
export interface Feedback {
  list(): Promise<FeedbackNote[]>
  markSeen(ids: readonly string[]): Promise<void>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    feedback: Feedback
  }
}

export interface FeedbackConfig {
  /** The URL prefix the app is mounted at: empty on the app's own server, `/app` when the ACRYL frame hosts it (agent-panel's `mount`). */
  mount?: string
}

const NOTES_PER_MINUTE = 30
const MOUNT = /^\/[A-Za-z0-9._~\-/]*[A-Za-z0-9._~-]$/u
const CLIENT = readFileSync(join(import.meta.dirname, 'client.js'), 'utf8')

/** A request from the app's own page: a browser sends Origin on a POST, and it must name this host. */
function fromOwnPage(headers: Headers): boolean {
  const origin = headers.get('origin')
  const host = headers.get('host')
  if (origin === null || host === null) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export function apply(ctx: Context, config: FeedbackConfig = {}): void {
  const mount = config.mount ?? ''
  if (mount !== '' && !MOUNT.test(mount)) throw new TypeError(`feedback: the app's mount "${mount}" must be empty or an absolute path such as "/app"`)
  const PREFIX = `${mount}/api/feedback`
  const store = new FeedbackStore(join(ctx.appInstance.home, 'feedback'))
  ctx.effect(() => ctx.reflect.provide('feedback', { list: () => store.list(), markSeen: (ids) => store.markSeen(ids) } satisfies Feedback), 'feedback: service')

  const tag = `<script type="module" src="${PREFIX}/feedback.js"></script>`
  const addScript = async (c: { res: Response }, next: () => Promise<void>): Promise<void> => {
    await next()
    if (!(c.res.headers.get('content-type') ?? '').includes('text/html')) return
    const html = await c.res.text()
    const headers = new Headers(c.res.headers)
    headers.delete('content-length')
    const body = html.includes(`${PREFIX}/feedback.js`) ? html : html.includes('</body>') ? html.replace('</body>', `${tag}</body>`) : html + tag
    c.res = new Response(body, { status: c.res.status, headers })
  }
  const router = ctx.router as unknown as { wrap?: (middleware: typeof addScript) => unknown }
  const wrapped = typeof router.wrap === 'function'
  if (wrapped) router.wrap?.(addScript)

  const sent: number[] = []
  const app = new Acryl()
    .use('*', async (c, next) => {
      if (wrapped) return next()
      await addScript(c, next)
    })
    .get(`${PREFIX}/feedback.js`, (c) =>
      c.body(`${CLIENT}\nstart(${JSON.stringify(PREFIX)})\n`, 200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' }))
    .post(`${PREFIX}/notes`, async (c) => {
      if (!fromOwnPage(c.req.raw.headers)) return c.json({ error: "only the app's own page may send feedback" }, 403)
      const now = Date.now()
      while (sent.length > 0 && (sent[0] as number) < now - 60_000) sent.shift()
      if (sent.length >= NOTES_PER_MINUTE) return c.json({ error: 'too much feedback at once; try again in a minute' }, 429)
      const note = parseNewNote(await c.req.json().catch(() => undefined))
      if (typeof note === 'string') return c.json({ error: note }, 400)
      sent.push(now)
      const stored = await store.add(note)
      return c.json({ id: stored.id }, 201)
    })
  ctx.router.route('/', app)
}
