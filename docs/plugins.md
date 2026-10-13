# The plugin library

Each plugin is plain Cordis code in `plugins/<name>/` of this repository. `acrylblends init` and `acrylblends add` copy it into
your app's `src/plugins/<name>/` with the plugins it requires. Every one is tested in this repository with `node:test`
against a real Cordis context, including disposal.

| Plugin | Service | From ACRYL |
|---|---|---|
| [instance](#instance) | `appInstance` | `runtime/acryl-harness-runtime/src/instance/` |
| [http](#http-and-server), [server](#http-and-server) | `http`, `server` | - |
| [settings](#settings) | `settings` | `plugins/acryl-settings` |
| [extensions](#extensions) | `extensions` | `plugins/acryl-extension-context` |
| [builder](#builder) | tools for the agent | the agent's install tools |
| [sandbox](#sandbox) | `sandbox` | - |
| [agent](#agent) | `agent`, `model`, `tools`, `memory` | - |
| [openai](#openai) | `model` (a real one) | - |
| [tasks](#tasks) | `tasks` | idea from Pi Durable |
| [events](#events) | a route | idea from Pi Durable |
| [manifest](#manifest) | functions, no service | `runtime/blends-core` |
| [save](#save) | a tool for the agent | `runtime/app-persistence` |
| [digest](#digest) | a function | - |

## instance

Where the app keeps things, decided once. `selectInstance({ projectRoot, env })` is the only code that reads the
environment; it returns a frozen `AppInstance` with `root` (the project folder), `home` (`<project>/.acrylblends`, or
`ACRYLBLENDS_HOME`), and a port preference: a stable port per app in 3100-3999 that moves to the next free one, or
`ACRYLBLENDS_PORT`. Two folders with the same name are different apps. Mount it first: `root.plugin(instance, chosen)`.

## http and server

`http` is a router service: `ctx.http.route(method, path, handler)` returns the function that removes the route, so a
plugin adds routes inside `ctx.effect` and they leave with it. `server` serves the router with `node:http`, takes `{ port,
hostname, scan }` as its Cordis config, provides `ctx.server.url`, and closes on dispose.

## settings

`ctx.settings.register(namespace, schema, { base, applies, validate })` returns a scope with `get`, `watch`, `update`
and `replace`. The value layers the schemastery schema's defaults, then `base`, then what is stored in
`<home>/settings.yaml`. Writes are validated, atomic and run one at a time; watchers and the `settings/updated` event see
them in order; an unchanged value notifies nobody; pending writes settle on dispose.

## extensions

Install, update, remove and reload Cordis plugins while the app runs: `ctx.extensions.install(folder)`, `remove(name)`,
`reload()`, `list()`, `pending()`, `ledger()`. A failed update brings the previous version back. Config: `{ sources: [{
dir, trust: 'install' | 'list' }] }`. Details in [Extending a running app](extending-apps.md).

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
tool call.

## events

`GET /events` as a stream of server-sent events. Config: `{ topics: ['tasks/changed', 'extensions/changed'], path }`. The SSE event
name is the Cordis event, the data is `{ "args": [...] }`, ids rise, a keepalive comment goes out every 15 s, and a connection's
listeners are removed when the client leaves. Any route can answer with a stream: return `{ body: null, stream: (send) => cleanup }`
from a route handler. A surface renders this stream instead of polling `GET /tasks`.

## manifest

Reads and validates `blend.yaml`, ACRYL's Blend format: Blueprints, and Blends that resolve over them (`lineage`, `extends`, `overrides`), plus `planUpgrade` for moving a Blend to a newer Blueprint.

`loadManifest(file, { known, values })`, `validate(document, known)`, `compose(root, manifest, registry, overrides)`,
`lock(manifest, sources)`, and `npm run lock`. See [The app manifest](manifest.md).

## save

`saveApp` over two ports (git and the hosting service), the secret scan, `npm run save`, and a `save_app` tool when the app
has a tool registry. It never reads, stores or asks for a token: git and gh use your own credential helpers.

## digest

`digestFolder(dir)`: the one definition of a folder's content digest, shared by extension staging and the lock.
