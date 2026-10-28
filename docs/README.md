# ACRYLBLENDS documentation

ACRYLBLENDS is the public ACRYL framework, in two parts.

- **The framework** is `import { Acryl } from 'acrylblends'`: a small web framework on Web Standards that runs on Node.js (Bun experimental), with each middleware and helper at its own
  subpath (`acrylblends/cors`, `acrylblends/node-server`). Start a project with `npm create acrylblends@latest`.
- **Blends** are apps built from [Cordis](https://www.npmjs.com/package/@deepseek-ai/cordis) plugins: ACRYL's router, shared state and inspector, and a library of plugins extracted from ACRYL
  (instance, settings, live extensions, an agent that extends the app it runs in, tasks, the app manifest, save). `acrylblends init` copies what you pick into your app. You own
  every copied line.

## Start here

| I want to | Read |
| --- | --- |
| Use the framework: handlers, routing, middleware | [Framework documentation](framework/README.md), [Getting started](framework/getting-started/basic.md) |
| Look up a call | [API summary](framework/api/summary.md), [Routing](framework/api/routing.md), [Context](framework/api/context.md), [Request](framework/api/request.md) |
| Use the framework inside a Cordis app | [Acryl in a Cordis app](framework/cordis/acryl-in-a-cordis-app.md), [Mounting](framework/cordis/mounting.md), [Plugin lifecycle](framework/cordis/plugin-lifecycle.md) |
| Move to 1.0 | [Migration to 1.0](framework/cordis/migration-to-1-0.md) |
| Move from 0.4 or 0.3 | [Migration from 0.4](framework/cordis/migration-from-0-4.md), [Migration from 0.3](framework/cordis/migration-from-0-3.md) |
| Create a Blend app and run it | [Getting started](getting-started.md) |
| Let an agent extend my running app | [Extending a running app](agent/extending-apps.md) |
| Describe my app as data | [The app manifest](blends/manifest.md) |
| See every plugin in the library | [The plugin library](plugins.md) |
| Build with Cordis itself | [Building with Cordis](cordis.md) |

## The framework docs (generated)

[framework/README.md](framework/README.md) is the framework's own text, kept in this repository and shipped inside every new app.
`pnpm run verify:framework` fails when the exports map of the package is out of date. The pages write `import { Acryl } from 'acrylblends'`; in a
generated Blend app the same names are the vendored plugin source in `plugins/acryl-router/src/` (see the app's `AGENTS.md`).

## Our own pages

- [Getting started](getting-started.md) - create an app, run it, add plugins, lock it, save it
- [The desktop shell](desktop.md) - `--desktop`, `npm run desktop`: an Electron window on the app's own server
- [The plugin library](plugins.md) - every plugin: what it does, its service, its config, where it came from
- [Releasing](releasing.md) - the steps of a release and the rule that its gates run the installed package
- [The PTY driver (plan)](plans/pty-driver.md) - M8: a coding agent in a real terminal inside the app folder, acting through the door
- [The PTY driver with real agents](plans/pty-driver-evidence.md) - M8 evidence: claude, codex and pi each build a feature in the terminal tab
- [The 1.0 docs claim audit](plans/docs-1-0-claim-audit.md) - every claim on the framework docs and the sites checked against the code; what was fixed
- [Real-agent runs against 1.0.0-rc.1](plans/release-evidence-1-0.md) - M10 evidence: codex and pi on the agent, notes and chat starters, claude once
- [The site patches](plans/site-patches/README.md) - patches for the hand-written pages of acrylblends.github.io (`git am`)
- [WebSocket upgrades on the router (plan)](plans/router-websocket.md) - spec 047 T009: upgrade routes owned by the mounting plugin
- [After 1.0: tickets](plans/framework-1-1-tickets.md) - 1.0.1 security fix, the 1.1 items with priority and order, what is parked
- [Framework 1.0 readiness](plans/framework-1-0-readiness.md) - audit: the API surface to freeze, the missing upgrade path, what is experimental; each item must-fix or later
- [Workshop readiness](plans/workshop-readiness.md) - the newcomer path walked on 1.0.0 (macOS): the step table, the frictions ranked, and a 90-minute outline
- [The workshop handout](workshop/README.md) - 90 minutes, one app in a browser and a window, an agent that edits it, the registry both ways
- [Facilitator notes](workshop/facilitator.md) - what to put on each machine, the timings, what breaks in the room, the no-network fallback
- [Extending a running app](agent/extending-apps.md) - extensions, the builder, durable tasks; how an agent writes a plugin
- [The app manifest](blends/manifest.md) - `blend.yaml`: the app as data, parameters, diagnostics, the lock
- [Building with Cordis](cordis.md) - plugins, services, `inject`, effects, events, a scope per task
- [Release notes 0.9.1](release-notes/0.9.1.md) - a fix: apps made by the installed command line start again
- [Release notes 0.9.2](release-notes/0.9.2.md) - Stop cancels the app's own agent, a secrets scan in check
- [Release notes 0.10.0](release-notes/0.10.0.md) - driver-pty: a coding agent in a real terminal in the app, the panel's drivers as a registry
- [Release notes 1.0.2](release-notes/1.0.2.md) - the chat template closed in production, create-acrylblends --from, the newcomer-path fixes
- [Release notes 1.0.1](release-notes/1.0.1.md) - a security fix for the agent template in production
- [Release notes 1.0.0](release-notes/1.0.0.md) - the 1.0 surface, acrylblends upgrade, what runs in production
- [Release notes 0.11.0](release-notes/0.11.0.md) - WebSocket upgrades on the router, brief prints the address
- [Release notes 0.9.0](release-notes/0.9.0.md) - the framework's home: the Cordis forms as subpaths, one `Acryl`, the source and its history here
- [Release notes 0.8.1](release-notes/0.8.1.md) - the door's plugin verbs work in every web template
- [Release notes 0.8.0](release-notes/0.8.0.md) - every template a Cordis app, the door (`.acryl/bin/acryl`), `clientModules` inside a sub-app
- [Release notes 0.7.8](release-notes/0.7.8.md) - one `plugins/` folder, `AGENTS.md` and `CLAUDE.md` with the app-guide skill, `acrylblends/read-sse`
- [Release notes 0.7.7](release-notes/0.7.7.md) - `kv`: JSON documents for tiny apps; `acrylblends kv import`
- [Release notes 0.7.6](release-notes/0.7.6.md) - `acrylblends check-deps`: app code takes the db port, one file opens the database
- [Release notes 0.7.5](release-notes/0.7.5.md) - the `db` port and numbered migrations; the notes and chat templates use them
- [Release notes 0.7.4](release-notes/0.7.4.md) - hosting adapters (AWS Lambda, Cloudflare, Vercel, Netlify, Bun...), templates from a repository
- [Release notes 0.7.3](release-notes/0.7.3.md) - the chat template, streaming docs
- [Release notes 0.7.2](release-notes/0.7.2.md) - client components without a bundler, serve() on 127.0.0.1, the notes template, production-ready starters
- [Release notes 0.7.1](release-notes/0.7.1.md) - Electron 44.9.3, no shell warning on Windows, forms and sessions guide
- [Release notes 0.7.0](release-notes/0.7.0.md) - .tsx pages on Node.js with no build step
- [Release notes 0.6.4](release-notes/0.6.4.md) - the rename completed, a smaller package, JSX in apps
- [Release notes 0.6.3](release-notes/0.6.3.md) - jsx and css, the stricter save, the desktop page
- [Release notes 0.6.2](release-notes/0.6.2.md) - presets, dev, mount, cache and proxy
- [Release notes 0.6.1](release-notes/0.6.1.md) - add desktop for a plain Acryl app, the create version stamp
- [Release notes 0.6.0](release-notes/0.6.0.md) - the desktop shell
- [Release notes 0.5.1](release-notes/0.5.1.md) - the npm page: a README in the package
- [Release notes 0.5.0](release-notes/0.5.0.md) - the framework is the package root, `create-acrylblends`, and the new docs
- [Release notes 0.4.1](release-notes/0.4.1.md) - the framework docs and an AGENTS.md inside every generated app
- [Release notes 0.4.0](release-notes/0.4.0.md) - the App and `ctx.router.route` migration
- [Release notes 0.3.0](release-notes/0.3.0.md) - what is breaking and how to migrate three lines of a route
