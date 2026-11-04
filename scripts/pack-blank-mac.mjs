#!/usr/bin/env node
/**
 * The Blank app as a macOS product (M10 T002): scaffold a Blank app with the desktop shell, install it, make the workspace links real files, mark it as a
 * product, and package it with electron-builder as an unsigned DMG. First run only, for this Mac's CPU.
 *
 *   node scripts/pack-blank-mac.mjs [--out <dir>] [--arch arm64|x64]
 *
 * The DMG carries the app itself: the frame and the Blank app it builds in, with Electron's own Node, so it needs no Node, npm or git. The bundle is
 * read-only; the packaged app copies it into the person's Documents on first start (plugins/desktop/product.ts).
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const option = (name, fallback) => {
  const at = args.indexOf(name)
  return at === -1 ? fallback : args[at + 1]
}
const arch = option('--arch', 'arm64')
const out = resolve(option('--out', join(root, 'dist', 'blank-mac')))
const work = join(root, 'dist', 'blank-mac-work')
const app = join(work, 'app')
const log = (line) => console.log(`pack-blank-mac: ${line}`)

if (!existsSync(join(root, 'ide', 'acryl-blends-frame', 'lib')) || !existsSync(join(root, 'packages', 'cli', 'dist')))
  throw new Error('the checkout is not built: run `corepack pnpm run build` first')

// 1. A Blank app with the desktop shell, made by this checkout's CLI, exactly as a person would make one.
rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })
const { frameSpecsEnv } = await import(join(root, 'scripts/lib/ide-specs.mjs'))
const cliVersion = JSON.parse(readFileSync(join(root, 'packages/cli/package.json'), 'utf8')).version
const init = spawnSync(
  process.execPath,
  [join(root, 'packages/cli/bin/acrylblends.js'), 'init', app, '--name', 'acryl-blends-blank', '--template', 'blank', '--desktop', '--yes', '--no-next'],
  {
    stdio: 'inherit',
    env: { ...process.env, ACRYLBLENDS_FRAME_PACKAGES: frameSpecsEnv(root, { dshVersion: '0.2.0-rc.2', frameworkVersion: `^${cliVersion}` }) },
  },
)
if (init.status !== 0) throw new Error(`init failed (${String(init.status)})`)
log(`scaffolded ${app}`)

// 2. Its packages, as npm installs them.
const install = spawnSync('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: app, stdio: 'inherit' })
if (install.status !== 0) throw new Error(`npm install failed (${String(install.status)})`)

// 3. npm links the workspace packages (file: specs) instead of copying them, and those links point at this checkout: a bundle must carry the files.
const materialize = (path) => {
  const target = execFileSync('readlink', [path], { encoding: 'utf8' }).trim()
  rmSync(path, { recursive: true, force: true })
  cpSync(resolve(dirname(path), target), path, { recursive: true, dereference: true })
}
const modules = join(app, 'node_modules')
for (const entry of readdirSync(modules)) {
  if (entry === '.bin') continue
  const path = join(modules, entry)
  const stat = lstatSync(path)
  if (stat.isSymbolicLink()) {
    materialize(path)
    log(`materialized ${entry}`)
  } else if (stat.isDirectory() && entry.startsWith('@')) {
    for (const scoped of readdirSync(path)) {
      const scopedPath = join(path, scoped)
      if (!lstatSync(scopedPath).isSymbolicLink()) continue
      materialize(scopedPath)
      log(`materialized ${entry}/${scoped}`)
    }
  }
}

// 4. The product marker, and what Electron needs to find its main process and the packager its identity.
const manifest = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'))
manifest.main = 'plugins/desktop/main.ts'
manifest.productName = 'ACRYL Blends Blank'
manifest.description = 'The ACRYL Blends frame around an empty app: make it yours from the chat.'
manifest.build = {
  appId: 'dev.acrylblends.blank',
  productName: 'ACRYL Blends Blank',
  asar: false,
  npmRebuild: false,
  files: ['**/*', '!dist/**', '!**/.acrylblends/**', '!**/*.map', ],
  directories: { output: 'dist' },
  mac: {
    target: [{ target: 'dmg', arch: [arch] }],
    identity: null,
    category: 'public.app-category.developer-tools',
    icon: undefined,
  },
  dmg: { title: 'ACRYL Blends Blank' },
}
writeFileSync(join(app, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
writeFileSync(join(app, 'product.json'), `${JSON.stringify({ appFolder: 'ACRYL Blends Blank' }, null, 2)}\n`)

// 5. Package it. The builder is not a dependency of this repo yet; a checkout of ACRYL has one, and npx fetches one otherwise.
const builder = process.env.ELECTRON_BUILDER
const command = builder === undefined ? 'npx' : process.execPath
const builderArgs = builder !== undefined
  ? [builder, '--mac', 'dmg', `--${arch}`, '--publish', 'never']
  : ['--yes', 'electron-builder@26.15.7', '--mac', 'dmg', `--${arch}`, '--publish', 'never']
log(`packaging with ${builder ?? 'npx electron-builder@26.15.7'}`)
const pack = spawnSync(command, builderArgs, { cwd: app, stdio: 'inherit', env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } })
if (pack.status !== 0) throw new Error(`electron-builder failed (${String(pack.status)})`)

// 6. The DMG, under the name the person is given.
const produced = readdirSync(join(app, 'dist')).filter((file) => file.endsWith('.dmg'))
if (produced.length === 0) throw new Error('electron-builder wrote no .dmg')
mkdirSync(out, { recursive: true })
for (const file of readdirSync(out)) if (file.endsWith('.dmg')) rmSync(join(out, file), { force: true })
const target = join(out, 'ACRYL-Blends-Blank-arm64.dmg')
cpSync(join(app, 'dist', produced[0]), target)
log(`done: ${target} (${String(Math.round(statSync(target).size / 1024 / 1024))} MB)`)
