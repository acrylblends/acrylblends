#!/usr/bin/env node
// Vendor the built framework package of ACRYL (distribution/acrylblends-framework, packed) as the root of the acrylblends package: lib/ and the exports map.
//
//   node scripts/vendor-framework-package.mjs <acrylblends-framework tarball> <ACRYL commit it was built from>
//
// The package name inside the tarball is swapped for ours (scripts/lib/names.mjs); nothing else in lib/ is touched. The record packages/cli/framework.json holds the commit, the
// checksum of the tarball and a digest of lib/, and `pnpm run verify:framework` fails when lib/ differs from it. Never edit lib/ here.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { digestOf, listFiles } from './lib/framework.mjs'
import { PACKAGE } from './lib/names.mjs'

const [tarball, commit] = process.argv.slice(2)
if (!tarball || !commit) {
  console.error('usage: node scripts/vendor-framework-package.mjs <tarball> <ACRYL commit>')
  process.exit(2)
}
const cli = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'cli')
const scratch = mkdtempSync(join(tmpdir(), 'acrylblends-framework-'))
execFileSync('tar', ['-xzf', resolve(tarball), '-C', scratch])
const unpacked = join(scratch, 'package')
const source = JSON.parse(readFileSync(join(unpacked, 'package.json'), 'utf8'))
const text = (path) => readFileSync(path, 'utf8')

rmSync(join(cli, 'lib'), { recursive: true, force: true })
cpSync(join(unpacked, 'lib'), join(cli, 'lib'), { recursive: true })
cpSync(join(unpacked, 'LICENSE'), join(cli, 'LICENSE'))

const files = new Map(
  listFiles(join(cli, 'lib')).map((file) => [file, readFileSync(join(cli, 'lib', file))]),
)
const stale = [...files].filter(([, bytes]) => bytes.toString('utf8').includes(source.name))
if (stale.length > 0)
  throw new Error(`lib/ still names ${source.name}: ${stale.map(([f]) => f).join(', ')}`)

const pkgFile = join(cli, 'package.json')
const pkg = JSON.parse(text(pkgFile))
pkg.main = './lib/index.js'
pkg.types = './lib/index.d.ts'
pkg.sideEffects = false
pkg.exports = {
  ...source.exports,
  './cli': { types: './dist/index.d.ts', default: './dist/index.js' },
  './package.json': './package.json',
}
if (!pkg.files.includes('lib'))
  pkg.files = [
    'bin',
    'dist',
    'lib',
    ...pkg.files.filter((f) => !['bin', 'dist', 'lib'].includes(f)),
  ]
writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`)

const record = {
  source: {
    repo: 'acryldev/acryl',
    path: 'distribution/acrylblends-framework',
    commit,
    packedAs: `${source.name}@${source.version}`,
  },
  tarballSha256: createHash('sha256')
    .update(readFileSync(resolve(tarball)))
    .digest('hex'),
  package: PACKAGE,
  subpaths: Object.keys(source.exports).length,
  files: files.size,
  digest: digestOf(files),
}
writeFileSync(join(cli, 'framework.json'), `${JSON.stringify(record, null, 2)}\n`)
rmSync(scratch, { recursive: true, force: true })
console.log(
  `vendored ${source.name}@${source.version}: ${files.size} files, ${record.subpaths} subpaths, ${record.digest.slice(0, 19)}`,
)
