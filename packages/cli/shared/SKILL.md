---
name: app-guide
description: How to change, run and check the __APP_NAME__ app. Use it before adding a feature, a route, a plugin or a dependency to this app, and before saying the work is done.
---

# Working in __APP_NAME__

1. **Read first.** `AGENTS.md` in this folder says how the app is laid out. The framework's API is in `docs/framework/`: start at `docs/framework/README.md`, and
   `docs/framework/api/summary.md` is the one-page summary. Parts the docs mark "not yet available" are not in this app.
2. **Make the change small.** Your own routes are a plugin (`src/routes.ts`) that builds an `Acryl` app and mounts it; test a route with `await app.request('/path')`.
3. **One plugin folder.** A plugin lives in `plugins/<name>/` (`npx acrylblends add <name>` copies a library plugin there). There is no `src/plugins/` and no `extensions/`.
4. **Defaults are swappable.** The database, the key-value store, the server and the window are plugins behind ports. The table "Defaults you can swap" in `AGENTS.md` names each default and where it is swapped. Never reach around a port to a driver: `npx acrylblends check-deps` fails the check.
5. **Look at the running app.** The door is `.acryl/bin/acryl` in this folder, if it exists; its state is under `.acryl/`, which git ignores. Without it, run the app with its scripts.
6. **Done means checked.** `npm test` passes, and the change shows in the running app after a restart. No secret goes in a file or in `git status`: keys come from environment variables.
