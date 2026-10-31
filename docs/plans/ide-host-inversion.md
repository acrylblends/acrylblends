# Host inversion: the app boots on our framework, DSH rides as rows

Status: design note for slice 107 (`107-host-inversion`), written before the code. Owner decision (2026-10-31): the app is hosted by our own framework, not `dsh --profile`; DSH is one driver (its chat, its session host, its conversation UI). The frame packages publish as `@acrylblends/*` (DS_Fork3 owns the pipeline).

## 1. The composition

The generated app's `dev` starts a launcher of ours, not the `dsh` bin. The launcher owns the Cordis `Context`, the layer order and the app's own rows; every DSH package it needs is a dependency mounted as a row of that composition, exactly as the frame's packages already are.

Layers, in order, each one a patch list over the previous:

1. **DSH base** — the rows of `@deepseek-ai/dsh-base`'s bundle patch files (`package.json` -> `dsh.bundle.patch`): the LLM, session, agent, tools, storage and settings rows.
2. **DSH web** — the rows of `@deepseek-ai/dsh-web-app`'s bundle patch files: the web server, the web runtime that serves the page and the client modules, the client-module rows (chat, conversation UI, settings screens, sidebar), the session controller, the workspace/files/terminal controllers, and the rest of the web surface DSH ships.
3. **The frame** — the app's own `cordis.patch.yml`, the same rows the slice 6 overlay generates today: `app-instance`, the door when the app carries it, `app-routes` (the app's routes at `/app`), `acryl-router`, `acryl-router-http`, and the `@acrylblends/*` frame packages; the switches (DSH's `ui-layout` off, `ui-sidebar`/`ui-conversation` on, the first-run dialog off) and the config (workspace directory under the app's home).
4. **The app's own rows** — what `blend.yaml` mounts for the app on its own server stays for production; in the frame host the same routes are the `app-routes` row of layer 3, so there is one copy of the app's pages, not two.

The launcher mounts the composed entries with Cordis's own loader (`@deepseek-ai/cordis-plugin-loader`) and applies patch lists with the entry-patch helper DSH already exports from `@deepseek-ai/dsh-app-boot` (insert/target/config replacement, the same semantics the profile layer has today). It does not use DSH's launcher, its profile directory, or `dsh plugin add`: the app's `node_modules` is the only package store, `npm install` is the only install step, and there is no `DSH_HOME/profiles/<name>` to create.

**Services the launcher provides itself.** `profileContext` with `name: 'web'` (the DSH rows test it: desktop-only rows stay off, the web rows stay on), and the app instance (`appInstance`: root, home, dshHome) as `app/runtime.mjs` already does. `process.env.DSH_HOME` is set to the instance's home before DSH's rows are imported, so DSH's storage, settings, logs and sessions live inside the app's own data home, not in a user-wide one. `web-startup` is configured by layer 3 with the host and the port: `ACRYLBLENDS_PORT` (0: any free port), DSH's 3080 otherwise.

**What the page gets.** DSH's web runtime serves DSH's page with the ACRYL frame mounted in it through the client-module mechanism the frame already uses (`window.__ModuleLoader__.load`, the client bundles of the `@acrylblends/*` rows). The client contract is not ported: it is DSH's, served by DSH's web runtime; our client packages are its plugins.

## 2. Which DSH rows, and what must be ported

All rows of layers 1 and 2 are mounted: the same composition `dsh --profile web` mounts today (dump it with `dsh --profile web --dump-config`). That includes the session host, the conversation UI, the chat's model/credentials rows, the client-module serving and every UI row the frame's tabs sit beside. The desktop-only rows stay disabled exactly as today, through `profileContext.name === 'web'`.

**Nothing is ported.** Every DSH capability the frame uses is a Cordis row that the two bundle packages already declare and that DSH's own page loads; there is no package that has to be rewritten to become a row. The one DSH code we call rather than mount is the entry-patch helper (`applyEntryPatches`) and the generic Cordis loader, both library calls inside our launcher, not a DSH launcher or profile. If the implementation finds a row that cannot mount outside the profile (a hard-coded profile path, a CLI-parsed flag with no service seam), that row is the exception to record here with its reason; the client contract itself is not a candidate.

## 3. What the generated app contains, and what `dev` runs

- `package.json`: `@deepseek-ai/dsh-base` and `@deepseek-ai/dsh-web-app` pinned exactly (as one meta-dependency would be), the `@acrylblends/*` frame packages, the framework and DSH's Cordis/loader libraries; no profile script.
- `scripts/ide-host.mjs`: the launcher: reads the app's `cordis.patch.yml` and the two DSH bundles' patch files, composes the entries, mounts them, forwards stop signals, sets the home and port.
- `npm run dev`: `node --import ./plugins/acryl-node-server/src/register.ts scripts/ide-host.mjs` (the app's JSX register, because the app's `.tsx` pages compile in the host's process too).
- `npm start` and production do not change: the app's own framework server (`src/main.ts`, the manifest rows), no frame, no door, no DSH.
- The scaffolder (`acrylblends init`) writes the same files for every template with a frame row, and the upgrade path writes them into an existing app; both stop generating a DSH profile and stop calling `dsh plugin add` (`scripts/ide-profile.mjs` is replaced by `scripts/ide-host.mjs`; generation stays idempotent). The `ACRYLBLENDS_FRAME_PACKAGES` bridge for unpublished frame specs stays until the `@acrylblends/*` packages are on npm.

## 4. The boot gate

`scripts/verify-ide-template.mjs <template>` keeps its shape (scaffold through the CLI, install, boot, real Chrome, free port) and its current assertions:

- every row of the composed host active, none pending or failed (the launcher reports the same row status the loader gives; the gate parses it);
- the page renders the ACRYL frame; the left panel shows Projects/sessions; the chat tab is in the tab strip; the right panel offers Files/Changes/Review; Settings has General, Models, Plugins, Support and Shortcuts; the command palette opens; a terminal tab answers in a PTY;
- the app answers at `/app` with its own body and its page is shown in the workspace browser tile;
- the door script rides the page once and a door call answers;
- chat with a local Anthropic-Messages mock (the slice 3 gate's model), so the frame's chat is proven without a real provider.

What changes: the gate no longer waits for `dsh`'s profile output or its `did not activate` lines; it reads the launcher's status, and it no longer creates a DSH profile. The port is always `ACRYLBLENDS_PORT=0`.

## 5. What is kept from `106-ide-slice6-boot`

Kept: the `/app` prefix and the single-prefix rule per template, the frame row shape (router + routerHttp claim + route), the tile decision (ACRYL's canvas browser tile, not DSH's right-sidebar browser), the door in each template, the boot gate and its surface assertions, the app's page check, the fixed spawn-dirs timing bound, and the docs decisions.

Dropped (replaced by the inversion): the DSH profile generator (`scripts/ide-profile.mjs`, `dsh plugin --profile add`, the profile package.json), the `dsh --profile` dev command and its profile arguments, and the DSH-profile row status parsing in the gate. The `106-ide-slice6-boot` branch is pushed as `d615176b` for reference; the backup can drop that branch once this branch carries the same gate.

## 6. Risks

- **DSH's home services.** A row may read `DSH_HOME` or a home path before our launcher sets it; the launcher sets it first (the app instance is chosen before any DSH row is imported), and the gate proves no file outside the app's home is written.
- **Loader resolution.** Rows name packages; the loader must resolve them from the app's own `node_modules`. The launcher runs with the app root as the loader base; the gate's boot is the proof.
- **Patch semantics drift.** `applyEntryPatches` is DSH's; a DSH bump that changes it is the same decision as the existing DSH pin bump.
- **Client HMR.** DSH's `client-hmr` row runs in the web layer; if it assumes a DSH profile, the gate sees it as a failed row and we record the exception.
- **Electron.** The same launcher is what the Electron shell will load later; nothing in this slice builds the window.
