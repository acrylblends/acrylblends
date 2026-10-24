
## This app (agent)

Besides `src/routes.ts`, the app runs an agent (`POST /ask`) that can write plugins into `extensions/` while the app runs and install them with
rollback; `GET /extensions` and `GET /tasks` show what it did. A plugin there is a folder with an `index.ts` exporting `name`, `inject`, `apply(ctx)`
and an optional `check(ctx)` that receives the plugin's own context (so `ctx.router` reads as in `apply`). It may import `acryl-router`.
