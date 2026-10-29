# Facilitator notes: an app that builds and drives itself

Read the handout first (`docs/framework/workshop/README.md`); this page is the room around it. The workshop changed shape on 2026-10-29: the agent living in
the app both builds its interface and drives it (clicks, sidebars, dialogs, settings), on the web and in a desktop window. The data layer and the template
tour are asides now, and `/hello` is only the introduction to the framework core.

## Before the room: put this on every machine

| What | Why | How |
| --- | --- | --- |
| Node.js 22.19 or newer (26 tested) | the app runs TypeScript directly | `node -v`; the app's own `scripts/check-node.cjs` refuses an older Node with a clear line |
| git, and a GitHub account with `gh auth login` | the last block forks the workshop registry and opens a pull request | `git --version`, `gh auth status` |
| One coding agent, logged in | the panel drives it; `codex`, `claude` and `pi` all worked | `codex login` once, or run `claude`/`pi` in a terminal |
| A prepared app with Electron already downloaded | the desktop block is 15 minutes and the download is the slowest part | run the handout's blocks 1 and 4 once per machine, then keep the folder as `~/acryl-workshop/prepared/` |
| A warm npm cache | the first `npm create` and the Electron download dominate the first ten minutes | the prepared app does it |

**The agent config that decides the day.** The panel's agent is configured to act rather than describe. Check on every machine that a plain request
produces files, not a plan: ask the prepared app's panel "say hello in a card on the page" and watch the first tool call appear within a few seconds. If
it only describes, the config is not in place (1.0.4-E) or the model is waiting for permission; the handout's sentence is "do it now".

## Timings, from the capability run

| Minutes | Block | Measured | If late |
| --- | --- | --- | --- |
| 0-10 | setup and `/hello` | create+install 9 s; the route reload instant; `add agent-panel` and `npm install` seconds | never cut |
| 10-40 | the agent builds the interface | one codex run built and installed the board in about 2.5 minutes; the agent then checked it through the door | if late, keep the board minimal (one column) |
| 40-60 | the agent drives the app | seven door calls in about 20 s with codex; the earlier capability run measured 17-48 s per model | the drive is the point; cut the second "check its own work" prompt |
| 60-75 | the same app in a window | add + install seconds; first Electron boot about 20 s; navigate+reload+look in the window under 3 s | pre-warm Electron or demo it |
| 75-90 | deploy and publish | the registry check merges in about 2 minutes | keep the publish; the deploy talk can be 3 minutes |

Checkpoints in the handout: 10 minutes a route answers; 40 minutes the agent's board is on screen; 60 minutes the agent has clicked through it; 75 minutes
the window is open. Walk the room at those minutes and help the machine that is behind, rather than the one that is ahead.

## What is in 1.0.4, and what is still coming

1.0.4 has A (`act reload`, `act navigate --path /x`, pages reloading themselves after a plugin change), B (the door's script on every development
page), D (the CLI's noise) and E (the clean agent config), and a run now survives page reloads: only Stop cancels it. Measured in this run: one prompt
built the board and installed it (about two and a half minutes with codex), the drive took seven door calls in about twenty seconds, and the window leg -
`act navigate`, `act reload`, `look` - worked in the Electron window first time.

Still open, and what to say:

- **TODO(1.0.5-panel), the panel's tool lines.** They can render as just the driver's name ("codex" repeated down the panel) instead of what the tool is
  doing. The agent's own messages are readable; tell the room to read those. It matters for the screenshot of the panel mid-build.
- **TODO(1.0.4-C), the window, menu and application-settings control (target 11-05).** In scope and taught in block 4: the agent lists the windows,
  opens a second one, picks a menu item and changes an app setting. If C slips, cut that second prompt and keep the first half - the page inside the
  window is driven today, so the block still lands.
- **F (the door through a DeepSeek model with no login).** Do not promise it; it is what a workshop without a hosted model login would want.
- **A plugin must be an extension, not a row.** An agent that adds its plugin as a row of `blend.yaml` makes the app fail to boot (`Cannot find package 'acrylblends'`, imported from the plugin): rows are imported at start-up, extensions at install time. Say it in block 2 and check the first board: it belongs in `plugins/` and installed with `.acryl/bin/acryl plugin add`.
- **Live installs race `npm run dev`.** The staged copy lives under `.acrylblends/extensions-staged/`, which `node --watch` watches, so an install can restart the app mid-install and the door then reports the app stopped. If a build goes quiet after an install, restart the server and ask the agent to install again. (Reported; 1.0.5 territory.)
- **The door allows one process per app.** Starting `npm run desktop` while `npm run dev` runs stops the window with `acryl-door: another process (pid …)
  serves the door of …; stop it first`. The handout now says to stop the server first; say it out loud too, it is the first thing a room hits.
- **Screenshots.** S3 (the board the agent built) and S6 (the registry listing) are taken from the run. S2 (the panel mid-build) needs the panel fix
  first, or it shows the "codex" wall; S1 (the first page), S4 (driving) and S5 (the real window) are pending, and S5 needs screen-recording permission
  on the machine that takes it.

## The no-network fallback

1. Prepared apps on every machine cover blocks 1-3; the agent's model still needs the network, so block 2 and 3 need a connection or a demo.
2. Block 5's registry needs GitHub; if the venue is offline, publish from your machine on a hotspot at the end, or show the recording.
3. Keep one phone hotspot for the room.

## Demo script (five minutes, if the room is behind)

1. Prepared app, panel open: ask for a card with a count. Narrate the tool calls as they stream and the page as it reloads.
2. Ask: "open the sidebar, tick one card, change the filter to done, tell me the counts." Point at the "agent is driving" indicator and the stop button.
3. Show `.acryl/audit/` afterwards: every action is a line.
4. Switch to the desktop window and repeat one click there.
5. Show the registry listing with an app already published, and the four commands that put it there.

## Screenshots

Not shot yet. They are taken once 1.0.4 is published, from real runs: the terminal after `npm create` and the first URL (S1), the panel mid-build (S2), the
page the agent built (S3), the agent driving with the indicator and an opened sidebar (S4), the real Electron window (S5), the registry listing (S6).
1280 wide, light theme, no personal data, tokens or real home paths; WebP or an optimised PNG next to the handout with alt text.

## Resetting between sessions

Everything a person makes lives inside their app folder and `~/acryl-workshop`. To reset a machine, delete the app folders and copy the prepared one back;
nothing is installed globally except the agent, `gh` and Node.

## What is still open

- The full text is written against 1.0.4-A and 1.0.4-B as designed; when those ship the TODO lines become normal steps, and the screenshots are taken.
- The handout's hosted-workspace section (browser-only attendees) stays TODO(M9) until that workspace is live; the one-click WebBoxes.ai deploy lives
  there too.
- The deploy block targets any Node host until M9: production mode locally plus the generic recipe (copy the folder, `npm install --omit=dev`, start with
  `NODE_ENV=production`).
