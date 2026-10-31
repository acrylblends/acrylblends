# Publishing the frame's packages (slice 1's last item)

The ported frame packages are unpublished, so today a scaffolded app installs them through the `ACRYLBLENDS_FRAME_PACKAGES` bridge (a `file:` spec per package
from the checkout). This page is the pipeline that turns them into npm tarballs and proves them, and the one config value the owner's naming decision moves.

**Dry run only.** The pipeline runs `npm pack` and stops: it never publishes, never logs in, and never writes outside its scratch folder. `npm publish` is
the owner's step. Before that step the npm org **`acrylblends`** must exist and the owner's account must be a member of it; `@acrylblends/*` cannot be
published without it. Create the org at <https://www.npmjs.com/org/create> (the name has to be free), then the publish is one `npm publish` per tarball.

## The one value

`frame/packages.json` holds the scope and each package folder's short name:

```json
{ "scope": "@acrylblends", "packages": { "acryl-ui": "ui", "acryl-app-shell": "app-shell", ... } }
```

A published name is `<scope>/<short>`. Changing the owner's mind about the name is a one-line change to `scope`; every overlay row, dependency, tarball and
gate reads the file.

| Folder | Published as | What it is |
| --- | --- | --- |
| `acryl-ui` | `@acrylblends/ui` | the design: themed components, semantic colour roles |
| `acryl-brand` | `@acrylblends/brand` | brand config: the mark, the accents |
| `dsh-client-ui-brand-acryl` | `@acrylblends/brand-client` | the DSH client brand plugin that paints the mark |
| `acryl-app-shell` | `@acrylblends/app-shell` | the frame: three columns, collapsible and resizable panels, layout state, theme |
| `acryl-workspace` | `@acrylblends/workspace` | Projects, sessions, terminal tabs, the right panel's files and changes |
| `acryl-settings` | `@acrylblends/settings` | the Settings surface and its sections |
| `acryl-shortcuts` | `@acrylblends/shortcuts` | the shortcut map and its UI |
| `acryl-sign-in` | `@acrylblends/sign-in` | connect a provider by account |
| `acryl-control` | `@acrylblends/control` | the host control surface the frame talks to |
| `acryl-diagnostics` | `@acrylblends/diagnostics` | diagnostics and support bundles |
| `acryl-plugin-admin` | `@acrylblends/plugin-admin` | plugin lifecycle and architecture routes |
| `acryl-support` | `@acrylblends/support` | support routes and the diagnostics download |
| `acryl-loopback-http` | `@acrylblends/loopback-http` | the loopback HTTP helper the host uses |
| `acryl-web` | `@acrylblends/web` | the web host surface the frame mounts on |

The short names are proposals: `brand-client` is the one that needed a decision (two brand packages), and the rest drop the `acryl-` prefix. Rename any of
them by editing its line; nothing else names a package.

## What the pipeline checks

`node --import ./scripts/workspace-source.mjs scripts/verify-frame-publish.mjs` (add `--skip-tests` to iterate, `--only <short>` for one package, `--keep`
to keep the scratch folder). For every package:

1. **Built**: `ide/<folder>/lib` exists (the gate's `pnpm run build` makes it).
2. **The original tests**: the package's own `test` script, which is the ported suite, unchanged.
3. **Provenance**: `provenance.json` with `source.repository`, `source.commit`, `ported` and `unchanged`.
4. **Packed**: a staged copy whose `package.json` carries the published name and no `workspace:` range (workspace ranges become `^<version>`), packed with
   `npm pack --json`; every entry of the package's `files` is in the tarball, and the packed name and version are the published ones.
5. **Peers**: `acrylblends`, `@deepseek-ai/cordis` and the `@deepseek-ai/dsh-*` services are peers, never dependencies, so one copy is shared with the host.
   Libraries such as `@deepseek-ai/schemastery` stay ordinary dependencies. Frame packages depend on each other (they ship together).

Then the whole set is installed into a fresh app: the blank template is scaffolded, the layer is generated with the published names (the overlay's rows, the
`@acrylblends` dependencies as tarball specs), and the app is booted through the host launcher of [the host inversion](ide-host-inversion.md)
(`npm run dev` -> `scripts/ide-host.mjs` on the framework's node server, no DSH profile) on a free port from `ACRYLBLENDS_PORT`: the frame page answers 200
and the app answers at `/app`. Every server is stopped with its process group, its port is checked free, and the gate fails if a process survives.

## What a rename touches in the artifact

The source keeps ACRYL's package names (the port rule); the published artifact carries the configured ones everywhere a name is a module specifier:

- `package.json`: the published `name`, and every dependency/peer/optional/dev entry renamed, with `workspace:` ranges turned into `^<that package's version>`.
- the built JavaScript and declarations: import and export specifiers of a frame package are rewritten (a package built against `acryl-loopback-http` imports
  `@acrylblends/loopback-http` in the tarball), so source maps point at the original source lines.
- `cordis.patch.yml`: the row's `name:` is the published name, quoted because a scoped name starts with `@` (YAML reserves it).
- Loader row ids cannot contain `@` or `/` (DSH refuses to parse the overlay), and they must not collide with DSH's own driver rows (`workspace` is one),
  so a scoped package's row id in a generated app overlay is its scope and name joined by a dash (`@acrylblends/workspace` -> `acrylblends-workspace`).

Three packages listed `LICENSE` in `files` without carrying the file (`acryl-workspace`, `acryl-plugin-admin`, `acryl-support`); they now carry the source's MIT
notice (WebBoxes s.r.o.), like the other ports.

The install in the publish check pins one Cordis (`overrides: {"@deepseek-ai/cordis": "4.0.4"}`) because the framework's `cordis-plugin-include` asks for
`~4.0.5` while DSH 0.2.0-rc.2 asks for `~4.0.4`: a coherence question between the framework and the DSH pin to settle before the owner publishes, not something
the pipeline should hide. The check app composes the frame through the DSH profile (as a host does), so no package is mounted twice.

## After the host inversion

The app is hosted by our framework (docs/plans/ide-host-inversion.md): `npm run dev` boots `scripts/ide-host.mjs`, which serves the document and the app's
routes at `/app` on `acryl-node-server` and mounts only DSH's chat/session driver rows, with DSH's client packages as libraries. The published packages keep
their provenance and names; the peer set stays what section "What a rename touches" says (the framework and DSH services are peers, util libraries are
dependencies), and the frame's packages still depend on each other because they ship together.
