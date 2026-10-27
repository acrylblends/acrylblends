# The plugin library

Each plugin is plain Cordis code in `plugins/<name>/` of this repository. `acrylblends init` and `acrylblends add` copy it into
your app's `plugins/<name>/` with the plugins it requires. Every one is tested in this repository with `node:test`
against a real Cordis context, including disposal.

| Plugin | Service | From ACRYL |
|---|---|---|
| [instance](#instance) | `appInstance` | `runtime/acryl-harness-runtime/src/instance/` |
| [acryl-router](#the-framework-plugins), [acryl-router-http](#the-framework-plugins), [acryl-node-server](#the-framework-plugins), [acryl-state](#the-framework-plugins), [acryl-inspect](#the-framework-plugins) | `router`, `nodeServer`, `state`, `inspect` | `plugins/acryl-*` (the ACRYL framework) |
| [settings](#settings) | `settings` | `plugins/acryl-settings` |
| [extensions](#extensions) | `extensions` | `plugins/acryl-extension-context` |
| [builder](#builder) | tools for the agent | the agent's install tools |
| [sandbox](#sandbox) | `sandbox` | - |
| [agent](#agent) | `agent`, `model`, `tools`, `memory` | - |
| [openai](#openai) | `model` (a real one) | - |
| [tasks](#tasks) | `tasks` | idea from Pi Durable |
| [manifest](#manifest) | functions, no service | `runtime/blends-core` |
| [save](#save) | a tool for the agent | `runtime/app-persistence` |

## instance

Where the app keeps things, decided once. `selectInstance({ projectRoot, env })` is the only code that reads the
environment; it returns a frozen `AppInstance` with `root` (the project folder), `home` (`<project>/.acrylblends`, or
`ACRYLBLENDS_HOME`), and a port preference: a stable port per app in 3100-3999 that moves to the next free one, or
`ACRYLBLENDS_PORT`. Two folders with the same name are different apps. Mount it first: `root.plugin(instance, chosen)`.

## The framework plugins

`acryl-router` (`ctx.router`: mounts an `App` with `route(prefix, app)`, with the ported core's routing, middleware and validators, and an in-process `request()`), `acryl-node-server` (one `node:http` listener that sends every
request to the router; config `{ port, hostname, scan }`, provides `ctx.nodeServer.url`), `acryl-state` (observable cells, read as JSON and streamed as server-sent
events at `/api/state/<key>` and `/api/state/<key>/events`), `acryl-inspect` (what every plugin requires, provides and registers) and `acryl-router-http` (the
`serve()` that `acryl-node-server` uses) are ACRYL's framework, vendored here as they are. Their text is in [framework/](framework/README.md); their source is
`plugins/acryl-*/src`, never edited in this repository (see `scripts/sync-framework.mjs`).

`acryl-db` (the `db` port: types, numbered migrations) and `acryl-db-sqlite` (the SQLite provider; one `node:sqlite` file, `data.sqlite` in the app home unless `path` is set,
the app's `migrations/` folder applied on start) come with `acrylblends add db` in a Blend app. A plugin declares `inject: ['db']` and calls `await ctx.db.all('SELECT ...', value)`;
the interface is the one in the [data guide](framework/guides/data.md). A plain Acryl app opens its database with `openDb` from `acrylblends/db/sqlite` instead.

## settings

`ctx.settings.register(namespace, schema, { base, applies, validate })` returns a scope with `get`, `watch`, `update`
and `replace`. The value layers the schemastery schema's defaults, then `base`, then what is stored in
`<home>/settings.yaml`. Writes are validated, atomic and run one at a time; watchers and the `settings/updated` event see
them in order; an unchanged value notifies nobody; pending writes settle on dispose.

## extensions

Install, update, remove and reload Cordis plugins while the app runs: `ctx.extensions.install(folder)`, `remove(name)`,
`reload()`, `list()`, `pending()`, `ledger()`. A failed update brings the previous version back. Config: `{ sources: [{
dir, trust: 'install' | 'list' }] }`. Details in [Extending a running app](agent/extending-apps.md).

## sandbox

`ctx.sandbox.run(entry, input, { timeoutMs, memoryMb, read })` runs a file that exports `run(input)` in a separate Node process
under the permission model (`node --permission`): it can read only its own folder; it cannot write files, start processes or
workers, or load native addons; it gets an empty environment; it is killed after a time limit and capped in memory and output.
It never throws: failures are results (`denied`, `timeout`, `output`, `crash`, `error`). **It does not block the network**: Node 24
has no network permission, so restrict egress outside the process where that matters.

## builder

Gives the agent tools over Extensions: `list_plugins`, `read_plugin`, `write_plugin`, `install_plugin`, `remove_plugin`.
Writes are confined to one extensions folder (`{ dir }`, which must be an extensions source) and to source files. It
teaches the scripted model commands (`create route <name> <path> <text>`, `update route ...`, `break plugin <name>`,
`remove plugin <name>`, `list plugins`) so the whole loop runs offline.

## agent

`model` (a scripted, offline model; other plugins `teach` it rules), `tools` (a registry; a tool registered inside
`ctx.effect` leaves with its plugin), `memory`, and `agent`: `ctx.agent.run(question)` runs a loop in its own child fiber
with a step budget (`{ steps }`), and returns the answer with a trace of every tool call. A failing tool is reported to
the model, not thrown. Replace `model` with a real provider: it only has to implement `complete({ question, step,
toolResult })`.

## openai

A real model for the agent: any OpenAI-compatible chat API (OpenAI, DeepSeek, Ollama, LM Studio) over `fetch`, with tool
calls, and no SDK. It provides the same `model` service, so nothing else changes. Its system prompt teaches the model the
extension contract. In the `agent` template, set `ACRYLBLENDS_MODEL_URL`, `ACRYLBLENDS_MODEL` and (for hosted APIs)
`ACRYLBLENDS_MODEL_KEY`; `main.ts` reads them and swaps the scripted model for this one.

## tasks

Records live in a store behind a small interface (`load`, `append`, `close`): a JSON lines file by default, or a SQLite file
(`store: sqlite`, using Node's built-in `node:sqlite`, with full-durability writes). Both pass the same conformance suite, and the
whole tasks test file runs against each. In the agent template this is the `taskStore` parameter of `blend.yaml`.

Durable task records: `ctx.tasks.start(kind, input, { parent })` returns a handle with `complete`, `fail`, `progress` and
an abort `signal`. Every change is appended to `<home>/tasks.jsonl` before the call returns. `cancel(id)` cancels the
tasks it owns too. After a crash, a task that was running is marked `interrupted` and is never run again on its own,
because a side effect may already have happened. When `tasks` is mounted, every agent run is a task owning one task per
tool call. With `acryl-state` mounted, the latest tasks are also the state cell `tasks`, and the installed extensions the cell `extensions`: read them at
`/api/state/tasks` and stream them at `/api/state/tasks/events`.

## manifest

Reads and validates `blend.yaml`, ACRYL's Blend format: Blueprints, and Blends that resolve over them (`lineage`, `extends`, `overrides`), plus `planUpgrade` for moving a Blend to a newer Blueprint.

`loadManifest(file, { known, values })`, `validate(document, known)`, `compose(root, manifest, registry, overrides)`,
`lock(manifest, sources)`, and `npm run lock`. See [The app manifest](blends/manifest.md).

## save

`saveApp` over two ports (git and the hosting service), the secret scan, `npm run save`, and a `save_app` tool when the app
has a tool registry. It never reads, stores or asks for a token: git and gh use your own credential helpers.

## desktop

An Electron window on the app's own server. `acrylblends init my-app --desktop` (or `acrylblends add desktop` in an existing app) adds `plugins/desktop`, `electron` as a development
dependency and the script `npm run desktop`. `npm run desktop` picks the app's instance as `npm run dev` does, keeps Electron's user data inside the app's own home (`.acrylblends/electron`,
never the user's application-data folder), starts `createApp` in the Electron main process, opens one window with a locked-down renderer (context isolation, no Node, sandbox) on the app's address
(`/todo` for the todo template: `acrylblends.desktopPath` in `package.json`), keeps navigation on the app's own origin (other links open in the system browser), and ends the process when the window
closes, after the server stopped. A second launch of the same app focuses the first. The app's own code never imports `electron`; only `plugins/desktop` does. `user-data.ts` and `shutdown.ts` are
vendored from ACRYL Desktop with a recorded digest (`upstream.json`). Run from source only for now; packaging a distributable app is not part of it. `npm install` does not download Electron's binary (Electron 44 dropped its install script): the
`electron` command downloads it the first time `npm run desktop` runs (about 100 MB, once per machine; `ELECTRON_MIRROR` and `ELECTRON_CACHE` apply). If that download is blocked, run `npx install-electron` where you can reach the mirror.
