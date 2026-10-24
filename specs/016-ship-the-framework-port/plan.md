# 016: Ship the framework port as 0.4.0

Status: waiting for ACRYL's sync commit (branch `047-framework-port`). Nothing here depends on the final code; the steps that do are marked.
Decisions: the owner, relayed by the coordinator (2026-10-23): "ship latest 0.4.0"; 0.3.0 stays on npm and is deprecated once 0.4.0 is verified from the registry.

## Already prepared (branch `016-port-prep`, local)

- The sync rewriter touches only real import and export statements (tests for comments, strings, multi-line and dynamic imports).
- `omit` in `plugin.json` takes globs, and the vendored plugins omit `**/*.test.*` and `**/*.case.ts`: an app never receives test files, while the sync copies and digests everything.

## Steps after the sync commit (in order, stop on any red)

1. Re-sync; `pnpm run verify:framework --against <ACRYL checkout>` must match.
2. Templates: tsconfig `lib: ES2024, DOM, DOM.Iterable`, keep `strict`, drop `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` (matches the settings the framework was written for).
3. Add the colocated tests (`plugins/acryl-*/src/**/*.test.*`) to our vitest run; list in `upstream.json` (`testsNotRun`) any that need packages an app does not have.
4. Migrate to `App` + `ctx.router.route('/prefix', app)` (`ctx.router.get` goes away; transport facts are `c.env.connection`): blank and agent `routes.ts`, the todo template (comes from upstream), `builder/script.ts`, `openai/prompt.ts`, the tests that call `ctx.router.get` or `router.request`, the tasks and extensions state-cell tests.
5. Full check, then the stranger gate from a packed tarball (todo, CRUD, restart, port freed).
6. Release notes 0.4.0 (below) and the site pages; bump `packages/cli` to 0.4.0.
7. Merge, push, CI green. Publish 0.4.0 with the approved token (temporary `--userconfig`, deleted). Rerun the stranger gate from npm (`npx acrylblends@0.4.0 init todo --template todo --yes`). `npm deprecate acrylblends@0.3.0 "superseded by 0.4.0"`.
8. Push the site (my commits only; leave the untracked `src/assets/`), check the Pages deploy and open the live pages.

## Release notes 0.4.0: outline (filled from ACRYL's migration document)

- **Breaking**: routes are registered on an ordinary `App` and mounted with `ctx.router.route(prefix, app)`; `ctx.router.get` and friends are gone. The before and after of a plugin: from the migration document.
- **Breaking**: transport facts (peer address, port) are in `c.env.connection`.
- **Changed**: the framework core is a port of the reference web framework's source; generated apps type-check with `lib` ES2024 plus DOM.
- **Unchanged**: `blank`, `todo`, `agent` templates and `--template`; plugin names (`acryl-router`, `acryl-node-server`, `acryl-state`, `acryl-inspect`); the lock, the registries, `instance`, `settings`, `extensions`, `agent`, `tasks`, `manifest`, `save`.
- **Migration** for a 0.3.0 plugin that called `ctx.router.get('/hello', handler)`: build an `App`, register on it, mount it once as one effect owned by the plugin (exact lines from the migration document).

## Site outline

Framework page (what the router, node server, state and inspector are; one source of truth), Templates, CLI reference, "Release notes 0.4.0" page, and the migration section. The 0.3.0 release-notes page stays as history with a line pointing to 0.4.0.
