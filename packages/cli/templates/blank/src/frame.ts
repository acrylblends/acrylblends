/**
 * The app as the ACRYL frame hosts it (`npm run dev`): the generated overlay mounts this row, which mounts the app's own
 * routes at {@link FRAME_MOUNT_PREFIX} on the frame's router. The frame then opens its tile at `/app/`. Nothing here runs in
 * production: `npm start` composes the app on its own server, where the routes are at the root as they always were.
 */
import type { Context } from '@deepseek-ai/cordis'
import { FRAME_MOUNT_PREFIX, makeApp } from './routes.ts'

export const name = 'app-routes'
export const inject = ['router', 'routerHttp']

/** The one router-http call this row makes, typed here: the service is read by the frame's own row, and a port is a pass. */
interface RouterHttp {
  mount(prefix: string): () => void
}

export function apply(ctx: Context & { readonly routerHttp: RouterHttp }): void {
  // The routes go on the frame's router at the prefix, and the prefix is claimed on the frame's web server, which serves the
  // router's answers over HTTP: a route registered but never mounted is unreachable inside the frame.
  ctx.router.route(FRAME_MOUNT_PREFIX, makeApp())
  ctx.routerHttp.mount(FRAME_MOUNT_PREFIX)
}
