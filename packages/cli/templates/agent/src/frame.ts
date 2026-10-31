/**
 * The app as the ACRYL frame hosts it (the `agent` template: the page and the agent panel stay inside the /app tile) (`npm run dev`): the generated layer mounts this row, which mounts the app's own routes at
 * {@link FRAME_MOUNT_PREFIX} on the frame's router and claims that prefix on the frame's web server, so the app answers at `/app`. The frame then
 * opens its tile there. Nothing here runs in production: `npm start` composes the app on its own server (no `routerHttp` service, so this row is not
 * mounted there), where the routes are at the root as they always were.
 */
import type { Context } from '@deepseek-ai/cordis'
import { FRAME_MOUNT_PREFIX, makeApp } from './routes.ts'

export const name = 'app-routes'

/** The frame always has both: its layer carries the router and the web adapter. */
export const inject = ['router', 'routerHttp']

export function apply(ctx: Context): void {
  ctx.router.route(FRAME_MOUNT_PREFIX, makeApp(FRAME_MOUNT_PREFIX))
  ctx.routerHttp.mount(FRAME_MOUNT_PREFIX)
}
