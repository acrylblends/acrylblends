# Facilitator notes: an app that builds and drives itself

Read the handout first (`docs/framework/workshop/README.md`); this page is the room around it. The workshop changed shape on 2026-10-29: the agent living in
the app both builds its interface and drives it (clicks, sidebars, dialogs, settings), on the web and in a desktop window. The data layer and the template
tour are asides now, and `/hello` is only the introduction to the framework core. The handout is written for **acrylblends 1.0.10 or newer**.

## Before the room: put this on every machine

| What | Why | How |
| --- | --- | --- |
| The preflight passing | it checks Node, npm, git, an agent with its login or key, a free port, and on Windows PowerShell and long paths | `npx acrylblends@latest preflight` ends with `Ready for the workshop.` |
| Node.js 22.19 or newer (24 and 26 tested) | the app runs TypeScript directly | `node -v`; the app's own `scripts/check-node.cjs` refuses an older Node with a clear line |
| git, and a GitHub account with `gh auth login` | the last block forks the workshop registry and opens a pull request | `git --version`, `gh auth status` |
| One coding agent, logged in | the panel drives it; `codex`, `claude` and `pi` all worked | `codex login` once (and a model the account supports), or run `claude` once, or pi with `DEEPSEEK_API_KEY` set in the terminal that starts the app |
| A prepared app with Electron already downloaded | the desktop block is 15 minutes and the download is the slowest part | run the handout's blocks 1 and 4 once per machine, then keep the folder as `~/acryl-workshop/prepared/` |
| A warm npm cache | the first `npm create` and the Electron download dominate the first ten minutes | the prepared app does it |

**The agent config that decides the day.** The panel's agent is configured to act rather than describe. Check on every machine that a plain request
produces files, not a plan: ask the prepared app's panel "say hello in a card on the page" and watch the panel's `Working...` line and the first file
appear. If it only describes, the model is waiting for permission; the handout's sentence is "do it now".

**Agent-specific checks.** Codex answering `model_not_found` means the account does not have the default model: pick one it supports (`/model` in codex,
or `model = "..."` in `~/.codex/config.toml`). pi with DeepSeek needs `DEEPSEEK_API_KEY` in the environment of the terminal that runs `npm run dev`
(the panel starts pi from the app); the preflight reports `PASS agent pi (DeepSeek key found)` when it is there. The package is
`@earendil-works/pi-coding-agent` (1.4.0 on npm on 2026-10-30), installed with `npm i -g @earendil-works/pi-coding-agent`.

## Timings, from the 1.0.10 walk (macOS, pi on DeepSeek)

| Minutes | Block | Measured | If late |
| --- | --- | --- | --- |
| 0-10 | preflight, setup and `/hello` | preflight 12 s; create, install, dev, the route edit, `npm test` (14 tests) and `npm run check` 14 s of commands | never cut |
| 10-40 | the agent builds the interface | 5:51 for pi to build, install and check the board (an earlier codex run: about 2.5 minutes) | if late, keep the board minimal (one column) |
| 40-60 | the agent drives the app | 1:41 for the tick-and-filter prompt (six door calls, most of the time the model thinking), 2:07 for the New-card prompt | the drive is the point; cut the second "check its own work" prompt |
| 60-75 | the same app in a window | add + install 5 s; first `npm run desktop` 10 s including the Electron download on a fast line; the drive in the window 22 s; the windows, menu and settings prompt 1:11 | pre-warm Electron or demo it |
| 75-90 | deploy and publish | production start in seconds; the registry check merges in about 2 minutes | keep the publish; the deploy talk can be 3 minutes |

Checkpoints in the handout: 10 minutes a route answers; 40 minutes the agent's board is on screen; 60 minutes the agent has clicked through it; 75 minutes
the window is open. Walk the room at those minutes and help the machine that is behind, rather than the one that is ahead.

## What to say in the room

- **Close the browser tab before block 4.** While a browser tab of the app is open, a door action without `--window` can go to that tab: in the 1.0.10
  walk the agent, asked from the window's panel, moved the hidden browser tab and reported success while the window stayed on `/`. With the tab closed
  the same prompt drove the window in 22 s. The handout says so at the top of block 4; it stays until the door aims at the window the agent was asked
  from (reported to Blends).
- **The Settings item.** It is in the application menu on macOS (`my-app > Settings...`, `Cmd+,`) and the first item of the File menu on Windows and Linux
  (`Ctrl+,`). An app gets it because it serves `/settings`; the template does. In the walk, pi found it in the app menu by itself.
- **Appearance.** The template's `/settings` saves light, dark or "match the system" for the app's own pages. A window that is already open shows the
  change after a reload, and a page the agent built follows the system theme unless asked otherwise. On a dark-mode machine, demo with Light.
- **The driving bar.** `Agent is driving: clicking` with a Stop button shows at the bottom of the page only while each action runs, a moment each; the
  panel's `Working... m:ss` line and its Stop button are what people see during a run.
- **Every agent builds a different board.** pi's board needed a title typed before "New card" added a card, and kept its sidebar always open when the
  prompt did not ask for a toggle. The handout's block 2 prompt now asks for a button that opens and closes the sidebar, so block 3 has something to open.
- **Production listens where it is told.** The app reads `ACRYLBLENDS_HOST` and `ACRYLBLENDS_PORT`, not `PORT`; without them it listens on `127.0.0.1` at a
  port chosen from its folder. A server needs `ACRYLBLENDS_HOST=0.0.0.0 ACRYLBLENDS_PORT=8080 NODE_ENV=production npm start` (verified: it answered on the
  LAN). If Blends ships `PORT`, the handout switches to it.
- **Windows.** Windows PowerShell 5.1 has no `&&` (two lines, or `;`); PowerShell sets variables with `$env:NAME="value"`; cmd.exe's `Ctrl-C` asks
  `Terminate batch job (Y/N)?` (answer `Y`); cmd.exe does not expand `~` (use `%USERPROFILE%`). Node 22 prints only `Restarting 'src/main.ts'` on a save;
  Node 24 and 26 print `Change detected …` before it.
- **F (the door through a DeepSeek model with no login).** pi with a DeepSeek key works today; do not promise more than that.

## What the 1.0.10 walk found, block by block

The final macOS walk on 1.0.10 (2026-10-30), verbatim from the handout as it stood before this revision, with pi on DeepSeek. Every block passed; these
are the places where the handout text differed from what the walk saw, and each one is now handled in the handout.

1. Block 1: npm test now has 14 tests (the guide gives no number). "Change detected … Restarting" matches on Node 24; on Node 22 only "Restarting"
   prints (seen on z370n).
2. Block 2: "keep the app's own page (/) open in a second tab, because the panel lives there" is outdated: the panel is on every page now and followed the
   agent to /board. The page is dark on a dark-mode Mac (screenshots s1-first-page/s3-board look different); the panel stays light on the dark page.
3. Block 3: the guide's block 2 prompt asks for no sidebar toggle, so "open the sidebar" has nothing to open (pi says so and goes on). "an indicator in
   the corner says the agent is driving, with a stop button": it shows only while each single door call runs (a fraction of a second), so an attendee
   will hardly see it; it never showed in 33 frames taken every 3 s. "Click New card twice" added no cards: pi's board needs a title first; the prompt
   only asks whether the counts agree. "seven door calls in about twenty seconds" was 6 calls in 1:41 with pi.
4. Block 4: the guide says "use the File menu". On macOS Settings is in the app menu (my-app>Settings..., Cmd+,); pi found it there itself. Elsewhere it
   is the first File item. "switch the appearance to dark" shows no change on a dark-mode Mac, and the agent-built /board ignores the app theme (its CSS
   follows the system); the change shows on the template's / and /settings, and in other open windows only after a reload (switching to Light in window
   3, window 1 on / changed only after act reload). The TODO(1.0.4-C) paragraph is outdated: the window, menu and settings control has shipped.
   Important: if the browser tab from blocks 2-3 is still open, the agent's door calls from the window's panel go to that browser tab, not the window. My
   first in-window drive moved the hidden tab and the window stayed on /. With the tab closed it worked.
5. Block 5: "That is the same app on any Node host … one port" names no port: the app binds 127.0.0.1 on a port derived from its folder path, ignores PORT
   (PORT=3299 still gave 3991), and needs ACRYLBLENDS_PORT and ACRYLBLENDS_HOST (only the app's README names them; production.md does not).

## The no-network fallback

1. Prepared apps on every machine cover blocks 1-3; the agent's model still needs the network, so block 2 and 3 need a connection or a demo.
2. Block 5's registry needs GitHub; if the venue is offline, publish from your machine on a hotspot at the end, or show the recording.
3. Keep one phone hotspot for the room.

## Demo script (five minutes, if the room is behind)

1. Prepared app, panel open: ask for a card with a count. Narrate the panel's `Working...` line and the page as it reloads.
2. Ask: "open the sidebar, tick one card, change the filter to done, tell me the counts." Point at the page changing and at the driving bar as each action
   runs.
3. Show `.acryl/audit/` afterwards: every action is a line.
4. Close the browser tab, switch to the desktop window and repeat one click there; then open Settings from the menu.
5. Show the registry listing with an app already published, and the four commands that put it there.

## Screenshots

Taken on 1.0.10 on macOS in dark mode (the pages follow the system theme), 1280 wide, no personal data, tokens or real home paths:

| File | Shows |
| --- | --- |
| `s1-first-page.webp` | the first page with the panel open (block 1) |
| `s2-panel-building.webp` | the panel with the build request and `Working... 0:04` (block 2) |
| `s3-board.webp` | a board an agent built (block 2; from an earlier run, kept because it shows the result best) |
| `s4-agent-drives-window.webp` | the agent driving the board in the desktop window: the Done filter it just set (block 4) |
| `s5-two-windows.webp` | two desktop windows: the app's page in the dark appearance, and the Settings window showing `Saved: Dark` (block 4) |
| `s6-registry.webp` | the registry listing (block 5) |

S4 and S5 are page captures of the desktop windows (through the window's DevTools), without the window frame; a capture with the frame needs the
screen-recording permission on the machine that takes it.

## Resetting between sessions

Everything a person makes lives inside their app folder and `~/acryl-workshop`. To reset a machine, delete the app folders and copy the prepared one back;
nothing is installed globally except the agent, `gh` and Node.

## What is still open

- Close-the-tab advice in block 4 until the door aims at the window the agent was asked from.
- The appearance reaching open windows live, and an agent-built page following the app's appearance: reported to Blends; the handout says "reload".
- `PORT` for production: if Blends ships it, the handout's server line switches from `ACRYLBLENDS_PORT` to `PORT`.
- The handout's hosted-workspace section (browser-only attendees) stays TODO(M9) until that workspace is live; the one-click WebBoxes.ai deploy lives
  there too.
- Windows findings from the 1.0.10 Windows walk are added when that walk reports.
