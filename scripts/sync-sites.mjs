#!/usr/bin/env node
// One step of the release checklist: bring both sites up to this repository. For each of acrylblends.github.io (the framework site) and acryl.dev, in a scratch clone:
//   - copy docs/framework over the site's src/docs/framework (the sites never edit it);
//   - on the framework site, add every release of docs/release-notes/ the site does not have yet (the entry and the list item), newest first;
//   - build the site (so a broken page fails here, not on the live site);
//   - commit, and with --push push to main (the Pages workflows deploy) and wait for them.
// Without --push it stops after the build and says what it would push.
//
//   node scripts/sync-sites.mjs [--push] [--only framework|acryl] [--work <folder>] [--no-build]
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { addReleases } from './lib/sites.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { values } = parseArgs({
  options: {
    push: { type: 'boolean' },
    only: { type: 'string' },
    work: { type: 'string' },
    'no-build': { type: 'boolean' },
  },
})
const log = (message) => console.log(`sync-sites: ${message}`)
const SITES = [
  {
    id: 'framework',
    repo: 'acrylblends/acrylblends.github.io',
    releaseNotes: true,
    live: 'https://acrylblends.github.io/',
    workflow: 'Deploy to GitHub Pages',
  },
  {
    id: 'acryl',
    repo: 'acryldev/acryldev.github.io',
    releaseNotes: false,
    live: 'https://acryl.dev/',
    workflow: 'Deploy acryl.dev',
  },
].filter((site) => values.only === undefined || site.id === values.only)
if (SITES.length === 0) {
  console.error(
    'usage: node scripts/sync-sites.mjs [--push] [--only framework|acryl] [--work <folder>] [--no-build]',
  )
  process.exit(2)
}

const run = (command, args, cwd, options = {}) => {
  const r = spawnSync(command, args, { cwd, encoding: 'utf8', ...options })
  if (r.status !== 0)
    throw new Error(`${command} ${args.join(' ')} failed in ${cwd}:\n${r.stdout}${r.stderr}`)
  return r.stdout
}
const credential = ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential']
const work =
  values.work === undefined ? mkdtempSync(join(tmpdir(), 'sync-sites-')) : resolve(values.work)
mkdirSync(work, { recursive: true })

const notes = Object.fromEntries(
  readdirSync(join(root, 'docs', 'release-notes'))
    .filter((name) => /^\d+\.\d+\.\d+\.md$/u.test(name))
    .map((name) => [
      name.slice(0, -3),
      readFileSync(join(root, 'docs', 'release-notes', name), 'utf8'),
    ]),
)
const version = JSON.parse(
  readFileSync(join(root, 'packages', 'cli', 'package.json'), 'utf8'),
).version

try {
  for (const site of SITES) {
    const dir = join(work, site.id)
    rmSync(dir, { recursive: true, force: true })
    run(
      'git',
      [...credential, 'clone', '-q', '--depth', '1', `https://github.com/${site.repo}.git`, dir],
      work,
    )
    const target = join(dir, 'src', 'docs', 'framework')
    rmSync(target, { recursive: true, force: true })
    mkdirSync(target, { recursive: true })
    cpSync(join(root, 'docs', 'framework'), target, {
      recursive: true,
      filter: (path) => !/(upstream\.json|UPSTREAM\.md)$/u.test(path),
    })
    if (site.releaseNotes) {
      const docFile = join(dir, 'src', 'lib', 'doc-content.ts')
      const contentFile = join(dir, 'src', 'lib', 'content.ts')
      const result = addReleases(
        readFileSync(docFile, 'utf8'),
        readFileSync(contentFile, 'utf8'),
        notes,
      )
      writeFileSync(docFile, result.docContent)
      writeFileSync(contentFile, result.content)
      log(
        `${site.id}: release notes added: ${result.added.length === 0 ? 'none (nothing newer than the site has)' : result.added.join(', ')}`,
      )
      if (result.gaps.length > 0)
        log(`${site.id}: older release notes the site lacks, not added: ${result.gaps.join(', ')}`)
    }
    if (values['no-build'] !== true) {
      const bun = spawnSync('bun', ['--version'], { encoding: 'utf8' }).status === 0
      const pnpm = existsSync(join(dir, 'pnpm-lock.yaml'))
      if (pnpm) {
        run('pnpm', ['install', '--frozen-lockfile'], dir)
        run('pnpm', ['run', 'build'], dir)
      } else if (bun) {
        run('bun', ['install', '--frozen-lockfile'], dir)
        run('bun', ['run', 'build'], dir)
      } else {
        run('npm', ['install', '--no-audit', '--no-fund'], dir)
        run('npm', ['run', 'build'], dir)
      }
      rmSync(join(dir, 'node_modules'), { recursive: true, force: true })
      rmSync(join(dir, 'dist'), { recursive: true, force: true })
      log(`${site.id}: built`)
    }
    const changed = run('git', ['status', '--porcelain'], dir).trim()
    if (changed === '') {
      log(`${site.id}: already up to date`)
      continue
    }
    run('git', ['add', '-A'], dir)
    run(
      'git',
      ['commit', '-q', '-m', `docs: framework docs and release notes re-synced (${version})`],
      dir,
    )
    if (values.push !== true) {
      log(
        `${site.id}: ${changed.split('\n').length} file(s) changed; not pushed (use --push). Clone kept in ${dir}`,
      )
      continue
    }
    run('git', [...credential, 'push', '-q', 'origin', 'HEAD:main'], dir)
    log(`${site.id}: pushed; waiting for the ${site.workflow} workflow`)
    const id = (() => {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const out = run(
          'gh',
          [
            'run',
            'list',
            '-R',
            site.repo,
            '--workflow',
            site.workflow,
            '--limit',
            '1',
            '--json',
            'databaseId,headSha',
          ],
          dir,
        )
        const [latest] = JSON.parse(out)
        const head = run('git', ['rev-parse', 'HEAD'], dir).trim()
        if (latest?.headSha === head) return latest.databaseId
        spawnSync('sleep', ['5'])
      }
      return undefined
    })()
    if (id !== undefined) {
      run('gh', ['run', 'watch', String(id), '-R', site.repo, '--exit-status'], dir, {
        stdio: 'ignore',
      })
      log(`${site.id}: deployed (${site.live})`)
    } else
      log(
        `${site.id}: pushed, but its workflow did not start in a minute: check ${site.repo}/actions`,
      )
    const page = await fetch(site.live)
    log(`${site.id}: ${site.live} answers ${page.status}`)
    if (!page.ok) throw new Error(`${site.live} answered ${page.status}`)
  }
} finally {
  if (values.work === undefined && values.push === true)
    rmSync(work, { recursive: true, force: true })
}
