import type { Context } from '@deepseek-ai/cordis'
import type {} from './plugins/http/index.ts'

export const APP_NAME = '__APP_NAME__'

/** The app's own routes. Each one lives in a `ctx.effect`, so it is removed when this plugin is disposed. */
export const routes = {
  name: 'routes',
  inject: ['http'],
  apply(ctx: Context) {
    ctx.effect(() => ctx.http.route('GET', '/', () => ({ body: { app: APP_NAME, ok: true } })))
    ctx.effect(() => ctx.http.route('GET', '/health', () => ({ body: { ok: true } })))
  },
}
