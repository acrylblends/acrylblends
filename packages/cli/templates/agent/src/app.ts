import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context, type Fiber } from '@deepseek-ai/cordis'
import { agent, memory, model, tools } from './plugins/agent/index.ts'
import { builder } from './plugins/builder/index.ts'
import { events } from './plugins/events/index.ts'
import { extensions } from './plugins/extensions/index.ts'
import { http } from './plugins/http/index.ts'
import { type AppInstance, instance } from './plugins/instance/index.ts'
import {
  blueprintsIn,
  compose,
  loadManifest,
  type ParameterValue,
} from './plugins/manifest/index.ts'
import { type OpenAIConfig, openai } from './plugins/openai/index.ts'
import { sandboxPlugin } from './plugins/sandbox/index.ts'
import { save } from './plugins/save/index.ts'
import { server } from './plugins/server/index.ts'
import { tasks } from './plugins/tasks/index.ts'
import { routes } from './routes.ts'

/** The plugins this app's code provides. `blend.yaml` chooses, orders and configures them. */
export const registry = {
  tasks,
  model,
  tools,
  memory,
  agent,
  http,
  events,
  extensions,
  builder,
  save,
  sandbox: sandboxPlugin,
  routes,
  server,
}

/** The manifest next to this app's source. */
export const MANIFEST = join(fileURLToPath(new URL('..', import.meta.url)), 'blend.yaml')

/**
 * The app's manifest, resolved. A Blend finds its Blueprint in `blueprints/<id>.yaml`; an app that is itself a Blueprint never looks.
 * `createApp` and the tests read it the same way.
 */
export function readManifest(values?: Readonly<Record<string, ParameterValue>>) {
  return loadManifest(MANIFEST, {
    known: Object.keys(registry),
    getBlueprint: blueprintsIn(join(fileURLToPath(new URL('..', import.meta.url)), 'blueprints')),
    ...(values ? { values } : {}),
  })
}

export interface App {
  readonly root: Context
  readonly url: string
  stop(): Promise<void>
}

/**
 * The app: `instance` first (where it lives, chosen at run time), then the manifest's rows in order. The app's own `extensions/`
 * folder is trusted to install at start, and is where the builder writes.
 */
export async function createApp(
  chosen: AppInstance,
  options: {
    values?: Readonly<Record<string, ParameterValue>>
    /** A real model (any OpenAI-compatible API) in place of the offline scripted one. */
    model?: OpenAIConfig
  } = {},
): Promise<App> {
  const manifest = readManifest(options.values)
  const extensionsDir = join(chosen.root, 'extensions')
  const root = new Context()
  const first = root.plugin(instance, chosen)
  await first.await()
  const fibers: Fiber[] = [
    first,
    // The `model` row mounts the scripted model, or the real one when a model is configured.
    ...(await compose(root, manifest, options.model ? { ...registry, model: openai } : registry, {
      ...(options.model ? { model: { ...options.model } } : {}),
      // Runtime values the manifest cannot hold: the manifest's own digest (every task records it), and who may install.
      tasks: { manifest: `sha256:${manifest.digest}` },
      // The `approval` parameter in blend.yaml (the extensions row) turns this source into one that asks.
      extensions: { sources: [{ dir: extensionsDir, trust: 'install' }] },
      builder: { dir: extensionsDir },
      server: { port: chosen.port.start, scan: chosen.port.scan, hostname: chosen.host },
    })),
  ]
  return {
    root,
    url: root.server.url,
    async stop() {
      for (const fiber of [...fibers].reverse()) await fiber.dispose()
    },
  }
}
