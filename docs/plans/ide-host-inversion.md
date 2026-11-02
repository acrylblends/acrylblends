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

### 13b. The composition row, landed, and the service-name collision it hits

`composeInto(ctx, chosen, options)` is now exported by the agent template's `src/app.ts`: `createApp` calls it (same rows, same order, same config as before; its
own suite is 15/15), and a generated `frame/app-plugins.mjs` row can call it with `{ host: true }` (no server config, and the server and door rows left to the
host). The generated launcher also prints the boot's failure chain now: on a StartupError it lists each failed row's id, module and full error, then exits 1;
`--check` already names every inactive row.

Mounting that row hits a second, bigger collision, measured: the app's own plugins and the host's DSH driver rows use the same Cordis service names. First
`Error: service "tools" has been registered at <ToolRuntime>` (DSH's driver `tools` row versus the app's `tools` plugin), and after isolating `tools`, `agent`,
`settings` and `workspace` in the row's scope, `Error: service "agent" has been registered at <tools>` - a per-service `isolate()` does not separate the
providers the way the mount needs.

So the next decision is not mechanical: either the app's whole plugin set mounts in a fully isolated scope (every service it provides isolated, which Cordis
supports but which needs the list derived from the app's registry, not hand-kept), or the host stops mounting the DSH driver rows whose names the app replaces
(`tools`, `agent`, `settings`, `workspace`) when the app brings its own - which changes what the chat driver rows see. That is a design call for the
coordinator, with the two exact errors above as the evidence.

### 13c. Scope isolation, tried: the derived list works, the app's own composition collides under it

Per the coordinator's decision (a), the mount was tried with the isolate list DERIVED from the app's own plugins (read from their sources: a Service's
`super(ctx, 'name')` and a `provide('name')`, restricted to the blend.yaml rows the host does not provide). For the agent template the derived list is exactly
`agent, extensions, memory, model, sandbox, tasks, tools`, and the row is generated with it. Booting then collides INSIDE the app's own composition, not with
the host: `Error: service "model" has been registered at <tasks>` although the app's own server mounts the same rows without isolating them. So the per-name
`isolate()` chain (one label, built by extending the context name by name) does not reproduce what the app's server does for the app's rows; the next probe is
how Cordis expects one bounded context to be isolated as a whole (one extension with the full map, or a forked context whose group keeps the app's rows in one
scope), with the app's own suite as the oracle: the app's rows must activate exactly as they do standalone, and only then can the host's driver rows keep their
own copies of the same names.

The row generation code is written and reverted (not landed); the derived-list scan itself is sound (it found exactly the seven services the app provides).

Attempt detail for the next probe, so it is not retried: the row already mounts the app under ONE child lineage - `let scope = ctx; for (const name of
APP_SERVICES) scope = scope.isolate(name, 'app-plugins')` - one context built once with a shared label, not a fresh label per name. That is the variant the
decision (a) note suggested, and it is the one that produced `service "model" has been registered at <tasks>` inside the app. A different mechanism is needed,
not a repeat of this one: either a context whose group keeps the app's rows in one scope as the app's own server does (the server mounts every row through one
`compose()` call on one plain Context), or a separate root Context for the app with the host's shared services (router, state, webServer, nodeServer) provided
into it explicitly.

### 13d. The Loader's entry isolate works; the panel's script still does not load under the host

Following the coordinator's lead (2), the app's rows mount through the Loader's own entry option: the generated `app-plugins` row carries
`isolate: {"agent":true,"extensions":true,"memory":true,"model":true,"sandbox":true,"tasks":true,"tools":true}` (the derived list), and `composeInto` with
`host: true` leaves out the host's infrastructure rows (`instance`, `acryl-router`, `acryl-web-server`, `acryl-page`, `manifest`, `save`, `acryl-node-server`,
`acryl-door`). Measured result: the host boots with every row active - DSH's driver rows and the app's own plugins coexist, no service collision - and the app
answers at `/app` with its page carrying the agent-panel and door script tags.

What still fails: the panel UI does not appear in the page. The app's panel endpoints are mounted on the host router at the ROOT (`/api/agent-panel/...`), not
under `/app`, and at that root they answer 401 to a plain request (`/api/agent-panel/panel.js` 401, `/api/agent-panel/session` "unauthorized"), so the panel
script is refused in the page even though its tag is served. The next probe is the panel's own origin/token admission under the host (its standalone gate,
`verify-agent-panel.mjs`, shows the contract it expects), not the composition.

The code is written and reverted; the branch stays green at the approved pair plus the notes.
## 14. Handoff at the hub-token step (2026-10-31)

`55f1f673` is the landing candidate approved with the full check green (scaffolder OK, verify:ide-host 72 rows + PENDING/restore + two reloads, verify:ide-template green end to end including Settings; whole chain EXIT 0). `7c694afc` is the next step and also has the full check green: routerHttp exposes a stable per-service hub token; the door keys its socket owner and prefix claim on it; the node server refuses any upgrade that reaches the HTTP fetch path before raw HTTP routes (503 for a WebSocket upgrade, 400 for another protocol); the reject writer checks the socket so a second handler can never answer twice. Suites: node-server 553, router-http 20, web-server 7, door 168 passed / 2 skipped; lint green; full check EXIT 0.

The narrowed re-provide state: the door's provider-removed-and-restored test (`tests/host/hub-ownership.spec.ts`, still skipped) now shows its steady state answering the upgrade with a plain 200 (`never opened (refused 200, refused 200)`). The transition windows themselves are clean: an upgrade with no listener is refused 503/400 before any HTTP route, never answered twice, and no write-after-end remains. The three supporting scenarios pass (node-only, routerHttp after the node server, routerHttp before the door).

The two hub generations: when the routerHttp row is disposed, its hub is closed with the service, but the prefix and upgrade claims made through `routerHttp.mount` can outlive it because the door's release is driven by service-change events rather than the service's own lifecycle. The re-provided service has a new hub token, so the door remounts the page socket route with the new allow; the surviving claim's handler still emits into the old hub, whose bindings the new route does not share, and the route answers the upgrade through its non-upgrade path (the plain 200).

Next idea (not yet coded): bind the claim and the page socket route to the service's Cordis lifecycle instead of to events. Mount both inside `ctx.inject(['routerHttp'], ...)`, so Cordis disposes them exactly when the service goes away and re-runs them against the new service; keep the node-server fallback in a scope active only while routerHttp is not provided. The hub token then only picks the allow for the scope that owns the route, and no state can survive the service it belongs to. A second, smaller idea if that still leaves a window: have the stable claim handler answer 503 whenever the owner generation it was made for is not the current one, so a stale claim refuses instead of reaching the old hub.

## 15. Handoff at the lifecycle-bound socket (2026-10-31)

`ad682bbf` on 107-host-page: the page socket route is mounted once at apply, before the private API routes, so a host restart cannot lose its precedence; the middleware asks for the live upgrade helper per request and refuses 503 while none is ready. While routerHttp exists, its `ctx.inject` scope owns the prefix claim and sets the helper, and Cordis disposes the claim with the service; the node server's hub is the helper only while routerHttp is absent. The transition windows are clean: 503 before any HTTP route and no double answers. Node-server 553 tests, door 168 passed / 2 skipped, lint green. The re-provide test is still skipped.

The narrowed remaining state: after routerHttp is disposed and re-provided, the steady state answers the upgrade with a plain, empty 200 (`never opened (refused 200 , refused 200 )`). With the route precedence and the claim lifetime now taken out of the equation, the 200 comes from the upgrade path itself on the re-provided service: the route's ownOrigin passes, the helper returns a 200 with an empty body rather than a handshake, which is what this router's upgrade helper does when the request it sees is not carrying the hub's upgrade bindings. The next investigation should look at the re-provided RouterHttp's hub and emitter: whether its setupWebSocket listener is attached to the emitter the claim emits into (the claim is made by `http.mount` inside the inject scope, so the emit target and the listener should be the same hub unless the mount resolves `this.ctx`/web differently on a second instantiation), and whether the `ctx.inject` activation for the new service runs before the route reads the helper (the 503 path would be visible if it did not). A focused probe: log the hub token and the emitter identity in the routerHttp adapter's `upgrades()`/`mount` on both activations, and the status the helper returns in the route.

The two earlier handoff sections still hold: the hub-token step (section 14) and the frame/page gate (sections 11-13), with the full check green at `7c694afc` and `55f1f673` approved for landing.

## 16. The section 15 probe: identities are consistent, the 200 is inside the re-provided hub

The probe ran on `225d4944` with the identities numbered by object: activation 1 created token 1, emitter 2 and hub 3; activation 2 created token 4, emitter 5 and hub 6; after the re-provide the raw claim's handler emits into the NEW emitter (5) and the NEW hub (6), and the page socket route reads a helper from that same new hub. So the steady-state 200 is not a claim/route generation mismatch: the right hub, the right emitter and the right helper are all in play, and the failure is inside the re-provided hub's upgrade path (the helper answers a plain empty 200).

What differs from activation 1 is the presence of the node server's `UpgradeHub` on the HTTP server (attached during the dispose window) with its `setupWebSocket` listener running with `skipWhenRawUpgrade: true`, while the routerHttp hub's listener runs on its own emitter. The next probe: label the two hubs in `adapter/websocket.ts`'s setup listener (a new option, only for diagnostics), log whether `WAIT_FOR_WEBSOCKET_SYMBOL` and `wss` are in the env the helper sees, the status of the `fetchCallback` result before it is written, and whether the helper's middleware called `next()` (a plain 200 with no body is what a router fallthrough or a deferred helper would leave). That separates the hub's binding plumbing from the door's route.

State: `225d4944` is the landing candidate (full check EXIT 0 at `225d4944` and at `ad682bbf`); the re-provide test is skipped; node-server 553, door 168 passed / 2 skipped, lint green; the probe edits were removed and the worktree is clean.

## 17. The re-provide scenario is fixed (2026-10-31)

Measured in the re-provide test at dispatch: the node server held three `upgrade` listeners, `[raw, raw, setup:node]` - two raw listeners, both attached at the emit (Node copies the listener array at emit, so a listener re-added during an emit cannot be called for that request; the second raw listener had been attached at an earlier moment and never removed). One request was therefore dispatched twice into the hub, the first waiter rejected and the second run found none, and the setup wrote the router's plain empty 200 down the socket.

Fix: the raw upgrade listener is attached once when the node server is made and consults the claim registry for the server's lifetime; claims coming and going never add or remove a listener. `upgradeListenerCount` is exposed for the test, which asserts it is 1 and stays 1 across a claim added, removed and added again. The WeakSet remains only as a guard; the re-provide test passes with the guard disabled, which proves the single ownership is the fix. Refusals keep one writer: an unclaimed WebSocket upgrade gets 503 and another protocol 400 from the raw listener (flagged so a hub setup leaves it alone), and a hub's own rejection no longer depends on the server's listener count.

`66865602` carries the fix and the door's provider-removed-and-restored test is unskipped and green (101 exactly once). Suites: node-server 554, router-http 20, web-server 7, door 169 passed / 1 skipped; lint green; full `pnpm run check` EXIT 0 on `66865602`. Sections 14-16 are kept as the record of the narrowing.

## 18. The panel under the app's mount (2026-10-31)

Section 13d left one blocker: the panel script was refused in the page. The cause was measured in the driver, not in the panel: DSH's `connection` row registers a `prefix /api`
route on the host's webServer (`deepseek-harness/packages/client/connection/src/index.ts`, `API_PATH = '/api'`), and that route answers every request under `/api` first. Its
admission refuses a request without DSH's browser session with exactly the 401 `unauthorized` seen in the page. The panel had mounted `/api/agent-panel` on the host's router at
the ROOT, so the driver's prefix route answered before the router ever saw the panel, and the panel's routes were not under the app's mount (`/app`) at all.

Fix, at the cause: the panel row takes the app's mount as its config (`mount`, the same rule and the same validation family as `clientModules`'s option). Its routes, the
script tag it adds to pages, its client-module mount and its WebSocket path are all `${mount}/api/agent-panel`, and the served `panel.js` calls `start(prefix)` so the client
uses the mounted path instead of a hardcoded root one. The agent template's `composeInto` passes `FRAME_MOUNT_PREFIX` (`/app`) in host mode, as a config override keyed by
the row id `agent-panel`, the same mechanism that carries the `server`, `tasks`, `extensions`, `builder` and `model` values. On the app's own server the row keeps its
default (the root), so standalone behavior and the standalone panel gate are unchanged.

The admission is the same one, not a loosened one: `Sec-Fetch-Site: same-origin` (or `Origin` equal to `Host`) for the session, and the token for ask, stop and run, now at
`/app/api/agent-panel/...`. The page gate asserts both directions: the panel appears in the app's iframe, offers its `agent` driver, and "add 2 3" produces a run that starts
and stops with "The answer is 5." in the panel's own log; a cross-site session and an ask without the token answer 403 at the mounted path.

Measured in the page gate: the panel script loads at `/app/api/agent-panel/panel.js` (200 through the `/app` routerHttp mount), the client modules compile and load under the
same prefix, the session answers and the run's events arrive over the panel's socket, all inside the app's tile. The panel unit suite gains the mounted case (routes under the
mount, nothing at the root, the mounted import and the `start('/app/api/agent-panel')` call, the mount's validation).

The same shape applies to any app plugin that mounts its own routes rather than joining `makeApp`. The PTY driver is the second: `driver-pty` takes the same `mount` config, its routes and
client modules live at `<mount>/api/driver-pty`, and `composeInto` passes `FRAME_MOUNT_PREFIX` to its row too (the row exists when `add driver-pty` mounted it; the override is unused
otherwise). A terminal driver now carries its view with it (`view: { module, prefix }` in `acrylblends/drivers`, read in the panel's session), so the panel loads the terminal module and
calls its endpoints at the mounted path instead of knowing `/api/driver-pty` itself. The shared mount rule is one function, `mountedPrefix` in `plugins/agent-panel/mount.ts`, used by the
panel and the PTY driver.

The page gate adds `driver-pty` to the agent app (with `programs: { node: [] }`, so it does not depend on which coding agents a machine has) and asserts the terminal at the mounted
path: the session names `pty:node` with its view under `/app/api/driver-pty`, the view module answers there, a session starts (200 with an id) and stops (200), and a cross-site or
untokened start answers 403. The PTY suite gains the mounted case on the same rule the panel's gained.

Survey of the other app-owned rows that claim a root `/api` path under the host (2026-10-31): `acryl-state` mounts `/api/state` on the router, and `acryl-inspect` mounts `/api/inspect`;
both also claim that prefix through `routerHttp` when it exists, and the host's raw routing picks the longest prefix, so `/api/state` and `/api/inspect` beat DSH's `/api` and are served.
They work, but they live outside the app's mount (their browser modules are addressed root-absolute, `/api/state/client.js`); moving them under the mount is a later change, not a
breakage. The door's `/api/acryl-door` is host-owned in the frame (the host layer mounts the row, `composeInto` leaves the app's out) and claims a longer prefix than `/api` by design,
because the CLI addresses it by app URL plus that path. The frame packages (`acryl-workspace`, `acryl-plugin-admin`, `acryl-support`, `acryl-sign-in`) are host rows and claim
`/api/acryl-*` through `routerHttp`, so they are never in DSH's `/api`. The templates other than `agent` mount their routes at `/` on their own server and have no framed composition
yet; when they get one they take the same `mount` config the agent template passes.

## 19. `acrylblends upgrade` brings a pre-frame app onto the host layout (2026-10-31)

The parked slice (6fc3d33e, `20b67da0`) was planned against the DSH-profile layout. What still fits the host launcher: the frame half of `upgrade` as a step
planned before anything is written, with per-file conflict detection by the generated marker, a refusal (exit 1, nothing written) unless `--force`, which
saves the app's version under `.acrylblends/upgrade-backup/` first, an idempotent second run, and a boot gate on a real app. What does not fit: the
`scripts/ide-profile.mjs` profile script and the `profile` npm script (the host launcher replaced them), the `app-routes` row alone (the framed app now also
mounts its own plugins through `frame/app-plugins.mjs` with the entry isolate, and the mount config lives in the composition root), and the rule that an app
without `src/frame.ts` simply stays standalone (every app made by the previous published release lacks it; the upgrade now brings the frame row and the
scaffold it needs).

The shape now: the fixtures cover every published release that shipped templates, `acrylblends` 0.3.0 through 1.1.0 (40 versions, checked against npm; the
releases before 0.3.0 predate the CLI's templates), deduplicated by content hash to 31 distinct scaffolds under `packages/cli/legacy/<template>/<hash>/`.
`scripts/build-legacy-layouts.mjs` derives them from the release tags: for each template it takes the route module `src/frame.ts` imports (or `src/routes.ts`)
plus `src/app.ts` where the current template exports `composeInto`, so the file list follows the templates rather than a hand list; `--check` compares the
committed bytes with the tags. `planFrameStep` identifies the app's template from those files and plans three kinds of writes. The template's own files are
`same` when they already equal the current template's, `update` when they equal the released ones, `add` when missing and `conflict` when the app edited
them. The generated files (overlay, `cordis.yml`, `scripts/ide-host.mjs`, `app/runtime.mjs`, `frame/app-plugins.mjs`) are ours by their marker line. The
two host plugins the launcher mounts by path (`acryl-web-server`, `acryl-page`) are copied when missing. `package.json` is merged, never a conflict (its
`dev` script moves to the launcher; `start` keeps the app's own server). The app's `blend.yaml` and any file of its own are untouched. The old
`scripts/ide-profile.mjs` is removed when it carries the generated marker.

`appFrameRows` (the row ids, the isolate scan and the generated composition file) moved out of `init` into `packages/cli/src/frame-rows.ts`, so `init` and
`upgrade` write the same rows from one home; `init` keeps its behavior (a template with `composeInto` gets the app-plugins row; the blank template keeps its
own composition). `applyIdeProfile` now goes through the same plan/write as the upgrade, so planning and applying cannot drift.

Releases before 0.7.8 cannot be carried forward: their `src/main.ts` imports `./plugins/...`, where the app keeps its plugins one folder up (`../plugins/...`
since 0.7.8), so such an app cannot start as scaffolded and replacing the scaffold the upgrade owns would not fix the entry module it does not. The upgrade
recognises that entry module (`brokenEntry`), reports it precisely in the CLI's message ("src/main.ts imports './plugins/...', as acrylblends 0.3.0 through
0.7.7 wrote it ... change those imports to '../plugins/...' and run again"), and leaves the frame alone; their layouts are still in the fixtures so the app is
identified and the message is exact. Every template without the frame row in the current release keeps the older plain report ("the notes template has no
src/frame.ts yet: left standalone"); every built-in template has the row now, so that branch is tested on the planning function with a temporary template
folder without `src/frame.ts`.

Tests: `packages/cli/test/upgrade-frame.test.ts` builds a released-layout app (current scaffold, then the released files, no frame row, no host plugins) and
covers the write and its report, the agent template's composition row with its isolate and the mount config, idempotency, a hand-written overlay refusal, an
edited scaffold refusal and `--force` with the backup, the planning function's no-frame-row branch, an unidentified scaffold, the pre-0.7.8 report, the old
profile script removal, and a loop over every distinct scaffold of all six templates (each upgrades and settles, or is reported). The gate
`scripts/verify-upgrade-frame.mjs` (wired as `verify:upgrade-frame`) iterates every distinct scaffold: the safe ones get the upgrade with every reported
change asserted and `blend.yaml` and a file of the app's own byte-identical, then a second run that must change nothing; the pre-0.7.8 ones are asserted to
get the precise report and no frame files. The oldest releasable layout per template is installed and booted (the frame page and `/app` answer, then the
server and its port are checked gone), and a 1.1.0 agent app is upgraded and run through the page gate (`verify-ide-template.mjs agent --existing <app>`:
composition, `/app`, the panel run, the PTY under the mount, the chat and Settings).

Known boundary: an app whose scaffold was edited (or made by a release other than 1.1.0) is identified only through its other template files; when none
matches, the upgrade leaves it standalone and says so. `--force` covers a recognized template with edited files, never an unidentified one.

## 20. The Windows 10 ConPTY resize: a test child that never read stdin (2026-10-31)

The driver-pty suite's real-PTY resize test failed on mbpi9win (Windows 10 Pro `10.0.19045`): after the driver's resize the child kept its start size. A minimal repro outside the framework (node-pty `1.2.0-beta.15`, and `1.2.0-beta.18`; Node 24.18.0) compared two children of the same `pty.spawn(process.execPath, ['-e', script], { cols: 90, rows: 20 })` and the same `pty.resize(110, 35)` after 2.5 s:

- A Node child that never reads stdin: its `process.stdout.columns` and `getWindowSize()` stay `90x20`; its `resize` event either does not fire or fires with the old size.
- The same Node child calling `process.stdin.setRawMode(true)` and `process.stdin.resume()` (what claude, codex and pi do): its next tick reports `110x35`.
- A PowerShell child printing `[Console]::WindowWidth`/`[Console]::WindowHeight`: `110x35` from the next sample on.

`useConptyDll: true` only makes the spawn size current (a child started after the resize sees `110x35`); it does not change the live case. The node-pty version does not change it either.

Cause: the ConPTY console is resized by `pty.resize` in every case (the client repaints at 35 rows, and the console API reports the new size); Node's tty learns of the change through its console input handling, so a child that never reads its console input never sees it. The real programs the driver starts read stdin in raw mode, so the framed terminal is not limited on Windows 10; the test's ECHO program was the one that never read stdin. It now reads stdin in raw mode on Windows, like a real program, and keeps its POSIX behavior (SIGWINCH reaches Node there). If a Windows host ever again delivers no resize to the child, the test skips with this section as the reason rather than passing silently.

The suite keeps the platform's evidence as it is: the new size where `resize` fires, or the console's `ESC [ 8 ; rows ; cols t` report where it appears.

## 21. The host owns a real profile: durable Settings (design, 2026-10-31)

The workshop rehearsal found the first user-facing defect of the host inversion: in the frame, Settings > Models answered "Loading the provider directory failed: dsh:
failed to read profile manifest <app home>/.acrylblends/package.json", and once that file existed, the DSH "Preview Notice" modal appeared and could not be dismissed
("The acknowledgement could not be saved"). Both come from one fact: DSH's Settings, config editor and plugin manager are written against a launcher-owned profile
(manifest, patch document, reconcile), and our host only fabricates a `profileContext` object. This slice gives the app a real profile in its own DSH home, so every
Settings write persists and survives a restart.

### 1. What DSH reads and writes

- `ProfileContext` (`deepseek-harness/packages/boot/app-boot/src/profile-context.ts:21-40`) is the launcher's contract: `name`, `dir` (the profile directory),
  `patchPath` (the settings document), `installAnchor` (the app's `package.json`), `cwd`, `home`, `startedBundles`, `overlays`, `telemetryDisabledEnv`.
- `readProfilePatches` (`profile-context.ts:64-76`) is the one composition reader: `loadProfileDirectory(dir, installAnchor)` bundle layers (none for us),
  then the `patchPath` file, then `<dir>/cordis.patch.yml` (`PROFILE_PATCH_FILENAME`, `profile.ts:40`), then the launch overlays, then a telemetry patch when the
  composition carries that row. The order is significant: the config editor re-applies exactly this list.
- `loadProfileDirectory` (`profile.ts:655-689`) reads `<dir>/package.json` (the profile manifest) and, per `dsh.profile.bundles`, each bundle's patch files; it also
  parses `<dir>/cordis.patch.yml` as the profile's own patch layer.
- `ConfigEditor.edit` (`packages/boot/config-editor/src/index.ts:95-160`) does, under a file lock: reconcile the current `readProfilePatches` list; read the entry's
  live config; compute the next config; read and update `patchPath` as a YAML sequence (one `{ id, name, config }` patch per edited row); verify through
  `composeEntries` that the document produces exactly the next config (else "overridden by a home patch or command-line overlay"); write the document atomically
  (mode 0o600); reconcile again with the document replacing the `patchPath` file in the list; and on failure restore the previous document and reconcile again.
- `reconcileProfilePatches` (`packages/boot/app-boot/src/index.ts:273-303`) replaces the root Include entry's `patches` with the given list, awaits the Loader,
  and rejects on newly introduced inactive entries (or on any failure of a required id). It requires the boot's Include entry, which `boot()` records.
- The plugin manager (`packages/boot/plugin-manager/src/index.ts:281-330`) reads the same manifest and `installAnchor` to list bundles; a missing manifest is the
  Models error above.

### 2. Who owns the profile files

The host owns the app's DSH home and writes its generated files there on every boot:

- `package.json`: the profile manifest, `{ name, private: true, dependencies: { "acrylblends-frame": "0.0.0" }, dsh: { profile: { bundles: ["acrylblends-frame"] } } }`.
- `node_modules/acrylblends-frame/package.json`: the composition bundle's manifest (`dsh.bundle.patch: cordis.patch.yml`), so DSH resolves the composition the
  way it resolves any installed bundle (from the profile directory).
- `node_modules/acrylblends-frame/cordis.patch.yml`: the composition (the driver rows selected from the base and web bundles, the host rows, the app's frame
  layer), with a "generated, do not edit, rewritten on every boot" header, written with the include's `!!js` tag so it round-trips to the identical patch list.

One file is the user's and the host only creates it when missing: `settings.patch.yml`, the profile patch document `ProfileContext.patchPath` points at. It is
never rewritten by a boot, an init or an upgrade; only DSH's config editor writes it (atomically). The app's own `cordis.patch.yml` (the frame overlay at the app
root) stays the app's generated overlay, a different file in a different folder.

The composition is a BUNDLE, not the profile's own home patch (`<dir>/cordis.patch.yml`), because of precedence, measured: with the composition as the home patch,
DSH's config editor refused every Settings save with "Configuration for ... is overridden by a home patch or command-line overlay". `readProfilePatches`
orders bundle layers, then the patch document, then the home patch; only a bundle layer puts the user's Settings edit after the composition. All three files live
under `.acrylblends/`, which every template's `.gitignore` already ignores.

### 3. Boot and reconcile use the same list

The launcher passes the composition bundle's patches and then the settings document to `boot`, exactly `readProfilePatches`' order and content with no home
patch and no overlays. Without that equality the first settings edit would reconcile the include to a different composition (the editor calls reconcile before and
after its write); with it, the first reconcile is a no-op recomposition and later ones differ only by the edited patch. The gate proves the precedence with one
key set in both places: the composition carries `ui-settings-general.welcomeNoticeVersion` and the user's dismissal writes the same key; the notice stays
dismissed after a host restart only if the document wins.

### 4. PENDING and reload

`reconcileProfilePatches` applies the list through the Include entry, so an edited row follows Cordis' ordinary update path: unchanged rows keep their fibers, a
changed config reloads its fiber, a row whose new config no longer satisfies its dependencies becomes PENDING until the dependency returns, and the editor's
required-id set turns a new failure into a rejected save (the editor then restores the document and recommits the previous list). The settings form's namespace
values come from the same document through `SettingsForms.describe`, and its revision counter is driven by the reload event, so the client sees the new value
without a page reload.

### 5. What stays fabricated, and what is out of scope

`startedBundles` stays as it is (our start is the launcher, not a DSH plugin install), `overlays` stays empty, and the plugin manager's install/remove operations
(for profile bundles) remain out of scope: the app's plugins are upgraded by `acrylblends upgrade`, not by DSH's manager. What this slice fixes is the contract
the Settings screens themselves exercise: the manifest read, the document read/write, and the reconcile.

### 6. Verification

The page gate (`scripts/verify-ide-template.mjs`) gains the workshop's day-one path: open Settings > Models and assert no error text and the provider rows; dismiss
the Preview Notice and assert it closes; restart the host with the same app home and assert the notice does not return (the acknowledgement persisted); add the
model key in Settings > Models and save; and chat with it against the local mock. It also asserts the secrets rule: after saving, the key text appears in no
`package.json` and in neither patch file (the settings document or the composition), only in DSH's credentials store. The precedence fixture is the notice itself:
the app's overlay carries a composition patch for `ui-settings-general.welcomeNoticeVersion`, the dismissal writes the same key in the settings document, and only
a correct order keeps the notice dismissed across the restart. A unit test in `packages/cli/test/upgrade-frame.test.ts` proves `init` and `upgrade` leave an
existing `settings.patch.yml` byte-identical and never report it. The existing checks (composition active, PENDING/restore, two reloads clean) keep proving the
recomposition itself.

## 22. Handoff: the workshop guide (branch 114-workshop-guide)

The attendee guide is `docs/framework/workshop/README.md` (with `facilitator.md` beside it); the registry repository `github.com/acryldev/workshop-2026-11-20`
(cloned read-only during the rehearsal) carries no guide, only the registry README, `CONTRIBUTING.md`, `index.json` and the entries, so the guide's publish block
must stay consistent with that README.

Target flow (the coordinator's outline): create an app; it opens in the ACRYL frame with sessions, the right panel and Settings; add the model key in Settings >
Models; chat; run claude/codex/pi in a PTY tab; edit the app and see it at /app; upgrade an older app.

Rehearsal setup measured on this Mac (2026-10-31): the packed `acrylblends` tarball (`scripts-pack.mjs copy`, `npm pack --ignore-scripts`, `scripts-pack.mjs
remove`) installed with a prefix into an isolated HOME; the app scaffolded by the packed CLI with `ACRYLBLENDS_FRAME_PACKAGES` through the checkout bridge (the
frame packages are unpublished; their tarball pipeline is `verify:frame-publish`); `npm install` with an isolated cache; `npm run dev` with `ACRYLBLENDS_HOME`
and `DSH_HOME` under the app and `ACRYLBLENDS_PORT=0`, never 3080. `npm create` cannot be rehearsed from a tarball because `create-acrylblends` resolves its
`acrylblends` dependency from the registry; use the packed CLI (`acrylblends init`).

Frame UI measured: left Projects/sessions with the app as a project and `New session`/`New chat on <app>`; the right panel with Files/Changes/Review/Checks/
Comments/Terminal; Settings sections General/Models/Built-in plugins/Agents/Tabs/Command palette/Shortcuts/Support; the tab menu opens New Terminal, New Browser
Tab, New File, New Diff, New Board, New Doc, Workspace brief, AcrylDSH Chat and coding-agent tabs (Claude, Codex, Pi, ...); a terminal tab starts in the app folder;
a browser tab reaches `/app`; `.acryl/door.json` appears in the app.

State carried into 114: 115 gives the host a real DSH profile, and the fresh-app page gates (agent and blank) are green on the day-one path: Settings > Models
loads and takes the key, the Preview Notice is dismissed and stays dismissed after a restart, the chat needs no key card after a settings reload (the reload is
what makes a saved key effective in the running page) and answers against the mock, and the key text is confined to DSH's `.credentials.yaml`. The upgrade gate's
page run on the upgraded fixture is green after that reload, and the reload's window is a product rule now, not a gate workaround. The frame restores the shown
chat's worktree asynchronously after a reload (the session list arrives, then the tree follows the chat's folder; `relocateShown` documents the
startup-before-discovery case), and a reload can also come back with no shown chat at all. A new chat asked in that window used to open with no selected
worktree, which the canvas answered with "Select a worktree first." and no composer. In the ported `ide/acryl-workspace` package, `WorkspaceShellState` now
exposes `restoring()` and `waitForSelection()` (8 s bound; a selection settles waiting callers, a restore that ends without one settles them with undefined,
and disposal settles them too), and `WorkspaceCanvas.openChat`, with no selected worktree, shows "Restoring the worktree of the open chat…" and opens the chat
on the worktree once the selection resolves; when no restore picks one (a reload with no shown chat), it falls back to the first worktree the sidebar lists
(the app's project) and selects it. Only a workspace with no worktree keeps "Select a worktree first.", and a chat is never opened with no worktree. The page
gate now asks for the new chat as soon as the frame is back - inside the window - with no fallback or worktree retry (it retries only the tab menu's own press
when the menu did not open), and its Settings step waits for the dialog instead of accepting an immediate snapshot. The upgraded app itself was complete
(profile manifest, composition bundle with the `workspace-controller` `documentsDirectory` config, `storages/workspace.json`); the persistence design is
unchanged.

Remaining for 114: rewrite the guide's blocks to the frame flow (day-one frame; Settings > Models; chat; a coding agent in a PTY tab; edit the app and see it at
/app; upgrade an older app), rehearse end to end exactly as an attendee would from the packed CLI in an isolated HOME, fix every failure at the cause, commit to
`114-workshop-guide`, and push nothing to the registry repository without the coordinator's approval.

## 23. CI after 115: the restarted host's token, and the notice check's Chrome (2026-10-31)

The first CI run after 115 landed (`797c8215`, run 41247560397) failed only in the two frame jobs. macOS, `blank`: after the settings restart the tile check
failed. The restart mints a new connection token - the log shows the same port with two different tokens - and the gate does refresh `url`, `origin` and the
cookie jar through the new token (the frame rendered after the restart), so the failure was the tile itself: its one-shot "Go" press landed on a fresh page
whose tile was still wiring, and the app's page never loaded in the iframe. The tile check now presses Go up to three times (the address stays typed) and, on
failure, names the iframe's `src`, title and text instead of only the server output. Windows: the notice check's own headless Chrome did not open within its
20-second loop, with Chrome's output discarded; the launch now waits up to 60 seconds, ends early when Chrome exits, and names the exit code and Chrome's last
lines. Product note: a host restart issues a new token, so a frame left open with the old token is expected to be re-opened through the browser with the new
printed URL; the gate follows the new token rather than requiring an old tab to survive the restart. The frame jobs on `118-ci-after-115` are the evidence.

### The rerun on 118 (`ba180b23`, run 41249023980)

Ubuntu green; the two others named their next causes. macOS: the Go re-press let the blank tile pass; the agent gate then failed at Settings > Models because the dialog opened on General (a remembered section) while the gate assumed Models - the gate now presses the Models section explicitly. Windows: `stopServer`'s port check ran `lsof`, which does not exist there, and crashed the restart (`Cannot read properties of undefined (reading 'trim')`); the holder is guarded now, so a missing tool reads as "no holder" and the ended process is the evidence. The notice Chrome's own diagnostics did not trigger.

**Open cause (product): the first Go press on a freshly loaded frame.** The re-press is a gate mitigation, not a cause fixed: if the first Go does nothing, an attendee who clicks once sees nothing happen. Likely the tile's Go handler is not attached when the page first paints (hydration), or Go fires before the address is committed. The product fix is that Go works on the first press, or stays disabled (visibly) until it can; the gate then presses once.

**Open owner decision: a frame surviving a dev restart.** A host restart mints a new connection token (same port, new token); a frame left open with the old token has to be re-opened through the new printed URL. Whether an open frame should survive a dev restart (persisting the connection token in the profile) is the owner's call, not decided here.

### The real Settings causes (`b0139d49`'s red, found with a local dialog dump)

The "no Models section" error on every frame job and on the check jobs was two things, neither of them the nav selector. The page opens DSH's first-run "Add an API key to get started" dialog on a profile without a key, and the gate accepted any dialog as Settings (its wait returned on the first `[role=dialog]`), so it looked for the section list in a dialog that was not open. The gate now dismisses that first-run dialog with "Configure later" - the user's own path - before pressing Settings. And the real Models page saves a provider key with **Apply** (the first-run card's button was "Save and continue"), so the gate tries Apply first and the card's button second. With those, the agent gate runs end to end: Settings > Models takes the key, the chat needs no card and answers against the mock; the blank and upgrade gates pass in the full check. The real DOM was read once, as asked: the only dialog at the failure was the first-run card, and the Models page's buttons are Cancel / Apply.

**Resolved in section 24:** the first Go press (the address field is read directly and every press reloads, with a bounded automatic-reload net for a transport error), and the frame gate's Settings press (the frame's own foot button, pressed until its dialog opens). Readiness is ruled out as the cause of the tile's error page by that run's own timeline.

## 24. CI stability on one tree: the tile's press, the Settings press, a refusal's body (2026-11-01)

Run 41258550752 on `94548f5d` (the merge of the green 118 tip) was red in three jobs on a tree that had just passed: the notes frame gate on ubuntu
("Settings did not open"), the chat frame gate on macOS (the tile's iframe had `src` and no readable document), and `packages` on Windows Node 22
(acryl-db-sqlite's ten-cycle loader test at the 5-second default). Each had its own cause, and each is fixed at the cause on `120-ci-stable`.

**The tile's first Go, and a failed load no press could recover.** The browser tab submitted `draft`, the React copy of the address, so a press that
arrived before the input's state had committed submitted nothing or the previous address. It now reads the address field itself (`name="address"`),
which is what the person sees. The address bar is uncontrolled for the same reason: nothing rewrites the typed text under React's tracker. A press of
the address already loaded was a no-op too, because `updateTile` with the same `url` changes no state and the iframe never reloads; every accepted
press now remounts the frame through a key. The gate presses Go once, as an attendee does, and names whether the iframe's document was readable when it
fails. Tests: a submit with the field's value ahead of React's state (the old code did nothing), a same-address press remounting the frame, and the
attempt rule.

**Cause fixes and safety net.** The live field read and the remount on every press are the cause fixes: a press is never lost, and a failed page can
always be reloaded. A finished load whose same-origin address has no readable document is the browser's error page (a real same-origin page always
exposes its document; a cross-origin page also hides it, and is never retried): the tile loads it again, at most three attempts per press with 250 ms
between them, then settles on the error page. That net is deliberately not offered as the cause fix.

**Neither readiness nor a socket from before the restart is the cause.** In the failing macOS chat step /app answered at 01:00:35.965, the host
restarted at 01:00:40.143, the new page rendered at 01:00:41.922, Settings > Models saved at 01:00:43.783, a PTY ran at 01:00:44.795, and the tile's
GET /app at about 01:00:45 had no readable document, while every request around it succeeded against the same server. An app route that is not mounted
answers a readable 404; only a transport failure produces the browser's error page. The tile-check browser is fresh: the notice check runs its own
Chrome and kills it before the tile check starts, so no socket from before the restart can be in its pool. node-server's disposer does close
connections on stop (`hub.close()`, `closeAllConnections()`, `close()`), and the generated launcher disposes the fiber on SIGINT/SIGTERM.

The mechanism therefore stays open until a net log names it: the tile check's Chrome now writes `--log-net-log` to the runner's temp folder, the
failure message prints the path, and the frame job uploads `frame-netlog-*.json` as an artifact only when a gate fails. The error code
(ERR_CONNECTION_RESET, ERR_EMPTY_RESPONSE or ERR_ABORTED) then decides between a kernel-level reset on a pooled connection and a cancelled subframe
navigation.

**Queued: a graceful node-server stop.** The disposer closes all connections immediately (`closeAllConnections()` before `close()`), so an in-flight
request at stop time is cut, for example a save while the app restarts. Requested: `closeIdleConnections()` first, a short bounded grace for in-flight
requests, then `closeAllConnections()` and `close()`, with a test that an in-flight request completes when stop begins. Queued after the three green CI
runs.

**The Settings press.** The last step used the generic `click('Settings')`, which takes the first control with that exact name anywhere in the page,
and one press of a wrong one, or of the right one before its dialog was wired, was lost. The first replacement pressed the frame's foot button on
every poll and then checked, and `41352589158` exposed its flaw: a poll could press while the dialog was already opening and stop on a dialog that was
closing (the new wait returned true), and the old snapshot check right after it then failed with the very same "Settings did not open" dump, on ubuntu
notes and macOS blank alike. The gate now looks first and presses only when no visible Settings dialog is up: every Settings-labelled button in the
left pane is pressed (the visible foot button goes through the product's `openSettings` path, and the hidden upstream shell's own trigger sits beside
it), the plain DSH trigger is the fallback when the pane offers none, and only a visible dialog whose nav carries a real section (Models) counts, so a
stale or hidden dialog cannot be mistaken for Settings. The candidates are still named on failure. The notes, blank and upgraded-agent gates pass
locally with it, together with the single Go.

**The notice check's profile cleanup.** Run `41352593171` (check, Linux Node 22) failed with `ENOTEMPTY: directory not empty, rmdir
'/tmp/ide-template-notice-...'`: the notice check killed its Chrome and removed the profile in the same breath, while Chrome was still writing it.
The cleanup now waits for the process to be gone (bounded at five seconds) before removing with the tile block's retries, and the outer cleanup
waits for a SIGKILLed host to exit before removing the scratch. A passed check no longer dies on its own cleanup.

**The agent panel's answer wait.** Run `41358355702`'s macOS agent step then failed at the in-app panel: "the panel's run did not start and stop in the
app's page: undefined", with the panel, its synchronous submit wiring and the template unchanged from `98355d28`, where the same step had passed. The
offline agent answers in well under a second on a quiet machine, so the tight part was the 30 s bound on a loaded runner; the wait is 60 s now, and a
failure carries the panel's own log, button states and driver list instead of only `undefined`.

**The SQLite bound.** The ten open/close cycles measured 1.2 to 1.4 s in three runs on Windows 10 (mbpi9win, Node 24.18), so the 5-second default is
honest cost under a loaded windows-latest runner, not a hang. The test carries the same 20-second bound as the kv-db ten-cycle test.

**A refusal answered before the request body (the queued ECONNRESET ticket).** The adapter (`acryl-router-http`'s `serve`) wrote the answer and ended,
leaving a request body the handler never read (a guard's 403, a 415, a body over its limit). Node then closes the socket with data pending, and the
peer sees a reset instead of the answer: read ECONNRESET in the workspace git worktree test on Windows, and reproducible on macOS with a client that
writes half a body and waits. `serve` now settles an unread body (bounded: one second, resumed not buffered) before writing the answer, so the client
can finish sending and read it. The test writes half a body, asserts no answer arrives yet, finishes the body, and reads the 403; the old adapter fails
the first assertion on every OS, the fixed one passes.

**The composer after a reload (product).** A reload mounts the chat surface before DSH's composer and nothing moves focus into the message box, so the
page lands on the body and an attendee clicks before the first word; the same happens when the worktree restore re-renders the surface and replaces the
focused node. `focusChatComposer` watches while a chat is the shown tab (bounded at 30 s) and focuses the composer only when focus is on the page
itself, never from a field, a dialog, a menu or a control the person is using. Tests cover the late composer, the field and the dialog, the replaced
composer and the deadline.

## 26. A graceful node-server stop (branch 121, 2026-11-02)

The disposer closed all connections immediately (`closeAllConnections()` before `close()`), so a request in flight when the app stopped was cut. Requested
behavior: close idle connections first, let in-flight requests finish within a short bounded grace, then close all connections and close; and since an
upgraded socket (the PTY and door WebSockets) is never an HTTP connection, track those too and let their owner close each with a proper close frame inside
the same grace.

Measured first, on Node 24 (the platform the apps require): `server.close()` does not end a keep-alive socket that becomes idle after its request finished
(it stays until the server cuts it), and neither `close()` nor `closeAllConnections()` reaches an upgraded socket - in a probe with one open raw upgrade, the
`close()` callback never fired, even after `closeAllConnections()`.

The implementation: the adapter counts requests whose response has not finished (the response's `finish`/`close` events), the upgrade listener tracks every
upgraded socket until it closes, and `NodeServer.stop()` - idempotent, public, and what the disposer calls - runs the hub's close beside the request grace.
It stops new connections, sweeps idle keep-alive sockets on every pass (one that goes idle after its request finished is not caught by the single sweep
`close()` does), waits up to `STOP_GRACE_MS` (2 s) for the active requests and the tracked sockets, then ends the finished sockets gracefully (a `FIN` behind
the buffered body, not a destroy: destroying there answered the client with a reset and an empty body, which the first version of the test caught), gives
them a 300 ms flush window, and forces `closeAllConnections()` plus destroys any upgraded socket still left, so the server's own `close()` can finish. A
socket owned by another hub (the router-http adapter's) is closed by that owner's disposer, with its 1001 frame; if it is still open when the grace ends, the
stop destroys it rather than hang. Tests: an in-flight request finishes and its answer arrives while `stop()` is under way, the port is free, and a second
stop or the disposer is a no-op; disposal with an open event stream gets an explicit bound for the grace it now waits; and stopping with a WebSocket open
resolves while the socket gets its 1001 close frame.

**D: the router drains, and the mount removal that cut a second time.** The first whole-root dispose still answered the save with a 200 and
`content-length: 0`: Cordis runs every disposer together, and the router's own disposal refused new requests, aborted in-flight flights and ended their
bodies at once. The coordinator chose D - the router's disposer drains instead of aborting - and first asked whether Cordis awaits async disposers. It
does: a probe with one 100 ms and one 500 ms disposer starts both on the same tick and resolves the root dispose at 636 ms, after the slow one. D is
implemented: while closing, the router answers new requests 503 with `Connection: close`; disposal waits up to `disposeGraceMs` for the flights in hand,
then aborts what is left and settles it for 300 ms. Implementing it exposed a second cut: removing a mount also aborted its flights at once, and on a whole
root dispose every plugin unloads together, so a route-owning plugin's removal cut the save even when the router drained. Mount removal now follows the
same rule (drain first, then abort). The launcher is unchanged: it keeps disposing the root directly, and both drains run in that window.

**The gate gap that let a type error hide.** The root typecheck ran three aggregate tsconfigs, not each package's own script, so a package's own test configs
(the router's `tsconfig.jsx-tests.json` among them) were never exercised by the gate: the compress test's `Blob` parts failed TypeScript 6 there while every
gate stayed green. The check now also runs `pnpm -r --if-present run typecheck` - every package's own script, test configs included - right after the
aggregate, and the whole tree passes it (27 packages). That is the same class as the earlier test-timeout gaps: the gate has to run the thing that fails.

Tests on a whole-root dispose, on the frame's own composition (the router, our node server, the webServer port over it, and the router-http adapter): an
in-flight save finishes with its full body and a mounted WebSocket gets 1001, both inside the grace plus 300 ms; the router's unit tests cover the drain,
the 503 with `Connection: close`, and that a flight finishing inside the grace is never aborted, while the node-server tests keep the `stop()` path, the
no-op second stop, the bounded event stream, and the 1001 close frame. The DSH web server stack is not in this test: its own disposal destroys upgraded
sockets (the client saw 1006) and the frame does not use it.

The Windows frame timings from the three green runs on `af583d6c` (measure only, for the record): blank 4m53 / 5m40 / 8m58, agent 5m12 / 6m15 / 6m51, todo
4m44 / 5m07 / 6m49, notes 4m16 / 5m05 / 7m09, chat 4m34 / 5m33 / 7m07, nodejs 4m16 / 5m41 / 6m29. Every step grows roughly together rather than one path
growing, which reads as runner and install/network slowness (each step scaffolds and installs from scratch), not a gate code regression; not fixed here.

## 28. The Windows notice-check Chrome launch (branch 123, 2026-11-02)

Run 41440407757 on `d0e0561c` failed frame (windows-latest) at the blank gate: "headless Chrome did not open for the notice check (exit null)" after about two
minutes, with nothing after the colon. The cause was in the gate, in two parts. The notice check spawned Chrome with `stdio: 'ignore'` and attached its output
listeners to the resulting null streams, so the captured output was always empty - the diagnostics that claimed to show Chrome's last lines never could. And
the launch waited on a guessed port (9300 + random(300)) with a 600-iteration loop and no named bound, so a browser that never opened DevTools on that port
spun with a live child and no evidence.

Both launches (the notice check and the tile check) now go through `scripts/lib/door-probe.mjs`'s `startChrome`: a unique profile per launch,
`--remote-debugging-port=0` with the port read from the profile's `DevToolsActivePort` file (never a guess), `--enable-logging=stderr` with stderr captured,
and a bounded 60 s wait whose failure names the exit code, the DevToolsActivePort state and the last 8 KB of the browser's output, appends that to
`<tmp>/acryl-chrome-launch.log` (the frame job's failure artifact step uploads it with the net logs, only when a gate fails), and kills the whole process
tree (`taskkill /T /F` on Windows, the process group elsewhere) before failing. A parser test covers the DevToolsActivePort read; the blank gate passes locally
through the new launcher and the full check is exit 0.

Handoff: the full check is green on branch 123; the next step is the branch CI and, on the Windows frame job, either a green run or the captured browser output
naming whether it is Defender, a first-run dialog or a profile lock - the message and the artifact now exist for that answer. Three consecutive green CI runs
on one sha are the bar before reporting 123 green.

### The agent panel's silent Send (branch 123, same day)

Run 3's macOS agent gate failed with the panel present, drivers listed, empty log, Send enabled and Stop disabled; the gate-wide page capture added earlier showed only
warnings (a PTY WebSocket closed before it opened, and the sandbox notices), no exception - so nothing threw, and the submit handler's two silent early returns
(nothing typed, or a run already being followed) were the fit. The panel now says why it does not send ("Type a message first." / "A run is already going; stop it
first."), marks itself `data-ready` once its form is wired and `data-following` while a run is going, and the gate waits for the ready mark, types with the native
setter plus an input event, and prints the textarea value, ready and following at submit time in both the failure message and its panel detail. A guard test covers
the two refusal reasons. The capture result is part of the record: no exception was thrown, which ruled the half-wired-by-a-throw theory out before the change.

### Handoff (branch 123, 2026-11-02, at d18a3b40)

Where it stands: the Chrome-launch rewrite and the agent panel's guards/readiness/diagnostics are in and green locally (full check exit 0 on d18a3b40; CI run 41466529499 on
it passed every job except the macOS agent gate). That run reached a new failure: the panel step now passes, and the gate fails at the FINAL Settings open after the chat
step ("Settings did not open", 20 s of the look-first press loop, no page exception) - the same class as `94548f5d`'s notes red. Evidence: the page dump shows the hidden
upstream sidebar's Settings trigger and the frame's foot Settings both present, a chat session "Hello from the gate" in the tree, and no dialog; the first Settings open
(Models, before the chat step) passes.

Open hypothesis to test next: the DSH chat run from the gate's chat step may still be streaming when the final Settings open starts (either Settings does not open while a
run is active, or the dialog is closed by the chat surface). The product answer is fixed, not open: Settings MUST open while a run streams - a user changes models or keys
mid-run - so the gate must not paper over it by waiting for idle. Test it deterministically on this Mac instead of waiting for CI: make the mock model stream slowly (about
10 s), start a chat run, press the frame's Settings while it streams, and poll for dialogs plus both Settings triggers' disabled and aria-expanded state. If Settings does not
open during a run, that is a product defect in the frame (or a DSH behaviour to report), to fix at the cause; if it does open, the cause of the gate failure is elsewhere and
the dialog polling names it.

What is in the branch: `d0e0561c` (121: node-server graceful stop, router drain, whole-root tests, every package's typecheck in the gate); `3318719a` (startChrome: own port
from DevToolsActivePort, `--enable-logging=stderr` captured, bounded named failure, launch log artifact, whole-tree kill; parser test); `d18a3b40` (panel guards,
data-ready/data-following, the gate's human-style typing and submit diagnostics, client-guards test). Three consecutive green CI runs on one sha remain the bar; the count
restarts on the next push.

**Settings during a streaming run, reproduced and the livelock fixed (`73d52acf`).** The product question was settled first, with the mock's new
`ACRYL_GATE_STREAM_MS` switch holding the answer open: with a 10 s and then a 60 s stream, the final Settings open succeeded while the chat showed
`Stop generating` at the moment the dialog was found, so Settings does open during a run and the product answer holds. The CI failure was therefore the
gate's own open loop: it re-pressed every Settings-labelled button every 500 ms whenever no visible dialog was up, and on a slow runner a press that
landed before the dialog rendered toggled the just-opened panel closed again - a livelock that leaves exactly the recorded state (both triggers present,
no dialog, no exception, about forty presses in twenty seconds). The loop now presses once and waits up to 3 s for the render before another press is
allowed (six bounded attempts, about the old 20 s budget). A failure records the press count, each trigger's visible/disabled/aria-disabled/
aria-expanded/aria-haspopup state, the dialog list and the stop/send controls; a success logs the stop controls present when the dialog opened, so the
"opens during a run" fact is in the record of every green run.

**The blank gate's dialog that closed during its sections wait (run 41491427783 on `c85973d8`).** The Linux Node 22 check failed at the blank gate after
the open loop found a visible Settings dialog: the old 15 s sections wait found it gone, and the dump had no dialog content. The wait was reading
`document.body` and had no way to reopen, and the press pressed every Settings-labelled button in the left pane - the visible foot and the hidden upstream
trigger, both moving the same panel, so a second press in the same tick can toggle the just-opened dialog straight back shut. The step now reads the
dialog's own text, re-presses only when the dialog has vanished, and presses one trigger per attempt: the product's foot button first (its `openSettings`
path activates the DSH trigger itself), the hidden trigger as the fallback. Blank and agent gates pass on the final code; the three-run count restarts on
this push.

## 29. The agent panel in a page that is replaced (branch 124, 2026-11-03)

The frame gate's macOS agent job failed on main (run 41536717281) at the panel step: the submit state had an empty composer, no "me" line and no refusal, and
the surviving panel was a fresh one (ready `1`, Send enabled, Stop disabled). Two candidates were checked, as the coordinator framed them.

**The submit does not navigate the page.** The submit handler's first statement is `preventDefault()` (it has been since the visible-guards change), and
the form names no action. A jsdom test now pins both: the submit event is `defaultPrevented` and the form has no `action`, so a missed guard could only
submit to this page, never leave it.

**The page is replaced under the panel.** A run that changes files reloads the page (the panel's own post-run reload), and a mount replaces the panel; a
page that comes back must show the run it lost and keep the composer's draft. Two changes in `plugins/agent-panel/client/main.ts`: `start()` closes the
previous instance's run socket and removes the previous `#agent-panel` host, so one live panel exists and the readiness mark belongs to the instance being
wired now; and the composer's draft lives in `sessionStorage`, is restored before the form is wired and cleared when a submit sends it.

The two causes behind those guards were checked, as the coordinator asked. **A second `start()` on one page was not found**: the panel script is one tag per
HTML response (the middleware inserts it only when the response does not already carry `${PREFIX}/panel.js`), a module executes once per document, and
neither the router wrap, the door, nor the agent template names the script again - so the host removal stays as a defence, not a fix for a named caller.
**The follow does not race the record**: the server creates the run and its `current` before the ask response answers (`startRun`, then `follow` in
`plugins/agent-panel/index.ts`), so a page that reloads after that response always finds it in one question; the client's timed retry was removed rather
than kept. What a follow genuinely cannot recover is a run the app server restarted away - a file change the run made kills the in-memory run with the
process - and the answer then lives only in the page that was replaced; that is recorded as a known property, not papered over.

The gate's panel step now records what it submitted with: `typedAt`, the typed textarea's and form's `isConnected`, whether that textarea is still the
panel's current one, whether the host is the current `#agent-panel`, and the panel's log at submit and at failure. A recurrence then names a replaced page
or an unwired form instead of leaving an empty dump.

Tests: `plugins/agent-panel/test/panel-client.test.ts` (node:test with jsdom, pinned as a root devDependency at the lockfile's version). A submit is
prevented and says "Type a message first."; a remount leaves one host and keeps the draft; a page replaced mid-run shows the question and the answer again
from the one follow the server can answer.

State: branch `124-panel-reload` from `542cfaf2`; the full check and the three-run count follow.

**The panel's own reload, and the check-then-reload race.** The panel reloads the app's page after a run that installed or removed a plugin, because the new
feature is served by the running app. It decided that at the end of the run and reloaded 900 ms later, so a person (or the frame gate) who started typing in
that window had the page replaced under their text - exactly the empty-composer dump. The panel lives inside the app's own page (it cannot refresh the
frame's canvas from inside), so the page reload is the app's refresh; but the decision is now made at the moment of reloading, in
`reloadDecision({ value, focused, following })`: the composer must be empty, unfocused and no run still going. Every panel-initiated reload is recorded
before it happens - a warning the page's error report and the gate both see, and a marker in `sessionStorage` (`agent-panel-reload`, reason and time) that
the reloaded page keeps; the gate's panel snapshot and failure dump now read that marker.

Tests: `reloadDecision` is pinned for typing, focus and a running run; a change event while the composer holds text leaves the page and the text alone (no
marker); a change event with an idle, empty composer records the marker before reloading.

**Open ticket, not 124 work: the standalone app's `node --watch`.** The frame's generated dev script has no watcher
(`packages/cli/src/ide-profile.ts`: `dev: node --import ... scripts/ide-host.mjs`), so a run's file edits do not restart the frame's app server. The
template's own `npm run dev` for a standalone app runs `node --watch`, where a run that edits a watched file would restart the server and kill the
in-memory run; the panel would come back with no run to follow. That is a ticket for the standalone path (a durable run log, or the run in a process the
watcher does not restart), not this branch.

**State (2026-11-03, survives a compact).** Branch `124-panel-reload` from `542cfaf2`; commits `44d51a99` (draft, single host, diagnostics),
`efa29230` (restore once, no retry, causes checked), `749b35b3` (reload decided when it happens, marker + tests), `f70c9c96` (jsdom types). Proven:
the submit cannot navigate (preventDefault first, no form action, tested); the server records a run before answering the ask (no follow race); no
second `start()` caller exists (one tag per HTML response, one module execution per document - host removal is defence); the frame's generated dev
script has no watcher, so the frame's app server does not restart under a run; the panel's check-then-reload race is fixed and its tests pass (typing
during the change window leaves the page and text alone; an idle empty composer records the marker before reloading). Left: the full check on the
branch head (running), then push, then three consecutive green CI runs on one sha, then report. The gate's panel step (on this branch) records the
typed nodes' liveness and the reload marker, so a recurrence names a replaced page or an unwired form.
