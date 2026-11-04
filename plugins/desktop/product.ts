/**
 * A product build (M10 T002): a desktop package that ships an app as its own starting point. `product.json` at the app root marks it, and the packaged app
 * copies that tree into the person's Documents the first time it starts, then runs there. The bundle itself is read-only (a mounted DMG can never be written
 * to), and the app folder a person builds in has to be theirs.
 */

import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export interface Product {
  /** The folder this product makes in Documents, and runs the frame on. */
  readonly appFolder: string
}

/** The product marker at the app root, or undefined for an app made with `acrylblends init` and started with `npm run desktop`. */
export function readProduct(root: string): Product | undefined {
  try {
    const value: unknown = JSON.parse(readFileSync(join(root, 'product.json'), 'utf8'))
    if (value === null || typeof value !== 'object') return undefined
    const folder = (value as { appFolder?: unknown }).appFolder
    return typeof folder === 'string' && folder.trim() !== ''
      ? { appFolder: folder.trim() }
      : undefined
  } catch {
    return undefined
  }
}

/**
 * What the copied app folder does not carry: build output, the bundle's own app data, and the carrier names the packager keeps files under.
 * The scaffold's `.git` travels, so branches and versions work; the carriers become their files in the copy (see `CARRIED`).
 */
const SKIPPED = new Set([
  'dist',
  '.acrylblends',
  'template-git',
  'gitignore-product',
  'package-product.json',
])

/**
 * The app's own files that the packager drops or rewrites inside a bundle, and the plain names they travel under. electron-builder excludes `.gitignore`
 * by name, and it ships a filtered manifest (the `scripts` block goes), so neither can reach the copy as itself; `firstRunRoot` writes them back.
 */
const CARRIED: readonly { readonly carrier: string; readonly file: string }[] = [
  { carrier: 'gitignore-product', file: '.gitignore' },
  { carrier: 'package-product.json', file: 'package.json' },
]

/**
 * What a product build adds to the app folder: Electron's packaging, not the person's app. A repository-local exclude keeps these out of `git status`
 * without editing the app's own tracked `.gitignore`.
 */
const PRODUCT_NAMES = [
  'product.json',
  'gitignore-product',
  'package-product.json',
  'template-git/',
] as const

/** Write back the files the packager drops or filters, from the carriers the bundle keeps them under. */
function writeCarried(root: string, destination: string, only?: string): void {
  for (const { carrier, file } of CARRIED) {
    if (only !== undefined && file !== only) continue
    const source = join(root, carrier)
    if (existsSync(source)) cpSync(source, join(destination, file), { force: true })
  }
}

/** Keep the product's own files out of the app folder's `git status`, the way git's local exclude is meant for. */
function ignoreProductFiles(destination: string): void {
  const git = join(destination, '.git')
  if (!existsSync(git)) return
  const info = join(git, 'info')
  const file = join(info, 'exclude')
  const before = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const known = new Set(before.split('\n').map((line) => line.trim()))
  const missing = PRODUCT_NAMES.filter((name) => !known.has(name))
  if (missing.length === 0) return
  mkdirSync(info, { recursive: true })
  const separator = before === '' || before.endsWith('\n') ? '' : '\n'
  appendFileSync(file, `${separator}${missing.join('\n')}\n`)
}

/**
 * The folder the product runs on: the bundle's own tree copied into Documents on the first start, or the copy made then.
 * @param root - the bundled app (read-only).
 * @param documents - the person's Documents folder (`app.getPath('documents')`).
 * @returns the app folder to run on.
 */
export function firstRunRoot(
  root: string,
  documents: string,
  log: (line: string) => void = console.log,
): string {
  const product = readProduct(root)
  if (product === undefined) return root
  const destination = join(documents, product.appFolder)
  if (existsSync(join(destination, 'package.json'))) {
    // The copy is the person's now. Only files an earlier build could not write are brought forward; nothing of theirs is touched (their manifest, in
    // particular, may carry dependencies they added since).
    if (
      !existsSync(join(destination, '.gitignore')) &&
      existsSync(join(root, 'gitignore-product'))
    ) {
      writeCarried(root, destination, '.gitignore')
      log(`product: restored .gitignore in ${destination}`)
    }
    // A build before the carriers existed left its copy of the repository here; it is a duplicate of `.git` and never the person's work.
    const carriedGit = join(destination, 'template-git')
    if (existsSync(carriedGit) && existsSync(join(destination, '.git'))) {
      rmSync(carriedGit, { recursive: true, force: true })
      log(`product: removed the leftover template-git folder in ${destination}`)
    }
    ignoreProductFiles(destination)
    return destination
  }
  log(`product: creating ${destination} from the bundled app (first start, one time)`)
  mkdirSync(documents, { recursive: true })
  cpSync(root, destination, {
    recursive: true,
    dereference: true,
    errorOnExist: false,
    force: true,
    // The bundled root arrives as a URL's directory and can end in a separator: the first segment is taken relative to it, never by index.
    filter: (source) => !SKIPPED.has(relative(root, source).split(sep)[0] ?? ''),
  })
  // The packager drops dot files like `.git`; the scaffold's repository travels as `template-git` and becomes the app folder's own.
  const templateGit = join(root, 'template-git')
  if (existsSync(templateGit))
    cpSync(templateGit, join(destination, '.git'), { recursive: true, force: true })
  writeCarried(root, destination)
  ignoreProductFiles(destination)
  log(`product: ${destination} is ready`)
  return destination
}
