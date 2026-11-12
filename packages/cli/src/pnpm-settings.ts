/**
 * What an app in the ACRYL frame needs from pnpm to install and start as it does with npm, kept in the app's `pnpm-workspace.yaml` (npm never reads it).
 *
 * - `nodeLinker: hoisted`: the frame's host composes about a hundred DSH rows by package name from the app's own folder, which finds them only in a flat
 *   `node_modules` (npm's layout). pnpm's isolated layout hides them, and the host stops with "failed to import" on every row.
 * - `allowBuilds`: pnpm 11 and later refuse to finish an install while a dependency's build script is neither allowed nor denied. The frame's packages
 *   whose scripts run under npm (frame/packages.json `pnpm.allowBuilds`) are allowed, so pnpm installs what npm installs.
 *
 * The file is the person's too (pnpm itself writes `minimumReleaseAgeExclude` there), so it is edited by lines: a key they set is never changed, and
 * their comments and layout stay.
 */
import release from '../../../frame/packages.json' with { type: 'json' }

/** The frame's dependencies whose build scripts pnpm must run. */
export const FRAME_ALLOW_BUILDS: readonly string[] = release.pnpm.allowBuilds

export const PNPM_WORKSPACE_FILE = 'pnpm-workspace.yaml'

/** A top-level key line (`name:` at column 0), with or without a value after it. */
function topKey(line: string): string | undefined {
  return /^([A-Za-z][\w-]*):/u.exec(line)?.[1]
}

/** A YAML map key, quoted when it is not a plain word (a scoped package name). */
function yamlKey(name: string): string {
  return /^[\w.-]+$/u.test(name) ? name : `'${name}'`
}

/** The package names a top-level `allowBuilds:` block already decides, allowed or denied. */
function decided(lines: readonly string[], start: number): { names: Set<string>; end: number } {
  const names = new Set<string>()
  // Right after the block's last entry: blank lines and comments after it belong to what follows.
  let end = start + 1
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue
    if (!/^\s/u.test(line)) break
    const key = /^\s+(['"]?)(.+?)\1\s*:/u.exec(line)?.[2]
    if (key !== undefined) names.add(key)
    end = index + 1
  }
  return { names, end }
}

/**
 * `pnpm-workspace.yaml` with the frame's settings added: the whole file when there is none, else only what it lacks. `builds` defaults to the frame's
 * list. Returns the text unchanged when nothing is missing.
 */
export function withFramePnpmSettings(
  text: string | undefined,
  builds: readonly string[] = FRAME_ALLOW_BUILDS,
): string {
  const lines = text === undefined || text === '' ? [] : text.replace(/\n$/u, '').split('\n')
  const keys = new Set(lines.map(topKey).filter((key) => key !== undefined))
  if (!keys.has('nodeLinker')) {
    lines.push(
      '# The ACRYL frame finds its packages in a flat node_modules, as npm lays it out (acrylblends writes this; npm ignores the file).',
      'nodeLinker: hoisted',
    )
  }
  const at = lines.findIndex((line) => topKey(line) === 'allowBuilds')
  if (at === -1) {
    if (builds.length > 0) {
      lines.push(
        "# The frame's packages whose install scripts npm runs too; pnpm stops an install while a build is neither allowed nor denied.",
        'allowBuilds:',
        ...builds.map((name) => `  ${yamlKey(name)}: true`),
      )
    }
  } else {
    const { names, end } = decided(lines, at)
    const missing = builds.filter((name) => !names.has(name))
    // An inline value (`allowBuilds: {}`) is the person's to change: only a block is extended.
    if (missing.length > 0 && /^allowBuilds:\s*(#.*)?$/u.test(lines[at] ?? ''))
      lines.splice(end, 0, ...missing.map((name) => `  ${yamlKey(name)}: true`))
  }
  const next = lines.length === 0 ? '' : `${lines.join('\n')}\n`
  return text !== undefined && next === text ? text : next
}
