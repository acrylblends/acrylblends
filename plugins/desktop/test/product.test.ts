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
import { firstRunRoot, readProduct } from '../product.ts'

const scratch = (): string => mkdtempSync(join(tmpdir(), 'acryl-product-'))

/** A bundle as electron-builder leaves it: no `.git`, a filtered manifest, and the carriers the packer adds. */
function bundle(root: string): void {
  mkdirSync(join(root, 'src'), { recursive: true })
  mkdirSync(join(root, 'dist'), { recursive: true })
  mkdirSync(join(root, '.acrylblends'), { recursive: true })
  mkdirSync(join(root, 'node_modules'), { recursive: true })
  mkdirSync(join(root, 'template-git', 'objects'), { recursive: true })
  writeFileSync(join(root, 'package.json'), '{}\n')
  writeFileSync(join(root, 'product.json'), '{"appFolder":"Test App"}\n')
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

const excludeOf = (destination: string): string =>
  readFileSync(join(destination, '.git', 'info', 'exclude'), 'utf8')

test('reads the product marker, and refuses a folder without a usable app name', () => {
  const root = scratch()
  assert.equal(readProduct(root), undefined)
  writeFileSync(join(root, 'product.json'), '{"appFolder":"  "}\n')
  assert.equal(readProduct(root), undefined)
  writeFileSync(join(root, 'product.json'), '{"appFolder":"Test App"}\n')
  assert.deepEqual(readProduct(root), { appFolder: 'Test App' })
})

test('the first start copies the app into Documents and writes back what the packager drops or filters', () => {
  const root = scratch()
  const documents = scratch()
  bundle(root)
  // The bundled root arrives as a URL's directory, with a trailing separator: the skip list must still name the bundle's top level.
  const destination = firstRunRoot(`${root}${sep}`, documents, () => {})
  assert.equal(destination, join(documents, 'Test App'))
  // The `.gitignore` and the manifest the packager refused to ship are there as themselves.
  assert.equal(
    readFileSync(join(destination, '.gitignore'), 'utf8'),
    'node_modules/\n.acrylblends/\n',
  )
  assert.equal(
    readFileSync(join(destination, 'package.json'), 'utf8'),
    '{"name":"test-app","scripts":{"dev":"node x"}}\n',
  )
  // The repository travels as its carrier and becomes `.git`; the carrier names do not stay in the copy.
  assert.equal(readFileSync(join(destination, '.git', 'HEAD'), 'utf8'), 'ref: refs/heads/main\n')
  for (const absent of [
    'template-git',
    'gitignore-product',
    'package-product.json',
    'dist',
    '.acrylblends',
  ])
    assert.equal(existsSync(join(destination, absent)), false, absent)
  // Build output and app data are left out; the app's own tree and its packages are kept.
  assert.equal(readFileSync(join(destination, 'src', 'app.ts'), 'utf8'), 'export {}\n')
  assert.equal(readFileSync(join(destination, 'node_modules', 'dep.js'), 'utf8'), 'x')
  // The product marker is ignored locally, never through the app's own `.gitignore`.
  assert.match(excludeOf(destination), /^product\.json$/mu)
})

test('a later start keeps the person’s copy, restores a missing .gitignore, and drops a leftover carrier', () => {
  const root = scratch()
  const documents = scratch()
  bundle(root)
  const destination = join(documents, 'Test App')
  mkdirSync(join(destination, '.git', 'info'), { recursive: true })
  writeFileSync(
    join(destination, 'package.json'),
    '{"name":"test-app","dependencies":{"mine":"1.0.0"}}\n',
  )
  writeFileSync(join(destination, '.git', 'HEAD'), 'ref: refs/heads/main\n')
  mkdirSync(join(destination, 'template-git'), { recursive: true })
  writeFileSync(join(destination, 'template-git', 'HEAD'), 'ref: refs/heads/main\n')
  const lines: string[] = []
  assert.equal(
    firstRunRoot(root, documents, (line) => lines.push(line)),
    destination,
  )
  assert.equal(
    readFileSync(join(destination, '.gitignore'), 'utf8'),
    'node_modules/\n.acrylblends/\n',
  )
  assert.equal(existsSync(join(destination, 'template-git')), false)
  // The person's manifest is theirs: a package they added is not replaced by the bundle's.
  assert.match(readFileSync(join(destination, 'package.json'), 'utf8'), /"mine":"1\.0\.0"/u)
  assert.match(excludeOf(destination), /^product\.json$/mu)
  // Bringing the same copy forward again writes nothing new.
  const before = excludeOf(destination)
  firstRunRoot(root, documents, () => {})
  assert.equal(excludeOf(destination), before)
  assert.equal(lines.length, 2)
})

test('a folder without the marker is its own app and is not copied', () => {
  const root = scratch()
  const documents = scratch()
  assert.equal(
    firstRunRoot(root, documents, () => {}),
    root,
  )
  assert.deepEqual(readdirSync(documents), [])
})
