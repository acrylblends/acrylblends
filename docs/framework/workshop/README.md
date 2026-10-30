# An app that builds and drives itself: the ACRYL Blends workshop

Ninety minutes, from an empty folder to an app whose interface a coding agent built from inside it, then drove the way a person would: it opens the
sidebar, ticks a card, changes a setting. The same app then runs in a desktop window, where the agent drives that too, and you publish it as a starter
other people can pull. **Acryl** is the small web framework underneath (a handler takes a `Request` and returns a `Response`); **ACRYL Blends** is the app
around it: a folder of Cordis plugins with a `blend.yaml`, running on your machine, with an agent living inside its panel.

Two things make this workshop different from clicking through a tutorial: you write very little code (the agent writes the interface, you direct and
edit it), and the agent is not a sidebar chat about the code, it is a hand on the app.

This guide is for **acrylblends 1.0.10 or newer**; `npm create acrylblends@latest` gives you that.

## 0. Before you start (10 minutes)

Run this first. It checks everything below and prints one line per check, with the exact command for anything missing:

```sh
npx acrylblends@latest preflight
```

It ends with `Ready for the workshop.`, or with how many lines say `FIX`: run each `FIX` line, then the preflight again. `NOTE` lines are things the
first blocks do without (`gh` is only needed in block 5).

| | macOS | Windows | Linux |
| --- | --- | --- | --- |
| Node.js 22.19 or newer (24 and 26 work) | `node -v` | `node -v` | `node -v` |
| git | `git --version` | `git --version` | `git --version` |
| one coding agent, logged in | `codex login status` or `claude --version` or `pi --version` | same | same |
| GitHub account and `gh`, for the last block | `gh auth status` | same | same |

Install what is missing: Node from <https://nodejs.org> (the LTS), git from <https://git-scm.com>, the GitHub CLI from <https://cli.github.com> (`gh auth
login` once), and one agent:

- **Codex**: `npm i -g @openai/codex`, then `codex login`. If a run answers `model_not_found`, your account does not have the default model: pick one
  your account supports (`/model` inside codex, or `model = "..."` in `~/.codex/config.toml`).
- **Claude Code**: <https://claude.com/claude-code>, then run `claude` once to log in.
- **pi with DeepSeek**: `npm i -g @earendil-works/pi-coding-agent`, and set your DeepSeek key in the terminal you will start the app from (the panel
  starts pi from the app, so pi sees that terminal's environment). The preflight checks the key: `PASS agent pi (DeepSeek key found)`.

  | macOS and Linux | Windows PowerShell | Windows cmd.exe |
  | --- | --- | --- |
  | `export DEEPSEEK_API_KEY=sk-...` | `$env:DEEPSEEK_API_KEY="sk-..."` | `set DEEPSEEK_API_KEY=sk-...` |

No prior knowledge of ACRYL, Cordis or Blends is needed; every new word is explained where it appears.

Make the workshop folder:

| macOS and Linux | Windows PowerShell | Windows cmd.exe |
| --- | --- | --- |
| `mkdir ~/acryl-workshop && cd ~/acryl-workshop` | `mkdir ~/acryl-workshop` then `cd ~/acryl-workshop` | `mkdir %USERPROFILE%\acryl-workshop` then `cd %USERPROFILE%\acryl-workshop` |

**On Windows.** Windows PowerShell 5.1 (the one Windows ships) has no `&&`: where this guide joins two commands with `&&`, type them as two lines, or join
them with `;`. PowerShell 7 (`pwsh`) accepts `&&`. In cmd.exe, `Ctrl-C` asks `Terminate batch job (Y/N)?`: answer `Y`.

**The agent setting that matters all day.** The app's agent is configured to act rather than to describe: when you ask for something, it writes the
files, installs the plugin and clicks through the result itself. If your agent stops to ask "shall I proceed?", answer "do it now" and it continues; that
one sentence is the difference between watching and building.

## The path

| Minutes | Block | What you get |
| --- | --- | --- |
| 0-10 | 0. Before you start, 1. The core in one breath | a checked machine, and an app with a route of your own, answering in a browser |
| 10-40 | 2. The agent builds the interface | a board page with cards, a sidebar and live counts, written by the agent from inside |
| 40-60 | 3. The agent drives the app | the agent opening the sidebar and ticking a card while you watch |
| 60-75 | 4. The same app in a window | the app and its agent in a desktop window, driven there too, with its menu and settings |
| 75-90 | 5. Deploy it, then publish it | the app running as a server, then listed in the registry |

> **Checkpoint 10 minutes:** your route answers in the browser.
> **Checkpoint 40 minutes:** the agent's board is on screen.
> **Checkpoint 60 minutes:** the agent has clicked through the page by itself.
> **Checkpoint 75 minutes:** the same app is in a desktop window.

## 1. The core in one breath (10 minutes)

```sh
npm create acrylblends@latest my-app agent
cd my-app
npm install
npm run dev
```

Open the address it prints. You get a small app with a button in the corner, "Ask the agent": it opens the panel, the agent that will build and drive
this app. It is the `agent` template.

![The app's first page with the agent panel open on the right; the page follows the system theme, dark here](/docs-assets/workshop/s1-first-page.webp)

The page follows your system's light or dark setting, so on a dark-mode machine it is dark as above. For the next two minutes forget the panel: an
Acryl app is a function from a request to a response.

Open `src/routes.ts` and add one line to the chain, just above `.get('/health', …)`, keeping the indentation of the lines around it:

```ts
      .get('/hello', (c) => c.json({ hello: 'workshop' }))
```

Save: the terminal prints `Restarting 'src/main.ts'` (Node 24 and 26 print `Change detected …` on the line before it; Node 22 prints only the
`Restarting` line), and `/hello` answers `{"hello":"workshop"}`. Stop the server (`Ctrl-C`; in cmd.exe answer `Y`), run `npm test` and `npm run check`:
both pass (`npm test` reports 14 passing tests). That is the whole core: a route, a test, a typecheck.

**Stuck?** A busy port means the app printed the next free one; use that address. `npm test` failing on your line names the file and the type.

## 2. The agent builds the interface (30 minutes)

Start the app (on pi, in the terminal where `DEEPSEEK_API_KEY` is set):

```sh
npm run dev
```

Open the address it prints and click "Ask the agent". In the list at the top of the panel, pick your coding agent (`codex`, `claude` or `pi`): `agent`
is the app's own agent, and without a model key it runs offline and only repeats what you say. Ask it, in one message:

> Do it now, without asking for approval. Build a board page at /board: three columns (backlog, doing, done) with cards that have a checkbox to mark
> them done, a sidebar with filters (all, mine, done) and a count on each filter, a button that opens and closes the sidebar, and a header button
> "New card" that adds one. Use the app's own state so the counts update live. Build it as a plugin in plugins/, install it into the running app, then
> go to /board yourself and check it looks right, and tell me what you saw.

What happens next is the workshop: the agent reads `AGENTS.md` and `docs/framework` (both are in your app), writes a Cordis plugin under `plugins/`,
installs it into the running app as an extension (`.acryl/bin/acryl plugin add plugins/board`), and goes to `/board` through the door to look at what it
built. The panel shows `Working... m:ss` while it runs; with pi the build took about six minutes. The panel is on every page of the app, so when the
agent moves the page to `/board`, the panel comes along and keeps following the run.

![The panel while the agent builds: the request, then Working... 0:04 below it](/docs-assets/workshop/s2-panel-building.webp)

![The board the agent built: three columns with cards, and a sidebar with filters and counts](/docs-assets/workshop/s3-board.webp)

Then make it yours: open the plugin it wrote, change a colour or a label, save, and watch the app reload. The code is in your folder and belongs to you;
the agent wrote it, you own it. Every agent builds a slightly different board: yours may need a title typed before "New card" adds one, or keep the
sidebar always open.

**Stuck?** If the agent describes the plan and stops, tell it "do it now, without asking for approval". An app made with an older release gets the
current panel and fixes with `npx acrylblends@latest upgrade`.

## 3. The agent drives the app (20 minutes)

The same agent, in the same panel, now uses the door: a channel into the running page with `look` (a snapshot of what is on screen, with refs) and
`act` (click, type, select, press, scroll, wait, and `navigate` or `reload` the page).

Ask it:

> Do it now, without asking for approval. On /board, use the door to open the sidebar, tick one card with its checkbox, set the filter to done, then
> look again and tell me what the counts say.

Watch the page: the card ticks, the filter changes, the counts move. While each action runs, a bar at the bottom of the page says `Agent is driving:
clicking` (or looking, typing) with a Stop button; it shows only for that moment, so most of the time you see the page change and the panel's `Working...`
line. The panel's own Stop button ends the whole run. Every action is a line in `.acryl/audit/` afterwards. With pi the drive was six door calls in
under two minutes, most of it the model thinking.

Then ask it to check its own work in the way a person would:

> Do it now, without asking for approval. Click "New card" twice, look at the board, and tell me whether the counts agree.

If your board needs a title before "New card" adds a card, the agent says so, and the counts agree because nothing was added; ask it to type a title
first if you want to see them move.

**Stuck?** If the agent says it cannot see a page, reload the app's tab: the page connects to the door when it loads.

## 4. The same app in a desktop window (15 minutes)

**First close the browser tab of the app.** While a browser tab of the app is open, the agent's page actions can go to that tab instead of the
window (the door picks a page when the agent does not name a window), and you would watch an unchanged window. Keep `npm run dev` running.

```sh
npx acrylblends add desktop
npm install
npm run desktop
```

The first `npm run desktop` downloads Electron (about 200 MB), then the window attaches to the running server and says so:

```text
desktop: attached to the app already running from this folder at http://127.0.0.1:3288 (its server keeps running when the window closes)
desktop: windows and menu are available to the door (acryl window list, acryl menu list)
```

A window opens on the same app, from the same server: your board, your sidebar, your panel. First drive the page in the window the way you did in block
3: open the panel there and ask the agent to open the sidebar and change a filter. Look and act work the same way through the window.

![The agent driving the board inside the desktop window: the Done filter it just set, and the panel's Working... line](/docs-assets/workshop/s4-agent-drives-window.webp)

Then hand the agent the window itself, not only the page inside it. Ask:

> List the windows that are open, open a second one with the board in it, open the app's settings from the menu, and switch the appearance to dark.

The agent lists the windows, opens a second one, clicks the menu's Settings item, and changes the app's appearance on the settings page; each shows on
screen as it happens. The Settings item is in the application menu on macOS (`my-app > Settings...`, `Cmd+,`) and the first item of the File menu on
Windows and Linux (`Ctrl+,`); it opens `/settings` in a window of its own.

The appearance is saved for the whole app. The app's own pages (`/`, `/settings`) use it; a window that is already open picks it up when it reloads, so
ask the agent "reload window 1 and look at it" to see the change there. On a machine already in dark mode, dark looks like before: pick Light to see
it change. A page the agent built (the board) follows the system theme unless you ask the agent to follow the app's appearance too.

![Two desktop windows: window 1 on the app's page in the dark appearance, and the Settings window showing Saved: Dark](/docs-assets/workshop/s5-two-windows.webp)

**Tip.** `navigate` answers with the status: a `404` means the app does not serve that path, and you can navigate straight back to one it does.

Close the windows when you are done. The last window does not close through the door without `--force` (closing it ends the desktop app), so close it
yourself or tell the agent it may.

**Stuck?** On Ubuntu 23.10+ the launch starts with `--no-sandbox` and says why; the AppArmor route is in
`docs/framework/getting-started/desktop.md`. If the agent reports success but the window did not change, a browser tab of the app is still open: close
it and ask again.

## 5. Deploy it, then publish it (15 minutes)

**Deploy the app without its agent.** The agent, the panel and the terminal driver are development tools: with `NODE_ENV=production` they start
nothing, while the app's own routes, plugins, state and database run as always. That is the app you put on a server. Stop `npm run dev` first.

```sh
NODE_ENV=production npm start
```

(The command is the app's own `start` script; on Windows, `set NODE_ENV=production&& npm start` in cmd, or `$env:NODE_ENV="production"; npm start` in
PowerShell.) It prints `extensions (read-only): board`: the board the agent installed runs, and nothing can install or remove a plugin.

That is the same app on any Node host: copy the folder (or clone the repository the app was saved to), run `npm install --omit=dev`, and start it with
`NODE_ENV=production`. On its own the app listens on `127.0.0.1` at a port chosen from its folder; a server must say where to listen. The app reads
`ACRYLBLENDS_HOST` and `ACRYLBLENDS_PORT` (from 1.1.0 also `HOST` and `PORT`, the names hosting platforms set, when those two are not set):

| macOS and Linux | Windows PowerShell | Windows cmd.exe |
| --- | --- | --- |
| `ACRYLBLENDS_HOST=0.0.0.0 ACRYLBLENDS_PORT=8080 NODE_ENV=production npm start` | `$env:ACRYLBLENDS_HOST="0.0.0.0"; $env:ACRYLBLENDS_PORT="8080"; $env:NODE_ENV="production"; npm start` | `set ACRYLBLENDS_HOST=0.0.0.0&& set ACRYLBLENDS_PORT=8080&& set NODE_ENV=production&& npm start` |

Nothing in the app assumes ACRYL's own infrastructure: it is one Node process, one port, and its data in `.acrylblends/` next to it.

**Publish it as a starter.** Your app already is one: `blend.yaml` names it, `plugins/` holds its code.

```sh
cd ~/acryl-workshop
gh repo fork acryldev/workshop-2026-11-20 --clone
cd workshop-2026-11-20
node scripts/make-entry.mjs ../my-app <your-github-login>.my-app --description "the board my agent built"
git add blends && git commit -m "add <your-github-login>.my-app"
git push
gh pr create --fill --repo acryldev/workshop-2026-11-20
```

(On Windows PowerShell 5.1, `cd ~/acryl-workshop` works as written; in cmd.exe use `cd %USERPROFILE%\acryl-workshop`. Type the `git add` and `git
commit` as two lines, or join them with `;`.)

A check runs on the pull request and merges it: your starter is listed in about two minutes, and anyone can start from it with
`npm create acrylblends@latest another-app -- --from <your-github-login>.my-app --registry github:acryldev/workshop-2026-11-20`.

![The workshop registry's page, listing the starters other people published](/docs-assets/workshop/s6-registry.webp)

As an aside, for an app made before this release: `npx acrylblends@latest upgrade` moves the framework plugins it carries to the installed version,
leaving your own code alone (an app you made today answers "everything is up to date").

**Stuck?** The registry's check comments what to change; fix, commit, push again. `gh auth status` not logged in means `gh auth login`. A production app
with no agent is correct: that is the design, not a missing piece.

## Browser only (WebBoxes.ai) TODO(M9)

No local install? The same app, and the same agent building and driving it, will run as a hosted workspace: open it in a browser, pick a starter, and work
in the same folders. Nothing to install, nothing to keep on your machine.

The hosted workspace is milestone M9; until it is live this section is a stub. When it is, it says the address, the sign-in it needs, and the two or three
clicks that replace block 1 here - and the one-click WebBoxes.ai deploy of an app from block 5, which is the same app on their infrastructure instead of
yours.

## Where next

- **Read the docs you already have**: every app carries `docs/framework`, the same pages as <https://acrylblends.github.io/docs>. The door's verbs are in
  `agent/`, the data ports in `guides/data.md`, and `guides/production.md` says exactly what runs on a server.
- **Teach the agent your app**: `AGENTS.md` is what it reads first; add your team's conventions there and it follows them in the next run.
- **Swap a provider by editing one row**: SQLite to Postgres, the browser to a window, one agent to another in the panel's driver list.
- **Bring your own tool**: <https://acrylblends.github.io/docs/guides/bring-your-own-tool> wraps an outside library as a provider of a port.

---

## If something goes wrong

| Symptom | Do |
| --- | --- |
| The preflight prints `FIX` lines | run each one, then `npx acrylblends@latest preflight` again |
| `npm create` fails or hangs | check the network; the facilitator has prepared apps |
| A port is taken | use the address the app printed |
| The agent cannot log in | `codex login` / `claude` / `pi` in a terminal, then retry in the panel |
| Codex answers `model_not_found` | pick a model your account supports: `/model` in codex, or `model = "..."` in `~/.codex/config.toml` |
| pi does not start or has no key | set `DEEPSEEK_API_KEY` in the terminal that runs `npm run dev`, restart it, and run the preflight |
| The agent plans and stops | reply "do it now"; the config asks it to act, but a model sometimes waits |
| `&&` is an error in PowerShell | Windows PowerShell 5.1: type the two commands as two lines, or join them with `;` |
| The agent says it acted, but the desktop window did not change | close the app's browser tab, then ask again |
| Anything else | the **Stuck?** line of the step, then your facilitator |
