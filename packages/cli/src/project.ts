import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

/** Thrown when the target directory exists and is not empty. Nothing has been written. */
export class TargetNotEmptyError extends Error {
  constructor(readonly target: string) {
    super(
      `refusing to write into "${target}": the directory is not empty. Choose an empty or new directory.`,
    )
    this.name = 'TargetNotEmptyError'
  }
}

/** A project name npm accepts: lower case letters, digits and dashes, starting with a letter. */
export function isValidName(name: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(name) && name.length <= 214
}

/** A valid default project name derived from a directory path. */
export function nameFrom(directory: string): string {
  const base = directory.split(/[\\/]/).filter(Boolean).pop() ?? ''
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^[^a-z]+/, '')
    .replace(/-+$/, '')
  return cleaned || 'my-app'
}

/** Refuse a target that exists and is not an empty directory. A missing target is fine: it is created. */
export function assertTargetFree(target: string): void {
  if (!existsSync(target)) return
  if (!statSync(target).isDirectory() || readdirSync(target).length > 0)
    throw new TargetNotEmptyError(target)
}

/**
 * Copy a template into `target`, replacing `__APP_NAME__` with `name`. Checks the target before writing anything.
 *
 * @returns the copied files, relative to `target`
 */
export function copyTemplate(source: string, target: string, name: string): string[] {
  assertTargetFree(target)
  mkdirSync(target, { recursive: true })
  const written: string[] = []
  const walk = (from: string, to: string, prefix: string) => {
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      if (
        entry.name === 'node_modules' ||
        (prefix === '' &&
          (entry.name === TEMPLATE_MANIFEST ||
            entry.name === 'upstream.json' ||
            entry.name === 'AGENTS.md'))
      )
        continue
      const sourcePath = join(from, entry.name)
      // npm and git treat a file named .gitignore specially, so templates keep it as `gitignore` (and `dockerignore`).
      const targetName =
        prefix === '' && (entry.name === 'gitignore' || entry.name === 'dockerignore')
          ? `.${entry.name}`
          : entry.name
      const targetPath = join(to, targetName)
      if (entry.isDirectory()) {
        mkdirSync(targetPath, { recursive: true })
        walk(sourcePath, targetPath, `${prefix}${entry.name}/`)
        continue
      }
      const text = readFileSync(sourcePath, 'utf8')
      if (text.includes('__APP_NAME__'))
        writeFileSync(targetPath, text.replaceAll('__APP_NAME__', name))
      else cpSync(sourcePath, targetPath)
      written.push(`${prefix}${targetName}`)
    }
  }
  walk(source, target, '')
  return written
}

/** A template's own manifest, `template.json`: the library plugins it is built from. Never copied (nor is `upstream.json`, the record of what was synced from ACRYL, nor the template's `AGENTS.md`, which `writeAgentFiles` joins to the shared core). */
export const TEMPLATE_MANIFEST = 'template.json'

export function readTemplatePlugins(templateDir: string): string[] {
  const file = join(templateDir, TEMPLATE_MANIFEST)
  if (!existsSync(file)) return []
  const { plugins } = JSON.parse(readFileSync(file, 'utf8')) as { plugins?: string[] }
  return plugins ?? []
}

/** Add run-time dependencies to an app's package.json, keeping what is there and sorting the keys. Returns the names added. */
export function mergeDependencies(
  appDir: string,
  dependencies: Readonly<Record<string, string>>,
): string[] {
  const file = join(appDir, 'package.json')
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as {
    dependencies?: Record<string, string>
  }
  const current = manifest.dependencies ?? {}
  const added = Object.keys(dependencies).filter((name) => !(name in current))
  const merged = { ...dependencies, ...current }
  manifest.dependencies = Object.fromEntries(
    Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)),
  )
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)
  return added
}

/** The generated app's guide for a coding agent: the shared core, then the template's own part. `CLAUDE.md` is only an import of it. */
export function writeAgentFiles(
  sharedDir: string,
  templateDir: string,
  target: string,
  name: string,
): string[] {
  const core = readFileSync(join(sharedDir, 'AGENTS.core.md'), 'utf8')
  const own = existsSync(join(templateDir, 'AGENTS.md'))
    ? readFileSync(join(templateDir, 'AGENTS.md'), 'utf8')
    : ''
  writeFileSync(join(target, 'AGENTS.md'), `${core}${own}`.replaceAll('__APP_NAME__', name))
  writeFileSync(join(target, 'CLAUDE.md'), '@AGENTS.md\n')
  return ['AGENTS.md', 'CLAUDE.md']
}

/**
 * Copy the framework's docs (a generated copy of ACRYL's `docs/framework`, already checked against its digest) into `<app>/docs/framework/`,
 * so a coding agent working in the app reads the API from the folder it is in. The generated-copy notes and the digest record stay behind.
 *
 * @returns the copied files, relative to `target`
 */
export function copyFrameworkDocs(source: string, target: string): string[] {
  const written: string[] = []
  const walk = (from: string, to: string, prefix: string) => {
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      if (entry.name === 'upstream.json' || entry.name === 'UPSTREAM.md') continue
      const sourcePath = join(from, entry.name)
      const targetPath = join(to, entry.name)
      if (entry.isDirectory()) {
        mkdirSync(targetPath, { recursive: true })
        walk(sourcePath, targetPath, `${prefix}${entry.name}/`)
        continue
      }
      cpSync(sourcePath, targetPath)
      written.push(`docs/framework/${prefix}${entry.name}`)
    }
  }
  mkdirSync(join(target, 'docs', 'framework'), { recursive: true })
  walk(source, join(target, 'docs', 'framework'), '')
  return written
}
