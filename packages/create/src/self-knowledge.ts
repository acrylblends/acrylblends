import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * What an app tells the agent that works in it (spec 049, slice 11): `AGENTS.md` and `CLAUDE.md` (the same text), and one skill that points
 * to `docs/framework/` and to the door. The files are written from this module only, so the three can never disagree.
 */

type Template = 'nodejs' | 'notes' | 'chat' | 'bun'

/** Where an agent looks for a skill: Claude Code reads `.claude/skills`, Codex and others read `.agents/skills`. The text is the same. */
export const SKILL_FOLDERS = ['.claude/skills/app-guide', '.agents/skills/app-guide'] as const

/** Every mention of the door is this one line, so its final wording changes in one place. */
export const DOOR_LINE =
  'The door is a command in this folder, `.acryl/bin/acryl`, that lets you look at and change the running app; its state lives under `.acryl/`, which git ignores. If `.acryl/bin/acryl` is not here, this app has no door yet: run it with its scripts and check it with `npm test`.'

/** The defaults of an app made from this template, each with the one place that swaps it. */
function defaultRows(template: Template, pkg: string): string[] {
  const rows: string[] = []
  if (template === 'notes' || template === 'chat')
    rows.push(
      `| Records | \`db\` port, SQLite (\`${pkg}/db/sqlite\`) | the opener, \`src/db.ts\`: call another provider there; no route, store or test changes |`,
    )
  rows.push(
    `| Small state | \`kv\` port, one JSON file (\`${pkg}/kv/json\`) | \`${pkg}/kv/db\` keeps it in the \`db\`; or a provider of your own; the opener is the only file that changes |`,
  )
  rows.push(
    template === 'bun'
      ? `| Server | Bun | \`${pkg}/node-server\` for Node, or the adapter of another runtime; \`src/index.ts\` is the only file that changes |`
      : `| Server | Node (\`${pkg}/node-server\`) | the adapter of another runtime (\`${pkg}/bun\`, ...); \`src/index.ts\` is the only file that changes |`,
  )
  rows.push(
    `| Window | the browser | \`npx ${pkg} add desktop\` adds an Electron window on the same server; the app's code never imports Electron |`,
  )
  if (template === 'nodejs' || template === 'notes' || template === 'chat')
    rows.push(
      `| Browser code | \`clientModules\`, no bundler | a bundler (Vite, esbuild) in front of \`src/client\`, wrapped in a plugin of its own |`,
    )
  return rows
}

/** The section every app carries: the framework is a set of defaults, never a rule. */
export function defaultsSection(template: Template, pkg: string): string {
  return `## Defaults you can swap

The framework is not rigid. Every choice is a plugin behind a port, and what the app starts with is only a fallback. Name the default before you change it,
and swap it at the one place that opens it.

| Choice | Default | To swap it |
| --- | --- | --- |
${defaultRows(template, pkg).join('\n')}

- **An outside tool** (a database server, a bundler, a router such as Vike) joins the app as a provider: a plugin in \`plugins/<name>/\` that implements a port and
  passes that port's conformance tests, then the opener names it. Postgres is such a provider and is not part of this package; add it when the app needs it.
- **The dependency rule:** only the opener imports a provider; everything else takes the port as an argument. \`${pkg} check-deps\` enforces it.
`
}

/** Where the plugins are, said once. */
export function pluginsSection(pkg: string): string {
  return `## Plugins

There is one plugin folder: \`plugins/\` at the root of the app. A plugin is a folder \`plugins/<name>/\` with an \`index.ts\`. \`${pkg} add <name>\` copies a library plugin
there; a plugin you or an agent write goes there too. Do not create \`src/plugins/\` or \`extensions/\`.
`
}

/** The door, as far as it is decided. */
export function doorSection(): string {
  return `## The door

${DOOR_LINE}
`
}

/** The text of the one skill. It repeats nothing of the docs; it says where to look and how to work. */
export function skillText(name: string, template: Template, pkg: string): string {
  return `---
name: app-guide
description: How to change, run and check the ${name} app. Use it before adding a feature, a page, a route, a plugin or a dependency to this app, and before saying the work is done.
---

# Working in ${name}

1. **Read first.** \`AGENTS.md\` in this folder says how the app is laid out. The framework's API is in \`docs/framework/\`: start at \`docs/framework/README.md\`, and
   \`docs/framework/api/summary.md\` is the one-page summary. Parts the docs mark "not yet available" are not in the package.
2. **Make the change small.** A route is a function from \`Request\` to \`Response\`: test it with \`await app.request('/path')\`. ${template === 'notes' || template === 'chat' ? 'A change to the data is the next numbered file in \`migrations/\`; never edit one that has run.' : 'Keep new code in \`src/\` next to the code it extends.'}
3. **One plugin folder.** A plugin lives in \`plugins/<name>/\` (\`${pkg} add <name>\` copies a library plugin there). There is no \`src/plugins/\` and no \`extensions/\`.
4. **Defaults are swappable.** The database, the key-value store, the server and the window are plugins behind ports. The table "Defaults you can swap" in \`AGENTS.md\` names each default and the one file that changes it. Never reach around a port to a driver: \`${pkg} check-deps\` fails the check.
5. **Look at the running app.** ${DOOR_LINE}
6. **Done means checked.** \`npm test\` and \`npm run check\` pass, and the change shows in the running app after a restart. No secret goes in a file or in \`git status\`: keys come from environment variables.
`
}

/** Write the same text to `AGENTS.md` and `CLAUDE.md`, and the skill to every folder an agent looks in. */
export function writeSelfKnowledge(
  target: string,
  agentsText: string,
  skill: string,
): string[] {
  const written = ['AGENTS.md', 'CLAUDE.md']
  writeFileSync(join(target, 'AGENTS.md'), agentsText)
  writeFileSync(join(target, 'CLAUDE.md'), agentsText)
  for (const folder of SKILL_FOLDERS) {
    const file = join(target, folder, 'SKILL.md')
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, skill)
    written.push(`${folder}/SKILL.md`)
  }
  return written
}
