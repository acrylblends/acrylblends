#!/usr/bin/env node
// Turn your app into an entry of this registry:   node scripts/make-entry.mjs <your app folder> <login>.<name> [--description "..."] [--license MIT]
// Copies the app to blends/<login>.<name>/ without what an entry does not carry (node_modules, dist, data, .git, the framework docs, the agent's scratch), makes its blend.yaml public
// and licensed under that id, and writes acryl.template.json, which marks the entry as an app for acrylblends. Then: commit, push to your fork, open a pull request.
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { description: { type: 'string' }, license: { type: 'string' } },
})
const [source, id] = positionals
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
if (!source || !id || !/^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/u.test(id)) {
  console.error(
    'usage: node scripts/make-entry.mjs <your app folder> <login>.<name>   (lower case; <login> is your GitHub login)',
  )
  process.exit(2)
}
const app = resolve(source)
if (!existsSync(join(app, 'blend.yaml')) || !existsSync(join(app, 'package.json'))) {
  console.error(`${app} is not an acrylblends app (no blend.yaml and package.json)`)
  process.exit(1)
}
const target = join(root, 'blends', id)
if (existsSync(target)) {
  console.error(`${target} exists already; change that entry by editing it, or choose another name`)
  process.exit(1)
}
const SKIP =
  /(^|[\\/])(node_modules|dist|data|\.git|\.acrylblends|\.acryl|docs[\\/]framework)([\\/]|$)/u
mkdirSync(dirname(target), { recursive: true })
cpSync(app, target, {
  recursive: true,
  filter: (path) => {
    const rel = path.slice(app.length)
    if (SKIP.test(rel)) return false
    if (lstatSync(path).isSymbolicLink()) {
      console.error(`skipped a link: ${rel}`)
      return false
    }
    return true
  },
})
if (existsSync(join(target, '.gitignore')))
  renameSync(join(target, '.gitignore'), join(target, 'gitignore'))
const manifestFile = join(target, 'blend.yaml')
const text = readFileSync(manifestFile, 'utf8')
const meta = /^metadata:\n(?:[ \t]+.*\n|[ \t]*\n)*/mu.exec(text)
if (!meta) {
  rmSync(target, { recursive: true, force: true })
  console.error('blend.yaml has no metadata block')
  process.exit(1)
}
const name = (/^\s+name:\s*(.+)$/mu.exec(meta[0])?.[1] ?? id).replaceAll('"', '').trim()
const description = values.description ?? `${name}, an acrylblends app made at the workshop.`
writeFileSync(
  manifestFile,
  text.replace(
    meta[0],
    [
      'metadata:',
      `  id: ${id}`,
      `  name: ${JSON.stringify(name)}`,
      '  version: 0.1.0',
      '  category: workshop',
      `  description: ${JSON.stringify(description)}`,
      `  license: ${values.license ?? 'MIT'}`,
      '  visibility: public',
      '',
    ].join('\n'),
  ),
)
writeFileSync(
  join(target, 'acryl.template.json'),
  `${JSON.stringify({ name, description, plugins: [] }, null, 2)}\n`,
)
console.log(
  `made blends/${id}/. Next:  git add blends/${id} && git commit -m "add ${id}" && git push, then open a pull request.`,
)
