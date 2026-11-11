#!/usr/bin/env node
// Make an app from this checkout, to try work that is not on npm yet: the same `acrylblends init --desktop --install` a person runs, with the frame and
// the framework taken from this checkout's build (`file:` links) instead of the registry. Build the checkout first (`pnpm run build`).
//
//   pnpm run try <folder> [starter]      e.g. pnpm run try ~/acryl-test/shop        (starter: blank when absent)
//
// Then: cd <folder> && npm run dev   (browser)   or   npm run desktop   (window)
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { frameSpecsEnv } from './lib/ide-specs.mjs'

const root = resolve(import.meta.dirname, '..')
const [folder, starter = 'blank'] = process.argv.slice(2)
if (folder === undefined) {
  console.error(
    'usage: pnpm run try <folder> [starter]   for example: pnpm run try ~/acryl-test/shop',
  )
  process.exit(2)
}
const cli = join(root, 'packages', 'cli', 'bin', 'acrylblends.js')
if (!existsSync(join(root, 'ide', 'acryl-blends-frame', 'lib', 'index.js'))) {
  console.error('try: this checkout is not built yet; run pnpm run build first')
  process.exit(1)
}
const app = resolve(folder)
const result = spawnSync(
  process.execPath,
  [cli, 'init', app, '--template', starter, '--desktop', '--install', '--yes', '--no-next'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      ACRYLBLENDS_FRAME_PACKAGES: frameSpecsEnv(root, {
        dshVersion: JSON.parse(readFileSync(join(root, 'frame', 'packages.json'), 'utf8'))
          .dshVersion,
      }),
    },
  },
)
if (result.status !== 0) process.exit(result.status ?? 1)
console.log(
  `\ntry: ready. Run it:\n  cd ${app}\n  npm run dev        (in the browser)\n  npm run desktop    (in its own window)\n`,
)
