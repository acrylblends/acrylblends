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

## 19. The Windows 10 ConPTY resize: a test child that never read stdin (2026-10-31)

The driver-pty suite's real-PTY resize test failed on mbpi9win (Windows 10 Pro `10.0.19045`): after the driver's resize the child kept its start size. A minimal repro outside the framework (node-pty `1.2.0-beta.15`, and `1.2.0-beta.18`; Node 24.18.0) compared two children of the same `pty.spawn(process.execPath, ['-e', script], { cols: 90, rows: 20 })` and the same `pty.resize(110, 35)` after 2.5 s:

- A Node child that never reads stdin: its `process.stdout.columns` and `getWindowSize()` stay `90x20`; its `resize` event either does not fire or fires with the old size.
- The same Node child calling `process.stdin.setRawMode(true)` and `process.stdin.resume()` (what claude, codex and pi do): its next tick reports `110x35`.
- A PowerShell child printing `[Console]::WindowWidth`/`[Console]::WindowHeight`: `110x35` from the next sample on.

`useConptyDll: true` only makes the spawn size current (a child started after the resize sees `110x35`); it does not change the live case. The node-pty version does not change it either.

Cause: the ConPTY console is resized by `pty.resize` in every case (the client repaints at 35 rows, and the console API reports the new size); Node's tty learns of the change through its console input handling, so a child that never reads its console input never sees it. The real programs the driver starts read stdin in raw mode, so the framed terminal is not limited on Windows 10; the test's ECHO program was the one that never read stdin. It now reads stdin in raw mode on Windows, like a real program, and keeps its POSIX behavior (SIGWINCH reaches Node there). If a Windows host ever again delivers no resize to the child, the test skips with this section as the reason rather than passing silently.

The suite keeps the platform's evidence as it is: the new size where `resize` fires, or the console's `ESC [ 8 ; rows ; cols t` report where it appears.
