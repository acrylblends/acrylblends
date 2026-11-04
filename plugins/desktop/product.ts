/**
 * A product build (M10 T002): a desktop package that ships an app as its own starting point. `product.json` at the app root marks it, and the packaged app
 * copies that tree into the person's Documents the first time it starts, then runs there. The bundle itself is read-only (a mounted DMG can never be written
 * to), and the app folder a person builds in has to be theirs.
 */

import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

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
    return typeof folder === 'string' && folder.trim() !== '' ? { appFolder: folder.trim() } : undefined
  } catch {
    return undefined
  }
}

/** What the copied app folder does not carry: build output and the bundle's own app data. The scaffold's `.git` travels, so branches and versions work. */
const SKIPPED = new Set(['dist', '.acrylblends'])

/**
 * The folder the product runs on: the bundle's own tree copied into Documents on the first start, or the copy made then.
 * @param root - the bundled app (read-only).
 * @param documents - the person's Documents folder (`app.getPath('documents')`).
 * @returns the app folder to run on.
 */
export function firstRunRoot(root: string, documents: string, log: (line: string) => void = console.log): string {
  const product = readProduct(root)
  if (product === undefined) return root
  const destination = join(documents, product.appFolder)
  if (existsSync(join(destination, 'package.json'))) return destination
  log(`product: creating ${destination} from the bundled app (first start, one time)`)
  mkdirSync(documents, { recursive: true })
  cpSync(root, destination, {
    recursive: true,
    dereference: true,
    errorOnExist: false,
    force: true,
    filter: (source) => !SKIPPED.has(source.slice(root.length + 1).split('/')[0] ?? ''),
  })
  log(`product: ${destination} is ready`)
  return destination
}
