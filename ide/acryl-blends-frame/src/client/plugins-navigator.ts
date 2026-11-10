/**
 * Settings → Plugins (docs/design/blends-frame-mockup.html): everything the app is made of, in one list, all read from the frame's Host: the
 * app's plugins (`blend.yaml` rows and what was written into `plugins/`) and the frame's own Loader rows. A switch writes where the plugin is
 * chosen; the Host then starts the app's plugins again, and the canvas loads the app page again.
 */

import { FRAME_PLUGINS_PATH, FRAME_PLUGINS_SHARE_PATH, FRAME_PLUGINS_SHARE_PLAN_PATH, FRAME_PLUGINS_SWITCH_PATH, parseAppPluginsView, parseSharePlan, type AppPluginKind, type AppPluginsView, type AppPluginView, type FramePluginView, type ShareVisibility, type SharedPluginView, type SharePlan } from '../contract.ts'

/** Sharing a local plugin: first what it would do, then, on the person's yes, exactly that. */
export interface PluginShare {
  plan(visibility?: ShareVisibility): Promise<SharePlan>
  publish(confirmed: SharePlan): Promise<SharedPluginView>
}

/** The question a share asks before anything is sent: the repository, whether it is created, the version and who can see it. */
export function shareQuestion(plan: SharePlan): string {
  const where = `${plan.owner}/${plan.repo}`
  const what = plan.createsRepository
    ? `Create repository ${where} on GitHub and publish v${plan.version}?`
    : `Publish v${plan.version} to ${where} on GitHub?`
  const released = plan.released === undefined ? '' : ` v${plan.released} is released there, so this is the next version.`
  const who = plan.visibility === 'public' ? 'public: anyone can read it and pull it into their own app' : 'private'
  return `${what}${released} It will be ${who}.`
}

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
  /** Publish this local plugin so another app can install it, after the person confirms its plan. Absent when the row cannot be shared here. */
  readonly share?: PluginShare
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

export function appPluginRow(plugin: AppPluginView, toggle: (on: boolean) => Promise<void>, share?: PluginShare, now?: Date): NavigatorPlugin {
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
  /** What sharing one local plugin would do (private unless `visibility` says public); nothing is sent. */
  planShare(name: string, visibility?: ShareVisibility): Promise<SharePlan>
  /** Share one local plugin as the person confirmed it; answers where it went. */
  share(name: string, confirmed: SharePlan): Promise<SharedPluginView>
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
    async planShare(name, visibility) {
      const response = await fetcher(FRAME_PLUGINS_SHARE_PLAN_PATH, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(visibility === undefined ? { name } : { name, visibility }),
      })
      if (!response.ok) throw new Error(await errorOf(response))
      return parseSharePlan(await response.json())
    },
    async share(name, confirmed) {
      const response = await fetcher(FRAME_PLUGINS_SHARE_PATH, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name, confirm: confirmed }),
      })
      if (!response.ok) throw new Error(await errorOf(response))
      const body = await response.json() as Record<string, unknown>
      if (typeof body['url'] === 'string' && typeof body['version'] === 'string') return { url: body['url'], version: body['version'] }
      throw new Error('the share answered without its repository')
    },
  }
}
