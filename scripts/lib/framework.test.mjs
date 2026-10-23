import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classify, digestOf, rewriteSpecifiers } from './framework.mjs'

const FILE = 'acryl-state/src/service.ts'

test('a real import of another vendored plugin becomes a relative path', () => {
  const { source, count } = rewriteSpecifiers(
    "import { streamSSE } from 'acryl-router/helpers'\nimport type { RouteContext } from 'acryl-router'\n",
    FILE,
  )
  assert.equal(count, 2)
  assert.match(source, /from '\.\.\/\.\.\/acryl-router\/src\/helpers\/index\.ts'/)
  assert.match(source, /from '\.\.\/\.\.\/acryl-router\/src\/index\.ts'/)
})

test('a multi-line import and a dynamic import are rewritten', () => {
  const { source, count } = rewriteSpecifiers(
    "import {\n  a,\n  b,\n} from 'acryl-router'\nconst m = await import('acryl-router/middleware')\n",
    FILE,
  )
  assert.equal(count, 2)
  assert.doesNotMatch(source, /from 'acryl-router'/)
  assert.doesNotMatch(source, /import\('acryl-router\/middleware'\)/)
})

test('an import shown in a JSDoc example, a line comment or a block comment is left alone, even for a package that is not vendored', () => {
  const text = [
    '/**',
    ' * Use `fire` from `acryl-router/service-worker` instead:',
    " *   import { fire } from 'acryl-router/service-worker'",
    ' */',
    "// import { x } from 'acryl-other'",
    "const a = 1 /* import { y } from 'acryl-router' */ + 2",
    "import { z } from 'acryl-router'",
    '',
  ].join('\n')
  const { source, count } = rewriteSpecifiers(text, FILE)
  assert.equal(count, 1)
  assert.match(source, /\* {3}import \{ fire \} from 'acryl-router\/service-worker'/)
  assert.match(source, /\/\/ import \{ x \} from 'acryl-other'/)
  assert.match(source, /\/\* import \{ y \} from 'acryl-router' \*\//)
  assert.match(source, /import \{ z \} from '\.\.\/\.\.\/acryl-router\/src\/index\.ts'/)
})

test('text inside a string or a template literal is left alone', () => {
  const text =
    "const doc = \"import { a } from 'acryl-router'\"\nconst t = `import { b } from 'acryl-router'`\n"
  assert.deepEqual(rewriteSpecifiers(text, FILE), { source: text, count: 0 })
})

test('a real import of a plugin that is not vendored is an error', () => {
  assert.throws(
    () => rewriteSpecifiers("import { x } from 'acryl-settings'\n", FILE),
    /imports "acryl-settings", which is not one of the vendored framework plugins/,
  )
})

test('classify marks comments, strings and code', () => {
  const text = "a // b\n'c' /* d */ e"
  const kind = classify(text)
  const at = (piece) => kind[text.indexOf(piece)]
  assert.equal(at('a'), 0)
  assert.equal(at('// b'), 1)
  assert.equal(at("'c'"), 2)
  assert.equal(at('/* d */'), 1)
  assert.equal(at(' e') + kind[text.length - 1], 0)
})

test('the digest does not depend on the order files were read in', () => {
  const a = new Map([
    ['b.ts', Buffer.from('2')],
    ['a.ts', Buffer.from('1')],
  ])
  const b = new Map([
    ['a.ts', Buffer.from('1')],
    ['b.ts', Buffer.from('2')],
  ])
  assert.equal(digestOf(a), digestOf(b))
})
