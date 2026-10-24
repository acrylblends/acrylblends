import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The templates: a blank Cordis app on the router, a todo list built only on the router and state, and the blank app with the offline agent. */
export const TEMPLATES = ['blank', 'todo', 'agent'] as const
export type Template = (typeof TEMPLATES)[number]

export function isTemplate(value: string): value is Template {
  return (TEMPLATES as readonly string[]).includes(value)
}

/**
 * The `templates/` folder of this package. The module sits at different depths in source (`src/`) and in the build
 * (`dist/`), so walk up until a `templates` folder holds the `blank` template.
 */
export function templatesRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (;;) {
    const candidate = join(dir, 'templates')
    if (existsSync(join(candidate, 'blank'))) return candidate
    const parent = dirname(dir)
    if (parent === dir) throw new Error('acrylblends cannot find its templates folder')
    dir = parent
  }
}

/** Absolute path of a template folder. */
export function templateDir(template: Template): string {
  return join(templatesRoot(), template)
}

/** The text every generated app's `AGENTS.md` starts with (`shared/`, beside `templates/`). */
export function sharedDir(): string {
  return join(dirname(templatesRoot()), 'shared')
}

/**
 * The framework's docs, as ACRYL wrote them: `docs/framework` of the repository, or the copy `prepack` puts inside the package. The module sits at
 * different depths in source and in the build, so walk up until a `docs/framework` folder holds the README.
 */
export function frameworkDocsRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (;;) {
    const candidate = join(dir, 'docs', 'framework')
    if (existsSync(join(candidate, 'README.md'))) return candidate
    const parent = dirname(dir)
    if (parent === dir)
      throw new Error('acrylblends cannot find the framework docs (docs/framework)')
    dir = parent
  }
}
