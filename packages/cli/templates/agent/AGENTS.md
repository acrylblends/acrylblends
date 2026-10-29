
## This app (agent)

Besides `src/routes.ts`, the app runs an agent (`POST /ask`) that can write plugins into `plugins/` while the app runs and install them with
rollback; `GET /extensions` and `GET /tasks` show what it did. A plugin there is a folder with an `index.ts` exporting `name`, `inject`, `apply(ctx)`
and an optional `check(ctx)` that receives the plugin's own context (so `ctx.router` reads as in `apply`). It may import `acryl-router`.

**Write an extension, not a row.** A feature you build while the app runs is a folder `plugins/<name>/` installed with `.acryl/bin/acryl plugin add plugins/<name>` (the `extensions` plugin loads it again at every start). Add a row to `blend.yaml` and an entry to the `registry` of `src/app.ts` only when the person asks for a plugin that is part of the app itself. Both kinds may import the framework by name (`acrylblends`, `acrylblends/body-limit`, `acryl-router`); a row's relative imports of its sibling plugins also work.

**Production.** The agent, the builder and the extensions are development tools: `POST /ask` spends the model key and runs tools, a plugin installed live runs in this process, and none of it is behind a login. With `NODE_ENV=production` `src/app.ts` leaves those three rows out, so `/ask`, `/extensions*` and `/tasks*` are not mounted; the page and `GET /health` stay. `ACRYL_PRODUCTION_KEEP=agent,builder,extensions` keeps the named rows, and each one kept prints a `WARNING` line at start.
