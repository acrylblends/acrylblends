# Site patches for acrylblends.github.io (1.0 docs pass)

Two patches, made in a local clone of `acrylblends/acrylblends.github.io` on top of its `origin/main` (`e2bc43f`). They are site source, which `scripts/sync-sites.mjs` does not carry, so they have to be applied there by hand. Nothing was pushed to either site repository.

```sh
git clone https://github.com/acrylblends/acrylblends.github.io.git
cd acrylblends.github.io
git am /path/to/docs/plans/site-patches/0001-*.patch /path/to/docs/plans/site-patches/0002-*.patch
bun install && bun run build     # expect "real-routes: 726 pages emitted..." with the 0.11.0 docs still in place; after sync-sites replaces them it is 722
```

The two commits also exist as branch `site-patches` in the local clone and as `f642d89` and `933fc05`; a fetch from that clone is equivalent to `git am`.

## 0001 - the /blends page shows what exists

The page listed seven "Preview - not published" Blends above the six starters that are really in the registry: ACRYL, Blank Canvas, Agent Workbench, Local-first Studio, Secure Ops, Data Pipeline and Release Pilot.

**None of the seven was real.** None is in `registry/index.json`, which has six entries (`acryl.blank`, `acryl.accounting`, `acryl.gtd`, `acryl.music`, `acryl.orderdesk`, `acryl.organizer`). The plugin names in them were invented as well (`agent-runtime`, `checkpoint-store`, `tool-router`, `desktop-surface`, `local-store`, `sync-adapter`, `identity-gate`, `secret-vault`, `audit-log`, `source-connectors`, `transform-engine`, `schema-guard`, `test-runner`, `release-graph`, `deploy-adapter`); the ACRYL entry also named four plugins that do exist in acryldev/acryl (`acryl-control`, `acryl-harness-runtime`, `cordis-plugin-market`, `dsh-client-ui-brand-acryl`), but no published Blend composes them, so the entry was still a fiction. The page did label them "Preview - not published" and their detail pages said "This is an illustrative composition", so nothing claimed they were pullable; the problem is that they were the larger half of the page and a reader could not tell the two halves apart.

What the patch does:

- removes the invented list and its data (`src/lib/content.ts`), the page-local search and mode toggle, and the per-Blend detail pages for names that do not exist (`BlendDetail` now 404s anything not in the registry);
- adds `src/lib/framework-parts.ts`: the "what a Blend is made of" map in spec 049's order (core, routing, serving, records, tiny data, live state, UI, desktop, agents, the door, live plugins, tooling), each row with the service a plugin injects, the real provider packages, and stable / optional / experimental;
- adds `src/lib/registry-placement.ts`: each published starter's place in the 100-category taxonomy, because the registry's own `category` field is the publisher's short word (starter, finance, productivity, ...), not the taxonomy. Category and subcategory pages now list the real starter instead of always "No Blends here yet";
- the header count becomes "6 starters in the registry - 100 categories".

## 0002 - the /docs/blends guide describes 1.0

`/docs/blends` is hand-written (`src/lib/doc-content.ts`) and `sync-sites` does not touch it. It had drifted: three CLI verbs instead of six, three templates instead of six, two old plugin folders instead of the one `plugins/` folder, `npm run lock` writing a file it does not write, and `App` (removed in 1.0) in the framework page's example. The patch brings those pages to the 1.0 commands, templates, plugin folder and class names, and names the published entries (`acrylblends/cordis/router`, ...) beside the app's own copies.

## What is not in these patches

- `src/docs/framework` and the release-notes entries: `scripts/sync-sites.mjs` does that, and Blends runs it after 1.0.0 is published. The patch set here deliberately leaves those out.
- `src/pages/DocsPage.tsx` (`/docs/platform`): it still describes ACRYL as "a clean plugin layer over DeepSeek Harness" and lists a DSH compatibility contract. That is the ACRYL product's story, not the framework's, and whether it changes is the owner's call, so it is untouched.
- The home page's "Checkpoint & rollback - Differentiate safely with traceable states and reversibility" card: no differentiation or rollback feature exists in acrylblends or in ACRYL's docs that I could confirm, so it is reported here rather than guessed at.
