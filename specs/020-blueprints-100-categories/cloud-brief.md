# 020 - The cloud-agent brief

One Claude Code cloud session builds one batch of ten blueprints. Paste the brief below into a new session on claude.ai/code with
**both repositories** attached (`acrylblends/acrylblends` and `acrylblends/acrylblends.github.io`), and replace `<NN>` with the batch number.
Budget: the $100 credit, ten batches, about $10 each, spent by 2026-11-05. Run up to three batches at once. The coordinator reviews and merges the
branches.

T000 in tasks.md proved the publish steps with `acrylblends.system-monitor` (T001), and batch 1 (04-10) ran every step below on seven more apps. The worked examples are on SITE main: `registry/blends/acrylblends.system-monitor/` (one plugin), and `acrylblends.small-crm` and `acrylblends.productivity-hub` (several plugins); the seven apps of batch 1 are on branch `blueprints/batch-01-apps`.

---

```text
You are building ACRYL Blends blueprints: starter apps people pick from https://acrylblends.github.io/blends.

Two checkouts are attached. In what follows ACR is the acrylblends/acrylblends checkout and SITE is the acrylblends/acrylblends.github.io checkout.
Work in a scratch folder outside both (called WORK), and run the commands from there.

Read first:
- ACR, branch main (the latest acrylblends, 1.2.0; the published `create-acrylblends` is still 1.1.0 and makes the older template): specs/020-blueprints-100-categories/spec.md (what a blueprint is and when one is done) and tasks.md (your batch: the ten tasks marked [B<NN>]).
- A finished blueprint, as the pattern to follow: read registry/blends/acrylblends.system-monitor/ on SITE main
  (src/monitor.ts is the plugin, src/monitor/ its domain code, test/ the tests, README.md, and AGENTS.md's last section). Do not copy its job; copy its shape.
- Two finished blueprints composed from several plugins, the shape your app should have: read registry/blends/acrylblends.small-crm/ and
  registry/blends/acrylblends.productivity-hub/ on SITE main (every feature is its own plugin and its own row in blend.yaml). Copy their composition and tests, not their job.
- In any app you make: AGENTS.md and docs/framework/README.md. The same docs are at https://acrylblends.github.io/docs.

Once, before the first blueprint:
a. Branches. In SITE: `git switch -c blueprints/batch-<NN> origin/main`. In ACR: `git switch -c blueprints/batch-<NN>-tasks origin/main`.
b. The registry index tool needs the Blend format library. CI takes it from a private checkout; use the published package instead:
     mkdir -p WORK/core/shim && cd WORK/core && npm init -y && npm install @webboxes/blends-core@0.4.0
     printf "export * from '../node_modules/@webboxes/blends-core/dist/registry.js'\n" > shim/registry.ts
     printf '{"type":"module"}\n' > shim/package.json
   and in every shell that runs the index tool: export BLENDS_CORE=WORK/core/shim   (it runs with Node 24 or with bun).

For each of your ten tasks:
1. Make the app with the published CLI, outside both repositories:
     cd WORK && npx --yes acrylblends@1.2.0 init <name> --template blank --yes
   This is the current template (home, extensions, acryl-door, app plugin folders), the same shape as 02 and 03. `npm create acrylblends@latest` still runs
   create-acrylblends 1.1.0 and makes the older template without those rows; use it only if the 1.2.0 package cannot be fetched.
   (Use --template agent only where the task says agent template.) It is a Cordis app: src/main.ts, src/app.ts, blend.yaml, plugins/.
2. Composition rule (owner): a blueprint is composed from Cordis plugins and nothing else. Every feature is its own plugin in its own folder
   plugins/<feature>/ (index.ts exporting name, inject and apply; its domain code beside it), listed as its own row in blend.yaml; the 1.2.0 template loads the
   folder by the row's name, so nothing is imported or registered in src/app.ts. No feature code in src/app.ts, src/main.ts or a shared routes file; an app with
   several areas has several plugins, one row each, and blend.yaml reads as what the app is made of. A domain plugin is separate from the page plugins that inject
   it, reached through its service, never by importing another plugin's files. Replace the template's src/routes.ts and src/about.tsx and their test; test/app.test.ts
   counts the manifest's rows, update it. Put the first page at `/` with seed data (or the real machine's data) so it shows something at once.
   Keep the parts that touch the outside world (the clock, the disk, the network, a process) behind a small object the plugin takes as config, so the tests hand in a
   fake. The 1.2.0 template's createApp has no `overrides` option: add it (and a `manifest` option) to src/app.ts as 03 does, so a test passes a plugin a fake by row
   id and another switches a feature row off with `disabled: true` and boots the app without it. Include that switch-off test.
   Give every feature plugin a plugins/<feature>/plugin.json in the framework's shape (name, description, requires, inject, provides, dependencies, mount), and give
   its row one comment line saying what it does: the row is what Settings > Plugins lists and switches.
   Tests (node:test) cover the domain logic and every route. No outside service, API key or paid API; only framework parts and small, well-known npm packages.
   Set `metadata.name` in blend.yaml to the human name (`name: System Monitor`): it is what the registry and the site list. Leave the rest of metadata as it is.
3. Check it, in the app folder: npm install, npm test, npm run check (type-check), then `ACRYLBLENDS_PORT=<a free port> npm start` and fetch the first page with curl
   (it answers with the seed data). Stop the server. Put `process.env.TZ = 'UTC'` at the top of test/support.ts and run the suite under UTC, America/Los_Angeles and
   Asia/Tokyo: a seed or assertion written in local time fails on another machine. In this blank template `npm run dev` is the same app with a file watcher; the ACRYL
   frame is checked by the coordinator, not here.
4. Write README.md: what it is, who it is for, how to start it (npm install, npm start, npm test), three prompts to try in the chat next, and docs/screenshot.png:
   a headless browser screenshot of the first page, 1440x900, with its seed data and no browser chrome. The screenshot is required, not optional: the site's cards and
   detail pages show it, so a browser is part of the job.
5. Publish it into SITE:
     node ACR/workshop-registry/scripts/make-entry.mjs WORK/<name> acrylblends.<name> --description "<one line>" --license MIT --category <category slug> --out SITE/registry
   That writes SITE/registry/blends/acrylblends.<name>/ (without node_modules, .acrylblends, data and docs/framework) and makes its blend.yaml public and licensed.
   The category slug is the one in tasks.md (`system`, `developer`, ...). blend.yaml has no field for the subcategory: the site's placement is a line you add to
   SITE/src/lib/registry-placement.ts, at the end of the `registryPlacement` object, using the names as tasks.md writes them (not slugs):
     "acrylblends.<name>": { category: "System", subcategory: "System utilities" },
   (subcategory: the closest of the task's subcategories). An entry with no placement line is not shown on the site.
   Then regenerate the index and check it: cd SITE && node scripts/registry-index.ts registry && node scripts/registry-index.ts registry --check
   (this also runs the entry checks: no links, install scripts, keys or oversized files, an acryl.template.json, a package.json and src/). Do not edit registry/index.json by hand.
   Then prove the listing, not only the entry: `npm run build` in SITE and serve the built site (`npm run preview -- --port 4601 --host 127.0.0.1`), then open
   /blends/<category>/<subcategory slug> and /blends/b/acrylblends.<name> in a headless browser. The card must be there with the entry's description and its
   docs/screenshot.png, and the detail page must show both. Save the two screenshots under WORK/proof/<n>-<name>/.
6. Prove the entry as a person gets it, from a one-entry scratch registry: the CLI reads the whole registry as one template, and the full registry is past its file limit.
     mkdir -p WORK/R/blends && cp -R SITE/registry/blends/acrylblends.<name> WORK/R/blends/
     cd SITE && BLENDS_CORE=WORK/core/shim node scripts/registry-index.ts WORK/R
     cd WORK && npm create acrylblends@latest t-<name> -- --from acrylblends.<name> --registry WORK/R
   then, in t-<name>: npm install, npm test, and `ACRYLBLENDS_PORT=<free port> npm start` with the first page fetched.

Do not create repositories. After review the coordinator gives every blueprint its own repository in the acrylblends organization, named
<NN>-<category>-<name> like 01-system-system-monitor (workshop-registry/scripts/publish-repo.mjs), and the site and acryl.dev/blends list it from the registry.

Commit each blueprint as its own commit in SITE (the entry folder, registry/index.json and the registry-placement.ts line), on branch blueprints/batch-<NN>, and push that
branch. Do not open a pull request, merge, or push to main. In ACR, on blueprints/batch-<NN>-tasks, tick your tasks in tasks.md and add anything you ran into under
"Found" (one line each, with the task), commit and push that branch too. Commit messages carry no AI or agent attribution and no co-author lines.

If one task is blocked, record why under "Found" and go on to the next one. Finish with a short report: each blueprint, its proof (the test count from npm test in
t-<name> and the first page's title), its plugin rows (id, what each provides and injects), the test that switches a row off and the app still boots, the two site
screenshots, and what is left.
```
