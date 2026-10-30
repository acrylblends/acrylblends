import type { Context } from '@deepseek-ai/cordis'
import { Acryl } from '../plugins/acryl-router/src/index.ts'
import { aboutPage } from './about.tsx'

export const APP_NAME = '__APP_NAME__'

/**
 * The only place the app's mount prefix is named. On its own server (production, `npm start`) the app mounts at the root and
 * its public URLs are `/`, `/about`, `/health`; when the ACRYL frame hosts it (`npm run dev`) the routes mount here, and the
 * frame opens its tile at `/app/`. Every page link and asset URL this template writes is derived from the prefix it is
 * mounted at, so the same source serves both.
 */
export const FRAME_MOUNT_PREFIX = '/app'

/** The app's own routes: an `App` mounted on the router at `options.prefix` (empty or absent: the root). The mount is removed when this plugin is disposed. */
export const routes = {
  name: 'routes',
  inject: ['router'],
  apply(ctx: Context, options: { readonly prefix?: string } = {}) {
    const prefix = options.prefix ?? ''
    const app = new Acryl()
      .get('/', (c) => c.json({ app: APP_NAME, ok: true }))
      .get('/health', (c) => c.json({ ok: true }))
      .get('/about', (c) => c.html(aboutPage()))
    ctx.router.route(prefix === '' ? '/' : prefix, app)
  },
}
