# Facilitator notes: the 90-minute ACRYL Blends workshop

Read the attendee handout first (`docs/workshop/README.md`); this page is the room around it: what to put on each machine, what actually breaks, and
where to cut when the clock runs. Every timing and every failure below was measured on the published `acrylblends` 1.0.0 during the readiness walk
(`docs/plans/workshop-readiness.md`).

## Before the room: put this on every machine

| What | Why | How |
| --- | --- | --- |
| Node.js 22.19 or newer, npm 11 | the app runs TypeScript directly, no build step | `node -v`; if missing, the LTS from nodejs.org or `brew install node` |
| git | the registry block clones the registry | `git --version` |
| A warm npm cache | the first `npm create` downloads the initializer, `npm install` downloads Electron | create one app and add the desktop shell once per machine (below) |
| A coding agent, logged in | step 7 drives Codex or Claude Code through the panel | `codex login status` or run `claude` once |
| `~/acryl-workshop/prepared/` | the no-network fallback and the reset | copy the two prepared apps (below) |
| `~/acryl-workshop/blends-core` | step 8 runs the registry's own check | a sparse checkout of `acryldev/acryl` at `runtime/blends-core`, at the commit the registry CI pins, with `bun install --production` |
| Bun | the registry index tool | `curl -fsSL https://bun.sh/install \| bash` or `npm i -g bun` |

Warm-up, once per machine (this is also the exact smoke test that the room works):

```sh
mkdir -p ~/acryl-workshop && cd ~/acryl-workshop
npm create acrylblends@latest warmup notes
cd warmup && npm install && npm test
npx acrylblends add desktop && npm install
cd ~/acryl-workshop && cp -R warmup prepared-notes && rm -rf warmup
```

That leaves `prepared-notes` with everything installed, including Electron.

## Timings, checkpoints, and what to make optional

The handout's own timings, as measured on the published 1.0.0:

| Minutes | Step | Measured | If late |
| --- | --- | --- | --- |
| 0-10 | installs and checks | seconds each | never cut |
| 10-15 | create and run the blank app | create 2-10 s (cold/warm), install 2-3 s, boot 1-3 s | never cut |
| 15-22 | change one route | reload is instant | never cut |
| 22-30 | tests and the typecheck | test 0.5-2 s, check 2.5-4 s | keep; cut the "write a test" exercise |
| 30-38 | data: JSON then SQLite (**optional**) | two adds plus edits, ~8 min | **cut first** |
| 38-45 | the desktop window | add 2 s, install 3 s, first Electron boot ~20 s | pre-warm Electron on every machine or demo it |
| 45-53 | pull a starter | TODO(B1) until 1.0.2 | demo it in 2 minutes |
| 53-60 | create from a template | create 2-3 s, install 2 s, window as above | drop the second app |
| 60-75 | the agent builds a feature | codex wrote a route in ~4 min; 15 leaves room for the queue | never cut; demo it if the room is behind |
| 75-82 | upgrade | upgrade + install + test, ~1 min | keep |
| 82-90 | publish and the hero moment | the registry steps are seconds; the PR is talk | always keep at least the hero talk |

Checkpoints in the handout, and what to look for as you walk the room: **15 minutes** every screen shows `{"app":"my-hero","ok":true}`; **45 minutes**
every screen has the app in a desktop window; **75 minutes** every screen has `/board` open with the agent's page. A machine behind at a checkpoint is
what the optional column is for, and the handout names the same choices so nobody has to guess.

## What breaks in the room, and what to say

These are the defects found by the walk. They are known; say so rather than letting people think they broke something.

- **Pulling a starter (TODO(B1)).** The form is `npm create acrylblends@latest my-app -- --from <id>`, and only starters that declare `runtime:
  acrylblends` can be pulled (the older `acryl.*` ACRYL Blueprints are refused with one line saying so). The ids this workshop uses ship with 1.0.2;
  until Blends sends them, write the id on the board and demo the step.
- **Upgrading.** An app's own copy shadows the bare command, so always `npx acrylblends@latest upgrade`; the handout says so with the reason (TODO(B2) until 1.0.2's migration guide says the same).
- **The agent panel (TODO(C1)).** 1.0.2 makes `acrylblends add agent-panel` add the rows it needs, and refuse on a `blank` app with what is missing.
  The handout uses the `agent` template for that step, so it works either way; on 1.0.x expect to make the two edits by hand.
- **The agent's login (C2).** The panel's `codex`/`claude` drivers use the attendee's own login. Anyone who is not logged in sees the driver and a
  failed run; `codex login` in a terminal fixes it. `pi` is offered only as a terminal driver (C3).
- **The `todo` template (C4).** Its app is under `/todo`, so the printed URL is a 404. Not used in this workshop.
- **Publishing target (TODO(registry-target)).** The handout publishes to the public registry today. When the workshop registry exists, swap the
  repository in step 10's four commands and tell the room which one they are looking at.
- **Browser-only attendees (TODO(M9)).** The handout's hosted-workspace stub is empty until M9 is live; until then a browser-only attendee can follow
  along but not create an app.
- **node-pty's install script (C5).** `npm install` warns that npm 11 blocked `node-pty`'s script. The terminal drivers still list; the workshop does
  not open one.

## The no-network fallback

If the venue has no reliable network:

1. Every machine gets `prepared-notes` and a prepared agent app from the sheet above, so steps 1-6 skip creation and installs.
2. Step 8 uses the cloned registry and the installed `blends-core`; no network needed.
3. Step 7 needs the agent's own model, so it cannot run offline. Demo it from your machine on a tethered connection, or record it (a 4-minute
   screen recording of the codex run is enough).
4. Keep one machine on a phone hotspot for `npm create` failures.

## Demo script for the agent block (5 minutes, if you demo instead of hands-on)

1. On the prepared agent app: `npm run dev`, open the page, click the panel button.
2. Ask: "Add a route GET /agent-built to src/routes.ts that returns {\"built\": true}, then run the tests and tell me what happened."
3. Narrate while it runs: the agent reads `AGENTS.md`, reads `docs/framework`, edits `src/routes.ts`, runs the tests; the terminal prints
   `Change detected … Restarting`; reload `/agent-built` and show `{"built":true}`.
4. Point at the panel's stop button and the audit line the panel writes under `.acrylblends/audit/`.

## Resetting between sessions

Everything a person makes lives inside their app folder and `~/acryl-workshop`. To reset a machine:

```sh
rm -rf ~/acryl-workshop/[a-z]*-app ~/acryl-workshop/registry
cp -R ~/acryl-workshop/prepared/* ~/acryl-workshop/    # if you keep a prepared/ folder
```

Nothing is installed globally except the agent and Bun; neither needs cleaning between sessions.

## What is still open

- Starter pull (B1), the panel's rows (C1) and the upgrade command in the docs (B2) are with the framework team; when they land, the handout's
  TODO lines become normal steps and this page's "what breaks" list shrinks.
- The Windows and Linux runs of the attendee handout are being replayed separately; add what differs to the handout's OS column rather than here.
