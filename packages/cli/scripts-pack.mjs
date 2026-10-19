// prepack: ship the plugin library inside the package (the CLI copies plugins out of it); postpack: remove the copy again.
import { cpSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const from = fileURLToPath(new URL('../../plugins', import.meta.url))
const to = fileURLToPath(new URL('./plugins', import.meta.url))

rmSync(to, { recursive: true, force: true })
if (process.argv[2] === 'copy')
  cpSync(from, to, {
    recursive: true,
    filter: (path) => !/[/\\](node_modules|test)([/\\]|$)/.test(path),
  })
