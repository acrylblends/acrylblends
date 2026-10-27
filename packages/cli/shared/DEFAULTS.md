
## Defaults you can swap

The framework is not rigid. Every choice is a plugin behind a port, and what the app starts with is only a fallback. Name the default before you change it,
and swap it at the one place that mounts it.

| Choice | Default | To swap it |
| --- | --- | --- |
| Records | none until you add one: `npx acrylblends add db` mounts the `db` port on SQLite | mount another provider of `db` in `src/app.ts`; plugins use `ctx.db` and do not change |
| Small state | none until you add one: `npx acrylblends add kv` mounts the `kv` port on one JSON file | mount `acryl-kv-db` (the same port over `db`) or a provider of your own |
| Server | Node (`acryl-node-server`) | mount the adapter of another runtime in `src/app.ts` |
| Window | the browser | `npx acrylblends add desktop` adds an Electron window on the same server |

- **An outside tool** (a database server, a bundler, a router such as Vike) joins the app as a provider: a plugin in `plugins/<name>/` that implements a port and
  passes that port's conformance tests, then `src/app.ts` mounts it. Postgres is such a provider and is not part of this package; add it when the app needs it.
- **The dependency rule:** only the file that mounts a provider imports it; everything else takes the port as an argument or injects it. `npx acrylblends check-deps` enforces it.

## Plugins

There is one plugin folder: `plugins/` at the root of the app. A plugin is a folder `plugins/<name>/` with an `index.ts`. `npx acrylblends add <name>` copies a library
plugin there; a plugin you or an agent write goes there too (the `extensions` plugin installs it into the running app, and `plugins/library.json` lists the copies it must not
install a second time). Do not create `src/plugins/` or `extensions/`.

## The door

The door is a command in this folder, `.acryl/bin/acryl`, that lets you look at and change the running app; its state lives under `.acryl/`, which git ignores. If
`.acryl/bin/acryl` is not here, this app has no door yet: run it with its scripts and check it with `npm test`.
