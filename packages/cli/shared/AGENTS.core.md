# __APP_NAME__

A Cordis app on the ACRYL framework: TypeScript that Node 22.19 or newer runs directly (no build step; erasable syntax only, so no enums and no
parameter properties). Every part of it is a Cordis plugin.

## The framework's API is in `docs/framework/`

Start at `docs/framework/README.md`; `api/summary.md` is the one-page summary. Read before you write routes: `api/routing.md` (the `Acryl` app), `api/request.md` (`c.req`),
`api/context.md` (`c`), `cordis/validation.md` and `guides/validation.md`, `guides/helpers.md` (`streamSSE`), `concepts/middleware.md`, `cordis/plugin-lifecycle.md` (what a plugin
owns and when it is unloaded), `cordis/mounting.md` and `cordis/node-server.md`. Pages marked "not yet available" describe parts that are not in this app.

The docs write `import { Acryl } from 'acrylblends'` and `from 'acrylblends/<subpath>'`. In this app the framework is the vendored plugin source in `src/plugins/acryl-router/src`
(read it, do not edit it: a change belongs in ACRYL, upstream), so from a file in `src/` import:

- `./plugins/acryl-router/src/index.ts` for `Acryl`, `Context`, `HTTPException`, `connectionOf`, `getConnInfo` and the types;
- `./plugins/acryl-router/src/middleware/index.ts` for every middleware (`cors`, `bodyLimit`, `trimTrailingSlash`, `loopbackOnly`, ...);
- `./plugins/acryl-router/src/helpers/index.ts` for the helpers and validators (`streamSSE`, `schemaValidator`, `validator`, cookies, `testClient`, ...).
- `./plugins/acryl-router/src/core/jsx/index.ts` for `acrylblends/jsx` (`jsx`, `Fragment`, the types), and `.../core/jsx/streaming.ts` for `acrylblends/jsx/streaming`.

**JSX: write `.tsx`.** The scripts in `package.json` run Node.js with `--import ./src/plugins/acryl-node-server/src/register.ts`, which compiles `.tsx` files with this app's own `typescript`; `tsconfig.json` sets `jsx: react-jsx` and `jsxImportSource: #acryl-jsx`, which `package.json`'s `imports` maps to the vendored runtime in `src/plugins/acryl-router`. See `src/about.tsx` (blank template) for a page and `test/app.test.ts` for how it is tested. Render a component with `.toString()` and return it with `c.html(...)`; import `jsx`, `Fragment` and the types from `./plugins/acryl-router/src/core/jsx/index.ts` when you need them. A command that starts the app without those scripts (a bare `node src/main.ts`) cannot load a `.tsx` file. Without a build step you can write the call JSX compiles to instead: `jsx('h1', { class: 'title' }, 'Hello')`, children after the props.

A plugin written into `extensions/` while the app runs may use the docs' own names instead: `acrylblends` and `acrylblends/<subpath>` resolve to the same files. `App` is the
deprecated name of `Acryl`.

## How a feature is built

Routes are an ordinary `Acryl` app that a plugin mounts once with `ctx.router.route(prefix, app)`. The mount belongs to the plugin and goes away when it unloads.

```ts
import type { Context } from '@deepseek-ai/cordis'
import { Acryl, HTTPException } from './plugins/acryl-router/src/index.ts'
import { schemaValidator, type StandardSchema } from './plugins/acryl-router/src/helpers/index.ts'

export const name = 'notes'               // a plugin's name; blend.yaml refers to it
export const inject = ['router']          // services it needs
export function apply(ctx: Context) {
  const app = new Acryl()
    .get('/', (c) => c.json({ ok: true }))
    .get('/:id', (c) => c.json({ id: c.req.param('id') }))
    .post('/', schemaValidator('json', NewNote), (c) => c.json(c.req.valid('json'), 201))   // NewNote is a Standard Schema
  ctx.router.route('/notes', app)         // build the whole app first: routes added after route() are not served
}
```

- A small route goes on the `App` in `src/routes.ts`. A new feature is a new plugin file: add it to `registry` in `src/app.ts`, add a row
  (`- id: notes` / `name: notes`) to `blend.yaml` before the `acryl-node-server` row, and pass runtime values (a data file) as its config in `createApp`.
- State, when `src/plugins/acryl-state` exists: `const cell = ctx.state.cell<T>('notes.list', initial)` (add `'state'` to `inject`), then
  `cell.get()`, `cell.set(value)`, `cell.update(fn)` and `cell.subscribe(fn)` (returns the unsubscribe). Every cell is also served as JSON at `/api/state/<key>`
  and streamed at `/api/state/<key>/events`.
- Test a route without a socket: `await ctx.router.request('/notes')`, or boot the app as `test/app.test.ts` does and use `fetch`.

## Things that surprise people

- A page mounted at `/x` answers `/x`, not `/x/` (trailing slashes are strict); `trimTrailingSlash()` (middleware) redirects `/x/` to `/x` for GET and HEAD.
- `schemaValidator('json', ...)` needs a JSON `Content-Type`; without it the schema sees `{}`. A failure answers 400 with
  `{ "error": "invalid json", "issues": [{ "message", "path" }] }`: the human text is `issues[0].message`. A `jsonOnly` recipe in `docs/framework/validation.md` answers 415 instead.
- Throw `new HTTPException(404, { message })` for an error response; the body is the message as plain text (use `c.json({ error }, status)` when a page expects JSON).
- Handlers get the request as `c.req`: `c.req.param('id')`, `c.req.query('q')`, `await c.req.json()`, `c.req.raw` for the Web `Request`.
- A server-sent stream is `streamSSE(c, async (stream) => { await stream.writeSSE({ data: JSON.stringify(x) }) ... })`; call `stream.onAbort(cleanup)`.
- `npm run dev` restarts the app whenever a file changes.

## Before you say you are done

`npm test` and `npm run check` (type-check) both pass. Put tests in `test/`, written with `node:test` like `test/app.test.ts`.
