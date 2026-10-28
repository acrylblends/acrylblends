# From nothing to your own app: the ACRYL Blends workshop

Ninety minutes, starting from an empty folder. **Acryl** is a small web framework built on Web Standards: a handler takes a `Request` and returns a
`Response`, exactly as in the browser. **ACRYL Blends** puts that framework inside an app you own: a folder whose `blend.yaml` lists its plugins, whose
`plugins/` folder holds their code, and which runs in a browser or in a desktop window. A coding agent can change the app while it runs. By the end you
will have built an app from the blank template, added a feature to it with an agent, opened it as a desktop window, upgraded it, and published it as a
starter other people can pull from the registry.

Every command below is copy-pasteable and was run on the published packages. Each step says how long it takes; the checkpoints tell you whether you
are on time.

## What you need (10 minutes)

| | macOS | Windows | Linux |
| --- | --- | --- | --- |
| Node.js 22.19 or newer | `node -v` | `node -v` | `node -v` |
| npm, which comes with Node | `npm -v` | `npm -v` | `npm -v` |
| git | `git --version` | `git --version` | `git --version` |
| a coding agent, logged in | `codex login status` or `claude --version` | same | same |
| a GitHub account and the `gh` CLI, logged in | `gh auth status` | same | same |

Install what is missing: Node from <https://nodejs.org> (the LTS), git from <https://git-scm.com>, the GitHub CLI (`brew install gh`, `winget
install GitHub.cli`, or <https://cli.github.com>), and one agent with `npm i -g @openai/codex` (then `codex login` once) or Claude Code. Run
`gh auth login` once, in any repository: step 10 publishes your app with a pull request. No prior knowledge of ACRYL, Cordis or Blends is needed;
every new word is explained where it appears.

Make a folder and open a terminal in it:

```sh
mkdir ~/acryl-workshop && cd ~/acryl-workshop
```

## The path

| Minutes | Step | What you get |
| --- | --- | --- |
| 0-10 | Before you start | tools installed and checked |
| 10-15 | 1. Create and run | a blank app answering in a browser |
| 15-22 | 2. Change one thing | a route of your own, live, without a restart |
| 22-30 | 3. Tests and the typecheck | the app proves itself |
| 30-38 | 4. Data: JSON, then SQLite *(optional)* | a counter kept in a file, then in SQL |
| 38-45 | 5. A desktop window | the same app as a window |
| 45-53 | 6. Pull a starter from the registry | someone else's app in your folder |
| 53-60 | 7. Create from a template | the six starters, one table, one run |
| 60-75 | 8. An agent builds a feature | your app changed by the agent, still running |
| 75-82 | 9. Upgrade | the app moved to the current framework |
| 82-90 | 10. Publish it | your app as a registry starter |

> **Checkpoint 15 minutes:** your app answers in a browser. Without that, read the "Stuck?" line of step 1.
> **Checkpoint 45 minutes:** your app is open in a desktop window. Behind? Step 4 is the optional one; skip it and carry on.
> **Checkpoint 75 minutes:** the agent's page is live. Still waiting? Give it five more minutes, then skip step 9.

## 1. Create and run (5 minutes)

```sh
npm create acrylblends@latest my-hero blank
cd my-hero
npm install
npm run dev
```

You should see:

```
created my-hero (blank) in /Users/you/acryl-workshop/my-hero: … files, plugins instance, acryl-router, acryl-node-server, manifest, save

Next:
  cd my-hero
  npm install
  npm run dev
```

then, from `npm run dev`:

```
my-hero listening on http://127.0.0.1:3080 (data in /Users/you/acryl-workshop/my-hero/.acrylblends)
```

Open that address: `{"app":"my-hero","ok":true}`. `/health` answers `{"ok":true}` too. Leave the terminal running.

**Stuck?** A busy port gets the next free one: use the address the app printed. The first `npm create` downloads the initializer, so give it a few
seconds.

## 2. Change one thing (7 minutes)

Open `src/routes.ts`. It builds an `Acryl` app and mounts it on the router. Add one line to that chain, above `.get('/health', …)`:

```ts
  .get('/hello', (c) => c.json({ hello: 'workshop' }))
```

Save. The terminal prints `Change detected … Restarting 'src/main.ts'`, and `http://127.0.0.1:3080/hello` answers `{"hello":"workshop"}`. No restart
command, no build step: the app watches its own source.

**Stuck?** No message means the file is not where the app watches; the message names the path it saw. A red error names the file and line.

## 3. Tests and the typecheck (8 minutes)

Stop the server with `Ctrl-C`, then:

```sh
npm test
npm run check
```

`npm test` ends with `ℹ pass 5`, `ℹ fail 0`. `npm run check` prints nothing when the types are clean.

Now add a test for your route in `test/`: copy the style of the existing test file, request `/hello` and expect `{"hello":"workshop"}`. `npm test`
again; a failure names the file and line.

**Stuck?** `npm run check` complaining about your new line is the typechecker doing its job; the message says which type it expected.

## 4. Data: JSON, then SQLite (8 minutes, optional)

An app keeps data through a **port**: a small interface that a plugin provides. The smallest is `kv`, a JSON file in the app's own folder.

```sh
npx acrylblends add acryl-kv-json
npm install
```

`add` copies the plugin into `plugins/` and prints how to mount it. Two edits, in files you already know:

1. `blend.yaml`, after `- id: instance`, add:

   ```yaml
       - id: acryl-kv
         name: acryl-kv
       - id: acryl-kv-json
         name: acryl-kv-json
   ```

2. `src/routes.ts`: change `inject: ['router']` to `inject: ['router', 'kv']`, and count visits in your route:

   ```ts
     .get('/hello', async (c) => {
       const visits = await ctx.kv.update('visits', (n) => (n ?? 0) + 1)
       return c.json({ hello: 'workshop', visits })
     })
   ```

   `apply(ctx)` already receives the context; register the plugin in `src/app.ts` the way the other rows are registered.

`npm run dev` again and open `/hello` twice: `visits` goes 1, 2. The file is `my-hero/.acrylblends/kv.json`.

The relational port is `db`, with numbered SQL migrations:

```sh
npx acrylblends add acryl-db-sqlite
mkdir migrations
printf 'CREATE TABLE visits (id INTEGER PRIMARY KEY, at TEXT NOT NULL);\n' > migrations/001-visits.sql
npm install
```

Add its two rows to `blend.yaml` the same way (`acryl-db`, then `acryl-db-sqlite`), give the plugin `inject: ['router', 'db', 'kv']`, and in the route
`await ctx.db.run('INSERT INTO visits (at) VALUES (?)', new Date().toISOString())` before the reply. The database is `my-hero/.acrylblends/data.sqlite`,
and the migrations run at start, in order.

**Stuck?** "no such table" means the migration file is not in `migrations/` at the app root, or the row is not mounted.

## 5. A desktop window (7 minutes)

```sh
npx acrylblends add desktop
npm install
npm run desktop
```

A window opens, showing the same routes and the same data. The app's own code never imports Electron; every Electron call lives in `plugins/desktop`,
and the window's browser data stays inside `my-hero/.acrylblends/electron`. Close the window when you are done (`Cmd-Q`, `Alt-F4`).

**Stuck?** The first `npm run desktop` downloads Electron (about 200 MB). No display (a bare server)? Skip this step; nothing later needs it.

## 6. Pull a starter from the registry (8 minutes)

The registry is where people publish starters: <https://acrylblends.github.io/blends> (the starters written for this framework say
`runtime: acrylblends`; older ACRYL app starters are refused with a line saying so). Pull one by id, straight into a new folder:

```sh
cd ~/acryl-workshop
npm create acrylblends@latest from-the-registry -- --from <starter-id>
cd from-the-registry
npm install
npm run dev
```

The same command takes a git repository or a folder: `--from github:you/starter` or `--from ../a-template`. You get a complete app someone else
published, with its plugins, its dependencies and its `blend.yaml`, in your folder and yours to change. Nothing is installed for you: the starter's
`Next:` block asks for the same `npm install` as step 1.

For the workshop's own registry, name it:

```sh
npm create acrylblends@latest from-the-workshop -- --from <id> --registry https://github.com/acryldev/workshop-2026-11-20
```

**Stuck?** The `--` before `--from` is npm's, not ours: without it npm swallows the flag. An id that is not in the registry prints the ids it knows.
TODO(B1): the ids of the starters this workshop uses are published with 1.0.2; the facilitator writes them on the board.

## 7. Create from a template (7 minutes)

Every app begins from one of six templates, the same list in `npm create acrylblends` and `acrylblends init`:

| Template | What you get |
| --- | --- |
| `blank` | the router, the server and one route: what you just built |
| `nodejs` | a page rendered with JSX and a client component, without a bundler |
| `notes` | a multi-user notes app on the `db` port: sign-up, sessions, migrations, search, a typed client |
| `chat` | an answer streamed over server-sent events from an OpenAI-compatible API, history in SQLite |
| `todo` | a to-do list on the router and live state |
| `agent` | the blank app with an offline agent that writes and installs plugins into the running app |

Try the one with a database and accounts, in a window:

```sh
cd ~/acryl-workshop
npm create acrylblends@latest notes-app notes
cd notes-app && npm install
npx acrylblends add desktop && npm install && npm run desktop
```

Sign up, add a note, close the window; run `npm run dev` and the note is still there, because it lives in `notes-app/.acrylblends/data.sqlite`.

**Stuck?** The sign-in page is at `/login`; the root redirects there. Delete the folder when you are done with it.

## 8. An agent builds a feature (15 minutes)

The agent panel turns a coding agent you already use into a chat in the corner of the page. It needs the plugins the `agent` template ships (its model,
tools and memory), so this step builds a second, small app from that template; it is the app you publish in step 10.

```sh
cd ~/acryl-workshop
npm create acrylblends@latest agent-app agent
cd agent-app
npm install
npx acrylblends add agent-panel driver-pty
npx acrylblends add desktop
npm install
npm run dev
```

`add agent-panel` adds the plugin rows the panel needs and prints what it changed. (On a `blank` app it refuses and says what is missing: that is why
this step uses the `agent` template.) Open the page, click the panel button in the corner, pick `codex` (or `claude`, or `pi`), and ask:

> Add a page at /board that lists the app's tasks, newest first, and a test for it.

The agent reads `AGENTS.md`, reads `docs/framework` (which is in your app), edits your files, runs your tests, and the app reloads itself. Open `/board`
when it is done.

A terminal agent works too: choose `pty:codex` (or `pty:claude`, `pty:pi`) for its normal interactive session inside the app folder, where it can use
the door (`.acryl/bin/acryl`) to look at the page it built.

**Stuck?** The panel uses your own agent account: `codex login` (or `claude`) in a terminal first. If `npm install` warns that npm blocked
`node-pty`'s install script, `add driver-pty` prints the exact approve command; run it and `npm install` again. TODO(C1): the row-writing and the
refusal land in 1.0.2, so on 1.0.x make the two edits `add` prints by hand.

## 9. Upgrade (7 minutes)

Your app carries its framework plugins as source, so a new release moves them in place and leaves your code alone. Run the tool by its full name:
**`npx acrylblends@latest`**, because an app's own copy of `acrylblends` shadows the bare command and an older copy has no `upgrade` at all.

```sh
cd ~/acryl-workshop/my-hero
npx acrylblends@latest upgrade --dry-run
npx acrylblends@latest upgrade
npm install && npm test
```

The dry run lists what would be replaced; the real run replaces untouched files and stops with a diff if you edited one (move your change into a plugin
of your own, or use `--force`, which backs the edited copies up first). Your tests still pass afterwards. TODO(B2): 1.0.2's docs say the same thing in
the migration guide; the command itself does not change.

## 10. Publish it, and the hero moment (8 minutes)

The app you publish is `agent-app`, the one the agent changed in step 8 (keep `my-hero` too: it is yours, saved the same way). It is already a
**starter**: `blend.yaml` names it, lists its rows, and `plugins/` holds its code. Two parts make it public: your own copy, then the registry.

**Your own copy first.** `npm run save` commits the app and pushes it to its remote (it refuses a file that looks like a secret, and refuses to push a
private app to a public remote). Create an empty repository on your git host, set it as `origin`, run `npm run save`.

**The registry.** Publishing is a pull request, and for this workshop it is a short one. TODO(registry-target): the repository exists after 1.0.2.

1. In `agent-app/blend.yaml`, set `visibility: public`, add a `license`, a `category` and a one-line `description`.
2. Fork the workshop registry and copy your app in under your GitHub login:

   ```sh
   cd ~/acryl-workshop
   gh repo fork acryldev/workshop-2026-11-20 --clone
   cd workshop-2026-11-20
   mkdir -p blends/<your-github-login>.agent-app
   cp ../agent-app/blend.yaml ../agent-app/package.json blends/<your-github-login>.agent-app/
   cp -R ../agent-app/plugins blends/<your-github-login>.agent-app/plugins
   cp ../agent-app/README.md blends/<your-github-login>.agent-app/README.md
   ```

3. Commit, push and open the pull request:

   ```sh
   git checkout -b my-agent-app
   git add blends/<your-github-login>.agent-app
   git commit -m "add <your-github-login>.agent-app"
   git push -u origin my-agent-app
   gh pr create --fill
   ```

4. An automatic check validates the entry (the same check the public registry runs), and the pull request merges. Within three or four minutes your
   starter is listed, and anyone can start from it:

   ```sh
   npm create acrylblends@latest my-app -- --from <your-github-login>.agent-app --registry https://github.com/acryldev/workshop-2026-11-20
   ```

   The entry is the whole app: `blend.yaml`, `plugins/`, and the app's `package.json`, whose dependencies come with it (a starter that mounts
   `desktop` brings `electron`, so whoever pulls it does not add the shell again). No `node_modules`.

**Stuck?** A YAML error names the line; the classic one is an unquoted `:` in the description. `index.json is stale` is not an error: run the
index tool the check names, or push again once CI has rebuilt it. `gh: not found` means the GitHub CLI is not installed, and `gh auth status` saying
not logged in means `gh auth login`.

> **The hero moment.** An app you created, with a page an agent wrote for it, running as a desktop window, saved in your own repository, and published
> as a starter in the registry so the next person can pull it with one command. Along the way you built a second app from blank, a route, a test, a JSON
> store and a SQLite database. Note what you did not write: the router, the server, the JSON file, the SQLite migrations, the window, the page.

## Where next

- **Read the docs you already have**: every app carries `docs/framework`, the same pages as <https://acrylblends.github.io/docs>. Start with
  `cordis/acryl-in-a-cordis-app.md`, then `guides/data.md`, then `guides/production.md` (what runs in production, and what does not).
- **Swap a provider by editing one row**: SQLite to Postgres (`npx acrylblends add acryl-db-postgres`), the browser to a window (`desktop`), one agent
  to another (the panel's driver list).
- **Teach your agent**: `AGENTS.md` in your app is what it reads first; add your team's conventions there and the next run follows them.
- **Bring your own tool**: <https://acrylblends.github.io/docs/guides/bring-your-own-tool> wraps an outside library as a provider of a port.

## Browser only (WebBoxes.ai) TODO(M9)

No local install? The same app, and the same agent, will run as a hosted workspace: open it in a browser, pick a starter, and work in the same three
folders. Nothing to install, nothing to keep on your machine.

The hosted workspace is milestone M9 and is due before the workshop, so this section is a stub until it is live: write the address, the sign-in it
needs, and the two or three clicks that replace steps 1-2 here, then let the local steps stand for anyone who wants the app on their own disk.

---

## If something goes wrong

| Symptom | Do |
| --- | --- |
| `npm create` fails or hangs | check the network; the facilitator has prepared apps |
| A port is taken | use the address the app printed |
| The agent cannot log in | `codex login` / `claude` in a terminal, then retry in the panel |
| You want to start over | delete your app folder and repeat step 1; nothing lives outside it |
| Anything else | the **Stuck?** line of the step, then your facilitator |

Behind at a checkpoint? Skip step 4 (data) first, then the second app in step 7. Steps 1-3, 5, 8-10 are the spine.
