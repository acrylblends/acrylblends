# create-acrylblends

Create an Acryl app with one command.

```sh
npm create acrylblends@latest my-app
```

It asks which template you want, creates `my-app`, and prints what to run next. Other package managers work the same way: `pnpm create acrylblends@latest`, `yarn create acrylblends`, `bun create acrylblends@latest`.

## Templates

| Template | What you get |
| --- | --- |
| `nodejs` | an Acryl app served with `serve()` from `acrylblends/node-server`, with a test; run with Node.js 22.19 or newer |
| `bun` (experimental) | the same app for Bun, with `export default app` |
| `notes` | a full-stack starter: accounts (scrypt, cookie session), notes in SQLite (`node:sqlite`), validated forms, search, a JSON API with a typed test client, csrf on, a test for every route |
| `chat` | an AI chat starter: the answer streams token by token (Server-Sent Events) from an OpenAI-compatible API (DeepSeek by default, key only from `DEEPSEEK_API_KEY`), a client component with a Stop button that also stops the request to the model, history in SQLite, tests with a mock model |
| `acryl-app` | a Cordis app built from plugins, with an agent that can extend it while it runs (the same app `npx acrylblends init --template agent` creates) |

Every template includes `AGENTS.md`, `CLAUDE.md` and a copy of the framework documentation in `docs/framework/`, so a coding agent working in the folder reads the API from the folder.

## Non-interactive use

Arguments for the initializer go after `--` with `npm create`:

```sh
npm create acrylblends@latest my-app -- --template nodejs --install --pm npm
```

| Option | |
| --- | --- |
| `--template <name>` | `nodejs`, `notes`, `chat`, `bun` or `acryl-app` |
| `--install` | install the dependencies after creating the app |
| `--pm <manager>` | `npm`, `pnpm`, `yarn` or `bun` (default: the one that ran the command) |
| `-y`, `--yes` | ask nothing: template `nodejs`, directory `acrylblends-app` unless given |

## Then

```sh
cd my-app
npm install     # unless you passed --install
npm run dev     # prints its URL; GET / answers "Acryl!"
npm test
```

```ts
import { Acryl } from 'acrylblends'

const app = new Acryl()
app.get('/', (c) => c.text('Acryl!'))

export default app
```

## Links

- Documentation: https://acrylblends.github.io/docs (mirrored at https://acryl.dev/docs)
- The framework package: https://www.npmjs.com/package/acrylblends
- Source and issues: https://github.com/acrylblends/acrylblends
- Blends registry: https://acrylblends.github.io/blends
- ACRYL: https://acryl.dev

MIT license.

## The `notes` template

`npm create acrylblends@latest my-notes -- --template notes` makes a small full-stack app, written to be read and copied:

- sign up and log in (scrypt password hashes from `node:crypto`, a random token in an `httpOnly` cookie, sessions in the database);
- notes in SQLite through the built-in `node:sqlite` (Node.js 22.19 or later, nothing native to install), with create, edit, delete and search forms, server-side validation with messages on the page, and a redirect (303) after each POST;
- a JSON API under `/api/notes` that shares the validation rules, with a test that uses the typed `testClient`;
- csrf protection on, a test for every route, and an `AGENTS.md` that describes the files so a coding agent can extend it;
- a live character counter and an instant filter written as a small script in the page. When the client components of `acrylblends/jsx/dom` can be served without a bundler (planned for 0.7.2), they will replace that script here.

`npx acrylblends add desktop` followed by `npm install` and `npm run desktop` runs it as a desktop window (see `docs/framework/getting-started/desktop.md`).
