/**
 * The app as the ACRYL frame hosts it (`npm run dev`): the generated overlay mounts this row, which mounts the app's own
 * routes at {@link FRAME_MOUNT_PREFIX} on the frame's router. The frame then opens its tile at `/app/`. Nothing here runs in
 * production: `npm start` composes the app on its own server, where the routes are at the root as they always were.
 */
import type { Context } from '@deepseek-ai/cordis'
import { FRAME_MOUNT_PREFIX, makeApp } from './routes.ts'

export const name = 'app-routes'

export function apply(ctx: Context): void {
  ctx.router.route(FRAME_MOUNT_PREFIX, makeApp())
}
