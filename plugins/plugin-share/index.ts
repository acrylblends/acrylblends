/**
 * Sharing a plugin between people: `pull(source)` turns a release someone published into a running plugin in this app. It fetches without running
 * anything, decides from the package's files (`pull-check.ts`), and hands a folder to `extensions`, which owns the install and its rollback.
 * Design: docs/plans/plugin-share.md.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { type Context, Service } from '@deepseek-ai/cordis'
import { digestFolder, type PluginFile } from '@webboxes/blends-core'
import {
  githubReleasesOverHttps,
  httpsDownload,
  InvalidPluginSourceError,
  type PluginSource,
  PluginStore,
  PullError,
  parsePluginSource,
  pullPlugin,
  type ReleasePort,
  readTarball,
} from '@webboxes/plugin-hub'
import { NAME } from '../extensions/index.ts'
import type {} from '../instance/index.ts'
import {
  missingServices,
  type PullRefused,
  pullRefusal,
  refuse,
  splitDigest,
} from './pull-check.ts'

export interface PluginShareConfig {
  /** Where pulled plugins go; must be an extensions source. Defaults to `<project>/plugins`. */
  dir?: string
  /** Where a `github:` source reads releases. Defaults to GitHub over HTTPS. */
  releases?: ReleasePort
}

export type PullResult =
  | {
      readonly ok: true
      readonly name: string
      readonly version: string
      /** The sha512 of the release's tarball, as the registry lists it. */
      readonly integrity: string
      /** The sha256 of the plugin's content: the same on every OS. A source can name it (`@sha256:<digest>`). */
      readonly digest: string
      readonly action: 'installed' | 'updated' | 'unchanged'
      readonly state: string
    }
  | PullRefused

declare module '@deepseek-ai/cordis' {
  interface Context {
    pluginShare: PluginShare
  }
}

const SOURCE_FORMS = 'github:<owner>/<repo>[@<version>] or a .tgz path or address'

/** Read what a person wrote. A `.tgz` path may be relative to the app folder; the hub only takes absolute ones. */
function readSource(
  input: string,
  root: string,
): { readonly source: PluginSource; readonly digest?: string } {
  const { source, digest } = splitDigest(input.trim())
  const isLocalTarball = /\.(?:tgz|tar\.gz)$/iu.test(source) && !/^[a-z][a-z0-9+]+:/iu.test(source)
  const parsed = parsePluginSource(isLocalTarball ? resolve(root, source) : source)
  if (parsed.kind !== 'github' && parsed.kind !== 'tarball-file' && parsed.kind !== 'tarball-url') {
    const named = parsed.kind === 'name' ? 'a bare name' : parsed.kind
    throw new InvalidPluginSourceError(
      input,
      `${named} sources are not offered here; pull ${SOURCE_FORMS}`,
    )
  }
  return { source: parsed, ...(digest === undefined ? {} : { digest }) }
}

const reasonOf = (cause: unknown): string => {
  if (cause instanceof PullError || cause instanceof InvalidPluginSourceError) return cause.reason
  return cause instanceof Error ? cause.message : String(cause)
}

export class PluginShare extends Service {
  private readonly dir: string
  private readonly releases: ReleasePort
  /** One pull at a time: two pulls of one name must not race for its folder. */
  private queue: Promise<unknown> = Promise.resolve()

  constructor(ctx: Context, config: PluginShareConfig) {
    super(ctx, 'pluginShare')
    this.dir = resolve(config.dir ?? join(ctx.appInstance.root, 'plugins'))
    this.releases = config.releases ?? githubReleasesOverHttps()
  }

  /** Pull a plugin into the running app. Never throws for what a person can act on: a refusal says what is wrong and what to do, and changes nothing. */
  pull(source: string): Promise<PullResult> {
    const run = this.queue.then(() => this.pullNow(source))
    this.queue = run.catch(() => undefined)
    return run
  }

  private async pullNow(input: string): Promise<PullResult> {
    const { home, root } = this.ctx.appInstance
    let read: ReturnType<typeof readSource>
    try {
      read = readSource(input, root)
    } catch (cause) {
      return refuse(
        'source',
        reasonOf(cause),
        `write ${SOURCE_FORMS}, with @sha256:<digest> at the end to name the content`,
      )
    }
    mkdirSync(home, { recursive: true })
    const scratch = mkdtempSync(join(home, 'plugin-pull-'))
    try {
      let pulled: Awaited<ReturnType<typeof pullPlugin>>
      try {
        pulled = await pullPlugin(read.source, {
          store: new PluginStore(scratch),
          releases: this.releases,
          download: httpsDownload(),
        })
      } catch (cause) {
        return refuse(
          'fetch',
          reasonOf(cause),
          'check the source with the person who released it; nothing was installed',
        )
      }
      const files: PluginFile[] = readTarball(readFileSync(pulled.stored.path)).map(
        ({ path, content }) => ({ path, bytes: content, kind: 'file' }),
      )
      const refused = pullRefusal(pulled.manifest, files, {
        digest: read.digest,
        nameFits: (name) => NAME.test(name),
        hasService: (service) => this.ctx.get(service as never) !== undefined,
      })
      if (refused !== undefined) return refused
      return await this.install(
        pulled.stored.name,
        pulled.stored.version,
        pulled.stored.integrity,
        files,
      )
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  }

  /** Put the files in `plugins/<name>/` and install them; whatever does not end running takes its folder with it. */
  private async install(
    name: string,
    version: string,
    integrity: string,
    files: readonly PluginFile[],
  ): Promise<PullResult> {
    const target = join(this.dir, name)
    const incoming = join(this.dir, `.pulling-${name}`)
    rmSync(incoming, { recursive: true, force: true })
    try {
      for (const file of files) {
        const path = join(incoming, ...file.path.split('/'))
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, file.bytes)
      }
      const digest = digestFolder(incoming)
      // The folder may be there already: the same bytes are already pulled, anything else is someone's work.
      const wrote = !existsSync(target)
      if (wrote) renameSync(incoming, target)
      else if (digestFolder(target) !== digest) {
        return refuse(
          'folder-exists',
          `plugins/${name} holds a different copy of this plugin`,
          `keep it, or remove plugins/${name} and pull again`,
        )
      }
      const undo = () => {
        if (wrote) rmSync(target, { recursive: true, force: true })
      }
      let result: Awaited<ReturnType<Context['extensions']['install']>>
      try {
        result = await this.ctx.extensions.install(target)
      } catch (cause) {
        undo()
        return refuse(
          'install',
          reasonOf(cause),
          'this app does not install plugins while it runs like this',
        )
      }
      if (!result.ok) {
        undo()
        return refuse('install', result.errors.join('; '), result.next)
      }
      if (result.state === 'pending') {
        await this.ctx.extensions.remove(name)
        undo()
        return missingServices(result.missing)
      }
      return {
        ok: true,
        name,
        version,
        integrity,
        digest,
        action: result.action,
        state: result.state,
      }
    } finally {
      rmSync(incoming, { recursive: true, force: true })
    }
  }
}

export const pluginShare = {
  name: 'plugin-share',
  inject: ['extensions', 'appInstance'],
  apply(ctx: Context, config: PluginShareConfig) {
    new PluginShare(ctx, config ?? {})
  },
}
