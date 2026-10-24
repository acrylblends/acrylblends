# __APP_NAME__

A Cordis app on the ACRYL framework: TypeScript that Node 22.19 or newer runs directly (no build step; erasable syntax only, so no enums and no
parameter properties). Every part of it is a Cordis plugin.

## The framework's API is in `docs/framework/`

Start at `docs/framework/README.md`. Read before you write routes: `routing.md` (the `App`), `request.md` (`c.req`), `context.md` (`c`),
`validation.md`, `helpers.md` (`streamSSE`), `middleware.md`, `plugin-lifecycle.md` (what a plugin owns and when it is unloaded) and
`node-server.md`. The framework's source is vendored in `src/plugins/acryl-*/src`: read it, do not edit it (a change belongs in ACRYL, upstream).
The docs write `from 'acryl-router'`; in this app that is `./plugins/acryl-router/src/index.ts` (relative to `src/`), `acryl-router/middleware`
is `./plugins/acryl-router/src/middleware/index.ts` and `acryl-router/helpers` is `./plugins/acryl-router/src/helpers/index.ts`.
A plugin written into `extensions/` while the app runs can import `acryl-router`, `acryl-router/middleware` and `acryl-router/helpers` by those names.

## How a feature is built

Routes are an ordinary `App` that a plugin mounts once with `ctx.router.route(prefix, app)`. The mount belongs to the plugin and goes away when it unloads.

```ts
import type { Context } from '@deepseek-ai/cordis'
import { App, HTTPException } from './plugins/acryl-router/src/index.ts'
import { schemaValidator, type StandardSchema } from './plugins/acryl-router/src/helpers/index.ts'

export const name = 'notes'               // a plugin's name; blend.yaml refers to it
export const inject = ['router']          // services it needs
export function apply(ctx: Context) {
  const app = new App()
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

- A page mounted at `/x` answers `/x`, not `/x/` (trailing slashes are strict).
- `schemaValidator('json', ...)` needs a JSON `Content-Type`; without it the schema sees `{}`. A failure answers 400 with
  `{ "error": "invalid json", "issues": [{ "message", "path" }] }`: the human text is `issues[0].message`.
- Throw `new HTTPException(404, { message })` for an error response; the body is the message as plain text (use `c.json({ error }, status)` when a page expects JSON).
- Handlers get the request as `c.req`: `c.req.param('id')`, `c.req.query('q')`, `await c.req.json()`, `c.req.raw` for the Web `Request`.
- A server-sent stream is `streamSSE(c, async (stream) => { await stream.writeSSE({ data: JSON.stringify(x) }) ... })`; call `stream.onAbort(cleanup)`.
- `npm run dev` restarts the app whenever a file changes.

## Before you say you are done

`npm test` and `npm run check` (type-check) both pass. Put tests in `test/`, written with `node:test` like `test/app.test.ts`.
