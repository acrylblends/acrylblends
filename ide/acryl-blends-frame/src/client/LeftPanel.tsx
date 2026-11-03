/** The left panel: the app's branches, each with what is open on it, then the versions of the checked-out branch, and where the app runs. */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { formatRelativeTime } from 'acryl-versions/client'
import type { FrameState } from '../contract.ts'
import type { VersionsLogView } from 'acryl-versions'
import { versionNumber, type VersionsPort } from './versions.ts'

/** A chat on the branch, as the left panel lists it. */
export interface ChatRow {
  readonly id: string
  readonly title: string
  readonly current: boolean
}

/** The chats the frame knows (DSH's sessions), and opening one in the right panel. */
export interface ChatsPort {
  getSnapshot(): readonly ChatRow[]
  subscribe(listener: () => void): () => void
  open(id: string): void
}

const BranchIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <circle cx="4" cy="3.5" r="1.6" />
    <circle cx="4" cy="12.5" r="1.6" />
    <circle cx="12" cy="6" r="1.6" />
    <path d="M4 5v6M12 7.6c0 2.4-3 2.4-6.5 3.4" />
  </svg>
)

type VersionsLoad =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly log: VersionsLogView }
  | { readonly status: 'error'; readonly message: string }

export interface LeftPanelProps {
  readonly state: FrameState
  readonly chats: ChatsPort
  readonly versions: VersionsPort
  /** Told the newest version's label ("v7"), for the top bar. */
  readonly onVersionLabel: (label: string | undefined) => void
}

export function LeftPanel({ state, chats, versions, onVersionLabel }: LeftPanelProps) {
  const subscribe = useCallback((listener: () => void) => chats.subscribe(listener), [chats])
  const chatRows = useSyncExternalStore(subscribe, () => chats.getSnapshot())
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(state.branches.filter(b => b.current).map(b => b.name)))
  const [load, setLoad] = useState<VersionsLoad>({ status: 'loading' })
  const [saving, setSaving] = useState<string | undefined>(undefined)

  const refresh = useCallback(async () => {
    try {
      const log = await versions.log(state.appRoot)
      setLoad({ status: 'ready', log })
    } catch (cause) {
      setLoad({ status: 'error', message: cause instanceof Error ? cause.message : 'The versions could not be read.' })
    }
  }, [versions, state.appRoot])

  // A new head is a new version, whoever made it (a save here, an agent's commit, a restore): read the list again.
  useEffect(() => { void refresh() }, [refresh, state.head])
  useEffect(() => {
    onVersionLabel(load.status === 'ready' && load.log.entries.length > 0 ? `v${String(load.log.entries.length)}` : undefined)
  }, [load, onVersionLabel])

  const toggle = (name: string) => {
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const save = async () => {
    if (saving === undefined || saving.trim() === '') return
    try {
      await versions.save(state.appRoot, saving.trim())
      setSaving(undefined)
      await refresh()
    } catch (cause) {
      setLoad({ status: 'error', message: cause instanceof Error ? cause.message : 'The save point could not be made.' })
    }
  }

  return (
    <>
      <div className="acrylBlendsPaneHead"><span className="acrylBlendsLabel">Branches</span></div>
      <div className="acrylBlendsList">
        {state.branches.length === 0 && <p className="acrylBlendsNote">This app's folder is not a git repository.</p>}
        {state.branches.map(branch => {
          const open = expanded.has(branch.name)
          // Chats are not tied to a branch yet: they are the checked-out branch's, since that is the folder the agent works in.
          const items = branch.current ? chatRows : []
          return (
            <div key={branch.name} className="acrylBlendsBranchGroup">
              <button type="button" className="acrylBlendsBranch" aria-expanded={open} onClick={() => { toggle(branch.name) }}>
                <svg className="acrylBlendsCaret" data-open={open || undefined} viewBox="0 0 10 10" aria-hidden="true"><path d="M3.5 2l3 3-3 3" /></svg>
                <BranchIcon />
                <span className="acrylBlendsBranchName">{branch.name}</span>
                <span className="acrylBlendsMeta">
                  {branch.current ? <span className="acrylBlendsDot" data-live /> : items.length > 0 ? `${String(items.length)} open` : ''}
                </span>
              </button>
              {open && items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className="acrylBlendsItem"
                  aria-current={item.current || undefined}
                  onClick={() => { chats.open(item.id) }}
                >
                  <span className="acrylBlendsItemIcon">◆</span>
                  <span className="acrylBlendsItemTitle">Chat · {item.title}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>
      <div className="acrylBlendsSep" />
      <div className="acrylBlendsPaneHead">
        <span className="acrylBlendsLabel">Versions</span>
        <button type="button" className="acrylBlendsSmallButton" onClick={() => { setSaving(current => (current === undefined ? '' : undefined)) }}>
          Save point
        </button>
      </div>
      {saving !== undefined && (
        <form className="acrylBlendsSaveForm" onSubmit={(event) => { event.preventDefault(); void save() }}>
          <input
            autoFocus
            aria-label="What changed"
            placeholder="What changed?"
            value={saving}
            onChange={(event) => { setSaving(event.target.value) }}
            onKeyDown={(event) => { if (event.key === 'Escape') setSaving(undefined) }}
          />
        </form>
      )}
      <div className="acrylBlendsList">
        {load.status === 'error' && <p className="acrylBlendsNote" data-error>{load.message}</p>}
        {load.status === 'ready' && load.log.entries.length === 0 && <p className="acrylBlendsNote">No versions yet.</p>}
        {load.status === 'ready' && load.log.entries.map((entry, index) => (
          <div key={entry.hash} className="acrylBlendsVersion" aria-current={index === 0 || undefined} title={`${entry.short} · ${entry.author}`}>
            <span className="acrylBlendsVersionDot" />
            <span className="acrylBlendsItemTitle">
              v{String(versionNumber(load.log.entries, index))} · {entry.subject}{index === 0 ? ' (current)' : ''}
            </span>
            <span className="acrylBlendsMeta">{formatRelativeTime(entry.at)}</span>
          </div>
        ))}
      </div>
      <div className="acrylBlendsLeftFoot">
        <span className="acrylBlendsDot" data-live />
        Running locally · port {window.location.port || (window.location.protocol === 'https:' ? '443' : '80')}
      </div>
    </>
  )
}
