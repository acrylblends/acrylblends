// Until the real `acrylblends` package carries the framework, the docs test resolves `acrylblends/<subpath>` to the vendored sources through these small
// re-export files. The subpath names are the ones the package will export, so the same code blocks check against either.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { CLASS, PACKAGE, REQUEST } from './names.mjs'

const MIDDLEWARE = [
  'basic-auth',
  'bearer-auth',
  'body-limit',
  'combine',
  'compress',
  'context-storage',
  'cors',
  'csrf',
  'etag',
  'ip-restriction',
  'jwk',
  'jwt',
  'language',
  'logger',
  'method-not-allowed',
  'method-override',
  'powered-by',
  'pretty-json',
  'request-id',
  'secure-headers',
  'serve-static',
  'timeout',
  'timing',
  'trailing-slash',
]
const HELPERS = {
  accepts: 'accepts',
  adapter: 'adapter',
  cookie: 'cookie',
  factory: 'factory',
  html: 'html',
  route: 'route',
  streaming: 'streaming',
  testing: 'testing',
  ws: 'websocket',
}
const ROUTERS = ['smart-router', 'reg-exp-router', 'trie-router', 'pattern-router', 'linear-router']

/** Write the shim files into `dir` and return the `paths` map for a tsconfig. `router` is the folder of the vendored acryl-router plugin. */
export function writeShim(dir, repoRoot) {
  const router = join(repoRoot, 'plugins', 'acryl-router', 'src')
  const node = join(repoRoot, 'plugins', 'acryl-node-server', 'src')
  const files = {
    index: [
      `export { App, Context } from '${router}/core/index.ts'`,
      `export { App as ${CLASS} } from '${router}/core/index.ts'`,
      `export type { AppRequest, AppRequest as ${REQUEST}, ContextRenderer, ContextVariableMap, Env, ErrorHandler, ExecutionContext, Handler, Input, MiddlewareHandler, Next, NotFoundHandler, NotFoundResponse, Schema, ToSchema, TypedResponse, ValidationTargets } from '${router}/core/index.ts'`,
      `export { HTTPException } from '${router}/core/http-exception.ts'`,
      `export type { ContentfulStatusCode, StatusCode } from '${router}/core/utils/http-status.ts'`,
    ],
    request: [`export * from '${router}/core/request.ts'`],
    types: [`export * from '${router}/core/types.ts'`],
    'http-exception': [`export * from '${router}/core/http-exception.ts'`],
    validator: [`export * from '${router}/core/validator/index.ts'`],
    client: [`export * from '${router}/core/client/index.ts'`],
    conninfo: [
      `export * from '${router}/core/helper/conninfo/index.ts'`,
      `export { connectionOf, getConnInfo, type ConnectionInfo, type RouterBindings, type RouterEnv } from '${router}/connection.ts'`,
    ],
    'schema-validator': [`export * from '${router}/helpers/schema-validator.ts'`],
    'loopback-only': [`export * from '${router}/middleware/loopback-only.ts'`],
    'node-server': [
      `export * from '${node}/adapter/index.ts'`,
      `export { serveStatic, type ServeStaticOptions } from '${node}/adapter/serve-static.ts'`,
      `export { getConnInfo } from '${node}/adapter/conninfo.ts'`,
    ],
  }
  for (const name of MIDDLEWARE)
    files[name] = [`export * from '${router}/core/middleware/${name}/index.ts'`]
  for (const [name, folder] of Object.entries(HELPERS))
    files[name] = [`export * from '${router}/core/helper/${folder}/index.ts'`]
  for (const name of ROUTERS)
    files[`router/${name}`] = [`export * from '${router}/core/router/${name}/index.ts'`]
  const paths = { [PACKAGE]: [join(dir, 'index.ts')], [`${PACKAGE}/*`]: [join(dir, '*.ts')] }
  for (const [name, lines] of Object.entries(files)) {
    const file = join(dir, `${name}.ts`)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, `${lines.join('\n')}\n`)
  }
  return paths
}
