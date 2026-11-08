/**
 * The collective app's showcase: every plugin in the app as a card (name, author, version, source, state, links to what it adds) at `/showcase`,
 * updated live as plugins are pulled and removed.
 *
 * A group pulls its members' plugins into one app (`plugin pull --from group.txt`); this page is where they see what the group made. It reads the
 * app's plugins through `pluginShare` (which knows where each pulled one came from), and follows `extensions/changed`: every install, update,
 * restore and removal goes through extensions, so one event covers them all. The stream's open connections end with the plugin.
 */
import type { Context } from '@deepseek-ai/cordis'
import { streamSSE } from '../acryl-router/src/helpers/index.ts'
import { Acryl } from '../acryl-router/src/index.ts'
import type {} from '../extensions/index.ts'
import type {} from '../plugin-share/index.ts'
import { type Offered, renderCards, renderPage, type ShowcaseCard, showcaseCards } from './cards.ts'

export type { ShowcaseCard } from './cards.ts'
export { renderCards, showcaseCards } from './cards.ts'

export const name = 'showcase'
export const inject = ['router', 'pluginShare']

/** A comment line this often keeps an idle stream open through proxies and browsers. */
const KEEP_ALIVE_MS = 15_000

/** The optional services the cards link to, read where they are now: an app without an agent has no tools, one without a home page no widgets. */
function offered(ctx: Context): Offered {
  const get = ctx.get as (service: string) => unknown
  const tools = get('tools') as { list(): ReadonlyArray<{ readonly name: string }> } | undefined
  const home = get('home') as { widgets(): ReadonlyArray<{ readonly id: string }> } | undefined
  return {
    tools: tools?.list().map((tool) => tool.name) ?? [],
    widgets: home?.widgets().map((widget) => widget.id) ?? [],
  }
}

export function apply(ctx: Context): void {
  const cards = (): ShowcaseCard[] => showcaseCards(ctx.pluginShare.list(), offered(ctx))

  // The pages that follow the stream; each gets the cards again after every change.
  const listeners = new Set<(html: string) => void>()
  const ends = new Set<() => void>()
  ctx.on('extensions/changed', () => {
    if (listeners.size === 0) return
    const html = renderCards(cards())
    for (const listener of listeners) listener(html)
  })
  ctx.effect(
    () => () => {
      for (const end of ends) end()
    },
    'showcase: end the open streams',
  )

  const app = new Acryl()
    .get('/showcase', (c) => c.html(renderPage(cards()), 200, { 'cache-control': 'no-store' }))
    .get('/showcase/plugins', (c) => c.json(cards(), 200, { 'cache-control': 'no-store' }))
    .get('/showcase/events', (c) =>
      streamSSE(c, async (stream) => {
        let queue: Promise<unknown> = Promise.resolve()
        const send = (html: string): void => {
          queue = queue
            .then(() => stream.writeSSE({ event: 'cards', data: html }))
            .catch(() => undefined)
        }
        let finish = (): void => undefined
        const ended = new Promise<void>((resolve) => {
          finish = resolve
          stream.onAbort(resolve)
        })
        ends.add(finish)
        listeners.add(send)
        send(renderCards(cards()))
        const keepAlive = setInterval(() => {
          queue = queue.then(() => stream.write(': keepalive\n\n')).catch(() => undefined)
        }, KEEP_ALIVE_MS)
        keepAlive.unref()
        try {
          await ended
        } finally {
          clearInterval(keepAlive)
          listeners.delete(send)
          ends.delete(finish)
          await queue
        }
      }),
    )
  ctx.router.route('/', app)
}
