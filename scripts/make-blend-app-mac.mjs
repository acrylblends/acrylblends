#!/usr/bin/env node
/**
 * One OS app per Blend, macOS spike (specs/049-framework-architecture/app-storage.md in ACRYL, "one OS app per Blend"): turn the packed product
 * (`pack-blank-mac.mjs`) into a second app with its own name, bundle id, Dock identity and its own root in the OS data folder.
 *
 *   node scripts/make-blend-app-mac.mjs --engine <ACRYL Blends.app> --name MyAccounting [--out <dir>]
 *
 * A signed app cannot be renamed without breaking its seal, so the copy is made where the Blend is installed and sealed again there, ad hoc (no
 * certificate). The copy is an APFS clone (`cp -c`): it shares the engine's disk blocks until a file changes. Everything the name touches is renamed
 * together, because Electron finds its helper apps by the main executable's name: the executable, the four helper apps and their executables, and
 * the bundle keys of all five Info.plists. `product.json` names the product after the Blend, so its apps live in `Application Support/<Name>/`
 * (plugins/instance/storage.ts) and share nothing with the engine's or another Blend's.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const option = (name) => {
  const at = args.indexOf(name)
  return at === -1 ? undefined : args[at + 1]
}
const engine = option('--engine')
const name = option('--name')
const out = resolve(option('--out') ?? '.')
if (engine === undefined || name === undefined)
  throw new Error('usage: make-blend-app-mac.mjs --engine <App.app> --name <Name> [--out <dir>]')
// A name that is a folder name on every OS (storage.ts `isPortableName`, the same rule) and a file name inside an Info.plist.
if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{0,62}$/u.test(name))
  throw new Error(`"${name}" cannot be an app name: letters, digits, space, - and _`)

const run = (file, argv) => execFileSync(file, argv, { encoding: 'utf8' }).trim()
const plist = (file, key) => {
  try {
    return run('plutil', ['-extract', key, 'raw', '-o', '-', file])
  } catch {
    return undefined
  }
}

const target = join(out, `${name}.app`)
if (existsSync(target)) throw new Error(`${target} exists`)
const contents = join(target, 'Contents')
run('cp', ['-cR', engine, target])

const oldName = plist(join(contents, 'Info.plist'), 'CFBundleExecutable')
const oldId = plist(join(contents, 'Info.plist'), 'CFBundleIdentifier')
if (oldName === undefined || oldId === undefined)
  throw new Error('the engine has no Info.plist identity')
const slug = name
  .toLowerCase()
  .replace(/[^a-z0-9]+/gu, '-')
  .replace(/^-|-$/gu, '')
const newId = `dev.acrylblends.app.${slug}`

/** The main app and the four helpers: bundle keys renamed, then the executable. */
const frameworks = join(contents, 'Frameworks')
const bundles = [
  { dir: target, exe: join(contents, 'MacOS') },
  ...readdirSync(frameworks)
    .filter((entry) => entry.startsWith(`${oldName} Helper`) && entry.endsWith('.app'))
    .map((entry) => ({
      dir: join(frameworks, entry),
      exe: join(frameworks, entry, 'Contents', 'MacOS'),
    })),
]
for (const { dir, exe } of bundles) {
  const info = join(dir, 'Contents', 'Info.plist')
  for (const key of ['CFBundleExecutable', 'CFBundleName', 'CFBundleDisplayName']) {
    const value = plist(info, key)
    if (value !== undefined)
      run('plutil', ['-replace', key, '-string', value.replace(oldName, name), info])
  }
  const id = plist(info, 'CFBundleIdentifier')
  if (id !== undefined)
    run('plutil', ['-replace', 'CFBundleIdentifier', '-string', id.replace(oldId, newId), info])
  for (const file of readdirSync(exe))
    if (file.startsWith(oldName))
      renameSync(join(exe, file), join(exe, file.replace(oldName, name)))
}
// Helper app folders last: their names are what the main executable looks up.
for (const { dir } of bundles.slice(1))
  renameSync(dir, join(frameworks, dir.slice(frameworks.length + 1).replace(oldName, name)))

// The product after the Blend: its root in the OS data folder, and the name of its first app.
const marker = join(contents, 'Resources', 'app', 'product.json')
const product = JSON.parse(readFileSync(marker, 'utf8'))
writeFileSync(marker, `${JSON.stringify({ ...product, product: name, appName: name }, null, 2)}\n`)

run('codesign', ['--force', '--deep', '-s', '-', target])
run('codesign', ['--verify', '--deep', '--strict', target])
console.log(`make-blend-app-mac: ${target} (${newId}), sealed ad hoc, verified`)
