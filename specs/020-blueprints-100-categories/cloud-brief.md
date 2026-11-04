# 020 - The cloud-agent brief

One Claude Code cloud session builds one batch of ten blueprints. Paste the brief below into a new session on claude.ai/code with
**both repositories** attached (`acrylblends/acrylblends` and `acrylblends/acrylblends.github.io`), and replace `<NN>` with the batch number.
Budget: the $100 credit, ten batches, about $10 each, spent by 2026-11-05. Run up to three batches at once. The coordinator reviews and merges the
branches.

T000 in tasks.md proves the publish steps first and corrects this brief where the real steps differ.

---

```text
You are building ACRYL Blends blueprints: starter apps people pick from https://acrylblends.github.io/blends.

Read first, in acrylblends/acrylblends (branch 020-blueprints):
- specs/020-blueprints-100-categories/spec.md   what a blueprint is and when one is done
- specs/020-blueprints-100-categories/tasks.md  your batch: the ten tasks marked [B<NN>]
- workshop-registry/README.md and workshop-registry/scripts/make-entry.mjs   how an app becomes a registry entry
- the framework docs: https://acrylblends.github.io/docs (router, state, page, db port, testing)

For each of your ten tasks:
1. Make the app with the published CLI, outside both repositories:
   npm create acrylblends@latest work/<name> -- --template blank --yes
   (use --template agent only where the task says agent template)
2. Build the app's job in its own plugins and routes, with seed data so the first page shows something, and tests for the domain logic and every
   route. Use no outside service, API key or paid API. Use only framework parts and small, well-known npm packages.
3. Check it: npm install, npm test, npm start (the first page answers with the seed data). If the frame is available (npm run dev), check it there too.
4. Write README.md: what it is, who it is for, three prompts to try in the chat next, and how to start it.
5. Publish it into acrylblends.github.io: node <acrylblends>/workshop-registry/scripts/make-entry.mjs work/<name> acrylblends.<name>
     --description "<one line>" --license MIT
   Then move or copy the entry to registry/blends/acrylblends.<name>/ in acrylblends.github.io if the script wrote it elsewhere. Set category to the
   task's category slug and subcategory to the closest of its subcategories, then regenerate registry/index.json with that repository's
   scripts/registry-index.ts.
6. Prove the entry: npm create acrylblends@latest /tmp/t-<name> -- --from acrylblends.<name> --registry <path to your acrylblends.github.io
   checkout>, then npm install and npm test in /tmp/t-<name>.

Commit each blueprint as its own commit in acrylblends.github.io on branch blueprints/batch-<NN>, and push the branch. Do not open a pull request,
merge or push to main. In acrylblends, on a branch blueprints/batch-<NN>-tasks, tick your tasks in tasks.md and add anything you ran into under
"Found". Commit messages carry no AI or agent attribution and no co-author lines.

If one task is blocked, record why under "Found" and go on to the next one. Finish with a short report: each blueprint, its proof (the test count and
the first page's title), and what is left.
```
