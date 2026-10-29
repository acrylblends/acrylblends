# An app that builds and drives itself: the ACRYL Blends workshop

Ninety minutes, from an empty folder to an app whose interface a coding agent built from inside it, then drove the way a person would: it opens the
sidebar, ticks a card, changes a setting. The same app then runs in a desktop window, where the agent drives that too, and you publish it as a starter
other people can pull. **Acryl** is the small web framework underneath (a handler takes a `Request` and returns a `Response`); **ACRYL Blends** is the app
around it: a folder of Cordis plugins with a `blend.yaml`, running on your machine, with an agent living inside its panel.

Two things make this workshop different from clicking through a tutorial: you write very little code (the agent writes the interface, you direct and
edit it), and the agent is not a sidebar chat about the code, it is a hand on the app.

## What you need (10 minutes)

| | macOS | Windows | Linux |
| --- | --- | --- | --- |
| Node.js 22.19 or newer (26 works) | `node -v` | `node -v` | `node -v` |
| git | `git --version` | `git --version` | `git --version` |
| one coding agent, logged in | `codex login status` or `claude --version` or `pi --version` | same | same |
| GitHub account and `gh`, for the last block | `gh auth status` | same | same |

Install what is missing: Node from <https://nodejs.org> (the LTS), git from <https://git-scm.com>, the GitHub CLI from <https://cli.github.com> (`gh auth
login` once), and one agent (`npm i -g @openai/codex` then `codex login`, or Claude Code, or `pi`). No prior knowledge of ACRYL, Cordis or Blends is
needed; every new word is explained where it appears.

```sh
mkdir ~/acryl-workshop && cd ~/acryl-workshop
```

**The agent setting that matters all day.** The app's agent is configured to act rather than to describe: when you ask for something, it writes the
files, installs the plugin and clicks through the result itself. If your agent stops to ask "shall I proceed?", answer "do it now" and it continues; that
one sentence is the difference between watching and building.

## The path

| Minutes | Block | What you get |
| --- | --- | --- |
| 0-10 | 1. The core in one breath | an app with a route of your own, answering in a browser |
| 10-40 | 2. The agent builds the interface | a board page with cards, a sidebar and live counts, written by the agent from inside |
| 40-60 | 3. The agent drives the app | the agent opening the sidebar and ticking a card while you watch |
| 60-75 | 4. The same app in a window | the app and its agent in a desktop window, driven there too |
| 75-90 | 5. Deploy it, then publish it | the app running as a server, then listed in the registry |

> **Checkpoint 10 minutes:** your route answers in the browser.
> **Checkpoint 40 minutes:** the agent's board page is on screen.
> **Checkpoint 60 minutes:** the agent has clicked through the page by itself.
> **Checkpoint 75 minutes:** the same app is in a desktop window.

## 1. The core in one breath (10 minutes)

```sh
npm create acrylblends@latest my-app agent
cd my-app
npm install
npm run dev
```

Open the address it prints. You get a small app with a panel in the corner: it is the `agent` template, and the panel is the agent that will build and
drive this app.

![The app's page in a browser, with the agent panel open on the right](/docs-assets/workshop/s1-first-page.webp) For the next two minutes forget the panel: an Acryl app is a function from a request to a response.

Open `src/routes.ts` and add one line to the chain, just above `.get('/health', …)`, keeping the indentation of the lines around it:

```ts
      .get('/hello', (c) => c.json({ hello: 'workshop' }))
```

Save: the terminal prints `Change detected … Restarting`, and `/hello` answers `{"hello":"workshop"}`. Stop the server (`Ctrl-C`), run `npm test` and
`npm run check`: both pass. That is the whole core: a route, a test, a typecheck.

**Stuck?** A busy port means the app printed the next free one; use that address. `npm test` failing on your line names the file and the type.

## 2. The agent builds the interface (30 minutes)

Start the app:

```sh
npm run dev
```

Open the address it prints (`/` is the app's page) and click the panel button in the corner. Ask it, in one message:

> Do it now, without asking for approval. Build a board page at /board: three columns (backlog, doing, done) with cards that have a checkbox to mark
> them done, a sidebar with filters (all, mine, done) and a count on each filter, and a header button "New card" that adds one. Use the app's own state
> so the counts update live. Build it as a plugin in plugins/, install it into the running app, then go to /board yourself and check it looks right,
> and tell me what you saw.

What happens next is the workshop: the agent reads `AGENTS.md` and `docs/framework` (both are in your app), writes a Cordis plugin under `plugins/`,
installs it into the running app as an extension (`.acryl/bin/acryl plugin add plugins/board`), and goes to `/board` through the door to look at what it built. Installed extensions are the default, and the one to ask for: a row of `blend.yaml` is imported at start-up, which on an app made before 1.0.5 fails with `Cannot find package 'acrylblends'`. The page it built is at `/board`; keep the app's own
page (`/`) open in a second tab, because the panel lives there.

![The board the agent built: three columns with cards, and a sidebar with filters and counts](/docs-assets/workshop/s3-board.webp)

Then make it yours: open the plugin it wrote, change a colour or a label, save, and watch the app reload. The code is in your folder and belongs to you;
the agent wrote it, you own it.

**Stuck?** `404` under `/api/agent-panel` on an app made before 1.0.5 means the panel is not mounted: `npx acrylblends add agent-panel`, `npm install`, restart (or `npx acrylblends@latest upgrade`). The panel's tool
lines can read as just the driver's name on 1.0.4 (TODO(1.0.5-panel)); read the agent's own messages, not those lines. If the agent describes the plan
and stops, tell it "do it now, without asking for approval".

## 3. The agent drives the app (20 minutes)

The same agent, in the same panel, now uses the door: a channel into the running page with `look` (a snapshot of what is on screen, with refs) and
`act` (click, type, select, press, scroll, wait, and `navigate` or `reload` the page).

Ask it:

> Do it now, without asking for approval. On /board, use the door to open the sidebar, tick one card with its checkbox, set the filter to done, then
> look again and tell me what the counts say.

Watch the page: the card ticks, the filter changes, the counts move, and an indicator in the corner says the agent is driving, with a stop button. Every
action is a line in `.acryl/audit/` afterwards. On 1.0.4 a drive like that was seven door calls in about twenty seconds with codex.

Then ask it to check its own work in the way a person would:

> Do it now, without asking for approval. Click "New card" twice, look at the board, and tell me whether the counts agree.

**Stuck?** If the agent says it cannot see a page, open `/` (the app's page) in a tab first: that is where the panel and the page channel live. In an
Electron window the page works the same way (see block 4).

## 4. The same app in a desktop window (15 minutes)

With `npm run dev` still running:

```sh
npx acrylblends add desktop
npm install
npm run desktop
```

The window attaches to the running server and prints a line saying so, so the board you were just driving is the one in the window. (On an app made before
1.0.5 the window instead stops with `acryl-door: another process (pid …) serves the door of …`, and you stop the dev server first.)

A window opens on the same app, from the same server: your board, your sidebar, your panel. First drive the page in the window the way you did in block
3: open the panel there and ask the agent to open the sidebar and change a filter. Look and act work the same way through the window.

Then hand the agent the window itself, not only the page inside it. Ask:

> List the windows that are open, open a second one with the board in it, use the File menu to open its settings, and switch the appearance to dark.

The agent lists the windows, opens a second one, picks a menu item and changes an application setting; each shows in the window as it happens.

**Tip.** `navigate` answers with the status: a `404` means the app does not serve that path, and you can navigate straight back to one it does.

TODO(1.0.4-C): the window, menu and application-settings control (target 2026-11-05). Until it ships, the first half of this block - the page inside
the window - works, and the second prompt is the part that arrives with C.

Close the windows when you are done.

**Stuck?** The first `npm run desktop` downloads Electron (about 200 MB). On Ubuntu 23.10+ the launch starts with `--no-sandbox` and says why; the
AppArmor route is in `docs/framework/getting-started/desktop.md`.

## 5. Deploy it, then publish it (15 minutes)

**Deploy the app without its agent.** The agent, the panel and the terminal driver are development tools: with `NODE_ENV=production` they start
nothing, while the app's own routes, plugins, state and database run as always. That is the app you put on a server.

```sh
NODE_ENV=production npm start
```

(The command is the app's own `start` script; on Windows, `set NODE_ENV=production&& npm start` in cmd, or `$env:NODE_ENV="production"; npm start` in
PowerShell.)

That is the same app on any Node host: copy the folder (or clone the repository the app was saved to), run `npm install --omit=dev`, and start it with
`NODE_ENV=production` as above. Nothing in the app assumes ACRYL's own infrastructure: it is one Node process, one port, and its data in `.acrylblends/`
next to it.

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
| `npm create` fails or hangs | check the network; the facilitator has prepared apps |
| A port is taken | use the address the app printed |
| The agent cannot log in | `codex login` / `claude` / `pi` in a terminal, then retry in the panel |
| The agent plans and stops | reply "do it now"; the config asks it to act, but a model sometimes waits |
| The agent cannot see the page | open `/` (the app's page) in a tab first; the panel and the page channel live there |
| Anything else | the **Stuck?** line of the step, then your facilitator |
