# IDE port: where it stands (2026-10-31)

Live status for a fresh session. The plan is [ide-port.md](ide-port.md); each slice's evidence is [ide-sliceN-*.md](.) beside it.

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

## Slice 6 state (in progress on `106-ide-slice6-templates`, base 127447cf)

Uncommitted work from the previous worker, adopted:

- `packages/cli/src/ide-profile.ts`: `IdeProfileInput.rows` (the app's own overlay rows) threaded into `overlayOf`.
- `packages/cli/templates/blank/src/routes.ts`: `apply(ctx, { prefix })`, `FRAME_MOUNT_PREFIX = '/app'`.
- `packages/cli/templates/blank/src/frame.ts` (new): the row the overlay mounts, which mounts the app's routes at the prefix.
- `packages/cli/templates/blank/test/app.test.ts`: asserts the old URLs standalone and `/app/*` through the frame row.

Done: the scaffolder (`acrylblends init`) now calls the generator for a template with `src/frame.ts`: it writes the profile, the overlay (app row `app-routes` -> `./src/frame.ts` plus the frame rows and the door row) and the `dev`/`profile` scripts; the frame package specs come from `ACRYLBLENDS_FRAME_PACKAGES` (JSON) while the ide packages are unpublished, and without it the app stays framework-only with a printed note. Two tests cover both paths (packages/cli/test/init-frame.test.ts).

Not yet done: no per-template boot gate yet (scaffold, install, profile, boot, app page at /app inside the frame); publishing the ide packages (owner decision: npm names) is the blocker for a real attendee app; `acrylblends upgrade`; Windows gate; the frame's tile at `/app` is proven reachable (ACRYL's canvas has a browser tile kind, `BrowserPane`, and the tab strip offers it) but not yet asserted in a gate.

**Open question to settle first:** the browser tile is DSH's `ui-sidebar-browser`, enabled only in the desktop profile (the documented `right-panel-open@1024` difference). Whether a web-hosted frame can show the app's page at `/app` in a tile, or needs its own tab kind, decides how a template's page reaches the main surface. Do not assume; check `packages/bundle/web-app/cordis.patch.yml` and ACRYL's canvas tab kinds.

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
