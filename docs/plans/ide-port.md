# Plan: the ACRYL IDE in the framework

Status: a plan for the owner to review. No code has been written. Facts are from `/acryldev/acryl` at `main` 9073312d (specs 040, 043, 048; `plugins/`, `runtime/`, `apps/`, and `deepseek-harness` 0.2.0-rc.2) and from this repository at 1.1.0. Numbers marked "estimate" are guesses by the agent that would do the work, in agent hours (one agent, working alone, including the gates); they are the least certain part of this page.

## What is being asked

The owner's direction: the ACRYL IDE becomes framework plugins, **ported as source with its tests** (provenance recorded, the original suites passing), not rebuilt: the workspace, PTY terminals running `claude`, `codex` and `pi` as they are, DeepSeek Harness (DSH) chat mode as the chat driver, and ACRYL's design. An app made with `create-acrylblends` opens inside that IDE. The door stays.

The panel in the `agent` template (a chat dropdown over headless `-p` runs, plus the optional terminal tab of `driver-pty`) is what this replaces for IDE apps. It is frozen until this plan is decided.

## What exists, and what already runs on the framework

Spec 048 already moved the IDE's **host half** onto this framework's router (`new Acryl()` per capability, `ctx.router.route`, `routerHttp.mount`, `loopback-only`, `bearer-auth`, `body-limit`, `streaming`). `acryl-workspace`'s `git`, `files`, `pty`, `projects`, `agents`, `folder-picker`, `shared-context` and `capabilities` import `acrylblends` and no DSH. The terminal is `node-pty` + `@xterm/headless` (+ serialize, so a reconnecting tab gets the screen) + `ws`, with the agent catalog (`claude`, `codex`, `pi`, ... with launch command, "yolo" flags, install page) in `src/agents`.

What is still tied to DSH is the **client half** (202 files, 19k lines in `acryl-workspace`, plus `acryl-app-shell`, `acryl-ui`, `acryl-shortcuts`, `acryl-sign-in`, the brand occupants): it is a DSH web-client plugin. It registers into DSH's client services (`ctx.slots.register` x10, `ctx.sidebarRightTabs.register` x5, `ctx.workspaceTabs.register` x2, reads `sessions` and `sidebarRight`), it is built into one `client.js` that DSH's module loader evaluates, and its chat tile is DSH's conversation UI (`client/chat/chat-selection.ts` treats DSH's main-view session as the source of truth).

## 1. What provides slots, tabs and the conversation UI

**Decision proposed: the framework owns the small client contract, ported with the same names; DSH stays the chat engine and the conversation UI, as a dependency.**

The client contract is small. Measured in DSH 0.2.0-rc.2:

| Package | Files / lines | Role |
| --- | --- | --- |
| `dsh-client-ui-slots` | 3 / 1,964 | the slot registry core: `SlotMap` declaration merging, `register` contributes a component and may declare child slots, a store seat and locale; zero runtime dependencies (React types) |
| `dsh-client-store` | 2 / 393 | the props stores the slots bind |
| `dsh-client-ui-renderer` | 10 / 2,478 | renders the slot tree |
| `dsh-client-modules` | 7 / 2,473 | the module loader that evaluates plugin `client.js` files |
| `dsh-client-web` | 12 / 818 | the page shell |
| `dsh-client-connection` | 16 / 2,364 | the page's connection to the host (typed RPC over a WebSocket) |
| `dsh-client-locale`, `-shortcuts`, `-resources` | 11 / 956, 13 / 1,245, 4 / 371 | services the ported client plugins read |

About 12,000 lines in all; each would be ported with its tests and a `provenance.json`, under the names the ported `acryl-workspace` client already registers against, so that client registers **unchanged**. That is the point of keeping the names.

The conversation UI is not small and is not ours: `dsh-client-ui-conversation` (71 files, 12.7k lines), `dsh-client-ui-chat` (93 / 12.4k), `-primitives` (87 / 12.8k), `-tool` (42 / 4.7k), `-trajectory` (31 / 9.4k), `-user-questions`, `-approval`, `-attachment`, `-input-trigger`, `-model-selection`, `-plan`, `-subagent`, over the session engine (`dsh-api-session-controller` 34 / 8.3k, `dsh-api-gateway` 5.2k, `dsh-session`, `dsh-agent`, `dsh-llm`, `dsh-tools`). Rewriting that is the "shitty chat window" outcome the owner rejected; depending on it is cheap in our lines and expensive in coupling. DSH is Cordis-based on the same `@deepseek-ai/cordis` ^4.0.2 as the framework, so its plugins can load in the same context as the app's; ACRYL's `acryl-harness-runtime` (53 files, 7.9k lines, `dsh-app-boot` x7) is the existing example of composing them.

**Alternative, not proposed:** let the framework own chat too (a new conversation UI). Rejected for the reason above.

**Open: how the page is built.** The framework's `clientModules` compiles TypeScript on request and rewrites three framework imports; it does not bundle npm packages. The IDE client needs React 18, CodeMirror 6 and xterm (the 3.3 MB `client.js`). So the IDE needs a bundling step, either a pre-built `client.js` per plugin served to the ported module loader (what DSH does, and what ACRYL ships today), or a bundler in the dev loop. Slice 0 decides this with a measurement.

## 2. Slices, each usable on its own

The door stays in every slice: `acryl look/act/window/menu`, the audit log, the loopback and per-run secret rules, and the "agent is driving" bar. The agent drives the IDE's own pages as it drives any page (each document with the door script connects as a page; the asking-page rule of 1.1.0 keeps it from driving the wrong one).

| Slice | What you can do when it lands | Contents | Estimate |
| --- | --- | --- | --- |
| 0. Spike and foundation | nothing new for an attendee; the decision record | a page served by the framework that loads the ported slot registry, store and renderer, loads one ported `client.js`, and boots DSH's session host in the same Cordis context under `acryl-node-server`; measures bundle size and cold start; decides the build step (above) and the DSH pin | 16-24 h |
| 1. Workspace shell with PTY terminals | open the app, add a project, open tabs, run `claude`, `codex` or `pi` as they are in a terminal tile, split, several worktrees | port `acryl-workspace` host (`git`, `files`, `pty`, `projects`, `agents`, `folder-picker`, `shared-context`, `capabilities`) and the client shell (`canvas`, `tabs`, `dock`, `projects`, `worktrees`, `terminal`, `agents`, `palette`, `chrome`) with their tests; `acryl-app-shell`; the app itself as a browser tile | 24-36 h |
| 2. DSH chat tile | chat with DSH (any model DSH is configured for) next to the terminals, sessions listed in the Projects and Chats pane | the conversation UI and session packages as dependencies, the chat tab/selection code, the model settings DSH already has | 30-50 h |
| 3. Files, diff, changes | edit files (CodeMirror), see diffs, stage and commit, review threads, checks, the Kanban board, docs | the right-panel tabs and tiles of `acryl-workspace` | 16-24 h |
| 4. Design | ACRYL's look: tokens, components, brand, shortcuts, settings | `acryl-ui` (64 files, 6.1k lines; wraps DSH's primitives and theme), `acryl-brand`, `dsh-client-ui-brand-acryl`, `acryl-shortcuts`, `acryl-settings`, light/dark following the app's appearance | 12-20 h |
| 5. Sign-in | connect a provider by account (OAuth) from Settings > Models: Claude, ChatGPT/Codex, DeepSeek account | `acryl-sign-in` (11 files, 1.1k lines, its loopback callback); keys and tokens stay in the agent's or DSH's own store, never in the page or the app folder | 8-12 h |
| 6. Template and create flow | `npm create acrylblends@latest my-app ide`, `npm run dev`, the IDE opens with the app inside | template, `acrylblends upgrade` path, docs, gates (real Chrome, real Electron, Windows), the workshop guide's blocks | 12-20 h |
| Electron (parallel to 5-6) | the IDE in a desktop window | see section 4 | 8-16 h |

Total, estimate: about 130-200 agent hours. Slice 2 is the widest range because it is the one that depends on DSH behaving the same inside the framework as it does in ACRYL; slice 0 exists to shrink that range before anything else is spent. Slices 3, 4 and 5 can be reordered after 1; slice 2 can move ahead of 1 if the owner wants chat first (it then lands in a plain three-column frame).

Each slice ends with: the original tests of what was ported passing, new tests for the seams, `provenance.json`, the gates run in a real browser, a release note, and a walk on macOS (and Windows for slice 1 and 6) before the next slice starts.

## 3. What the attendee runs

```
npm create acrylblends@latest my-app ide
cd my-app
npm run dev
```

`ide` is the template name: it says what you get. `npm run dev` starts the app and the IDE together and opens the IDE; the app (its pages, `/board`, `/settings`) is shown in a browser tile inside it, and in the desktop shell it is the same. The agent terminals (`claude`, `codex`, `pi`, any program) start in the app folder with `.acryl/bin` on the PATH, so they build through the door. The `agent` template stays for people who want the small app with its own agent and no IDE. Production is unchanged in kind: the IDE and the door are development tools and start nothing under `NODE_ENV=production`.

## 4. Electron

Two shells exist: this repository's `plugins/desktop` (about 1,100 lines: windows, cascade, `window`/`menu` door verbs guarded against ending the session, Settings menu item, user data, shutdown; gated in real Electron on macOS, Linux and Windows) and ACRYL's `apps/acryl-desktop` (111 files, 21k lines; 16 files import `electron`: `main.ts`, `preload.ts`, `native-menu`, `window-options`, `tray-icons`, `electron-platform`, `electron-reveal`, startup recovery window, profile-create window, workspace admission). Most of the rest of it is DSH boot and host wiring that the framework does not need.

Proposed: **keep `plugins/desktop` as the shell** (it has the door verbs and the gates), and port from ACRYL only what the IDE needs of Electron: the native menu, the window options and chrome metrics (the app frame reserves title-bar space per platform), tray icons, reveal-in-folder, and the native folder picker that `acryl-workspace` already isolates behind a seam (`projects-control.ts`). `acryl-workspace`'s own rule, "nothing here may import Electron", stays. Everything else in `apps/acryl-desktop` stays in ACRYL.

## 5. Risks

- **DSH pin.** DSH is 0.2.0-rc.2 and moves; `acryl-workspace`'s peers are pinned to that exact rc. Porting the client contract under its names makes drift visible (the ported tests fail) but does not stop it. The pin and an upgrade routine (what to re-run when DSH moves) go in slice 0. Licence: DSH is MIT, so porting and depending are both allowed; the framework's rule that the upstream name appears only in LICENSE files applies to the ported web framework, and provenance for DSH-derived files names DSH as the source, which needs the owner's decision on wording.
- **Bundle size and cold start.** `client.js` is about 3.3 MB because the module loader evaluates one file and CodeMirror's language packs are inlined; DSH's own conversation UI adds to it. Slice 0 measures it on a cold start and on the workshop's slowest laptop class; options are curated language packs and lazy-loaded tiles.
- **`node-pty` on Windows and the install.** `node-pty` 1.2.0-beta.15 is native with an install script; the earlier workshop walks hit its allow-scripts warning, and Windows needs prebuilt binaries or a compiler. The existing `driver-pty` gate runs on `windows-latest`; slice 1 keeps that gate and adds the workspace's terminal to it. A fallback (a clear message and the headless run) is needed for a machine where it cannot install.
- **Two documents with the door script in one window.** The app inside a browser tile is a second page in the IDE window. The asking-page rule keeps the agent on the right one, and the tile must be a same-origin frame; slice 1 tests it in real Chrome and Electron.
- **Chat engine inside the app's process.** DSH's session host brings its own home folder, models configuration and sandbox. Where it stores what (keys, OAuth tokens) must stay out of the app folder, `.acryl`, the audit log and anything `make-entry` or the production build packs; a test proves it, as for any connection.
- **Scope.** This is the biggest piece of work this repository has had; the freeze for the workshop (2026-11-20) applies: nothing of it ships before the workshop unless the owner says the workshop is on `ide`. A slice 0 and 1 result is plausible by then; the whole is not.
- **Provenance and tests.** "Ported with tests" means the original suites run here, unmodified except for import paths; a test that cannot run because it needs DSH's host is recorded as such, not dropped.

## 6. Estimates

See the table in section 2. Slice 0 first (16-24 h) is the cheapest way to turn the biggest unknowns (build step, DSH in the framework's context, bundle size) into measurements before the owner commits to the rest.

## Decisions needed from the owner

1. The framework owns the client contract (slots, store, renderer, module loader) under DSH's names, and DSH's conversation UI is a dependency (section 1).
2. Slice order, in particular whether chat (slice 2) goes before the workspace shell (slice 1).
3. Electron: `plugins/desktop` stays the shell, with the listed pieces ported (section 4).
4. The wording of provenance for DSH-derived source.
5. Whether the workshop of 2026-11-20 stays on the `agent` template, or waits for slice 1.
