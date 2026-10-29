# Facilitator notes: the 90-minute ACRYL Blends workshop

Read the attendee handout first (`docs/framework/workshop/README.md`); this page is the room around it: what to put on each machine, what actually breaks, and
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
| A GitHub account with `gh auth login` | step 10 forks the workshop registry and opens a pull request | `gh auth status` |
| A device with `git` and a text editor | the edits in steps 2, 4 and 8 are small but real | `git --version` |

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

The handout's own timings, as measured on the published 1.0.2 (macOS, cold npm cache in a throwaway home):

| Minutes | Step | Measured | If late |
| --- | --- | --- | --- |
| 0-10 | installs and checks | seconds each | never cut |
| 10-15 | create and run the blank app | create 9 s cold (2 s warm), install 2 s, boot 2 s | never cut |
| 15-22 | change one route | reload is instant | never cut |
| 22-30 | tests and the typecheck | test 0.5-2 s, check 2.5-4 s | keep; cut the "write a test" exercise |
| 30-38 | data: JSON then SQLite (**optional**) | two adds plus edits, ~8 min | **cut first** |
| 38-45 | the desktop window | add 2 s, install 3 s, first Electron boot ~20 s | pre-warm Electron on every machine or demo it |
| 45-53 | pull a starter | create 4 s, install 3 s, runs at once | keep; it is the fastest win in the room |
| 53-60 | create from a template | create + install + add desktop 4 s | drop the second app |
| 60-75 | the agent builds a feature | set-up 4 s; codex wrote a page and tests in about 7 minutes | never cut; demo it if the room is behind |
| 75-82 | upgrade | seconds: a fresh app answers "everything is up to date" | keep; it is a 2-minute talk |
| 82-90 | publish and the hero moment | the registry steps are seconds; the PR is talk | always keep at least the hero talk |

Checkpoints in the handout, and what to look for as you walk the room: **15 minutes** every screen shows `{"app":"my-hero","ok":true}`; **45 minutes**
every screen has the app in a desktop window; **75 minutes** every screen has `/board` open with the agent's page. A machine behind at a checkpoint is
what the optional column is for, and the handout names the same choices so nobody has to guess.

## What breaks in the room, and what to say

These are the defects found by the walk. They are known; say so rather than letting people think they broke something.

- **The data step is the slow one.** Wiring `kv` then `db` by hand is about ten minutes of edits for a newcomer (two rows, two registry lines, two
  type imports, the migrations folder). It is the block the handout names optional, and the one to help with first.
- **A relative migrations path in `blend.yaml` fails.** `migrations: migrations` in the row stops the app with "this app has no file base URL to
  resolve it from". The folder is named in `src/app.ts`'s compose options instead; the handout teaches that form and the stuck line names the error.
- **`pi` shows up only when the app can see its login.** 1.0.2 offers pi as a chat driver when `DEEPSEEK_API_KEY` is exported or `~/.pi/agent/auth.json`
  holds a deepseek entry, read from the HOME the app runs in. On a normal attendee machine it is there; in a run with a moved HOME it is not (and pi
  would fail on its first message anyway). `pty:pi` needs only the program.
- **The agent run takes minutes, not seconds.** Codex wrote the page and its tests in about seven; tell the room to start it and keep talking.
- **Publishing.** The workshop registry is `github.com/acryldev/workshop-2026-11-20`, public and open. Attendees fork it, run
  `node scripts/make-entry.mjs ../agent-app <login>.agent-app --description "..."`, push and open a pull request; a check merges it, usually well under
  two minutes, and a refusal comes as a comment. Taking an app down is a pull request that removes its folder. Pulling is
  `--from <id> --registry github:acryldev/workshop-2026-11-20` (rehearsed on 1.0.2: create 12 s, install 3 s, runs at once).
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
