import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The two templates: a Cordis app, and the same app with the offline agent. Both depend on `cordis` only. */
export const TEMPLATES = ['app', 'agent'] as const
export type Template = (typeof TEMPLATES)[number]

/** The template for an agent choice. */
export function templateFor(agent: boolean): Template {
  return agent ? 'agent' : 'app'
}

/**
 * The `templates/` folder of this package. The module sits at different depths in source (`src/`) and in the build
 * (`dist/`), so walk up until a `templates` folder holds the `app` template.
 */
export function templatesRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (;;) {
    const candidate = join(dir, 'templates')
    if (existsSync(join(candidate, 'app'))) return candidate
    const parent = dirname(dir)
    if (parent === dir) throw new Error('acrylblends cannot find its templates folder')
    dir = parent
  }
}

/** Absolute path of a template folder. */
export function templateDir(template: Template): string {
  return join(templatesRoot(), template)
}
