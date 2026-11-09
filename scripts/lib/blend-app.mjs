/**
 * One OS app per Blend, the part that is the same on every OS (specs/049-framework-architecture/app-storage.md in ACRYL): the name a Blend app may have,
 * and the copy of a Windows or Linux engine folder under that name. The copy links every file to the engine's (hard links on one volume: a second app costs
 * the folders and one file, not the engine's size) except the product marker, which is the one file that differs.
 */
import {
  copyFileSync,
  linkSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

/** A name that is a folder name on every OS (plugins/instance/storage.ts `isPortableName`, the same rule) and a file name inside an Info.plist. */
export const NAME = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,62}$/u

/** The bundle id's last part: lower case, letters and digits, dashes between. */
export const slugOf = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')

/** Where the product marker lies in a Windows or Linux engine folder (electron-builder's `asar: false` layout: `resources/app`). */
export const MARKER = ['resources', 'app', 'product.json']

/** Link `from` into `to`, folder by folder; `skip` gets each file's path under `from`, `/`-separated. Falls back to a copy where a link cannot be made. */
export function linkTree(from, to, skip = () => false, base = '') {
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const path = base === '' ? entry.name : `${base}/${entry.name}`
    const source = join(from, entry.name)
    const target = join(to, entry.name)
    if (skip(path)) continue
    if (entry.isDirectory()) linkTree(source, target, skip, path)
    else if (entry.isSymbolicLink()) symlinkSync(readlinkSync(source), target)
    else {
      try {
        linkSync(source, target)
      } catch {
        copyFileSync(source, target)
      }
    }
  }
}

/**
 * A Windows or Linux Blend app: the engine folder linked under `<out>/<name>`, its executable renamed to the Blend's, the marker rewritten so the product
 * (and with it the root in the OS data folder) is the Blend's. Linux gets a `.desktop` entry beside it.
 * @param engine - the engine folder (an unpacked Electron app with `resources/app`).
 * @param exe - the engine's executable, relative to `engine` (`ACRYL Blends.exe`, `acryl-blends`).
 */
export function makeDirApp({ engine, name, out, exe, platform }) {
  if (!NAME.test(name))
    throw new Error(`"${name}" cannot be an app name: letters, digits, space, - and _`)
  const dir = join(out, name)
  const marker = MARKER.join('/')
  linkTree(engine, dir, (path) => path === marker)
  const product = JSON.parse(readFileSync(join(engine, ...MARKER), 'utf8'))
  writeFileSync(
    join(dir, ...MARKER),
    `${JSON.stringify({ ...product, product: name, appName: name }, null, 2)}\n`,
  )
  const extension = exe.endsWith('.exe') ? '.exe' : ''
  const renamed = `${name}${extension}`
  renameSync(join(dir, exe), join(dir, renamed))
  if (platform === 'linux')
    writeFileSync(
      join(out, `${name}.desktop`),
      [
        '[Desktop Entry]',
        'Type=Application',
        `Name=${name}`,
        // Electron's sandbox needs a setuid helper or user namespaces; Ubuntu 23.10 and later restrict the latter, so the entry says so itself.
        `Exec="${join(dir, renamed)}" --no-sandbox %U`,
        'Terminal=false',
        'Categories=Office;Development;',
        '',
      ].join('\n'),
    )
  return { dir, exe: join(dir, renamed) }
}
