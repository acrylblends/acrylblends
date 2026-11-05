import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { test } from 'node:test'
import { openProductStorage } from '../../instance/storage.ts'
import { openProductApp, readProduct, seedSource } from '../product.ts'

const scratch = (): string => mkdtempSync(join(tmpdir(), 'acryl-product-'))

/** A bundle as electron-builder leaves it: no `.git`, a filtered manifest, and the carriers the packer adds. */
function bundle(root: string): void {
  mkdirSync(join(root, 'src'), { recursive: true })
  mkdirSync(join(root, 'dist'), { recursive: true })
  mkdirSync(join(root, '.acrylblends'), { recursive: true })
  mkdirSync(join(root, 'node_modules'), { recursive: true })
  mkdirSync(join(root, 'template-git', 'objects'), { recursive: true })
  writeFileSync(join(root, 'package.json'), '{}\n')
  writeFileSync(join(root, 'product.json'), '{"product":"Test Product","appName":"Test App"}\n')
  writeFileSync(
    join(root, 'package-product.json'),
    '{"name":"test-app","scripts":{"dev":"node x"}}\n',
  )
  writeFileSync(join(root, 'gitignore-product'), 'node_modules/\n.acrylblends/\n')
  writeFileSync(join(root, 'src', 'app.ts'), 'export {}\n')
  writeFileSync(join(root, 'dist', 'build.txt'), 'x')
  writeFileSync(join(root, '.acrylblends', 'state.yaml'), 'x')
  writeFileSync(join(root, 'node_modules', 'dep.js'), 'x')
  writeFileSync(join(root, 'template-git', 'HEAD'), 'ref: refs/heads/main\n')
}

const excludeOf = (source: string): string =>
  readFileSync(join(source, '.git', 'info', 'exclude'), 'utf8')

/** A product's storage under a moved home: the per-OS rule of this machine, never the real one. */
const storageIn = (home: string) =>
  openProductStorage({ product: 'Test Product', writtenBy: '1.0.0', env: { HOME: home }, home })

test('reads the product marker: its name, and the first app’s name (the product’s when absent); a marker without a product is none', () => {
  const root = scratch()
  assert.equal(readProduct(root), undefined)
  writeFileSync(join(root, 'product.json'), '{"product":"  "}\n')
  assert.equal(readProduct(root), undefined)
  // The marker an earlier build wrote names a Documents folder: it is not a product of this layout.
  writeFileSync(join(root, 'product.json'), '{"appFolder":"Test App"}\n')
  assert.equal(readProduct(root), undefined)
  writeFileSync(join(root, 'product.json'), '{"product":"Test Product"}\n')
  assert.deepEqual(readProduct(root), { product: 'Test Product', appName: 'Test Product' })
  writeFileSync(join(root, 'product.json'), '{"product":"Test Product","appName":" Mine "}\n')
  assert.deepEqual(readProduct(root), { product: 'Test Product', appName: 'Mine' })
})

test('a new app’s source is the bundled app with what the packager drops or filters written back, and without build output, app data or the marker', () => {
  const root = scratch()
  const source = join(scratch(), 'source')
  bundle(root)
  // The bundled root arrives as a URL's directory, with a trailing separator: the skip list must still name the bundle's top level.
  seedSource(`${root}${sep}`, source)
  // The `.gitignore` and the manifest the packager refused to ship are there as themselves.
  assert.equal(readFileSync(join(source, '.gitignore'), 'utf8'), 'node_modules/\n.acrylblends/\n')
  assert.equal(
    readFileSync(join(source, 'package.json'), 'utf8'),
    '{"name":"test-app","scripts":{"dev":"node x"}}\n',
  )
  // The repository travels as its carrier and becomes `.git`; the carrier names do not stay in the source.
  assert.equal(readFileSync(join(source, '.git', 'HEAD'), 'utf8'), 'ref: refs/heads/main\n')
  for (const absent of [
    'template-git',
    'gitignore-product',
    'package-product.json',
    'product.json',
    'dist',
    '.acrylblends',
  ])
    assert.equal(existsSync(join(source, absent)), false, absent)
  assert.equal(readFileSync(join(source, 'src', 'app.ts'), 'utf8'), 'export {}\n')
  // The packages still travel with the source until the framework resolves from the bundle (app-storage.md slice 3).
  assert.equal(readFileSync(join(source, 'node_modules', 'dep.js'), 'utf8'), 'x')
  // The product's names are ignored locally, never through the app's own `.gitignore`.
  assert.match(excludeOf(source), /^product\.json$/mu)
})

test('the first start makes one app in the product’s root, never in Documents; a later start opens it again and never seeds it twice', () => {
  const root = scratch()
  bundle(root)
  const home = scratch()
  const product = { product: 'Test Product', appName: 'Test App' }
  const lines: string[] = []
  const first = openProductApp(storageIn(home), product, root, (line) => lines.push(line))
  assert.equal(first.kind, 'product')
  assert.equal(first.name, 'Test App')
  assert.match(first.id, /^test-app-[0-9a-f]{4}$/u)
  // Source, data (the engine's home, its logs inside) and cache, in one folder of the product's root under the moved home.
  assert.ok(first.root.startsWith(home), first.root)
  assert.ok(first.root.endsWith(join('Test Product', 'apps', first.id, 'source')), first.root)
  assert.equal(first.home, join(first.root, '..', 'data'))
  assert.equal(first.dshHome, first.home)
  assert.ok(existsSync(join(first.home, 'logs')))
  assert.equal(readFileSync(join(first.root, 'src', 'app.ts'), 'utf8'), 'export {}\n')
  assert.equal(existsSync(join(home, 'Documents')), false)

  // The person's change survives the next start: the source is theirs, and the bundle is not copied over it.
  writeFileSync(join(first.root, 'src', 'app.ts'), 'export const mine = 1\n')
  const again = openProductApp(storageIn(home), product, root, (line) => lines.push(line))
  assert.equal(again.id, first.id)
  assert.equal(readFileSync(join(again.root, 'src', 'app.ts'), 'utf8'), 'export const mine = 1\n')
  assert.equal(lines.length, 1)
  assert.equal(storageIn(home).apps().length, 1)
  assert.ok(storageIn(home).apps()[0]?.lastOpened !== undefined)
})

test('a seed that fails leaves no app behind: no registry entry and no folder', () => {
  const home = scratch()
  const storage = storageIn(home)
  assert.throws(
    () =>
      storage.create('Broken', () => {
        throw new Error('the bundle is unreadable')
      }),
    /the bundle is unreadable/u,
  )
  assert.deepEqual(storage.apps(), [])
  const apps = join(storage.electron, '..', 'apps')
  assert.deepEqual(existsSync(apps) ? readdirSync(apps) : [], [])
})

test('a root written by a newer version stops with a message naming that version, and is left as it was', () => {
  const home = scratch()
  const storage = storageIn(home)
  const layout = join(storage.electron, '..', 'layout.json')
  const newer = '{"layout":2,"writtenBy":"9.0.0"}'
  writeFileSync(layout, newer)
  assert.throws(
    () => storageIn(home),
    /written by Test Product 9\.0\.0, which is newer than this one \(1\.0\.0\)/u,
  )
  assert.equal(readFileSync(layout, 'utf8'), newer)
})
