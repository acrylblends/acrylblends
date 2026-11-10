/** The Plugins page of Settings: search, the groups as chips, and one row per plugin with who made it, its state and its switch. */

import { useEffect, useMemo, useState } from 'react'
import type { SharePlan, ShareVisibility } from '../contract.ts'
import { filterPlugins, shareQuestion, type NavigatorPlugin, type PluginGroup } from './plugins-navigator.ts'

export interface PluginsSectionInjected {
  /** Every plugin of the app and the frame, read fresh. */
  readonly loadPlugins: () => Promise<readonly NavigatorPlugin[]>
}

const CHIPS: readonly { readonly group: PluginGroup | 'all'; readonly label: string }[] = [
  { group: 'all', label: 'All' },
  { group: 'made', label: 'Made by agents' },
  { group: 'registry', label: 'Registry' },
  { group: 'frame', label: 'Frame' },
]

type Load =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly plugins: readonly NavigatorPlugin[] }
  | { readonly status: 'error'; readonly message: string }

export function PluginsSection({ loadPlugins }: PluginsSectionInjected) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<PluginGroup | 'all'>('all')
  const [busy, setBusy] = useState<string | undefined>(undefined)
  const [failure, setFailure] = useState<string | undefined>(undefined)
  // A share sends the plugin to GitHub under the person's name: it says what it will create and waits for their yes.
  const [asking, setAsking] = useState<{ readonly key: string; readonly plan: SharePlan } | undefined>(undefined)
  const [sharing, setSharing] = useState<'planning' | 'publishing' | undefined>(undefined)

  const [reads, setReads] = useState(0)
  useEffect(() => {
    let live = true
    loadPlugins().then(
      (plugins) => {
        if (!live) return
        setLoad({ status: 'ready', plugins })
        setBusy(undefined)
      },
      (cause: unknown) => {
        if (!live) return
        setLoad({ status: 'error', message: cause instanceof Error ? cause.message : 'The plugins could not be read.' })
        setBusy(undefined)
      },
    )
    return () => { live = false }
  }, [loadPlugins, reads])

  const plugins = load.status === 'ready' ? load.plugins : []
  const shown = useMemo(() => filterPlugins(plugins, query, group), [plugins, query, group])
  const count = (chip: PluginGroup | 'all') => (chip === 'all' ? plugins.length : plugins.filter(plugin => plugin.group === chip).length)

  const flip = async (plugin: NavigatorPlugin) => {
    if (plugin.toggle === undefined || busy !== undefined) return
    setBusy(plugin.key)
    setFailure(undefined)
    try {
      // Until the list is read again the row shows the new position.
      await plugin.toggle(!plugin.on)
      setReads(count => count + 1)
    } catch (cause) {
      setFailure(`${plugin.name}: ${cause instanceof Error ? cause.message : String(cause)}`)
      setBusy(undefined)
    }
  }

  const askShare = async (plugin: NavigatorPlugin, visibility?: ShareVisibility) => {
    if (plugin.share === undefined || busy !== undefined) return
    setBusy(plugin.key)
    setSharing('planning')
    setFailure(undefined)
    setAsking(undefined)
    try {
      setAsking({ key: plugin.key, plan: await plugin.share.plan(visibility) })
    } catch (cause) {
      setFailure(`${plugin.name}: ${cause instanceof Error ? cause.message : String(cause)}`)
    }
    setBusy(undefined)
    setSharing(undefined)
  }

  const publish = async (plugin: NavigatorPlugin, plan: SharePlan) => {
    if (plugin.share === undefined || busy !== undefined) return
    setBusy(plugin.key)
    setSharing('publishing')
    setFailure(undefined)
    setAsking(undefined)
    try {
      const shared = await plugin.share.publish(plan)
      // The row shows where it went without waiting for the Host to read the whole list again.
      setLoad(current => current.status === 'ready'
        ? { status: 'ready', plugins: current.plugins.map(row => row.key === plugin.key ? { ...row, shared } : row) }
        : current)
    } catch (cause) {
      setFailure(`${plugin.name}: ${cause instanceof Error ? cause.message : String(cause)}`)
    }
    setBusy(undefined)
    setSharing(undefined)
  }

  return (
    <div className="acrylBlendsPlugins">
      <h3>Plugins</h3>
      <p className="acrylBlendsPluginsSub">Everything this app is made of. Agents add features as Cordis plugins; each one can be switched off or replaced.</p>
      <div className="acrylBlendsPluginsTools">
        <input className="acrylBlendsSearch" aria-label="Search plugins" placeholder="Search plugins" value={query} onChange={(event) => { setQuery(event.target.value) }} />
        {CHIPS.map(chip => (
          <button key={chip.group} type="button" className="acrylBlendsChip" aria-pressed={group === chip.group} onClick={() => { setGroup(chip.group) }}>
            {chip.label} {count(chip.group)}
          </button>
        ))}
      </div>
      {failure !== undefined && <p className="acrylBlendsNote" data-error>{failure}</p>}
      {load.status === 'loading' && <p className="acrylBlendsNote">Reading the plugins…</p>}
      {load.status === 'error' && <p className="acrylBlendsNote" data-error>{load.message}</p>}
      {load.status === 'ready' && shown.length === 0 && <p className="acrylBlendsNote">No plugin matches.</p>}
      {shown.map(plugin => {
        const on = busy === plugin.key ? !plugin.on : plugin.on
        return (
          <div key={plugin.key} className="acrylBlendsPlug">
            <b>{plugin.name}</b>
            <span className="acrylBlendsPlugBy">{plugin.by}</span>
            {plugin.toggle === undefined
              ? <span className="acrylBlendsPlugFixed" title="Part of the frame; it cannot be switched off here">built in</span>
              : (
                <button
                  type="button"
                  role="switch"
                  className="acrylBlendsTog"
                  aria-checked={on}
                  aria-label={`${plugin.name} ${on ? 'on' : 'off'}`}
                  disabled={busy !== undefined}
                  onClick={() => { void flip(plugin) }}
                />
              )}
            <small>
              {plugin.description}{plugin.description === '' ? '' : ' · '}
              <span className="acrylBlendsPlugState" data-state={plugin.state === 'active' ? 'ok' : plugin.state === 'off' ? 'off' : 'warn'}>{plugin.state}</span>
              {plugin.shared !== undefined && (
                <>
                  {' · '}
                  {plugin.shared.gone === true
                    ? (
                      <span className="acrylBlendsSharedGone" title="GitHub says this repository no longer exists; Share publishes it again">
                        {plugin.shared.url.replace(/^https:\/\//u, '')} is gone
                      </span>
                    )
                    : (
                      <a className="acrylBlendsShared" href={plugin.shared.url} target="_blank" rel="noreferrer">
                        {plugin.shared.url.replace(/^https:\/\//u, '')} · v{plugin.shared.version}
                      </a>
                    )}
                </>
              )}
              {plugin.share !== undefined && (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="acrylBlendsShareButton"
                    disabled={busy !== undefined}
                    onClick={() => { void askShare(plugin) }}
                  >
                    {busy === plugin.key && sharing !== undefined ? (sharing === 'planning' ? 'Checking…' : 'Sharing…') : plugin.shared === undefined || plugin.shared.gone === true ? 'Share' : 'Share again'}
                  </button>
                </>
              )}
              {asking?.key === plugin.key && (
                <span className="acrylBlendsShareAsk" role="group" aria-label={`Share ${plugin.name}`}>
                  {shareQuestion(asking.plan)}
                  {/* Cancel is the default: Enter or a stray click sends nothing. */}
                  <button type="button" className="acrylBlendsShareCancel" autoFocus onClick={() => { setAsking(undefined) }}>Cancel</button>
                  <button type="button" className="acrylBlendsShareVisibility" disabled={busy !== undefined} onClick={() => { void askShare(plugin, asking.plan.visibility === 'public' ? 'private' : 'public') }}>
                    {asking.plan.visibility === 'public' ? 'Keep it private' : 'Make it public'}
                  </button>
                  <button type="button" className="acrylBlendsShareConfirm" disabled={busy !== undefined} onClick={() => { void publish(plugin, asking.plan) }}>
                    {asking.plan.createsRepository ? 'Create and publish' : `Publish v${asking.plan.version}`}
                  </button>
                </span>
              )}
            </small>
          </div>
        )
      })}
    </div>
  )
}
