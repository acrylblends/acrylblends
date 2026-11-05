# Release checklist: the ACRYL frame on npm, then acrylblends and create-acrylblends 1.2.0

Nothing here has been done. Steps marked **OWNER** need the owner's own npm or GitHub account; an agent never does them. Run the rest from a checkout of
the release branch (`129-create-1-2-0`) after `corepack pnpm install --frozen-lockfile && corepack pnpm run build`.

The order matters. `acrylblends` 1.2.0's `init --desktop` installs the frame's packages from npm by default, so they must be on npm before 1.2.0 is.
`main` keeps matching the published 1.1.0 until step 6 (the cloud brief tells builders that main is what the CLI is).

## 0. Decisions before anything is published

- [ ] **OWNER** Confirm the names in `frame/packages.json`: the scope `@acrylblends`, and the two new short names `versions` (acryl-versions) and
      `blends-frame` (acryl-blends-frame). A rename is one line there; re-run step 2 after it.
- [ ] **OWNER** Approve the release itself (this checklist), as the coordinator relays it.

## 1. The npm org

- [ ] **OWNER** Signed in to npm as yourself: `npm org ls acrylblends`. It should list your account. If the org does not exist, create it at
      <https://www.npmjs.com/org/create> (name `acrylblends`, free plan for public packages) and run the command again.

## 2. Pack and prove the frame (no publish, no login)

- [ ] `corepack pnpm run verify:frame-publish -- --keep`. It must end with `OK (dry run: nothing was published, no npm login)`.
      It runs each package's own tests, checks provenance, packs the 16 tarballs, scaffolds an app with `init --desktop` (which writes the published
      names), installs the tarballs and the packed acrylblends 1.2.0, checks for one Cordis and one acrylblends in the tree, boots the frame, and checks
      `/` and `/app`. The last lines name the kept folder; the tarballs are `<kept>/stage/<short>/acrylblends-<short>-<version>.tgz`.

## 3. Publish the 16 frame packages, dependencies first

- [ ] **OWNER** From the kept folder, one `npm publish <tarball> --access public` per package, in this order (each one's frame dependencies are
      published before it):

| # | Package | Version | Depends on (frame) |
| --- | --- | --- | --- |
| 1 | @acrylblends/ui | 0.3.0 | - |
| 2 | @acrylblends/brand-client | 0.1.0 | - |
| 3 | @acrylblends/app-shell | 0.1.0 | ui |
| 4 | @acrylblends/control | 0.2.5 | - |
| 5 | @acrylblends/loopback-http | 0.1.0 | - |
| 6 | @acrylblends/settings | 0.1.0 | - |
| 7 | @acrylblends/workspace | 0.1.0 | ui, control, loopback-http, settings |
| 8 | @acrylblends/sign-in | 0.1.0 | ui, control, loopback-http |
| 9 | @acrylblends/diagnostics | 0.1.0 | - |
| 10 | @acrylblends/plugin-admin | 0.1.0 | ui, control, loopback-http |
| 11 | @acrylblends/support | 0.1.0 | ui, control, diagnostics, loopback-http |
| 12 | @acrylblends/web | 0.1.0 | - |
| 13 | @acrylblends/system-prompt | 0.1.0 | - |
| 14 | @acrylblends/app-context | 0.1.0 | - |
| 15 | @acrylblends/versions | 0.1.0 | loopback-http |
| 16 | @acrylblends/blends-frame | 0.1.0 | app-shell, loopback-http, versions, workspace |

- [ ] `npm view @acrylblends/<short> version` answers for all 16 (the registry can lag a few minutes).

Not published: `acryl-brand` and `acryl-shortcuts`. The frame mounts neither and no frame package depends on them. Already on npm and not ours to publish:
`@deepseek-ai/dsh-*` 0.2.0-rc.2, `@deepseek-ai/cordis` 4.0.5, `@deepseek-ai/cordis-plugin-loader` 1.0.6.

## 4. Merge the release branch into main

- [ ] The coordinator merges `129-create-1-2-0` into acrylblends `main`. The one conflict (`workshop-registry/test/rules.test.mjs`, both sides add
      make-entry tests) is resolved as on the proof branch `129-merge-proof`, whose CI is green. The `check` and `ci` workflows on main must be green
      before step 5.

## 5. Tags (they start the release workflow)

- [ ] **OWNER** `git tag v1.2.0 <main sha> && git push origin v1.2.0` (publishes `acrylblends` 1.2.0).
- [ ] **OWNER** `git tag create-v1.2.0 <main sha> && git push origin create-v1.2.0` (publishes `create-acrylblends` 1.2.0; it depends on
      `acrylblends` ^1.2.0, so push it after `v1.2.0` has published).

Each tag's `verify` job checks that the tag is the package's version, runs `pnpm run check`, packs, and does an `npm publish --dry-run`.

## 6. The npm-release environment

- [ ] **OWNER** For each tag's run, approve the `publish` job's `npm-release` environment in GitHub Actions (Review deployments, then Approve).
      It publishes the tarball that passed `verify`, with provenance.

## 7. After the publish

- [ ] `npm view acrylblends version` and `npm view create-acrylblends version` answer `1.2.0`.
- [ ] In an empty folder outside every repository: `npx acrylblends@1.2.0 init fresh --template blank --desktop -y`, then `cd fresh && npm install &&
      npm run dev`. The frame opens and the app answers at `/app`. Stop the server and check its port is free.
- [ ] `npm create acrylblends@1.2.0 app2 -- --from acrylblends.productivity-hub -y` makes an app named app2 whose `npm run snapshot verify` passes.

## What 1.2.0 contains

`docs/release-notes/1.2.0.md`. Since the notes were written: `init --desktop` installs the published frame by default (`ACRYLBLENDS_FRAME_PACKAGES`
overrides it with a checkout's specs, or `none` for the framework alone), and `upgrade` gives a desktop app the published frame the same way.
