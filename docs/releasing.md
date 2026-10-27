# Releasing

1. Bump `packages/cli/package.json` (`acrylblends`) and `packages/create/package.json` (`create-acrylblends`), and add `docs/release-notes/<version>.md` with its line in `docs/README.md`.
2. `pnpm run check` must pass: lint, build, `verify:framework`, `verify:secrets`, typecheck, the tests, `verify:scaffolder`, `verify:byo`, `verify:panel`, `verify:packed`, `verify:tarball`.
3. `pnpm pack` in both packages; publish the two tarballs.
4. Install the published versions from the registry in an empty folder with an empty home and make an app of every template.
5. Redeploy the sites.

**Release gates run the installed package, never the repository's CLI.** What a user gets is the packed tarball installed from scratch; the repository has files the package leaves out (0.9.0 worked from the repository and failed once installed). `verify:packed` installs only the two tarballs and runs their commands.
