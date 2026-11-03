/**
 * Settings → Plugins (docs/design/blends-frame-mockup.html): everything the app is made of, in one list, all read from the frame's Host: the
 * app's plugins (`blend.yaml` rows and what was written into `plugins/`) and the frame's own Loader rows. A switch writes where the plugin is
 * chosen; the Host then starts the app's plugins again, and the canvas loads the app page again.
 */

import { FRAME_PLUGINS_PATH, FRAME_PLUGINS_SHARE_PATH, FRAME_PLUGINS_SWITCH_PATH, parseAppPluginsView, type AppPluginKind, type AppPluginsView, type AppPluginView, type FramePluginView, type SharedPluginView } from '../contract.ts'

/** A share's answer: where it went, or the version already released and the next patch that would follow. */
export type ShareOutcome =
  | { readonly status: 'shared'; readonly url: string; readonly version: string }
  | { readonly status: 'released'; readonly version: string; readonly nextVersion: string }

/** Which filter chip a plugin falls under. */
export type PluginGroup = 'made' | 'registry' | 'frame'

export interface NavigatorPlugin {
  /** Unique across groups: `app:<name>` or `frame:<entryId>`. */
  readonly key: string
  readonly name: string
  readonly group: PluginGroup
  /** The badge: who made it ("Claude · today"), "registry", "frame". */
  readonly by: string
  readonly description: string
  readonly on: boolean
  /** Shown after the description: "active", "off", "not saved yet", "failed". */
  readonly state: string
  /** Where a local plugin was shared: its repository and released version. */
  readonly shared?: SharedPluginView
  /** Publish this local plugin so another app can install it; `bump` releases the next patch. Absent when the row cannot be shared here. */
  readonly share?: (options?: { readonly bump?: boolean }) => Promise<ShareOutcome>
  /** Absent when the plugin cannot be switched here (the frame's protected rows). */
  readonly toggle?: (on: boolean) => Promise<void>
}

const DAY_MS = 86_400_000

/** "today", "yesterday", "Mon", or "12 Oct" for an older day. */
export function madeWhen(at: string, now: Date = new Date()): string {
  const when = new Date(at)
  if (Number.isNaN(when.getTime())) return ''
  const day = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const days = Math.round((day(now) - day(when)) / DAY_MS)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return when.toLocaleDateString('en', { weekday: 'short' })
  return when.toLocaleDateString('en', { day: 'numeric', month: 'short' })
}

export function appPluginRow(plugin: AppPluginView, toggle: (on: boolean) => Promise<void>, share?: (options?: { readonly bump?: boolean }) => Promise<ShareOutcome>, now?: Date): NavigatorPlugin {
  const made = plugin.kind === 'made'
  const by = made
    ? plugin.by === undefined ? 'not saved yet' : [plugin.by, plugin.at === undefined ? '' : madeWhen(plugin.at, now)].filter(part => part !== '').join(' · ')
    : plugin.version === undefined ? 'registry' : `registry · v${plugin.version}`
  return {
    key: `app:${plugin.name}`,
    name: plugin.name,
    group: made ? 'made' : 'registry',
    by,
    description: plugin.description,
    on: plugin.on,
    state: plugin.on ? 'active' : 'off',
    ...(plugin.shared === undefined ? {} : { shared: plugin.shared }),
    ...(made && share !== undefined ? { share } : {}),
    toggle,
  }
}

const FRAME_STATE_LABEL: Record<FramePluginView['state'], string> = { active: 'active', waiting: 'waiting for a service', failed: 'failed', off: 'off' }

/** One of the frame's own plugins: shown with its state, switched only by changing the frame. */
export function framePluginRow(plugin: FramePluginView): NavigatorPlugin {
  return {
    key: `frame:${plugin.id}`,
    name: plugin.name,
    group: 'frame',
    by: plugin.version === undefined ? 'frame' : `frame · v${plugin.version}`,
    description: plugin.description,
    on: plugin.state !== 'off',
    state: FRAME_STATE_LABEL[plugin.state],
  }
}

/** The plugins a search and a chip leave. */
export function filterPlugins(plugins: readonly NavigatorPlugin[], query: string, group: PluginGroup | 'all'): NavigatorPlugin[] {
  const needle = query.trim().toLowerCase()
  return plugins.filter(plugin => (group === 'all' || plugin.group === group)
    && (needle === '' || plugin.name.toLowerCase().includes(needle) || plugin.description.toLowerCase().includes(needle) || plugin.by.toLowerCase().includes(needle)))
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface AppPluginsApi {
  read(): Promise<AppPluginsView>
  switch(kind: AppPluginKind, name: string, on: boolean): Promise<void>
  /** Share one local plugin; answers where it went, or the released version and the next patch. */
  share(name: string, options?: { readonly bump?: boolean }): Promise<ShareOutcome>
}

async function errorOf(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown }
    if (typeof body.error === 'string') return body.error
  } catch {
    // Not JSON: the status says it.
  }
  return `the request failed (HTTP ${String(response.status)})`
}

export function createAppPluginsApi(fetcher: FetchLike = (input, init) => fetch(input, init)): AppPluginsApi {
  return {
    async read() {
      const response = await fetcher(FRAME_PLUGINS_PATH, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(await errorOf(response))
      return parseAppPluginsView(await response.json())
    },
    async switch(kind, name, on) {
      const response = await fetcher(FRAME_PLUGINS_SWITCH_PATH, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ kind, name, on }),
      })
      if (!response.ok) throw new Error(await errorOf(response))
    },
    async share(name, options) {
      const response = await fetcher(FRAME_PLUGINS_SHARE_PATH, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name, ...(options?.bump === true ? { bump: true } : {}) }),
      })
      if (!response.ok) throw new Error(await errorOf(response))
      const body = await response.json() as Record<string, unknown>
      if (body['status'] === 'released' && typeof body['version'] === 'string' && typeof body['nextVersion'] === 'string')
        return { status: 'released', version: body['version'], nextVersion: body['nextVersion'] }
      if (typeof body['url'] === 'string' && typeof body['version'] === 'string')
        return { status: 'shared', url: body['url'], version: body['version'] }
      throw new Error('the share answered without its repository')
    },
  }
}
