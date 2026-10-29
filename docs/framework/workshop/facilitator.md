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
| 0-10 | setup and `/hello` | create and install seconds; the route reload instant | never cut |
| 10-40 | the agent builds the interface | the build is one run; allow 8-12 minutes, plus edits | if late, keep the board minimal (one column) |
| 40-60 | the agent drives the app | a model-driven drive took codex 28 s, claude 17 s, pi 48 s (on the desktop window, 1.0.x) | the drive is the point; cut the second "check its own work" prompt |
| 60-75 | the same app in a window | add + install seconds; first Electron boot about 20 s | pre-warm Electron or demo it |
| 75-90 | deploy and publish | the registry check merges in about 2 minutes | keep the publish; the deploy talk can be 3 minutes |

Checkpoints in the handout: 10 minutes a route answers; 40 minutes the agent's board is on screen; 60 minutes the agent has clicked through it; 75 minutes
the window is open. Walk the room at those minutes and help the machine that is behind, rather than the one that is ahead.

## What is not in 1.0.x yet, and what to say

The capability report is the source; these are the ones the handout touches.

- **TODO(1.0.4-A), reload and navigate inside one run.** Today the user reloads the browser after the agent installs the plugin, and asks it to check in
  a second message. Say so plainly; it costs one sentence, not a step.
- **TODO(1.0.4-B), the door script on every development page.** On a page without it the agent cannot see anything and says so. Fallback: the `pty:` tab
  and `.acryl/bin/acryl look` / `act`.
- **TODO(1.0.4-E), a clean agent config.** The prompt noise and the "shall I proceed?" habit are what the config fixes; until every machine has it, the
  "do it now" sentence in the handout is the workaround.
- **TODO(1.0.4-D), CLI noise.** The `acryl` command's chatter is being trimmed; nothing in the workshop depends on it, but it is the difference between a
  screen that reads well and one that does not.
- **Later: C (Electron windows, menus and native settings, target 11-05) and F (the door through a DeepSeek model with no login).** Do not promise either
  in the room. C is the difference between driving the page in the window (works) and driving the app's own menus (not yet); F is what a workshop without
  a hosted model login would want.

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
- The handout's hosted-workspace section (browser-only attendees) stays TODO(M9) until that workspace is live.
