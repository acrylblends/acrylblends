# ACRYL Blends workshop: build an app, then let an agent change it

Ninety minutes, one app that runs in a browser and in a desktop window, and a coding agent that edits it while it runs. You will publish a starter
into a copy of the registry too. You need a terminal, Node.js, git, and a login for one coding agent (Codex, Claude Code, or `pi`).

Everything here was run on the published `acrylblends` 1.0.0. If a step fails on your machine, read its **Stuck?** line before asking for help; it
covers what actually goes wrong.

## Before you start

| | macOS | Windows | Linux |
| --- | --- | --- | --- |
| Node.js 22.19 or newer | `node -v` | `node -v` | `node -v` |
| npm (comes with Node) | `npm -v` | `npm -v` | `npm -v` |
| git | `git --version` | `git --version` | `git --version` |
| A coding agent, logged in | `codex login status` (or `claude --version`) | same | same |

If Node is missing, install the current LTS from <https://nodejs.org> (or `brew install node` on a Mac). If the agent is missing, install Codex
(`npm i -g @openai/codex`) or Claude Code and log in once before the workshop. The agent is only used in the last third; everything before it
works without one.

Make a folder for your work and open a terminal in it:

```sh
mkdir ~/acryl-workshop && cd ~/acryl-workshop
```

## The plan

| Minutes | What |
| --- | --- |
| 0-10 | Check the machine, create the app |
| 10-25 | Run it, read its three folders, change one route |
| 25-35 | Tests and the typecheck |
| 35-45 | The same app in a desktop window |
| 45-70 | A coding agent edits the running app |
| 70-85 | The registry: read one, publish one into a local copy |
| 85-90 | Where to go next |

## 1. Create the app (2 minutes)

```sh
npm create acrylblends@latest notes-app notes
```

You should see something like:

```
created notes-app (notes) in /Users/you/acryl-workshop/notes-app: 150+ files, plugins instance, acryl-router, acryl-node-server, acryl-db, acryl-db-sqlite, manifest, save

Next:
  cd notes-app
  npm install
  npm run dev
```

The `Next:` block prints twice; run its three lines once. Six templates exist: `blank`, `nodejs`, `notes`, `chat`, `todo` and `agent`. We use
`notes` because it has accounts, a database and tests.

**Stuck?** `npm create` downloads `create-acrylblends` the first time (a few seconds). Behind a proxy or offline, use the folder the facilitator
prepared.

## 2. Install and run (5 minutes)

```sh
cd notes-app
npm install
npm run dev
```

`npm install` ends with `found 0 vulnerabilities`. `npm run dev` prints the address and keeps running:

```
notes-app listening on http://127.0.0.1:3938 (data in /Users/you/acryl-workshop/notes-app/.acrylblends)
```

Open that address. You land on the sign-in page; create an account and add a note. Leave the terminal running.

**Stuck?** If the port is taken, the app simply prints the next free one: use the address it printed, not 3938. `Ctrl-C` stops it; start it again
with `npm run dev`.

## 3. Three folders, and what they mean (5 minutes)

- `blend.yaml` is the app as data: an ordered list of plugin rows with their config. Switch a row off (`disabled: true`) and it is gone, no code
  edit.
- `plugins/` is the code you own: the framework plugins the starter copied in, and any plugin you or an agent write.
- `src/` is your app: `src/main.ts` starts it, `src/app.ts` registers the plugins, `src/routes.ts` mounts the routes, `src/notes-app.ts` builds the
  notes app itself.
- `.acrylblends/` is where the app keeps its database and settings. It is in `.gitignore`.

**Stuck?** Nothing to run here. If a file is missing, compare with `ls` above; the folder names are exact.

## 4. Change one thing (10 minutes)

Open `src/notes-app.ts`, find the line `const app = new Acryl<Env>()`, and add one line below it:

```ts
  app.get('/hello', (c) => c.json({ hello: 'workshop' }))
```

Save the file. The terminal prints:

```
Change detected in '/Users/you/acryl-workshop/notes-app/src/notes-app.ts'
Restarting 'src/main.ts'
notes-app listening on http://127.0.0.1:3938 (…)
```

Open `http://127.0.0.1:3938/hello` (your port): `{"hello":"workshop"}`.

**Stuck?** No restart means the file was not saved where the app watches: check the path in the message. A red error means a typo; read the file
and line it names.

## 5. Tests and the typecheck (10 minutes)

Stop the dev server with `Ctrl-C`, then:

```sh
npm test
npm run check
```

`npm test` ends with `ℹ tests 15`, `ℹ pass 15`, `ℹ fail 0` (the count depends on the template). `npm run check` prints nothing when it is happy:
that is the typecheck passing.

Add a test for the route you just wrote, in `test/`, and run `npm test` again. A failing test prints the file and line.

**Stuck?** `npm run check` failing on your new line is the typecheck doing its job; the message names the type.

## 6. The same app in a window (10 minutes)

```sh
npx acrylblends add desktop
npm install
npm run desktop
```

A desktop window opens, showing the same app from the same server. Your routes, your sign-in and your notes are the ones you already wrote; every
Electron call lives inside `plugins/desktop`, so the app's own code never imports it. Its browser data lives inside the app folder, in
`.acrylblends/electron`. Close the window when you are done.

**Stuck?** The first `npm run desktop` downloads Electron (about 200 MB, once). On Linux without a display, skip this step and watch the
facilitator's window.

## 7. A coding agent edits the running app (25 minutes)

The `notes` app runs its own offline agent, but the interesting one is a coding agent you already trust. Use the `agent` template for this part:
it ships the plugin rows an agent needs.

```sh
cd ~/acryl-workshop
npm create acrylblends@latest agent-app agent
cd agent-app
npm install
npx acrylblends add agent-panel driver-pty
npm install
```

`add` prints two edits it does not make for you. Do them:

1. In `blend.yaml`, before the `- id: routes` row, add:

   ```yaml
       - id: agent-panel
         name: agent-panel
       - id: driver-pty
         name: driver-pty
   ```

2. In `src/app.ts`, import them and register them:

   ```ts
   import * as agentPanel from '../plugins/agent-panel/index.ts'
   import * as driverPty from '../plugins/driver-pty/index.ts'
   ```

   and add `'agent-panel': agentPanel, 'driver-pty': driverPty,` to the `registry` object.
   (The agent template's `src/app.ts` already lists `agent`, `builder`, `extensions`, `sandbox` and `tasks`.)

Run it and open the page:

```sh
npm run dev
```

Click the panel button in the corner of the page. Pick `codex` (or `claude`) and ask:

> Add a route GET /agent-built to src/routes.ts that returns {"built": true}, then run the tests and tell me what happened.

Watch the terminal: the agent edits files, the app reloads by itself, and `http://127.0.0.1:<port>/agent-built` answers `{"built":true}`. The panel
shows what the agent is doing and has a stop button.

**Stuck?** A 404 on `/api/agent-panel/session` means the panel is waiting for a plugin row: check the two edits above (and that you started from the
`agent` template). If the agent reports it is not logged in, run `codex login` (or `claude`) in a terminal and retry. `pi` shows up as a terminal
driver, not a chat one.

## 8. The registry (15 minutes)

The registry is where starters live: <https://acrylblends.github.io/blends>. Publishing is a pull request; you can rehearse the whole path on your
own machine, which is what we do here.

```sh
cd ~/acryl-workshop
git clone --depth 1 https://github.com/acrylblends/acrylblends.github.io.git registry
cd registry
mkdir -p registry/blends/you.demo/plugins/you-demo
```

Write `registry/blends/you.demo/blend.yaml`:

```yaml
apiVersion: blends.acryl.dev/v1alpha1
kind: Blueprint
metadata:
  id: you.demo
  name: Your Demo
  version: 0.1.0
  category: starter
  description: "Blank plus one plugin that answers GET /hello."
  license: MIT
  visibility: public
spec:
  runtime: cordis
  extends: acryl.blank
  rows:
    - id: you-demo
      name: you-demo
```

…a `plugins/you-demo/index.ts` that mounts a route, and a `README.md`. Then run the same check CI runs. It needs the format library from ACRYL's
source, which the facilitator has already put at `~/acryl-workshop/blends-core`:

```sh
bun ~/acryl-workshop/blends-core/src/bin/registry-index.ts registry --check
```

It refuses your entry first (an unquoted `:` in the description is the classic mistake), then says `registry/index.json is stale: run
blends-registry-index registry`. Run the same command without `--check`; it writes the index; `--check` now passes. That is the pull request: a new
folder and a regenerated index. (Do not push.)

Pulling a starter by id (`acryl new my-app --from you.demo`) is the other half: TODO(B1), it is being finished in the framework and is not part of
this walk yet.

**Stuck?** `bun: command not found`: use `npx bun` or the facilitator's machine. A YAML error names the line; quote the description.

## 9. Where to go next (5 minutes)

- The docs you have on disk: every generated app carries `docs/framework`, the same pages as <https://acrylblends.github.io/docs>.
- `AGENTS.md` in your app is what a coding agent reads first; it is part of every template.
- Swap a provider by editing one row: SQLite to Postgres, the browser to a desktop window, an agent to another agent.

---

## If something goes wrong

| Symptom | Do |
| --- | --- |
| `npm create` fails or hangs | Check the network; the facilitator has the apps pre-created in `~/acryl-workshop/prepared/` |
| Port taken | Use the address the app printed |
| The agent cannot log in | `codex login` / `claude` in a terminal, then retry in the panel |
| You want to start over | Delete the app folder and repeat step 1; nothing lives outside it |
| Anything else | Read the **Stuck?** line of the step; then ask |
