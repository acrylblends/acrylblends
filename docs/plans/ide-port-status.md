# IDE port: where it stands (2026-10-31)

Live status for a fresh session. The plan is [ide-port.md](ide-port.md); each slice's evidence document (`ide-sliceN-*.md`) sits beside it.

## Landed on `main` (all with the full repository check green)

| Slice | Commit | What works |
| --- | --- | --- |
| 1 | e7d9d3e3 | Frame, `@acryl/ui`, `acryl-app-shell`, settings, shortcuts, control, diagnostics, brand; profile and overlay generation; the door on both hosts; first-run dialog off |
| 2 | 4e2d28c2 | `acryl-workspace` ported whole (803 tests + 1); Projects left pane, right panel, real PTY terminals; frame rendered in DSH; comparison alpha fix and recaptured references |
| 3 | 1f4c6af2 | DSH chat as a tab; first-run connect card; key stored only by DSH (600) and never under the app; sessions survive a restart; gate flake fixed |
| 4 | a93324cd | Files, editor, Changes, Review right-panel views; 4 new references with a committed, hash-verified fixture; 20 of 26 views within 2% |
| 5 | 127447cf | `acryl-sign-in` ported (30 tests) and mounted; OAuth connect flow in Settings > Models; API-key card suppressed for signed-in accounts; no token on disk under the app |

## The slice 6 decisions (made 2026-10-31, before the code)

1. **The frame stays at `/`; the app's routes mount at `/app` in the frame host** and the tile opens `/app/`. Changing the frame's URL would move DSH's page, the index hook and the door's target.
2. **The prefix lives in one place per template and is empty outside the frame.** Production runs the app on its own server, so public URLs there do not move; a test asserts a template built with prefix `''` serves its old URLs.
3. **The agent template keeps its own page and agent panel** inside the tile (the workshop guide depends on them); the plan's "the panel gives way to the frame" is recorded as a post-workshop change. DSH's chat remains beside the tile.

## Slice 6, step 1 landed on `main` (1f306a62)

Uncommitted work from the previous worker, adopted:

- `packages/cli/src/ide-profile.ts`: `IdeProfileInput.rows` (the app's own overlay rows) threaded into `overlayOf`.
- `packages/cli/templates/blank/src/routes.ts`: `apply(ctx, { prefix })`, `FRAME_MOUNT_PREFIX = '/app'`.
- `packages/cli/templates/blank/src/frame.ts` (new): the row the overlay mounts, which mounts the app's routes at the prefix.
- `packages/cli/templates/blank/test/app.test.ts`: asserts the old URLs standalone and `/app/*` through the frame row.

Landed: the scaffolder (`acrylblends init`) calls the generator for a template with `src/frame.ts`: it writes the profile, the overlay (app row `app-routes` -> `./src/frame.ts` plus the frame rows and the door row) and the `dev`/`profile` scripts; the frame package specs come from `ACRYLBLENDS_FRAME_PACKAGES` (JSON) while the ide packages are unpublished, and without it the app stays framework-only with a printed note. Two tests cover both paths (packages/cli/test/init-frame.test.ts). The blank template's routes take one mount prefix (`FRAME_MOUNT_PREFIX = '/app'`), its frame row mounts them there through the same `makeApp()` builder, and its test proves the standalone URLs do not move. The scaffolder gate is green for every template; the full repository check is green on 1f306a62.

Not yet done, in this order: (1) the remaining templates one at a time: todo, notes, chat, agent (its own panel stays inside the tile, per the decision above), nodejs, each with the same gate; (2) `acrylblends upgrade` for pre-frame apps (DS_Fork3, branch 106-ide-slice6-upgrade); (3) Windows (mbpi9win) for the template gate. Publishing the ide packages (owner decision: npm names) is the blocker for a real attendee app to install the frame at all, and the `ACRYLBLENDS_FRAME_PACKAGES` bridge is a checkout-only stopgap.

## Slice 6, step 2: the blank boot gate (branch `106-ide-slice6-boot`)

`scripts/verify-ide-template.mjs <template>` (in `pnpm run check` as `verify:blank-frame`) does what a person does, then asserts what they see:

1. `acrylblends init <dir> --template blank` through the built CLI with `ACRYLBLENDS_FRAME_PACKAGES` pointing at this checkout's `ide/` packages as `file:` specs; a second init must refuse.
2. `npm install`, `npm run profile` (the app's own profile, from nothing), `npm run dev`.
3. Every overlay row must be active (no "did not activate", "pending" or "failed"): `app-instance, acryl-door, app-routes, acryl-router, acryl-router-http, acryl-web, acryl-settings, acryl-shortcuts, acryl-app-shell, acryl-workspace, acryl-plugin-admin, acryl-support, acryl-sign-in, ui-brand-acryl`.
4. The page loads the workspace client and carries the door script once; `/app` answers with the app's own body (`{"app":"blank-app","ok":true}`); a door call (`.acryl/bin/acryl brief --json`) answers; `/app/about` answers with the template's page.
5. Headless Chrome: the ACRYL frame renders; the app's page is opened in the workspace's own browser tile (tab strip -> "Choose what to open" -> "New Browser Tab", type the absolute URL, Go) and the tile's document shows `About`.
6. The blank app's own `npm run check` (tsc) and `npm test` (6 tests) pass in the same scaffolded folder.

The frame row now declares `inject: ['router', 'routerHttp']` and claims `/app` on the frame's web server as well as routing it (without the claim the row activates and `/app` is 404). The generated `dev` script (`scripts/ide-dev.mjs`) starts DSH through the app's own JSX register (a `.tsx` page must compile in the host) and passes `ACRYLBLENDS_PORT` as `--port`; the gate sets 0, so it never collides with a running frame. The template's `src/frame.ts` row is the same shape each template will carry.

**Tile decision:** ACRYL's own canvas browser tile, not DSH's `ui-sidebar-browser`: that package registers a tab type for DSH's **right sidebar**, while the requirement is the main surface; DSH's row would add a second, different surface. Recorded in `ide-port.md` with the frame and prefix decisions.

**Not yet done:** the other templates (todo, notes, chat, agent with its panel, nodejs) and their gates; Electron window for a template; Windows.

## Next steps, in order

1. Settle the tile question above; record the answer in ide-port.md.
2. Scaffolder: every template calls `ideProfilePlan` with its app rows; blank first, gate on a real boot (app's page at `/app` inside the frame).
3. The other templates, one commit each: todo, notes, chat, agent (panel intact), nodejs.
4. `acrylblends upgrade` for pre-frame apps.
5. Windows: the template gate on mbpi9win (arrange with the owner; do not fake).
6. After the port: Electron window, workshop guide rerun, owner's attendee test. The workshop of 2026-11-20 stays on the `agent` template.

## Rules that keep this safe

- Gate each step: lint, typecheck, full repository check; boot gate where the template is involved; land on `main` only on exit 0.
- Never mask a comparison view; a finding is reported with its number.
- One branch per slice; delete merged branches.
- Node-pty and koffi need `allowBuilds` in the generated profile, already present.
