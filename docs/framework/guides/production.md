# What runs in production

`acrylblends` has two kinds of parts: the ones an app is built from, which run in production, and the development tools that let an agent (or you) work on the running app, which do not. This page says which is which, and exactly what the safety checks around live plugin install do and do not promise. A test (`plugins/driver-pty/test/production.test.ts`) mounts every development tool in one app and checks the table below.

## The table

| Part | In development | With `NODE_ENV=production` |
| --- | --- | --- |
| Your routes and plugins, the router, the server, state, the `db` and `kv` ports and their providers | run | run |
| **The door** (`acryl-door`: `.acryl/bin/acryl`, the page script, the operator routes) | **experimental**: starts when the server is up | starts nothing: no service, no route, no `.acryl/` folder, no script in the page. `ACRYL_DOOR=off` also turns it off. A host that means to run it in production sets `allowInProduction: true` in the plugin's config |
| **The agent panel** (`agent-panel`) | **experimental**: a script tag on every HTML page and `/api/agent-panel/*` | does nothing (no tag, no routes). `ACRYL_DOOR=off` too |
| **The PTY driver** (`driver-pty`) | **experimental**: terminal drivers in the panel, `/api/driver-pty/*` | does nothing. `ACRYL_DOOR=off` too |
| **Live plugin install and the agent** (`extensions`, `builder`, `agent`: `POST /ask`) | **experimental**: install, update, remove and reload plugins while the app runs; the agent builds them | left out: the `nodejs`, `notes` and `chat` templates drop the `extensions` row, and the `agent` template drops `agent`, `builder` and `extensions` (since 1.0.1) unless `ACRYL_PRODUCTION_KEEP` names them |
| `acrylblends/bun` | **experimental**: one smoke gate runs it on Bun | the same |

Experimental means: it works and is gated, its interface may still change in a minor version, and it is not for the public internet. The door and the panel are loopback and own-page only, with a per-run secret and an audit log; that is a convenience fence for a developer's machine, not an authentication system.

## The `agent` template in production

The `agent` template mounts an agent behind `POST /ask` that spends the model key and can write plugins into the running app (`builder`) and install them (`extensions`, with `POST /extensions/approve` deciding installs). **None of that is behind a login.** Since 1.0.1, with `NODE_ENV=production` the template leaves the `agent`, `builder` and `extensions` rows out, along with the door: `/ask`, `/extensions*` and `/tasks*` are not mounted, and the page and `GET /health` stay. 1.0.0 left them mounted.

- To keep a row anyway, name it: `ACRYL_PRODUCTION_KEEP=agent,builder,extensions` (a comma list). Each row kept prints a `WARNING` line at start saying what it gives a visitor. Put your own login in front before you do.
- **An app made by 1.0.0 keeps its own `src/app.ts` and `src/routes.ts`**, which `acrylblends upgrade` never touches (they are your files). Until you change them: deploy with the `agent`, `builder` and `extensions` rows set to `disabled: true` in `blend.yaml`, or start from another template, or copy the new `src/app.ts` and `src/routes.ts` of a fresh `acrylblends init my-app --template agent` over yours.

## What live plugin install does and does not promise

Installing a plugin (`ctx.extensions.install`, the door's `plugin add`, the builder's `install_plugin`) is a **correctness check, not a security boundary**:

- It stages a content-hashed copy, imports it, mounts it, and reports the real state (`active`, `pending` with what it waits for, or `failed` with the error). If an update fails to start, the previous version is mounted again. A ledger line records every change.
- **The plugin's code runs inside the app's own process with the app's permissions**: it can read the app's files and environment, open sockets and start processes. Nothing in the install check stops that.
- At start-up the app reinstalls what was installed, and installs a new folder only from a source trusted to `install` (the app's own `plugins/` is). Code that arrived through a `git pull` into an untrusted source is listed, not run.
- `approval: true` holds an install until someone posts to `/extensions/approve`: it decides *whether* a plugin installs, not what an installed plugin can do.

## What the sandbox does and does not stop

`ctx.sandbox` runs code you do not trust, such as a **tool** an agent just wrote, in a separate Node process with the permission model on (`node --permission`):

- It **stops**: reading any file outside the tool's own folder; writing files; starting child processes or workers; loading native addons; using the inspector. It gets an empty environment (no keys, no paths). It is killed after a time limit and capped in memory and output size. Calls are independent: nothing survives into the next one.
- It **does not stop**: network access (Node 24 has no network permission: restrict egress outside the process where that matters), and it does not apply to plugins installed live (those are not run in the sandbox).

## Checklist for a deployment

1. `NODE_ENV=production` (the process manager or the Dockerfile sets it; the templates' Dockerfile does).
2. With the `agent` template, leave `ACRYL_PRODUCTION_KEEP` unset (1.0.1 and later), or remove the agent rows.
3. Do not set `allowInProduction` on the door unless the host is a single-user desktop app.
4. Keep `ACRYL_DOOR=off` in any environment where an agent should not be able to see the page.
