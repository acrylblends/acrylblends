# What runs in production

`acrylblends` has two kinds of parts: the ones an app is built from, which run in production, and the development tools that let an agent (or you) work on the running app, which do not. This page says which is which, and exactly what the safety checks around live plugin install do and do not promise. A test (`plugins/driver-pty/test/production.test.ts`) mounts every development tool in one app and checks the table below.

## The table

| Part | In development | With `NODE_ENV=production` |
| --- | --- | --- |
| Your routes and plugins, the router, the server, state, the `db` and `kv` ports and their providers | run | run |
| **The door** (`acryl-door`: `.acryl/bin/acryl`, the page script, the operator routes) | **experimental**: starts when the server is up | starts nothing: no service, no route, no `.acryl/` folder, no script in the page. `ACRYL_DOOR=off` also turns it off. A host that means to run it in production sets `allowInProduction: true` in the plugin's config |
| **The agent panel** (`agent-panel`) | **experimental**: a script tag on every HTML page and `/api/agent-panel/*` | does nothing (no tag, no routes). `ACRYL_DOOR=off` too |
| **The PTY driver** (`driver-pty`) | **experimental**: terminal drivers in the panel, `/api/driver-pty/*` | does nothing. `ACRYL_DOOR=off` too |
| **Live plugin install** (`extensions`, `builder`) | **experimental**: install, update, remove and reload plugins while the app runs | the `nodejs`, `notes` and `chat` templates leave the `extensions` row out; the `agent` template does not (see below) |
| `acrylblends/bun` | **experimental**: one smoke gate runs it on Bun | the same |

Experimental means: it works and is gated, its interface may still change in a minor version, and it is not for the public internet. The door and the panel are loopback and own-page only, with a per-run secret and an audit log; that is a convenience fence for a developer's machine, not an authentication system.

## The `agent` template is a development app

The `agent` template mounts an agent behind `POST /ask` that can write plugins into the running app (`builder`) and install them (`extensions`). Only its door is left out in production. Do not deploy it as it is: remove the `agent`, `builder` and `extensions` rows from `blend.yaml` (or start from `blank`, `nodejs`, `notes`, `chat` or `todo`), and if live install is wanted anywhere shared, set `approval: true` so an install waits for `POST /extensions/approve`.

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
2. Start from a template that is not `agent`, or remove the agent rows.
3. Do not set `allowInProduction` on the door unless the host is a single-user desktop app.
4. Keep `ACRYL_DOOR=off` in any environment where an agent should not be able to see the page.
