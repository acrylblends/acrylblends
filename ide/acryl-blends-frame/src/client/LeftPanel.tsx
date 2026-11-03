/** The left panel: the app's branches, each with what is open on it, then the versions of the checked-out branch, and where the app runs. */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { formatRelativeTime } from 'acryl-versions/client'
import { branchNameProblem, type FeedbackNoteView, type FeedbackView, type FrameBranch, type FrameState } from '../contract.ts'
import type { VersionsLogView } from 'acryl-versions'
import { PTY_AGENTS, terminalMeta, type FrameTabs } from './tabs.ts'
import { versionNumber, type VersionsPort } from './versions.ts'
import { branchClick, saveBeforeSwitchMessage, type BranchesApi } from './branches.ts'
import { feedbackPlace, type FeedbackApi } from './feedback.ts'

/** A chat on the branch, as the left panel lists it. */
export interface ChatRow {
  readonly id: string
  readonly title: string
  readonly current: boolean
  /** When the chat last changed (ms since the epoch); absent when DSH did not say. */
  readonly updatedAt?: number
}

/** The chats the frame knows (DSH's sessions), and opening one in the right panel. */
export interface ChatsPort {
  getSnapshot(): readonly ChatRow[]
  subscribe(listener: () => void): () => void
  open(id: string): void
}

/** Feedback from users: the notes, and handing one to an agent (the chat's composer). */
export interface FeedbackPort {
  readonly api: FeedbackApi
  /** @returns false when there is no chat to hand it to. */
  hand(note: FeedbackNoteView): boolean
}

/** How often the left panel asks for new feedback. */
const FEEDBACK_INTERVAL_MS = 15_000
/** How many notes the panel lists; the newest first. */
const FEEDBACK_SHOWN = 5

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

/** The left panel's branch calls: New, and moving to an existing branch with the state re-read and the app page reloaded. */
export interface BranchesPort {
  readonly api: BranchesApi
  readonly changed: () => Promise<void>
  /** Switch the app's folder to a branch, read the frame state again and reload the app page; rejects with the Host's reason. */
  readonly switchTo: (name: string) => Promise<void>
}

export interface LeftPanelProps {
  readonly state: FrameState
  readonly chats: ChatsPort
  readonly versions: VersionsPort
  /** The right panel's tabs: the branch lists its open agents and terminals, and a click shows one. */
  readonly tabs: FrameTabs
  readonly feedback: FeedbackPort
  readonly branches: BranchesPort
  /** Show a right panel tab (opening the panel when it is closed). */
  readonly showTab: (id: string) => void
  /** Told the newest version's label ("v7"), for the top bar. */
  readonly onVersionLabel: (label: string | undefined) => void
}

export function LeftPanel({ state, chats, versions, tabs, feedback, branches, showTab, onVersionLabel }: LeftPanelProps) {
  const subscribe = useCallback((listener: () => void) => chats.subscribe(listener), [chats])
  const chatRows = useSyncExternalStore(subscribe, () => chats.getSnapshot())
  const subscribeTabs = useCallback((listener: () => void) => tabs.subscribe(listener), [tabs])
  const strip = useSyncExternalStore(subscribeTabs, () => tabs.getSnapshot())
  const terminals = strip.tabs.flatMap(tab => (tab.kind === 'pty' || tab.kind === 'terminal' ? [tab] : []))
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(state.branches.filter(b => b.current).map(b => b.name)))
  const [load, setLoad] = useState<VersionsLoad>({ status: 'loading' })
  const [saving, setSaving] = useState<string | undefined>(undefined)
  // The new branch's name while it is typed, and why the last try failed.
  const [naming, setNaming] = useState<string | undefined>(undefined)
  const [branchProblem, setBranchProblem] = useState<string | undefined>(undefined)
  // The branch a click would move to, asking first because files are unsaved; the branch in flight; and why the last try failed.
  const [askSwitch, setAskSwitch] = useState<string | undefined>(undefined)
  const [busySwitch, setBusySwitch] = useState<{ readonly branch: string; readonly phase: 'saving' | 'switching' } | undefined>(undefined)
  const [switchNote, setSwitchNote] = useState<{ readonly branch: string; readonly message: string } | undefined>(undefined)
  const [notes, setNotes] = useState<FeedbackView>({ available: false, notes: [] })
  const [handNote, setHandNote] = useState<string | undefined>(undefined)

  const readFeedback = useCallback(async () => {
    try {
      setNotes(await feedback.api.read())
    } catch {
      // The section keeps what it showed; the next read tries again.
    }
  }, [feedback])
  useEffect(() => {
    void readFeedback()
    const timer = window.setInterval(() => { void readFeedback() }, FEEDBACK_INTERVAL_MS)
    return () => { window.clearInterval(timer) }
  }, [readFeedback])

  const hand = async (note: FeedbackNoteView) => {
    setHandNote(feedback.hand(note) ? undefined : 'Open a chat first, then hand the note to it.')
    if (!note.seen) {
      await feedback.api.markSeen([note.id]).catch(() => {})
      await readFeedback()
    }
  }

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

  const createBranch = async () => {
    if (naming === undefined) return
    const name = naming.trim()
    const problem = branchNameProblem(name)
    if (problem !== undefined) {
      setBranchProblem(problem)
      return
    }
    try {
      await branches.api.create(name)
      setNaming(undefined)
      setBranchProblem(undefined)
      setExpanded(current => new Set(current).add(name))
      await branches.changed()
    } catch (cause) {
      setBranchProblem(cause instanceof Error ? cause.message : 'The branch could not be made.')
    }
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

  // A save point when the person chose one, then the Host moves the folder; the frame state re-read marks the new current branch, and the
  // composition reloads the app page on its files (switch, state, canvas - in that order). Nothing here stashes or discards work.
  const switchTo = async (name: string, saveFirst: boolean) => {
    setBusySwitch({ branch: name, phase: saveFirst ? 'saving' : 'switching' })
    setSwitchNote(undefined)
    try {
      if (saveFirst) {
        await versions.save(state.appRoot, saveBeforeSwitchMessage(name))
        setBusySwitch({ branch: name, phase: 'switching' })
      }
      await branches.switchTo(name)
      setAskSwitch(undefined)
      setExpanded(current => new Set(current).add(name))
    } catch (cause) {
      setSwitchNote({ branch: name, message: cause instanceof Error ? cause.message : 'The branch could not be switched to.' })
    } finally {
      setBusySwitch(undefined)
    }
  }

  const clickBranch = (branch: FrameBranch) => {
    if (busySwitch !== undefined) return
    const action = branchClick(branch, state.unsaved)
    if (action === 'toggle') {
      toggle(branch.name)
    } else if (action === 'switch') {
      void switchTo(branch.name, false)
    } else {
      setSwitchNote(undefined)
      setAskSwitch(branch.name)
    }
  }

  /** What the ask's first button says while its work runs. */
  const saveButtonLabel = (name: string): string => {
    if (busySwitch?.branch !== name) return 'Save a point first'
    return busySwitch.phase === 'saving' ? 'Saving...' : 'Switching...'
  }

  return (
    <>
      <div className="acrylBlendsPaneHead">
        <span className="acrylBlendsLabel">Branches</span>
        {state.branches.length > 0 && (
          <button
            type="button"
            className="acrylBlendsSmallButton"
            title="A new branch from the current version; your files stay as they are"
            onClick={() => { setBranchProblem(undefined); setNaming(current => (current === undefined ? '' : undefined)) }}
          >
            New
          </button>
        )}
      </div>
      {naming !== undefined && (
        <form className="acrylBlendsSaveForm" onSubmit={(event) => { event.preventDefault(); void createBranch() }}>
          <input
            autoFocus
            aria-label="Branch name"
            placeholder="Branch name, e.g. feature-due-dates"
            value={naming}
            onChange={(event) => { setNaming(event.target.value); setBranchProblem(undefined) }}
            onKeyDown={(event) => { if (event.key === 'Escape') setNaming(undefined) }}
          />
          {branchProblem !== undefined && <p className="acrylBlendsNote" data-error>{branchProblem}</p>}
        </form>
      )}
      <div className="acrylBlendsList">
        {state.branches.length === 0 && <p className="acrylBlendsNote">This app's folder is not a git repository.</p>}
        {state.branches.map(branch => {
          // Only the checked-out branch has rows under it (see below), so only it opens: another branch's caret stays closed rather than opening onto nothing.
          const open = branch.current && expanded.has(branch.name)
          // Chats and terminals are not tied to a branch yet: they are the checked-out branch's, since that is the folder they work in.
          const count = branch.current ? chatRows.length + terminals.length : 0
          return (
            <div key={branch.name} className="acrylBlendsBranchGroup">
              <button
                type="button"
                className="acrylBlendsBranch"
                aria-expanded={branch.current ? open : undefined}
                title={branch.current ? 'Show what is open on this branch' : `Switch to ${branch.name}`}
                onClick={() => { clickBranch(branch) }}
              >
                <svg className="acrylBlendsCaret" data-open={open || undefined} viewBox="0 0 10 10" aria-hidden="true"><path d="M3.5 2l3 3-3 3" /></svg>
                <BranchIcon />
                <span className="acrylBlendsBranchName">{branch.name}</span>
                <span className="acrylBlendsMeta">
                  {branch.current ? <span className="acrylBlendsDot" data-live /> : count > 0 ? `${String(count)} open` : ''}
                </span>
              </button>
              {askSwitch === branch.name && (
                <div className="acrylBlendsAsk" role="group" aria-label={`Switch to ${branch.name}`}>
                  <p>
                    {state.unsaved === undefined
                      ? 'The unsaved files could not be counted. Save a point first, or cancel.'
                      : `${String(state.unsaved)} unsaved ${state.unsaved === 1 ? 'change' : 'changes'}. Save a point first, or cancel.`}
                  </p>
                  <div className="acrylBlendsAskActions">
                    <button
                      type="button"
                      className="acrylBlendsSmallButton"
                      disabled={busySwitch !== undefined}
                      onClick={() => { void switchTo(branch.name, true) }}
                    >
                      {saveButtonLabel(branch.name)}
                    </button>
                    <button
                      type="button"
                      className="acrylBlendsSmallButton"
                      disabled={busySwitch !== undefined}
                      onClick={() => { setAskSwitch(undefined) }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {switchNote?.branch === branch.name && <p className="acrylBlendsNote" data-error>{switchNote.message}</p>}
              {open && branch.current && chatRows.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className="acrylBlendsItem"
                  aria-current={(item.current && strip.active === 'chat') || undefined}
                  onClick={() => {
                    chats.open(item.id)
                    showTab('chat')
                  }}
                >
                  <span className="acrylBlendsItemIcon">◆</span>
                  <span className="acrylBlendsItemTitle">Chat · {item.title}</span>
                </button>
              ))}
              {open && branch.current && terminals.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  className="acrylBlendsItem"
                  aria-current={strip.active === tab.id || undefined}
                  onClick={() => { showTab(tab.id) }}
                >
                  <span className="acrylBlendsItemIcon">{tab.kind === 'pty' ? '>_' : '$'}</span>
                  <span className="acrylBlendsItemTitle">{tab.kind === 'pty' ? PTY_AGENTS.find(entry => entry.agent === tab.agent)?.label : 'Terminal'}</span>
                  <span className="acrylBlendsMeta acrylBlendsItemMeta">{tab.kind === 'pty' ? 'PTY' : terminalMeta(strip.titles?.[tab.terminalId])}</span>
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
      {notes.available && (
        <>
          <div className="acrylBlendsSep" />
          <div className="acrylBlendsPaneHead">
            <span className="acrylBlendsLabel">Feedback from users</span>
            {notes.notes.some(note => !note.seen) && <span className="acrylBlendsFeedbackNew">{String(notes.notes.filter(note => !note.seen).length)} new</span>}
          </div>
          <div className="acrylBlendsList">
            {notes.notes.length === 0 && <p className="acrylBlendsNote">No feedback yet. People send it with the Feedback button on the app's pages.</p>}
            {handNote !== undefined && <p className="acrylBlendsNote" data-error>{handNote}</p>}
            {notes.notes.slice(0, FEEDBACK_SHOWN).map(note => (
              <button
                key={note.id}
                type="button"
                className="acrylBlendsFeedback"
                data-seen={note.seen || undefined}
                title="Hand it to an agent: the note goes into the chat, ready to send"
                onClick={() => { void hand(note) }}
              >
                <span><b>{feedbackPlace(note, state.appPage ?? '')}</b> · "{note.text}"</span>
                <small>{note.element === undefined ? 'nothing specific' : `pinned on ${note.element.label}`} · {formatRelativeTime(note.at)}</small>
              </button>
            ))}
          </div>
        </>
      )}
      <div className="acrylBlendsLeftFoot">
        <span className="acrylBlendsDot" data-live />
        Running locally · port {window.location.port || (window.location.protocol === 'https:' ? '443' : '80')}
      </div>
    </>
  )
}
