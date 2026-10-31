/**
 * The app as the ACRYL frame hosts it (`npm run dev`): the generated overlay mounts this row, which mounts the app's own routes at
 * {@link FRAME_MOUNT_PREFIX} on the frame's router and claims that prefix on the frame's web server, so the app answers at `/app`. The frame then
 * opens its tile there. Nothing here runs in production: `npm start` composes the app on its own server (no `routerHttp` service, so this row is not
 * mounted there), where the routes are at the root as they always were.
 */
import type { Context } from '@deepseek-ai/cordis'
import { FRAME_MOUNT_PREFIX, makeApp } from './routes.ts'

/** The one method this row needs of the frame's `routerHttp` (`acrylblends/cordis/router-http`); a framework-only app has no such package, so the shape is declared here. */
interface RouterHttpPort {
  mount(prefix: string): () => void
}

export const name = 'app-routes'

/** The frame always has both: its overlay carries the router and the web adapter. */
export const inject = ['router', 'routerHttp']

export function apply(ctx: Context): void {
  ctx.router.route(FRAME_MOUNT_PREFIX, makeApp())
  // Required by `inject`, so it is there when this row applies; the cast names the one method the row uses.
  const http = ctx.get('routerHttp') as RouterHttpPort
  http.mount(FRAME_MOUNT_PREFIX)
}
