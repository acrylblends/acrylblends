# The PTY driver (M8, spec 046 T029)

Status: design, no code yet. Target 2026-10-29 20:00 CET. Builds on the agent panel's headless drivers (`plugins/agent-panel`).

## What it is

A plugin, `driver-pty`, that starts a coding agent (`claude`, `codex`, `pi`, any program) inside a real pseudo-terminal in the app folder. The agent builds through the door (`.acryl/bin/acryl brief|look|act|plugin|tool`) exactly as it does today, but the person sees and can type into the agent's own terminal UI instead of a one-shot headless run. The framework packages keep no import of any agent, harness or terminal library; the plugin is one more row in `blend.yaml`.

## Why not just widen the headless drivers

The panel's drivers run `claude -p`, `codex exec`, `pi -p`: one message in, one stream out, no approvals, no follow-up. A PTY gives the programs' own interactive mode (permission prompts, slash commands, follow-up turns, their own login) without the panel re-implementing any of it. The headless drivers stay: they are what the gates run, and they need no native module.

## Shape

- Plugin `driver-pty`, provides service `driver` registry entry `pty` (the panel lists it next to `agent`, `claude`, `codex`, `pi`; the panel and this plugin share one small `Driver` interface: `start(options) -> session`, session emits `data`, accepts `write`, `resize`, `kill`, ends with an exit code).
- A session is a PTY process: program + args from a table (`claude`, `codex`, `pi`; extra programs from config), `cwd` = the app root, env = the app's environment minus the door secret (the door command finds its own `.acryl/door.json`), `TERM=xterm-256color`.
- Transport: a WebSocket per session on `/api/driver-pty/<id>` (same-origin check and token as the panel's `ask`; development only; off with `NODE_ENV=production` or `ACRYL_DOOR=off`). Binary frames for terminal data, JSON frames for `resize` and `exit`. The page side is xterm.js loaded from the plugin's client folder (served by `clientModules`, no bundler), shown as a second tab of the panel.
- One session at a time per app, like the panel's one run; a second start is refused with 409. The session ends when the page closes, the program exits, or Stop is pressed (SIGHUP, then SIGKILL after 2 s, by process group).
- Audit: start, exit and the program name go to `.acryl/audit/driver-pty.jsonl`. Keystrokes are not logged (they can contain secrets); the door already audits what the agent does.
- Page reload: when a plugin is installed or removed the page reloads the page as the panel does today; the terminal session survives a reload (the session lives on the server; the page re-attaches by id and replays the last 64 KB of scrollback).

## The native module

`node-pty` is a native addon. Rules: it is an optional peer of the plugin, never of `acrylblends` itself; the plugin's `plugin.json` lists it under `dependencies` so `acrylblends add driver-pty` installs it; if it fails to load (no prebuilt binary, a sandbox that forbids PTYs, Codex workspace-write), the plugin starts with the driver marked unavailable and a one-line reason, and the panel simply does not list `pty`. The package gates never need it. ACRYL's workspace uses `node-pty` 1.2.0-beta.15; the plugin pins the same version. A tiny `spawn` seam (`(program, args, options) -> Process`) is the only place that imports it, so tests run on a fake process.

## Acting through the door

Nothing new is needed: the agent in the terminal reads `AGENTS.md` / `CLAUDE.md` in the folder, which name the door verbs. The plugin adds one thing: it puts `.acryl/bin` on the session's `PATH`, so `acryl look` works without the folder prefix. A hint line is written into the terminal before the program starts when the door is off.

## Tests

1. Unit, in process, fake PTY: start, write, resize, exit code, kill escalation, the 409, the same-origin and token refusals, scrollback replay on re-attach.
2. A real-PTY test that is skipped with a printed notice when `node-pty` cannot load (same pattern as the listen skips): runs `node -e` that echoes input and prints its window size.
3. Gate `verify:driver-pty` (in `check`, skips with a notice when no PTY): fresh agent app, driver added, headless Chrome opens the panel's terminal tab, a scripted program (not a model) runs `.acryl/bin/acryl plugin add ...` in the PTY, and the page reloads and shows the new route. Models stay out of `check`; a manual gate with real `claude`, `codex` and `pi` follows the existing `verify-coding-agent` pattern.
4. `verify:packed` additionally installs the plugin from the packed tarball in a new app (the installed-package rule).

## Order of work (about 36 h)

1. Driver interface shared with the panel; refactor the headless drivers behind it (no behaviour change, panel tests stay green).
2. `driver-pty` plugin with the fake-PTY tests.
3. Real `node-pty` seam and the skip logic.
4. Terminal tab in the panel client (xterm.js, resize, re-attach).
5. Gate, docs (`docs/plugins.md`, a section in the agent guide), release notes, release.

## Open questions for the coordinator

- Is xterm.js acceptable as a client dependency of the plugin (vendored file copied into the app, about 300 KB), or should the ACRYL workspace terminal's screen model be reused? My proposal: vendor xterm.js; the ACRYL one is a server-side screen model and heavier to carry.
- T028 (`driver-dsh`) would implement the same `Driver` interface as a non-PTY driver; the interface above is meant to fit it, so please confirm that is the intent.
