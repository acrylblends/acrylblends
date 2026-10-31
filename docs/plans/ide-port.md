# Plan: the ACRYL frame and IDE in the framework

Status: amended after slice 0 (`ide-slice0.md`, the decision record, with measurements) and after the owner's direction on 2026-10-30. A plan for the owner to review; slice 0 is the only part built, on a branch, with nothing released. Estimates are the agent's own, in agent hours (one agent working alone, gates included); they are the least certain part of this page.

## What the owner asked for

1. ACRYL's IDE becomes framework plugins, **ported as source with its tests** (provenance recorded, the original suites passing), not rebuilt: the workspace, PTY terminals running `claude`, `codex` and `pi` as they are, DeepSeek Harness (DSH) chat mode as the chat driver, ACRYL's design. The door stays.
2. **The ACRYL frame is the base of every app**, not an `ide` template beside simpler ones. Every app made with `create-acrylblends` (the `blank` template included) starts inside it: `acryl-app-shell`'s three columns (a left sessions and projects panel, the main surface, a right panel, each collapsible and resizable, and remembered), ACRYL's Settings screens (the same sections, rows and controls), its design (`acryl-ui`, brand, light and dark) and its shortcuts. The app's own pages render in the main surface. "Minimal" means few panels filled, never a different and simpler UI.
3. **Predictable means the same positions, toggles and shortcuts as ACRYL.** Behaviour is ported, not reinterpreted, and each slice is compared against screenshots of ACRYL's own desktop taken as the reference.

The panel of the `agent` template (a chat dropdown over headless runs, an optional terminal tab) is frozen and is replaced by the frame for every app; nothing more is built on it.

## What slice 0 settled

Details and numbers are in `ide-slice0.md`; the decisions that shape the rest of this plan:

- **DSH hosts the application.** DSH's own rule is that supported Node applications launch through named `dsh` profiles. The app's server is `dsh --profile <app> --patch <overlay>`; the framework (`acrylblends`, 1.1.0 in the spike) is added to the profile with DSH's own `dsh plugin add`, and its router, `routerHttp`, the app's plugins and DSH's `sessions` service run in **one Cordis context**. Proved with ACRYL's real workspace shell: all rows activated, the frame and a Settings screen render, a terminal tab answered a typed command through a real PTY.
- **The framework does not port DSH's client contract.** The first version of this plan had the framework own ported copies of the slot registry, store, renderer, module loader, page shell and connection (about 12,000 lines). With DSH hosting, those are DSH's npm packages, and the ported ACRYL client plugins register against them as they do in ACRYL.
- **There is no bundler in the app.** DSH serves each plugin package's prebuilt `lib/client.js`. A ported ACRYL plugin is an npm package built at publish time with this repository's `tsdown`, which makes a `client.js` byte-identical to ACRYL's own from the same source (shown for the brand plugin).
- **The chat is DSH's.** It arrives with `dsh` (its conversation UI and session engine, over 289 `@deepseek-ai/*` packages); ACRYL only themes it and tabs it.
- Costs: the install is 523 MB (18 s warm, 57 s cold), the page is 7.4 MB on the wire (17 MB decoded), cold start 1.4 s, load 0.6 s on loopback.

## 1. The frame, the client contract and the conversation UI

| Part | Where it comes from | Port work |
| --- | --- | --- |
| Slot registry, store, renderer, module loader, page shell, connection, locale, shortcuts service | DSH's npm packages (pinned) | none |
| Conversation UI and session engine (chat) | DSH's npm packages | none; connect models (slice 3) |
| The frame: `acryl-app-shell` (13 files, 1.1k lines) | ACRYL source | port with tests |
| Design: `acryl-ui` (64 files, 6.1k lines), `acryl-brand`, `dsh-client-ui-brand-acryl` (ported in the spike) | ACRYL source | port with tests |
| Settings: `acryl-settings` (service), the Settings screens ACRYL adds to DSH's (`Agents`, `Tabs`, `Command palette`, plugin lifecycle in `acryl-plugin-admin`), `acryl-shortcuts` | ACRYL source | port with tests |
| Workspace: `acryl-workspace` (host half 8 folders, client half 15 folders; 202 files, 19k lines), the terminal (`node-pty`, `@xterm/headless`, `ws`), the agent catalog | ACRYL source | port with tests |
| Sign-in (OAuth for Claude, ChatGPT/Codex, DeepSeek account): `acryl-sign-in` | ACRYL source | port with tests |
| The door: `acryl-door` (this repository) | this repository | adapt to DSH's host (below) |
| `appInstance`, `acrylWeb` | 15 lines each over DSH's `webServer` | become small framework plugins |

**Where the ported packages live.** They are npm packages with a `dsh.client` declaration, built at publish time, so the repository holds their source and tests under a folder of their own (not `plugins/`, whose contents are copied into apps as source) and the publish pipeline builds and verifies them like `acrylblends`. Which npm names they publish under is an owner decision (below).

**The app's own pages and code.** In the frame's main surface an app's pages can be shown in a browser tile (served at root paths by `routerHttp`; works today) or, for a native look, be client plugin rows built with the same `tsdown` recipe. Slice 1 decides which one the templates use; the first is enough for the existing templates.

## 2. Slices, each usable on its own

The door stays in every slice. Every slice ends with the original tests of what was ported passing, new tests for the seams, `provenance.json`, the gates in a real browser, a release note, a macOS walk (Windows for slices 1 and 2 and 6), and a **screenshot comparison with ACRYL's own desktop** for the views the slice adds.

| Slice | What you can do when it lands | Contents | Estimate |
| --- | --- | --- | --- |
| 0. Spike | nothing new for an attendee | done: `ide-slice0.md` | about 5 h (spent) |
| 1. The ACRYL frame and Settings | every app opens inside ACRYL's frame: collapsible, resizable, remembered panels, Settings with ACRYL's sections, light and dark, shortcuts; the app's pages in the main surface; the door works in it | `acryl-app-shell`, `acryl-ui`, `acryl-settings` and its screens, `acryl-brand`, shortcuts, the brand client (done in the spike); the `dsh` profile and overlay the templates generate; `acrylWeb` and `appInstance` plugins; the door adapted to the host (its page script through DSH's index-inject hook, `acrylWeb` in place of `nodeServer`); the publish pipeline for client packages; first run without DSH's two dialogs in the way | 24-36 h |
| 2. Workspace and PTY terminals | projects, tabs per worktree, split, `claude`, `codex` and `pi` as they are in terminal tiles, the agent catalog | `acryl-workspace` host and client (with the git, files, projects folders it contains) and its tests; `node-pty` allowed in the profile; Windows | 24-36 h |
| 3. DSH chat | chat with DSH next to the terminals; sessions in the left panel; connect a model (API key now, OAuth in slice 5) | DSH's conversation UI is already in the page; the work is connection, first run, session persistence, the chat tab selection, model settings in the ACRYL frame | 8-16 h |
| 4. Files, diff, changes | edit files (CodeMirror), diffs, stage and commit, review threads, checks, the board, docs tabs | right-panel tabs and tiles of the workspace: they come with slice 2's port, so this slice is tests, gates and the screenshot comparisons | 8-16 h |
| 5. Sign-in | connect a provider by account (OAuth) from Settings > Models; keys and tokens stay in DSH's or the agent's own store, never in the page, the app folder, `.acryl`, the audit log or what `make-entry` and the production build pack | `acryl-sign-in` (11 files, 1.1k lines); the test with a fake agent that does a browser-style login and shows the state moving; no token string in any file | 8-12 h |
| 6. Templates | `npm create acrylblends@latest my-app <template>` for every template starts in the frame; `blank` is the frame with the main surface nearly empty; `acrylblends upgrade` moves an existing app onto it | the generated profile and overlay per template, the upgrade path, docs, gates (real Chrome, real Electron, Windows), the workshop guide's blocks | 24-36 h |
| Electron (alongside 5 and 6) | the frame in a desktop window | section 4 | 8-16 h |

Total: about 105-170 agent hours after the spike (the earlier estimate was 130-200 with the client contract to port). Slices 3 and 4 can move after 5 if the owner wants OAuth first; slice 1 cannot move: everything else needs the frame.

### Slice 6 decisions (2026-10-31, before the code)

- **The frame stays at `/`; the app's routes mount at `/app`** in the frame host, and the tile opens the app's page there. Moving the frame's URL would move DSH's own page, the index-inject tap and the door's target; the app is the content, so it takes the prefix.
- **The prefix lives in one place per template and is empty outside the frame.** Production runs the app on its own server on its own port, so its public URLs do not move; a template test asserts that an app built with prefix `''` serves its old URLs (`/`, `/about`, `/health`), and the boot gate asserts the same routes answer through the frame at `/app`.
- **The app's page in the main surface is ACRYL's own canvas browser tile** (`acryl-workspace`'s `BrowserPane`, offered by the tab strip as "New Browser Tab"), not DSH's `ui-sidebar-browser`. That package registers a tab type for DSH's **right sidebar** (`sidebarRightTabs`), while the owner's requirement is the main surface, which is the workspace canvas; the frame's right panel is the workspace's Files/Changes/Review, so enabling DSH's row would add a second, different surface and change the frame away from ACRYL.
- **The agent template keeps its own page and agent panel** inside the tile; the plan's "the panel is frozen and replaced by the frame" is a post-workshop direction (the workshop's guide depends on the panel), recorded here as a follow-up: after the workshop, the agent template's panel gives way to the frame's chat, nothing else moves. DSH's chat remains beside the tile.
- **The frame's port is the app's own preference:** `npm run dev` passes `ACRYLBLENDS_PORT` to DSH's web app as `--port` (0 lets the OS pick a free port; unset keeps DSH's 3080), so two frames, or a gate beside a person's running app, never fight over one port. The gate sets 0.
- **The frame's rows load the app's own source:** the generated `dev` script starts DSH through the app's JSX preload (`plugins/acryl-node-server/src/register.ts`), because a template page written in `.tsx` must compile in the host's process too; without it the app's frame row fails to import ("Unknown file extension .tsx").
- **Every template ships the door** (its source in the app folder, mounted only by the frame's overlay in development; `npm start`/production composes the app's own server and mounts no door row), so an agent working in the app can drive the frame the way the workshop teaches.

### How a slice is compared with ACRYL

`scripts/frame-compare.mjs` takes screenshots of a running app at the views and viewports named in `scripts/frame-views.json` (the frame, dark and light, the left panel collapsed, the right panel open, Settings general, models and shortcuts, a terminal tab; 1440x900 and 1024x768) and puts each one beside the ACRYL reference with a difference image (`capture`, `compare`, and `check` for both). It passes a view when at most 2% of the pixels differ, fails when the sizes differ or a reference view has no candidate, and exits 1 on any failure, so a slice's gate can call it. The reference set is ACRYL's own desktop, taken at the same names (`<view>@<width>x<height>.png`); until it arrives the harness is checked against itself (the same app twice: 0.00% on every view; dark against light: 99.9%, exit 1). The package list with exact dependencies, and the one peer-dependency change, is generated by `scripts/ide-port-inventory.mjs` into [ide-port-packages.md](ide-port-packages.md).

## 3. What the attendee runs

```
npm create acrylblends@latest my-app agent
cd my-app
npm run dev
```

Every template name now says what the app does, not what UI it has: the UI is always the ACRYL frame. `npm run dev` starts DSH with the app's profile and opens the frame with the app in it; the agent terminals (`claude`, `codex`, `pi`, any program) start in the app folder with `.acryl/bin` on the PATH so they build through the door. The install is bigger than today's (about 520 MB, one minute cold): a pre-warmed package store for the workshop is part of slice 6. The frame, the door and the agents are development tools; production serves the app's routes and pages without them, as today.

## 4. Electron

DSH has its own desktop shell; ACRYL's `apps/acryl-desktop` (111 files, 21k lines, 16 files import `electron`) is built around it, and this repository's `plugins/desktop` (about 1,100 lines) is a smaller shell with the door's `window` and `menu` verbs, gated on three platforms. Proposed: **keep `plugins/desktop` as the shell** and port from ACRYL only what the frame needs of Electron: the native menu, the window options and chrome metrics (the frame reserves title-bar space per platform), tray icons, reveal in folder and the native folder picker the workspace isolates behind a seam. It loads the same page DSH serves. The rest of `apps/acryl-desktop` stays in ACRYL. Slice 0 did not run Electron.

## 5. Risks

- **The DSH pin.** `@deepseek-ai/dsh` 0.2.0-rc.2, exactly; DSH says its APIs are pre-stable. The upgrade routine (a script that boots the new DSH next to the same framework and fails loud if rows, the page or the terminal break) is in `ide-slice0.md`. A bump is an owner decision.
- **Install size and time.** 523 MB and 289 packages for `dsh` alone; cold 57 s on a good link, much worse on workshop Wi-Fi. Mitigations in slice 6: a pre-warmed store on the workshop network or a drive, a lockfile, one command that prints what it is doing.
- **The page.** 7.4 MB on the wire, 17 MB decoded, 50 MB of JS heap: fine on a laptop, slow once on a bad link; the browser caches it. The workspace bundle (4.0 MB raw) can be trimmed (CodeMirror language packs) if it matters.
- **`node-pty` on Windows.** The profile's pnpm refuses its install script until `allowBuilds` says yes, and Windows is the platform that needs the script. Slice 2 runs the existing `windows-latest` gate on the workspace terminal and gives a clear message and the headless run as the fallback.
- **The door in DSH's host.** The door's host half and page script need the adaptation described in slice 1; it is the largest single item there. Until it is done an agent cannot drive the frame.
- **Two documents with the door script in one window.** The app inside a browser tile is a second page; the asking-page rule of 1.1.0 keeps the agent on the right one; slice 1 tests it in real Chrome and Electron.
- **Keys and tokens.** DSH's home and the agents' own configs hold them. A test proves none reaches the app folder, `.acryl`, the audit log, or anything `make-entry` or the production build packs (slices 3 and 5).
- **Sameness with ACRYL.** The owner's rule is the same positions, toggles and shortcuts. The reference is screenshots of ACRYL's own desktop; **it did not boot from its checkout during slice 0** (the ACRYL side is fixing its boot), so the comparison starts when they send the reference set. Without it a slice can only be compared with itself.
- **Scope and the workshop.** This is the largest piece of work the repository has had. The workshop of 2026-11-20 stays on the `agent` template unless the owner decides otherwise; slice 1 plausibly lands before it, the whole does not.

## Decisions needed from the owner

1. DSH hosts the application (the `dsh` profile is the app's launcher), the framework is rows of it, DSH's client packages are the contract and its conversation UI is the chat (sections "What slice 0 settled" and 1).
2. The names the ported packages publish under, and where their source lives in the repository.
3. The order of slices (frame and Settings first, as asked).
4. Electron: `plugins/desktop` stays the shell (section 4).
5. Provenance wording for source derived from ACRYL and DSH (both MIT).
6. Whether the workshop stays on the `agent` template.
7. A reference set of ACRYL desktop screenshots for the comparisons.
