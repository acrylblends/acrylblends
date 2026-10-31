/**
 * The layout the previous published release (acrylblends 1.1.0) scaffolded, compared with the current templates: `acrylblends upgrade` may replace a
 * template's own file (the app's scaffold) but never one the app edited. The fixtures under `legacy/1.1.0/` are the released files, verbatim; an app's file
 * matches when it equals the fixture with the app name substituted, or the current template's file (already upgraded).
 */
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Template, templateDir } from './templates'

/** The release the upgrade accepts as the starting layout. */
export const LEGACY_VERSION = '1.1.0'

/** The app name init substituted for `__APP_NAME__` in the template's files. */
const PLACEHOLDER = '__APP_NAME__'

/** Per template: the module that identifies it, and the scaffold files the frame layout brings up to date. */
export interface LegacyLayout {
  readonly template: Template
  /** The app's route module: the file every app of this template has, whichever release made it. */
  readonly route: string
  /** The template's own files the frame layout needs in their current form. */
  readonly scaffold: readonly string[]
}

const LAYOUTS: readonly LegacyLayout[] = [
  { template: 'blank', route: 'src/routes.ts', scaffold: ['src/routes.ts'] },
  { template: 'nodejs', route: 'src/routes.ts', scaffold: [] },
  { template: 'notes', route: 'src/routes.ts', scaffold: [] },
  { template: 'chat', route: 'src/routes.ts', scaffold: [] },
  { template: 'todo', route: 'src/todo.ts', scaffold: ['src/todo.ts', 'src/app.ts'] },
  { template: 'agent', route: 'src/routes.ts', scaffold: ['src/routes.ts', 'src/app.ts'] },
]

/** What a template's scaffold file is: the app's own (up to date or edited), the released template's, or missing. */
export type ScaffoldState = 'same' | 'update' | 'add' | 'conflict'

export interface ScaffoldFile {
  /** Path inside the app, with forward slashes. */
  readonly file: string
  /** The current template's text, which an upgrade writes for `update` and `add`. */
  readonly text: string
  readonly state: ScaffoldState
}

/** The upgrade's read of an app: which template made it, and what the frame layout would do to its scaffold. */
export interface LegacyRead {
  readonly layout: LegacyLayout
  /** `src/frame.ts` first (it has no released predecessor), then the template's own files it replaces. */
  readonly files: readonly ScaffoldFile[]
}

/** The `legacy/1.1.0` fixtures: beside `dist/` in the build and `src/` in a checkout, found by walking up like the templates. */
export function legacyRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (;;) {
    const candidate = join(dir, 'legacy', LEGACY_VERSION)
    if (existsSync(join(candidate, 'agent', 'src', 'routes.ts'))) return candidate
    const parent = dirname(dir)
    if (parent === dir) throw new Error('acrylblends cannot find its legacy layout fixtures')
    dir = parent
  }
}

/** The scaffold files the frame layout replaces for a template (empty for a template with no frame row yet). */
export function legacyScaffold(template: Template): readonly string[] {
  return LAYOUTS.find((layout) => layout.template === template)?.scaffold ?? []
}

/** The frame row module's path inside an app: a template with it is framed by the host. */
export const FRAME_FILE = 'src/frame.ts'

/** Whether the current template carries the frame row (only the framed templates can be upgraded onto it). */
export function carriesFrame(template: Template): boolean {
  return existsSync(join(templateDir(template), FRAME_FILE))
}

/** A template's file as a scaffolded app of `name` has it. */
function templateText(template: Template, file: string, name: string): string {
  const text = readFileSync(join(templateDir(template), file), 'utf8')
  return text.replaceAll(PLACEHOLDER, name)
}

/** A released file as an app of `name` made by that release has it, or undefined when the release had no such file. */
function releasedText(template: Template, file: string, name: string): string | undefined {
  const path = join(legacyRoot(), template, file)
  if (!existsSync(path)) return undefined
  return readFileSync(path, 'utf8').replaceAll(PLACEHOLDER, name)
}

/** The app's name as `init` wrote it into the scaffold (package.json, then the folder). */
export function appNameOf(appDir: string): string {
  try {
    const manifest = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8')) as {
      name?: unknown
    }
    if (typeof manifest.name === 'string' && manifest.name !== '') return manifest.name
  } catch {
    // The caller already refused an app without a readable package.json; fall through to the folder.
  }
  return basename(appDir)
}

/**
 * Which template made this app: a layout whose route module matches the current or the released one, or, when that file was edited, the framed layout with
 * the most scaffold files matching. Undefined when none matches: the app's scaffold was edited, or another release made it, and the upgrade leaves it alone.
 */
export function identifyTemplate(appDir: string, name: string): LegacyLayout | undefined {
  let best: { layout: LegacyLayout; score: number } | undefined
  for (const layout of LAYOUTS) {
    const route = read(join(appDir, layout.route))
    const routeKnown =
      route !== undefined &&
      (route === templateText(layout.template, layout.route, name) ||
        route === releasedText(layout.template, layout.route, name))
    let score = routeKnown ? 2 : 0
    for (const file of layout.scaffold) {
      const app = read(join(appDir, file))
      if (app === undefined) continue
      const released = releasedText(layout.template, file, name)
      if (app === templateText(layout.template, file, name) || app === released) score += 1
    }
    if (score === 0) continue
    if (best === undefined || score > best.score) best = { layout, score }
  }
  return best?.layout
}

function read(path: string): string | undefined {
  return existsSync(path) ? readFileSync(path, 'utf8') : undefined
}

/**
 * What the frame layout would do to the app's scaffold of `layout`: `same` when the app already has the current template's file, `update` when it has the
 * released one, `add` when it is missing, `conflict` when the app edited it (the caller refuses without `--force`).
 */
export function readLegacy(appDir: string, layout: LegacyLayout, name: string): LegacyRead {
  const files: ScaffoldFile[] = []
  const frame = read(join(appDir, FRAME_FILE))
  if (carriesFrame(layout.template)) {
    const text = templateText(layout.template, FRAME_FILE, name)
    files.push({
      file: FRAME_FILE,
      text,
      state: frame === undefined ? 'add' : frame === text ? 'same' : 'conflict',
    })
  }
  for (const file of layout.scaffold) {
    const app = read(join(appDir, file))
    const text = templateText(layout.template, file, name)
    const released = releasedText(layout.template, file, name)
    files.push({
      file,
      text,
      state:
        app === undefined
          ? 'add'
          : app === text
            ? 'same'
            : released !== undefined && app === released
              ? 'update'
              : 'conflict',
    })
  }
  return { layout, files }
}
