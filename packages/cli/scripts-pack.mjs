// prepack: ship the plugin library and the framework docs inside the package (the CLI copies them out); postpack: remove the copies again.
import { cpSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const from = fileURLToPath(new URL('../../plugins', import.meta.url))
const to = fileURLToPath(new URL('./plugins', import.meta.url))

rmSync(to, { recursive: true, force: true })
if (process.argv[2] === 'copy')
  cpSync(from, to, {
    recursive: true,
    filter: (path) => !/[/\\](node_modules|test)([/\\]|$)/.test(path),
  })

const docsFrom = fileURLToPath(new URL('../../docs/framework', import.meta.url))
const docsTo = fileURLToPath(new URL('./docs', import.meta.url))

rmSync(docsTo, { recursive: true, force: true })
if (process.argv[2] === 'copy') cpSync(docsFrom, join(docsTo, 'framework'), { recursive: true })
