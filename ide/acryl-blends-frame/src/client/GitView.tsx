/**
 * The Git tab: the branch against its remote with Push and Pull, what changed since the newest version, then the versions as history. Read
 * again whenever the frame sees a new head or count; the remote is asked (a fetch) when the tab opens and by each push or pull.
 */

import { useEffect, useRef, useState } from 'react'
import type { GitStatusView, WorkspaceGitApi } from 'acryl-workspace/ui'
import type { VersionsLogView } from 'acryl-versions'
import { formatRelativeTime } from 'acryl-versions/client'
import type { GitRemoteState } from '../contract.ts'
import { remoteLabel, syncActions, type GitSyncPort } from './git-sync.ts'
import { versionNumber, type VersionsPort } from './versions.ts'

type GitLoad =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly changes: GitStatusView; readonly log: VersionsLogView }
  | { readonly status: 'error'; readonly message: string }

export interface GitViewProps {
  readonly git: WorkspaceGitApi
  readonly versions: VersionsPort
  readonly sync: GitSyncPort
  readonly root: string
  /** Changes when the worktree does (the frame state's head and unsaved count): the tab reads again. */
  readonly revision: string
}

/** The letter a change shows: git's own, with an untracked file as U (new), as editors show it. */
export const changeLetter = (code: string): string => (code === '?' ? 'U' : code)

type Remote =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly state: GitRemoteState }
  | { readonly status: 'error'; readonly message: string }

/** What the last push or pull said: one line, git's own when it failed. */
type Outcome = { readonly message: string; readonly failed: boolean }

const messageOf = (cause: unknown, fallback: string): string => (cause instanceof Error && cause.message !== '' ? cause.message : fallback)

export function GitView({ git, versions, sync, root, revision }: GitViewProps) {
  const [load, setLoad] = useState<GitLoad>({ status: 'loading' })
  const [remote, setRemote] = useState<Remote>({ status: 'loading' })
  const [busy, setBusy] = useState<'push' | 'pull' | undefined>(undefined)
  const [outcome, setOutcome] = useState<Outcome | undefined>(undefined)
  // The first read asks the remote (a fetch); later ones, on a new head or count, read the local refs only.
  const asked = useRef(false)

  useEffect(() => {
    let live = true
    const fetchFirst = !asked.current
    asked.current = true
    sync.remote(fetchFirst).then(
      (state) => { if (live) setRemote({ status: 'ready', state }) },
      (cause: unknown) => { if (live) setRemote({ status: 'error', message: messageOf(cause, 'The remote could not be read.') }) },
    )
    return () => { live = false }
  }, [sync, root, revision])

  const act = (kind: 'push' | 'pull'): void => {
    setBusy(kind)
    setOutcome(undefined)
    ;(kind === 'push' ? sync.push() : sync.pull()).then(
      (result) => {
        setRemote({ status: 'ready', state: result.remote })
        setOutcome({ message: result.message, failed: false })
      },
      (cause: unknown) => {
        setOutcome({ message: messageOf(cause, `The ${kind} did not go through.`), failed: true })
        // A refused push or pull still fetched: read the counts again.
        sync.remote(false).then(state => setRemote({ status: 'ready', state }), () => {})
      },
    ).finally(() => setBusy(undefined))
  }

  useEffect(() => {
    let live = true
    Promise.all([git.status(root), versions.log(root)]).then(
      ([changes, log]) => { if (live) setLoad({ status: 'ready', changes, log }) },
      (cause: unknown) => { if (live) setLoad({ status: 'error', message: cause instanceof Error ? cause.message : 'Git could not be read.' }) },
    )
    return () => { live = false }
  }, [git, versions, root, revision])

  const actions = remote.status === 'ready' ? syncActions(remote.state) : { push: false, pull: false }
  const remoteSection = (
    <>
      <div className="acrylBlendsLabel acrylBlendsGitLabel">Remote</div>
      <div className="acrylBlendsGitRemote">
        <span className="acrylBlendsGitRemoteState" data-testid="git-remote-state">
          {remote.status === 'loading' ? 'Asking the remote…' : remote.status === 'error' ? 'unknown' : remoteLabel(remote.state)}
        </span>
        <button type="button" className="acrylBlendsSmallButton" disabled={busy !== undefined || !actions.pull} onClick={() => act('pull')}>
          {busy === 'pull' ? 'Pulling…' : 'Pull'}
        </button>
        <button type="button" className="acrylBlendsSmallButton" disabled={busy !== undefined || !actions.push} onClick={() => act('push')}>
          {busy === 'push' ? 'Pushing…' : 'Push'}
        </button>
      </div>
      {remote.status === 'error' && <p className="acrylBlendsNote" data-error>{remote.message}</p>}
      {/* A push or pull says what git said; the fetch's own line would only repeat it. */}
      {outcome === undefined && remote.status === 'ready' && remote.state.kind === 'tracking' && remote.state.fetchError !== undefined && (
        <p className="acrylBlendsNote" data-error>The remote did not answer: {remote.state.fetchError}</p>
      )}
      {outcome !== undefined && (
        <p className="acrylBlendsNote" data-testid="git-sync-outcome" role="status" {...(outcome.failed ? { 'data-error': '' } : {})}>{outcome.message}</p>
      )}
    </>
  )
  if (load.status === 'loading') return <div className="acrylBlendsGit">{remoteSection}</div>
  if (load.status === 'error') return <div className="acrylBlendsGit">{remoteSection}<p className="acrylBlendsNote" data-error>{load.message}</p></div>
  const { changes, log } = load
  const newest = log.entries.length > 0 ? `v${String(log.entries.length)}` : undefined
  return (
    <div className="acrylBlendsGit">
      {remoteSection}
      <div className="acrylBlendsLabel acrylBlendsGitLabel" data-second>{newest === undefined ? 'Changes' : `Changes since ${newest}`}</div>
      {changes.changes.length === 0 && <p className="acrylBlendsNote">Nothing changed.</p>}
      {changes.changes.map(change => (
        <div key={change.path} className="acrylBlendsFrow" title={change.oldPath === undefined ? change.path : `${change.oldPath} → ${change.path}`}>
          <span className="acrylBlendsGm">{changeLetter(change.code)}</span>
          <span className="acrylBlendsFrowName">{change.path}</span>
          {(change.added !== null || change.removed !== null) && (
            <span className="acrylBlendsMeta">+{String(change.added ?? 0)} −{String(change.removed ?? 0)}</span>
          )}
        </div>
      ))}
      <div className="acrylBlendsLabel acrylBlendsGitLabel" data-second>History</div>
      {log.entries.length === 0 && <p className="acrylBlendsNote">No versions yet.</p>}
      {log.entries.map((entry, index) => (
        <div key={entry.hash} className="acrylBlendsFrow" title={`${entry.short} · ${entry.author}`}>
          <span className="acrylBlendsFrowName">{entry.subject} (v{String(versionNumber(log.entries, index))})</span>
          <span className="acrylBlendsMeta">{formatRelativeTime(entry.at)}</span>
        </div>
      ))}
    </div>
  )
}
