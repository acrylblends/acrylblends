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
| Move from 0.4 or 0.3 | [Migration from 0.4](framework/cordis/migration-from-0-4.md), [Migration from 0.3](framework/cordis/migration-from-0-3.md) |
| Create a Blend app and run it | [Getting started](getting-started.md) |
| Let an agent extend my running app | [Extending a running app](agent/extending-apps.md) |
| Describe my app as data | [The app manifest](blends/manifest.md) |
| See every plugin in the library | [The plugin library](plugins.md) |
| Build with Cordis itself | [Building with Cordis](cordis.md) |

## The framework docs (generated)

[framework/README.md](framework/README.md) is ACRYL's own text, copied here as it is. Do not edit it in this repository: change it in ACRYL and run `scripts/sync-framework.mjs`.
`pnpm run verify:framework` fails when a page differs from the digest recorded in `framework/upstream.json`. The pages write `import { Acryl } from 'acrylblends'`; in a
generated Blend app the same names are the vendored plugin source in `src/plugins/acryl-router/src/` (see the app's `AGENTS.md`).

## Our own pages

- [Getting started](getting-started.md) - create an app, run it, add plugins, lock it, save it
- [The desktop shell](desktop.md) - `--desktop`, `npm run desktop`: an Electron window on the app's own server
- [The plugin library](plugins.md) - every plugin: what it does, its service, its config, where it came from
- [Extending a running app](agent/extending-apps.md) - extensions, the builder, durable tasks; how an agent writes a plugin
- [The app manifest](blends/manifest.md) - `blend.yaml`: the app as data, parameters, diagnostics, the lock
- [Building with Cordis](cordis.md) - plugins, services, `inject`, effects, events, a scope per task
- [Release notes 0.6.2](release-notes/0.6.2.md) - presets, dev, mount, cache and proxy
- [Release notes 0.6.1](release-notes/0.6.1.md) - add desktop for a plain Acryl app, the create version stamp
- [Release notes 0.6.0](release-notes/0.6.0.md) - the desktop shell
- [Release notes 0.5.1](release-notes/0.5.1.md) - the npm page: a README in the package
- [Release notes 0.5.0](release-notes/0.5.0.md) - the framework is the package root, `create-acrylblends`, and the new docs
- [Release notes 0.4.1](release-notes/0.4.1.md) - the framework docs and an AGENTS.md inside every generated app
- [Release notes 0.4.0](release-notes/0.4.0.md) - the App and `ctx.router.route` migration
- [Release notes 0.3.0](release-notes/0.3.0.md) - what is breaking and how to migrate three lines of a route
