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

/** The scaffold's name comes from the folder, so the first screen escapes it like any other user text. */
const escapeHtml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/**
 * The first screen: the page a browser gets at the root, which is what the ACRYL frame's first tile shows. A blank app whose root answered JSON to
 * every client gave the tile Chrome's JSON viewer, nearly invisible in the frame's dark surface (owner review, 2026-11-02); the root now answers a page
 * to a browser and the JSON hello to everything else, the way the agent template does. The About link is relative, so it works under the frame's /app
 * mount and on the app's own server alike.
 */
const homePage = (name: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(name)}</title>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(name)}</h1>
      <p>Your app is running. This is the page the ACRYL frame opens first; edit <code>src/routes.ts</code> to change it.</p>
      <p><a href="./about">About</a></p>
    </main>
  </body>
</html>`

/** The app's own pages and routes, mountable at any prefix: the standalone server mounts it at the root, the frame row at {@link FRAME_MOUNT_PREFIX}. */
export function makeApp(): Acryl {
  return (
    new Acryl()
      // A browser gets the first screen; an API client gets the JSON hello.
      .get('/', (c) =>
        (c.req.header('accept') ?? '').includes('text/html')
          ? c.html(homePage(APP_NAME))
          : c.json({ app: APP_NAME, ok: true }),
      )
      .get('/health', (c) => c.json({ ok: true }))
      .get('/about', (c) => c.html(aboutPage()))
  )
}

/** The app's own routes: an `App` mounted on the router at `options.prefix` (empty or absent: the root). The mount is removed when this plugin is disposed. */
export const routes = {
  name: 'routes',
  inject: ['router'],
  apply(ctx: Context, options: { readonly prefix?: string } = {}) {
    const prefix = options.prefix ?? ''
    ctx.router.route(prefix === '' ? '/' : prefix, makeApp())
  },
}
