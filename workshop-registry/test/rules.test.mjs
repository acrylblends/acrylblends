// The rules of the workshop registry, run on real folders: the pull request rules (check-pr.mjs, plain Node) and the entry checks (registry-index.ts --only, which needs bun and
// blends-core: set BLENDS_CORE to its src folder, or those tests are skipped and say so).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..')
const scratch = mkdtempSync(join(tmpdir(), 'workshop-registry-test-'))
after(() => rmSync(scratch, { recursive: true, force: true }))

const check = (login, changes, pr) => {
  const list = join(scratch, `changed-${Math.random().toString(36).slice(2)}.tsv`)
  writeFileSync(list, changes.map((row) => row.join('\t')).join('\n'))
  return spawnSync(
    process.execPath,
    [join(repo, 'scripts', 'check-pr.mjs'), '--login', login, '--changed', list, '--pr', pr],
    { encoding: 'utf8' },
  )
}

/** A pull request tree with an entry for `login`: a small, valid app for acrylblends. */
function entryTree(id) {
  const pr = mkdtempSync(join(scratch, 'pr-'))
  const dir = join(pr, 'blends', id)
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(
    join(dir, 'blend.yaml'),
    `apiVersion: blends.acryl.dev/v1alpha1\nkind: Blueprint\nmetadata:\n  id: ${id}\n  name: "Hello"\n  version: 0.1.0\n  category: workshop\n  description: "A hello app."\n  license: MIT\n  visibility: public\nspec:\n  runtime: cordis\n  rows:\n    - id: router\n      name: acryl-router\n`,
  )
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'hello', scripts: { test: 'node --test' } }),
  )
  writeFileSync(
    join(dir, 'acryl.template.json'),
    JSON.stringify({ name: 'Hello', description: 'A hello app.', plugins: [] }),
  )
  writeFileSync(join(dir, 'src', 'app.ts'), 'export const hello = 1\n')
  return { pr, dir }
}

describe('what a pull request may change', () => {
  test('an entry named after its author, added or removed, passes; the folder is the id', () => {
    const { pr } = entryTree('alice.hello')
    const added = check(
      'Alice',
      [
        ['added', 'blends/alice.hello/blend.yaml'],
        ['added', 'blends/alice.hello/src/app.ts'],
      ],
      pr,
    )
    assert.equal(added.status, 0, added.stdout)
    assert.equal(added.stdout.trim(), 'alice.hello')
    const removed = check(
      'alice',
      [
        ['removed', 'blends/alice.hello/blend.yaml'],
        ['removed', 'blends/alice.hello/src/app.ts'],
      ],
      mkdtempSync(join(scratch, 'empty-')),
    )
    assert.equal(removed.status, 0, removed.stdout)
  })

  test("another login's folder, a file outside blends/, the index, a workflow and a script are refused", () => {
    const { pr } = entryTree('alice.hello')
    for (const [login, path, why] of [
      ['mallory', 'blends/alice.hello/src/app.ts', 'belongs to "alice"'],
      ['alice', 'index.json', 'outside it'],
      ['alice', '.github/workflows/entry.yml', 'outside it'],
      ['alice', 'scripts/check-pr.mjs', 'outside it'],
      ['alice', 'blends/bob.thing/blend.yaml', 'belongs to "bob"'],
      ['alice', 'blends/alice.hello/../../index.json', 'leaves its folder'],
    ]) {
      const result = check(login, [['modified', path]], pr)
      assert.equal(result.status, 1, `${login} ${path}`)
      assert.match(result.stdout, new RegExp(why), `${login} ${path}: ${result.stdout}`)
    }
  })

  test('two entries in one pull request, and a file moved in from another folder, are refused', () => {
    const { pr } = entryTree('alice.hello')
    const two = check(
      'alice',
      [
        ['added', 'blends/alice.one/a'],
        ['added', 'blends/alice.two/a'],
      ],
      pr,
    )
    assert.equal(two.status, 1)
    assert.match(two.stdout, /one entry per pull request/)
    const moved = check('alice', [['renamed', 'blends/alice.hello/a', 'blends/bob.thing/a']], pr)
    assert.equal(moved.status, 1)
    assert.match(moved.stdout, /may not move between folders/)
  })

  test('a symbolic link in the entry is refused before anything reads the folder', () => {
    const { pr, dir } = entryTree('alice.hello')
    symlinkSync('/etc/passwd', join(dir, 'src', 'notes.txt'))
    const result = check('alice', [['added', 'blends/alice.hello/src/notes.txt']], pr)
    assert.equal(result.status, 1)
    assert.match(result.stdout, /notes\.txt: a link; links are not allowed/)
  })
})

const core = process.env.BLENDS_CORE
const bun = spawnSync('bun', ['--version'], { encoding: 'utf8' }).status === 0
const skip =
  core && bun && existsSync(join(core, 'registry.ts'))
    ? false
    : 'set BLENDS_CORE to blends-core/src and have bun on the PATH'

describe('is the entry a sound starter', { skip }, () => {
  const only = (id, dir) => {
    const root = mkdtempSync(join(scratch, 'registry-'))
    mkdirSync(join(root, 'blends'), { recursive: true })
    cpSync(dir, join(root, 'blends', id), { recursive: true, verbatimSymlinks: true })
    return spawnSync('bun', [join(repo, 'scripts', 'registry-index.ts'), root, '--only', id], {
      encoding: 'utf8',
      env: { ...process.env, BLENDS_CORE: core },
    })
  }

  test('a small, public, licensed app passes', () => {
    const { dir } = entryTree('alice.hello')
    const result = only('alice.hello', dir)
    assert.equal(result.status, 0, result.stdout + result.stderr)
  })

  test('an install script, a key, an oversized file, a private entry and a missing marker are each refused with the reason', () => {
    const cases = [
      [
        'alice.script',
        (dir) =>
          writeFileSync(
            join(dir, 'package.json'),
            JSON.stringify({ name: 'x', scripts: { postinstall: 'node steal.js' } }),
          ),
        /install script "postinstall"/,
      ],
      [
        'alice.key',
        (dir) =>
          writeFileSync(join(dir, 'src', 'k.ts'), `export const k = 'sk-${'a'.repeat(40)}'\n`),
        /looks like it holds an API key/,
      ],
      [
        'alice.big',
        (dir) => writeFileSync(join(dir, 'src', 'big.bin'), Buffer.alloc(2 * 1024 * 1024)),
        /a file may be at most 1024 KB/,
      ],
      [
        'alice.private',
        (dir) =>
          writeFileSync(
            join(dir, 'blend.yaml'),
            readFileSync(join(dir, 'blend.yaml'), 'utf8').replace(
              'visibility: public',
              'visibility: private',
            ),
          ),
        /private/,
      ],
      ['alice.nomark', (dir) => rmSync(join(dir, 'acryl.template.json')), null],
    ]
    for (const [id, change, reason] of cases) {
      const { dir } = entryTree(id)
      change(dir)
      const result = only(id, dir)
      if (reason === null) {
        // Without the marker an entry is an ACRYL starter: it passes the format check, and the workshop registry lists apps for acrylblends only.
        assert.equal(result.status, 0, `${id}: ${result.stdout}`)
      } else {
        assert.equal(result.status, 1, `${id}: ${result.stdout}`)
        assert.match(result.stdout, reason, id)
      }
    }
  })
})

test('a whole app in the wrong folder is one line, not one per file', () => {
  const { pr } = entryTree('alice.hello')
  const rows = Array.from({ length: 300 }, (_, n) => ['added', `blends/bob.hello/src/file-${n}.ts`])
  const result = check('alice', rows, pr)
  assert.equal(result.status, 1)
  assert.equal(result.stdout.trim().split('\n').length, 1, result.stdout)
  assert.match(result.stdout, /blends\/bob\.hello\/: the folder belongs to "bob"/)
})
