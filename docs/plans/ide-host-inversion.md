# Host inversion: our framework hosts the app; DSH is the chat/session driver

Status: design note for slice 107 (`107-host-inversion`), revised after review. Owner direction (2026-10-31): the app is hosted by our own framework, not by `dsh --profile`; DSH is one driver (its chat, its session host); the frame packages publish as the `@acrylblends` scope packages (DS_Fork3 owns the pipeline).

What changed from the first draft: DSH's web server, web runtime, page and client boot are **not mounted**. Our node-server and router serve the document and the client modules; the document is the ACRYL frame's own layout; DSH contributes only the chat/session driver rows and the client packages the frame imports as libraries.

## 1. Our HTTP host

- `acryl-node-server` (ours) listens on the port and serves the router and the client modules; there is no DSH `webServer` or `web-startup` row.
- The page is one document written and served by us (`clientModules`): the frame's client entry (the `acryl-app-shell` layout, which renders the left panel, main surface and right panel) is the root bundle. No DSH page, no DSH slots switched off: the frame's slots are the page's slots.
- The app's own routes are mounted at `/app` on our router (the slice 6 prefix rule), served by our server; the door's page script rides the same document through our client-module serving (the slice 1/6 adaptation, now against our server instead of DSH's index-inject).
- For the DSH driver rows that register HTTP endpoints (the remote gateway), our host provides **one compatibility service of our own**, `webServer`, with the slice of DSH's web-server interface they use (`register` prefix/exact, `registerUpgrade`, index tap if a row needs it), backed by our node-server. It is our adapter (estimate: 150-250 lines, tested like `routerHttp`), not DSH code; a row that needs more of the interface is listed with the extra surface and either served or excluded with a reason. This avoids mounting DSH's web server while keeping the driver rows unchanged.

## 2. Our client runtime

- The page loads our client-module loader (DSH's `@deepseek-ai/dsh-client-modules` as an npm **library**, served by our server; ~1,900 lines) and the client graph of the frame: `acryl-app-shell`, `acryl-workspace`, and the DSH client packages the frame imports (table below).
- DSH's client packages are served by **our** client-module serving, from `node_modules`, through their `dsh.client` entries; our loader resolves their bare imports. They are libraries, not rows of DSH's web runtime.
- The chat tab mounts the conversation UI client module (DSH's `dsh-client-ui-conversation`, ~18,500 lib lines) as a library in the chat tile; it talks to the driver through the remote client packages (also libraries) over our host's gateway endpoint. The frame's chat tile already receives `renderConversation` today; under our page it receives the same component from the served module.
- The client-side services the frame's client packages inject (`slots`, `locale`, `sidebarRight`, `sidebarRightTabs`, `shortcuts`, `layout`, `renderer`, ...) come from those client libraries, bootstrapped by the page's client entry. No DSH client runtime row or DSH client boot is mounted.

## 3. The client contract, per package

Line counts are the package's shipped `lib` JavaScript (`.js`, no maps) in DSH `0.2.0-rc.2`, as installed in a frame profile; "frame imports" is how many of our `ide/*/src` files name it. Decision means: **library** = DSH npm package served by our server and loaded in our client graph, not ported; **port** = source under the `@acrylblends` scope packages with provenance. No package is ported in this slice unless a row below says so.

| Package | lib lines | frame imports | Used for | Decision |
| --- | ---: | ---: | --- | --- |
| `dsh-client-modules` | 1,898 | 4 | client-module loader and client boot primitives | library, served by our server |
| `dsh-client-store` | 179 | 2 | reactive store the client plugins share | library |
| `dsh-client-ui-slots` | 576 | 23 | slot registry (the frame's link/extension points) | library |
| `dsh-client-ui-renderer` | 1,898 | 13 | client renderer the frame's plugins register into | library |
| `dsh-client-ui-primitives` | (npm package, not in this profile) | 11 | base UI components used by the frame's screens | library |
| `dsh-client-locale` | 1,600 | 9 | localized strings | library |
| `dsh-client-ui-theme` | 1,732 | 8 | theme tokens, light/dark | library |
| `dsh-client-ui-settings` | 1,554 | 8 | Settings shell and sections | library |
| `dsh-client-ui-session` | 504 | 6 | session views shared by chat/tabs | library |
| `dsh-client-ui-layout` | 699 | 4 | layout service the frame's shell uses | library |
| `dsh-client-ui-sidebar` | 541 | 5 | sidebar tab primitives | library |
| `dsh-client-ui-sidebar-right` | 9,244 | 4 | right panel shell (File/Changes/Review mount here) | library |
| `dsh-client-ui-commands` | 1,465 | 2 | command registry for the palette/shortcuts | library |
| `dsh-client-shortcuts` | 2,557 | 5 | shortcut commands and the palette event | library |
| `dsh-client-connection` | 2,352 | 1 | remote connection client | library |
| `dsh-client-ui-settings-models` | 4,126 | 4 | Models settings page (the account card mounts here) | library |
| `dsh-client-ui-settings-account` | 4,619 | 0 | account settings page used by sign-in | library |
| `dsh-client-ui-conversation` | 18,505 | 7 | the DSH chat view in the chat tile | library, served as the chat module |
| `dsh-client-ui-workspace` | 4,435 | 0 | workspace client the conversation UI injects | library |
| `dsh-client-file-upload` | 1,982 | 0 | upload client the conversation UI injects | library |
| `dsh-brand` | 32 | 0 | brand token helpers | library |

If a library turns out to hard-depend on a DSH host row that we do not mount, the row is added to section 4 with its evidence; if a library turns out to need a profile-only mechanism, the note is amended with that package's port plan and provenance before the code. The frame's own client packages (the `@acrylblends` scope packages) keep their existing ports and provenance.

## 4. The DSH driver rows

Only the rows the chat and session need, grouped with why. Each is a standard Cordis row from DSH's npm packages, mounted in our composition after our own rows; "verified injects" are read from the installed `0.2.0-rc.2` package.

| Row (id) | Package | Why | Verified hard injects |
| --- | --- | --- | --- |
| `typert` | `@deepseek-ai/dsh-typert-registry` | the typed remote registry the conversation client calls through | - |
| `typert-loader` | `@deepseek-ai/dsh-typert-loader` | registers the generated remote modules | - |
| `typert-gateway` | `@deepseek-ai/dsh-api-gateway` | the HTTP/remote gateway the page's client connects to; registers on the host (through our `webServer` port) | - |
| `session` | `@deepseek-ai/dsh-session` | the session host: create, read, send turns | - |
| `session-persistence-jsonl` | `@deepseek-ai/dsh-session-persistence-jsonl` | keeps chat sessions across restarts | - |
| `session-query-sqlite` | `@deepseek-ai/dsh-session-query-sqlite` | session list/search the left pane and controller read | - |
| `session-projection` | `@deepseek-ai/dsh-session-projection` | the turn projections the conversation renders | - |
| `session-title` | `@deepseek-ai/dsh-session-title` | titles for chat tabs | - |
| `storage`, `storage-json`, `storage-domain` | DSH storage rows | the durable store the session/settings rows write through | - |
| `agent` | `@deepseek-ai/dsh-agent` | runs a chat turn | - |
| `agent-default-model` | `@deepseek-ai/dsh-agent-default-model` | the model a new session uses | - |
| `llm` | `@deepseek-ai/dsh-llm` | the model service | - |
| `llm-retry` | `@deepseek-ai/dsh-llm-retry` | provider retries | - |
| `llm-deepseek` | `@deepseek-ai/dsh-llm-deepseek-api-key` | the API-key model provider | - |
| `llm-deepseek-account` | `@deepseek-ai/dsh-llm-deepseek-account` | the account model provider (OAuth) | - |
| `deepseek-account` | `@deepseek-ai/dsh-deepseek-account-platform` | the account catalog/OAuth service | - |
| `credentials` | `@deepseek-ai/dsh-credentials-local` | the key store (never in the page/app folder) | - |
| `authorization` | `@deepseek-ai/dsh-authorization` | the authorization service the sign-in host uses | - |
| `settings` | `@deepseek-ai/dsh-settings` | settings the model rows read; needs `configEditor` and `profileContext` (we provide a minimal `profileContext`) | `configEditor`, `profileContext` |
| `config-editor` | `@deepseek-ai/dsh-config-editor` | the settings store backend | - |
| `attachment-local` | `@deepseek-ai/dsh-attachment-local` | attachments the session controller admits | - |
| `file-reference-local` | `@deepseek-ai/dsh-file-reference-local` | file references the session controller resolves | - |
| `session-controller` | `@deepseek-ai/dsh-api-session-controller` | the session remote API the conversation client calls | its row class injects `agents`, `sessionQuery`, `typert`; the service uses `typert`, `fileReferences`, `attachments` |
| `api-remotes` | `@deepseek-ai/dsh-api-remotes` | the remote registry/gateway wiring | `typertGateway` |
| `workspace-controller` | `@deepseek-ai/dsh-api-workspace-controller` | the workspace remote the conversation UI's workspace client injects; our workspace also uses its own files/git services | - |

Excluded with reasons: DSH's web server, web startup, web runtime, client HMR, DSH's UI client rows (not mounted as rows; the client packages are libraries), DSH's terminal/file/diff controllers (our workspace's, ported in slice 2), DSH's plugin manager/support rows (our the `@acrylblends` scope packages packages), the tool rows and their dependencies (the chat answers without tools; the owner's terminal agents are our PTYs), telemetry/product analytics (disabled in the web profile today). If a listed driver row's hard injects pull a row not listed, that row is added here with its evidence in the implementation commit; the gate's active-row list is the proof.

## 5. What our ported packages hard-require from DSH

- `acryl-sign-in` host: DSH's `authorization` and `credentials` services (slice 5; listed above).
- `acryl-workspace`'s connect-model control: DSH's `credentials`, `llm` and `session` remote faces (slice 3; the rows above).
- `acryl-workspace`'s chat tile and session list: the session/agent rows above; its terminals, files, git, board, comments are ours (node-pty host routes), not DSH's controllers.
- Settings screens, shortcuts and the palette are ours (the `@acrylblends` scope packages), mounted on our host.

## 6. What the generated app contains, and what `dev` runs

- `package.json`: our framework, the the `@acrylblends` scope packages frame packages (published names; the `ACRYLBLENDS_FRAME_PACKAGES` bridge until then), DSH's driver packages pinned exactly, and the client libraries the frame imports. No DSH profile, no `dsh plugin add`.
- `scripts/ide-host.mjs`: our launcher: chooses the instance/home/port (`ACRYLBLENDS_PORT`, 0 allowed), composes our rows (the app's frame layer: `app-instance`, door when present, `app-routes` at `/app`, our router/routerHttp, the the `@acrylblends` scope packages rows, the DSH driver rows), provides `profileContext` and the `webServer` compatibility port, mounts the client-module serving and the page, and forwards stop signals.
- `npm run dev`: `node --import ./plugins/acryl-node-server/src/register.ts scripts/ide-host.mjs` (the app's JSX register, as the app's own scripts use). `npm start`/production stays the app's own framework server (no frame, no door, no DSH).
- Scaffolder (`acrylblends init` and `acrylblends upgrade`): write the host script and layer instead of the DSH profile (`scripts/ide-profile.mjs` and the profile directory are removed); generation stays idempotent; blank first.

## 7. The boot gate

`scripts/verify-ide-template.mjs <template>` keeps the slice 6 shape and acceptance: scaffold through the CLI, install, boot, real Chrome on a free port, every row active; the frame renders; (a) left panel Projects/sessions; (b) right panel Files/editor/Changes/Review; (c) Settings General/Models/Plugins/Support/Shortcuts; (d) chat tab; (e) a terminal PTY that answers; (f) the command palette and shortcuts; (g) the door script once and a door call; (h) the app answers at `/app` and its page shows in the workspace browser tile; plus chat with the local Anthropic-Messages mock. What changes: no DSH profile and no `dsh` output to parse; the gate reads our launcher's row status, and the page is ours.

## 8. What is kept from `106-ide-slice6-boot`

Kept: the `/app` prefix and the single-prefix rule, the frame row shape (router + `routerHttp` claim + route), the tile decision (ACRYL's canvas browser tile, not DSH's right-sidebar browser), the door in each template, the boot gate and its surface assertions, the app's page check, the `spawn-dirs` timing bound fix, and the docs decisions. Dropped: the DSH profile generator, the `dsh --profile` dev command and its arguments, and DSH-profile row parsing in the gate. The branch is pushed as `d615176b` for reference; it can be dropped once this branch carries the gate.

## 9. Risks

- **Driver row drift.** A DSH bump may change a row's injects; the gate's active-row list and the pin are the guard.
- **`webServer` port surface.** If a driver row uses more of DSH's web-server interface than the port exposes, that row is either served by a small extension to our port or excluded with a reason in this note.
- **Client library boot.** The client libraries expect DSH's client boot order; our page bootstraps them explicitly; the gate's chat/tile/settings checks are the proof.
- **Settings' `profileContext`.** DSH's settings row hard-injects it; our host provides the minimal compatible object (name `web`, home, directories) and the gate proves settings and models work.
- **Home.** DSH's rows keep their files in the app's own data home (the launcher sets `DSH_HOME` from the app instance before importing any driver row); the gate proves nothing is written to a user-wide home.

## 10. Implementation notes (2026-10-31, after steps 1-2)

Landed on `107-host-inversion`: `bfaeb660` (the raw node route/upgrade seam in `acryl-node-server` and the `acryl-web-server` port with its tests) and `f0c0cfa3` (the generated `scripts/ide-host.mjs`, the driver-row selection, and `scripts/verify-ide-host.mjs`, which boots the composition and checks: 52 rows active, no DSH web row, PENDING on provider removal / active on restore, two reloads clean). The app pins one Cordis (4.0.5, DSH's own) and `cordis-plugin-loader` 1.0.6; the driver rows are selected from `@deepseek-ai/dsh-base` and `@deepseek-ai/dsh-web-app` by id and mounted through the Cordis loader on our node server.

The next step, the page and the client runtime, has these findings:

- `@deepseek-ai/dsh-client-modules` is a Cordis row with a host half that does the client-module work: it scans the loader entries for `dsh.client` declarations, composes `window.__DSH_BOOT__`, serves the client bundles, and contributes its boot scripts to the web server's index-injection table. It hard-injects only `loader` and optionally uses `webServer`, which our port provides. It is the package to mount as the client-module serving on our host (a library row, not DSH's web runtime).
- Its graph invariant fails loudly when a `dsh.client` row advertises a bundle that does not resolve, so the frame's client injects are the complete list of client rows to mount: for the frame packages, `client-locale`, `client-shortcuts`, `ui-settings`, `ui-sidebar-right`, `ui-theme`, `ui-settings-models`, `api-remotes`, `client-connection`, `ui-slots`, `ui-primitives`; for the chat, `client-ui-conversation` and its injects (`api-session-controller`, `client-file-upload`, `ui-layout`, `ui-renderer`, `ui-session`, `ui-workspace`). Nothing else of DSH's client surface is mounted.
- The document itself: our page row serves a minimal index from `@deepseek-ai/dsh-web-frontend`'s `dist/index.html` with the webServer index taps applied (that is where `__DSH_BOOT__` and the registration scripts land) and serves its `assets/` files; the visible layout is the ACRYL frame because the only layout client row mounted is `acryl-app-shell`, which renders in the shell's root slot. The shell (the frontend's built client runtime) is a library served by our server, as the per-package table allows; DSH's web server, web runtime and web-startup rows are still not mounted.
- The page row and the client rows are the next commit; the browser gate then runs (a)-(h) plus the PTY, the chat mock and the door.


## 11. Handoff (2026-10-31, branch 107-host-page)

State: `107-host-page` is pushed; the latest code commit before this note is `2cfe7a93` (the workspace Settings fallback and the page gate). The composition gate (`pnpm run verify:ide-host`) is green: every row active (70 rows), no DSH web row mounted, PENDING on provider removal / active on restore, two reloads clean, the app's tests and typecheck green. The app boots on our host, the page is ours (title ACRYL, `__DSH_BOOT__` through the webServer index rows), the launcher prints the tokenized URL (plain 401, token 303 with the cookie), the ACRYL frame renders, and the chat session is created (the agent-loop row is mounted).

`scripts/verify-ide-template.mjs blank` (run `node --import ./scripts/workspace-source.mjs scripts/verify-ide-template.mjs blank --keep` after `pnpm --filter acrylblends run build`) now passes: scaffolding through the CLI with the frame specs and the second-init refusal, install, the composition check, the tokenized boot, the page with the boot wire and the door script once, `/app` with the app's own body, a door CLI call, `/app/about`, the frame, the left panel with Projects rows, the chat tab, and the right panel with Files/Changes/Review. It stops at Settings:

- The frame's page renders no DSH sidebar, so the workspace's `openSettingsSection` finds no `aria-haspopup="dialog"` Settings trigger. It now falls back to the layout service's `selectPanel('settings')` (`setSettingsPanelOpener` in `ide/acryl-workspace/src/client/settings/open-settings.ts`, registered by the workspace client's `ctx.inject(['layout'])`), but the settings dialog still does not appear: the frame's layout sets `panelInfo`, while the shell's keyed `settings` panel is registered in DSH's root layout store, not in the frame's `DesktopLayoutState`. The next step is to find where DSH's `ui-settings` registers that main panel and wire it to the frame's layout (or provide the registration), then run the gate's remaining checks.

After Settings, the gate's remaining assertions are the command palette (the `acryl:toggle-command-palette` event), a terminal tab over a real PTY, `/app` in the workspace browser tile, and chat with the local Anthropic-Messages mock through the key card (the slice 3 gate's mock and flow).

Other open items: the door's page WebSocket owner is deterministic (services presence; one owner; routerHttp preferred), with tests for node-only, routerHttp after the node server and routerHttp before the door; the provider-removed-and-restored scenario is skipped in `plugins/acryl-door/tests/host/hub-ownership.spec.ts` because the next upgrade is not answered after a re-provide. The door's handshake was verified 101 against the frame host before this test was written.

## 12. Session note (2026-10-31, 107-host-page-settings)

Picked up at the Settings step of the page gate. Findings, in order:

1. **DSH's settings UI is a dialog, not a keyed `main` panel.** `ui-settings-general` registers `SettingsRoot` into the root slot `sidebar.settings` (declared
   by `dsh-client-ui-sidebar`'s contract), and opens it through `shellStore` (its own store), the `settings.trigger` slot's button, or the `settings.open`
   shortcut command. The workspace's fallback `selectPanel('settings')` therefore opens nothing: the frame's keyed `main` slot has no `settings` entry.
2. **The frame did not declare or render `sidebar.settings`.** Tried the obvious fix: declare it in the frame's root children and render it in
   `AdvancedFrame` with `{ wide: !collapsed }`. It typechecks (with `@deepseek-ai/dsh-client-ui-sidebar` as a devDependency for the SlotMap), builds, and
   **breaks the page: the gate then fails earlier with "the ACRYL frame did not render in the page"** (no `.dshWorkspace`), so the change was reverted. The
   attempt is kept as an attachment to this note's session (`/tmp/settings-slot-attempt.patch`, not committed): the next attempt should find why rendering
   that slot crashes the frame (most likely the settings client's strict child entries need the DSH root's other providers, e.g. `locale`/`shortcuts`
   hooks the frame's root does not inject) rather than rendering it blind.
3. **Baseline check after the revert:** with the revert the gate gets past the frame, the left Projects panel and the chat tab, and now fails at "the right
   panel did not open with its views" (`checkTileInBrowser`), a step the handoff recorded as passing at `2cfe7a93`. It may be a flake or a state difference
   from a full rebuild; it needs a rerun on a quiet machine before it is called a regression.

Next: fix the settings opening at the dialog's owner (render the settings dialog inside the frame with the providers its root expects, or have the workspace
run the `settings.open` path through the settings trigger), then the gate's steps after Settings (palette, PTY tab, /app tile, chat mock), then the door's
re-provide scenario.

## 13. The app's own plugin rows in the frame (design note, 2026-10-31)

Found while asserting the agent template's panel inside the `/app` tile: the generated layer mounts only the app's routes row, so an app's own plugins never run
in the frame host. On the agent template that means no agent panel on the page, and no `/ask` either; the blank template is unaffected because it has no plugins
of its own.

### 1. Which rows the host owns, and which the layer owns

The host launcher mounts, in its own layer: `node-server` (the framework's server), `web-server` (the webServer port DSH's driver rows register on), `page` (the
document and the index tap), the client rows, and the DSH driver rows it selects by id. `app-instance` comes from `app/runtime.mjs`. The generator's layer keeps
`app-routes` (`./src/frame.ts`), the frame packages with their rows, the door row when the app carries one, and the disabled/overridden DSH rows it already
writes. So the layer owns: the app's routes row, the app's own plugin rows, the frame packages, and the door. The host owns: the server, the web-server port,
the page, the app instance, and the DSH driver selection. `manifest` and `save` are app plugins but not rows the frame needs (they are CLI-time tools), so they
stay out of the layer.

### 2. How the app's own rows mount

The same entries the app's own server mounts: the app's `blend.yaml` lists `- id: <name>` rows, and each resolves to `./plugins/<name>/index.ts` (the folder the
scaffolder copied). The layer should carry them in `blend.yaml` order, after `app-routes`, skipping the ids the host or the generator already provides
(`instance`, `acryl-router`, `acryl-node-server`, `acryl-web-server`, `acryl-page`, `manifest`, `save`, `acryl-door`). The attempted implementation in
`packages/cli/src/init.ts` did exactly that (reading `blend.yaml`, falling back to the plugin folders, `readdirSync` for the rest) and is reverted, not landed.

### 3. What actually fails, measured

With those rows in the layer, DSH's startup audit reports (text as printed):

```
Failed plugins (6):
  agent
    Package: ./plugins/agent/index.ts
    failed to import
  tasks
    Package: ./plugins/tasks/index.ts
    failed to import
  sandbox, extensions, builder, openai: the same
```

`failed to import` is `dsh-app-boot`'s label for a row whose Loader entry has no fiber (`inactiveEntries`: `if (fiber === void 0) ... error: "failed to import"`),
so the real import rejection is swallowed. What was measured around it, on a scratch framed agent app:

- Patching `cordis-plugin-loader`'s own `_init` catch to print `error` printed **nothing**: the row never reaches that catch, so the import happens on another
  path (DSH's boot importer), which is where the next session must print the rejection.
- The same plugins import cleanly from the app folder with the app's register:
  `node --import ./plugins/acryl-node-server/src/register.ts -e "import('./plugins/agent/index.ts')"` prints `agent ok` (and the same without the register).
- It is not a row-id collision: prefixing every id (`app-agent`, ...) fails identically. It is not the loader's TypeScript extension rewrite
  (`__rewriteRelativeImportExtension`, which turns `./x.ts` into `./x.js`): an absolute `file:///.../plugins/agent/index.ts` row name and an extensionless
  `./plugins/agent/index` row name fail the same way. All six app plugin rows fail while `app-routes` (`./src/frame.ts`) and the framework rows mount.

Next: instrument DSH's boot import of layer rows (the path that runs before the Loader's `_init`) and print its rejection; the two candidates are a different base
URL for rows inside the app's `plugins/` folders, and the boot importer evaluating rows before the app's register hooks are installed. Once the cause is known, the
rows land in `init.ts` as described in (2) and the agent template's panel assertion can go back into the page gate.

### 13a. The cause, measured, and what mounting the rows then needs

The swallowed rejection, printed by patching the Loader's activation step: `Error: invalid plugin, expect function or object with an "apply" method,
received object`, once per row. A Cordis row's module must BE the plugin, while the app's registry mounts NAMED plugin objects
(`import { agent, memory, model, tools } from '../plugins/agent/index.ts'`; `export const registry = { tasks, model, tools, memory, agent, ... }`), so the module
namespace has no `apply`. That is why the rows never reached the loader's import catch: the import succeeded and the plugin check threw afterwards.

A working mount is a one-line generated adapter per row, from the same source of truth the app already has (`src/app.ts`'s imports and its registry), never a
hand-kept list:

```js
// frame/<row>.mjs
export { agent as default } from '../plugins/agent/index.ts'
```

and the row names `./frame/<row>.mjs`; a row imported as a namespace (`* as panel`) mounts the module directly. Tried in a scaffolded agent app: all rows
load and apply, and two further needs surfaced, which are the next step:

- **The rows need their composition config.** The app's server passes per-row config in `createApp` (`builders`/`extensions` sources and the rest are set in code,
  not in `blend.yaml`), so the layer's rows run without it: the builder row then fails with its own clear error ("the builder writes into …/plugins, which is
  not an extensions source"). The composition the app's server builds should be exported by the template (one function `appRows()` the server and the generated
  layer both mount), so the frame composes the app exactly as its own server does, config included.
- **The launcher must print the cause.** DSH's "failed to import" hid this for two rounds, here and in ACRYL's 178 rows. The generated `scripts/ide-host.mjs`
  should catch the boot's StartupError and print each failing row's id, module and the full error chain (`error.entries` carries the original failures), and
  `--check` should fail naming them.

Both are prerequisites for re-mounting the app rows and for the agent template's panel assertion in the page gate.
