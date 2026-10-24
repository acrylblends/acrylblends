/**
 * A Host-only consumer: Node types and no DOM library. Typechecking this against the built `lib/types` proves every public entry point's
 * declarations stand without the DOM library, which a server plugin should not need to load.
 */

import type * as Router from '../../src/index.ts'
import type * as Client from '../../src/client.ts'
import type * as Helpers from '../../src/helpers/index.ts'
import type * as Middleware from '../../src/middleware/index.ts'

export type Entries = [typeof Router, typeof Client, typeof Helpers, typeof Middleware]
