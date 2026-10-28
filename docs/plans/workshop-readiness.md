# Workshop readiness: the newcomer path on 1.0.0 (macOS walk)

Walked 2026-10-28 on the published packages, exactly as an attendee would: only the **npm page** (`npmjs.com/package/acrylblends`, which
carries the README in the 1.0.0 tarball) and **acrylblends.github.io/docs**, plus what the CLI itself prints. Nothing was read from the
repository to decide what to type; the repository was read afterwards, to check the claims.

- **Versions walked:** `acrylblends` 1.0.0 (latest), `create-acrylblends` 1.0.0 (latest), `acryl` 0.2.5 (latest, the CLI). `acrylblends@0.4.1`
  (create-acrylblends) for the 0.11.0 app in step 8.
- **Host:** macOS 25.6 (arm64), Node v24.19.0, npm 11.17.0.
- **Isolation:** a throwaway root, `HOME` and `npm_config_cache` pointed inside it, so no real app home and no user npm cache were used:
  `S=/tmp/workshop-walk-1937; export HOME=$S/home npm_config_cache=$S/npm-cache npm_config_prefix=$S/npm-global`. Every server was started on
  its own port, stopped afterwards, and every port checked free.
- **The other two walks.** DS2 (Windows, mbpi9win) and Fork3 (Linux, z370n scratch) replay this document. The `OS` column marks where a
  command or a path differs; everything else is the same on all three. The macOS-only commands are the three below.

| | macOS (this walk) | Windows | Linux |
| --- | --- | --- | --- |
| Shell for the exported variables | `export HOME=… npm_config_cache=…` | `$env:HOME=…; $env:npm_config_cache=…` (PowerShell) or `set` in cmd | same as macOS |
| Kill a dev server | `lsof -nP -iTCP:<port> -sTCP:LISTEN -t` then `kill` | `netstat -ano | findstr :<port>` then `taskkill /PID …` | `lsof` as macOS |
| Desktop user data | inside the app: `<app>/.acrylblends/electron` | same | `~/.config/Electron` or inside the app: check `<app>/.acrylblends/electron` |
| Electron window | opens automatically | same | needs a display; the walk assumes a desktop session |

## The walk, step by step

Times are wall clock on this Mac with a **warm** npm cache after the first create; the cold first create is noted.

| # | Step | Command | Expected | Got | Time (s) | OS |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | Preconditions | `node -v`, `npm -v` | 22.19+ | v24.19.0, npm 11.17.0 | - | - |
| 1 | Create six apps | `npm create acrylblends@latest app-<t> <t>` for `blank nodejs notes chat todo agent` | an app, next steps printed | all six created; `Next:` block printed **twice**; blank cold 10.3, the rest 1.7-2.9 | 1.7-10.3 each | - |
| 2 | Install | `npm install` in each | 0 vulnerabilities | 15 packages for blank; 0.8-3.2 | 0.8-3.2 | - |
| 3 | Test | `npm test` | all pass | blank 5, nodejs 8, notes 15, chat 10, todo 6, agent 10; 0 fail | 0.5-2.1 | - |
| 4 | Typecheck | `npm run check` | clean | clean (tsc, and `check-deps` where present) | 2.6-4.0 | - |
| 5 | Run + change | `npm run dev`, open the printed URL, add one route to the app's route file, save | the page answers, the route answers after the reload | all six ran; `node --watch` restarted on save; the new route answered; blank 3437, nodejs 3801, notes 3938, chat 3167, todo 3564, agent 3955 | boot 1-3 | - |
| 6 | Desktop | `npx acrylblends init app-desktop --desktop --template nodejs`; `npm install`; `npm run desktop` | a window on the app's own server | window opened, served `http://127.0.0.1:3260/` (200), Electron user data under `app-desktop/.acrylblends/electron`; quit cleanly, port free | init 2.9, install 3.2, boot ~20 (first Electron download) | display needed |
| 7 | Registry pull | `npm i -g acryl`; `acryl new app-gtd --from acryl.gtd` | an app from the starter `acryl.gtd` | **refused**: `acryl: acryl new needs the ACRYL framework checkout for now …` (exit 1) | 12.4 + 0.9 | - |
| 8 | Registry publish | clone the registry, add `registry/blends/workshop.demo/{blend.yaml,plugins/,README.md}`, `bun <blends-core>/src/bin/registry-index.ts registry --check`, then the same without `--check` | the check refuses a stale index, the tool writes it, the check passes | first `--check`: refused the entry on a YAML error (an unquoted `:` in the description); after quoting: `registry/index.json is stale: run blends-registry-index registry` (exit 1); the tool wrote it; `--check` exit 0 | clone 1.6, install 1.0, each run <1 | - |
| 9 | Built-in agent | in the `agent` template: `npx acrylblends add agent-panel driver-pty`, add two rows to `blend.yaml`, register both in `src/app.ts`, `npm install`, `npm run dev`, `GET /api/agent-panel/session`, `POST /api/agent-panel/ask` with driver `codex`, message: add `GET /agent-built` to `src/routes.ts` and run the tests | the panel lists drivers, codex edits the app, the page reloads | drivers `agent`, `claude`, `codex` (chat) and `pty:claude`, `pty:codex`, `pty:pi` (terminal); codex applied the patch, the app auto-reloaded, `GET /agent-built` → `{"built":true}`; the ask stream was still running at 240 s | add 1.7, codex ~4 min | user's own `~/.codex` login |
| 10 | Upgrade | an app from `npm create acrylblends@0.4.1 app-old nodejs` (acrylblends ^0.11.0): `npx acrylblends upgrade --dry-run`, `npx acrylblends upgrade`, `npm install`, `npm test`, `npm run check` | the plan, the upgrade, then green tests | `npx acrylblends upgrade` printed the **0.11.0 help** and exited 0 (see F2); `npx acrylblends@latest upgrade` printed the plan (acryl-router 1 updated, acryl-door 1 updated), the real run upgraded them and set `^1.0.0`, after `npm install` 8/8 tests and `check-deps` clean | create 0.6, install 1.9, test 1.8 | - |

Isolation, checked at the end: no process of the walk was left running, every port free (3437, 3801, 3938, 3167, 3564, 3955, 3260), the real
`~/Library/Application Support/ACRYL*` unchanged (10 entries, same mtimes), `~/.acryl`, `~/.acryl-dev` and `~/.acryl-instances` untouched. One
exception worth recording: the codex driver needs the user's own login, so `~/.codex` was symlinked into the scratch `HOME` for step 9; an
attendee has it in place already.

## Frictions, ranked

### Blockers (a workshop cannot proceed as written)

**F1. Pulling a starter from the registry does not work with the published CLI.** `acryl new my-app --from acryl.gtd` exits 1 with
`acryl: acryl new needs the ACRYL framework checkout for now (its launcher, scripts/blank.mjs, is not part of the published CLI yet)`.
Promised by the npm page (`README` "Start from the registry", lines 103-115) and by the registry page on the site
(`acrylblends.github.io/blends` and its `registry/README.md`, both showing `acryl new my-app --from <id>`). `create-acrylblends` is not an
alternative: it takes a `github:`/`@scope/`/`.tgz` source and requires an `acryl.template.json`, which registry starters do not have
(`docs/framework/guides/create-acrylblends.md`, "Start from a template"). **Nothing in the published set can create an app from a starter.**

**F2. The documented upgrade command is a silent no-op inside a 0.11 app.** `npx acrylblends upgrade --dry-run` resolves to the app's own
installed 0.11.0 CLI, which has no `upgrade` verb: it prints the old help text and exits 0, so nothing happens and nothing says so. The
working form is `npx acrylblends@latest upgrade`. Documented in `docs/framework/cordis/migration-to-1-0.md` lines 11-12 and in the npm page
(`README` "Keep the framework current", lines 133-139). A newcomer would believe the app was upgraded.

### Confusing (a workshop loses 10-20 minutes each)

**C1. `acrylblends add agent-panel` leaves the panel silently absent.** The command copies the plugin and prints "add a row … and register it
in `src/app.ts`", but the panel also needs rows for `agent` and `extensions` (its `inject`), and nothing says so: the app boots, and
`GET /api/agent-panel/session` answers 404 with no message anywhere. On the `blank` template the panel cannot be added at all, because
`model`, `tools` and `memory` (rows of the `agent` template) are not in the plugin library. The instruction text lives only in the command's
output; no page in `docs/framework` covers adding the panel to an app (`docs/framework/agents/index.md` describes the agent template, and
`guides/production.md` describes its switches). The working base for step 9 was the `agent` template plus two hand edits.

**C2. The agent needs the user's own login.** With an isolated `HOME` the panel offered `codex` as a chat driver but the run would have failed
to authenticate; only after linking `~/.codex` into the scratch home did it work. Same for `claude`. Nothing in the docs says the panel's
headless drivers use the attendee's own login (and that `pi` may not be found: see C3).

**C3. `pi` is offered only as a terminal, not as a chat driver.** The session listed `claude` and `codex` as chat drivers and `pty:pi` as a
terminal, although `pi` is installed. The panel's headless list is built from a PATH probe the shell-function install of `pi` does not satisfy.
Not documented either way in `docs/framework/agents/index.md`.

**C4. The `todo` template serves nothing at `/`.** `npm run dev` prints `http://127.0.0.1:<port>`, the app answers 404 there because
everything is under `/todo`. `docs/framework/guides/create-acrylblends.md` line 14 says "a to-do list on the router and state"; the terminal
example in the same guide curls `$URL/todo/api`, so the paths are there, but the printed URL is the bare origin.

**C5. node-pty's install script is blocked by npm 11's allow-scripts.** `npm install` warns `node-pty … (install: … node-gyp rebuild …)` and
suggests `npm approve-scripts`. The PTY drivers still registered; whether a terminal actually opens with the unbuilt binding was not tested.
Not mentioned in any page.

### Cosmetic

**F3 (cosmetic).** `npm create acrylblends@latest` prints the `Next:` block twice (once from the initializer, once from the wrapper).
**C6 (cosmetic).** `npm create acrylblends@0.4.1 app-old blank` exits 2 without showing the initializer's message (0.4.1 has no `blank`
template); npm only says "command failed".
**C7 (cosmetic).** `acrylblends init --desktop` on a `nodejs` app prints that it added `sandbox`, `extensions` and `acryl-door` to a plain
web app, which reads as if a desktop shell needed them.

## What a 90-minute workshop can use today

Built only from steps that worked in this walk. Each block is timed from the table.

| min | Block | What the attendee does | Steps |
| --- | --- | --- | --- |
| 0-10 | Setup check | Node 22.19+, `npm create acrylblends@latest hello notes`, `npm install`, `npm run dev`, open the URL, log in, add a note | 1-5 |
| 10-25 | The shape of the app | open `blend.yaml` (the app as data), `plugins/` (the code they own), `src/routes.ts`; add `GET /hello` returning JSON, watch it reload | 5 |
| 25-35 | Tests and the typecheck | `npm test`, `npm run check`; add a test for the new route | 3, 4 |
| 35-50 | Web to desktop | `npx acrylblends add desktop`, `npm install`, `npm run desktop`, same route in the window | 6 |
| 50-70 | The built-in agent | start from the `agent` template app made in setup; `add agent-panel driver-pty`; two edits; open the panel; ask codex for one route and see the page reload | 9 |
| 70-85 | Registry: reading it | browse `acrylblends.github.io/blends`, read an entry's `blend.yaml`, explain the publish flow from the site and from the registry `README` | (read only: F1 blocks making an app from one) |
| 85-90 | Publish path, on paper | walk the four commands from step 8 in the cloned registry, showing `--check` refusing and the tool fixing it | 8 |

Do **not** put F1 or F2 in the room as hands-on steps: F1 fails outright and F2 looks like success. If the registry must be hands-on, use step 8
(publishing into a clone), which works, and say plainly that pulling a starter needs the ACRYL source checkout today.

## What this walk does not cover

- Windows and Linux: DS2 and Fork3 replay the same table; the `OS` column is where to add what differs.
- A browser-only attendee (WebBoxes): not tested here.
- Real model quality: step 9 used codex as the agent; the app's own offline agent and a DeepSeek-backed model were not part of this walk.
- The PTY terminals (`pty:claude`, `pty:codex`, `pty:pi`) were listed but not opened (see C5).
