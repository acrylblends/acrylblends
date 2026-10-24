# ACRYLBLENDS documentation

ACRYLBLENDS is the public ACRYL framework: apps built from [Cordis](https://www.npmjs.com/package/@deepseek-ai/cordis) plugins, with ACRYL's router,
shared state and inspector (all Cordis plugins), and a library of plugins extracted from ACRYL (instance, settings, live
extensions, an agent that extends the app it runs in, tasks, the app manifest, save). `acrylblends init` copies what you pick into your app. You own
every copied line; there is no ACRYLBLENDS runtime to import.

## Start here

| I want to | Read |
| --- | --- |
| Run something in five minutes | [Getting started](getting-started.md) |
| Understand why it is built this way | [Concepts](framework/concepts.md), [Plugin lifecycle](framework/plugin-lifecycle.md) |
| Look up a call | [Routing](framework/routing.md), [Context](framework/context.md), [Request](framework/request.md) |
| Copy a pattern | [Getting started with the framework](framework/getting-started.md), [Validation](framework/validation.md), [Helpers](framework/helpers.md), [Serving over HTTP](framework/node-server.md) |
| See what ships in the box | [Middleware](framework/middleware.md) |
| Move an app from 0.3 | [Migration from 0.3](framework/migration-from-0-3.md) |
| Let an agent extend my running app | [Extending a running app](agent/extending-apps.md) |
| Describe my app as data | [The app manifest](blends/manifest.md) |
| See every plugin in the library | [The plugin library](plugins.md) |
| Build with Cordis itself | [Building with Cordis](cordis.md) |

## The framework docs (generated)

[framework/README.md](framework/README.md) is ACRYL's own text for the router, state and inspector, copied here as it is. Do not edit it in this repository: change
it in ACRYL and run `scripts/sync-framework.mjs`. `pnpm run verify:framework` fails when a page differs from the digest recorded in
`framework/upstream.json`. In a generated app the framework plugins live in `src/plugins/<name>/src/`, so an import written `from 'acryl-router'` in those pages
reads `from './plugins/acryl-router/src/index.ts'` there.

## Our own pages

- [Getting started](getting-started.md) - create an app, run it, add plugins, lock it, save it
- [The plugin library](plugins.md) - every plugin: what it does, its service, its config, where it came from
- [Extending a running app](agent/extending-apps.md) - extensions, the builder, durable tasks; how an agent writes a plugin
- [The app manifest](blends/manifest.md) - `blend.yaml`: the app as data, parameters, diagnostics, the lock
- [Building with Cordis](cordis.md) - plugins, services, `inject`, effects, events, a scope per task
- [Release notes 0.4.1](release-notes/0.4.1.md) - the framework docs and an AGENTS.md inside every generated app
- [Release notes 0.4.0](release-notes/0.4.0.md) - the App and `ctx.router.route` migration
- [Release notes 0.3.0](release-notes/0.3.0.md) - what is breaking and how to migrate three lines of a route
