/**
 * The branch against its remote, with Pull and Push and the line the last one said. Two faces on one hook: the Git tab's remote row, and the
 * compact chips on the left panel's versions header (`↑2` / `↓1` / `✓`, with the line as a brief toast). Read again whenever `revision` changes;
 * the first read asks the remote (a fetch), later ones read the local refs, and each push or pull asks it anyway.
 */

import { useEffect, useRef, useState } from 'react'
import type { GitRemoteState } from '../contract.ts'
import { remoteChips, remoteLabel, syncActions, type GitSyncPort } from './git-sync.ts'

type Remote =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly state: GitRemoteState }
  | { readonly status: 'error'; readonly message: string }

/** What the last push or pull said: one line, git's own when it failed. */
type Outcome = { readonly message: string; readonly failed: boolean }

const messageOf = (cause: unknown, fallback: string): string => (cause instanceof Error && cause.message !== '' ? cause.message : fallback)

function useRemoteSync(sync: GitSyncPort, root: string, revision: string) {
  const [remote, setRemote] = useState<Remote>({ status: 'loading' })
  const [busy, setBusy] = useState<'push' | 'pull' | undefined>(undefined)
  const [outcome, setOutcome] = useState<Outcome | undefined>(undefined)
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
  const stateText = remote.status === 'loading' ? 'Asking the remote…' : remote.status === 'error' ? 'unknown' : remoteLabel(remote.state)
  return { remote, busy, outcome, setOutcome, act, stateText }
}

export interface RemoteSyncProps {
  readonly sync: GitSyncPort
  readonly root: string
  readonly revision: string
}

/** The Git tab's row. */
export function RemoteSync({ sync, root, revision }: RemoteSyncProps) {
  const { remote, busy, outcome, act, stateText } = useRemoteSync(sync, root, revision)
  const actions = remote.status === 'ready' ? syncActions(remote.state) : { push: false, pull: false }
  return (
    <>
      <div className="acrylBlendsLabel acrylBlendsGitLabel">Remote</div>
      <div className="acrylBlendsGitRemote">
        <span className="acrylBlendsGitRemoteState" data-testid="git-remote-state" title={stateText}>{stateText}</span>
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
}

/** How long a push's or pull's line stays: a failure longer, and a click on it dismisses it sooner. */
const TOAST_MS = 4000
const TOAST_FAILED_MS = 9000

/** The versions header's chips; nothing when the branch has no remote. */
export function RemoteChips({ sync, root, revision }: RemoteSyncProps) {
  const { remote, busy, outcome, setOutcome, act, stateText } = useRemoteSync(sync, root, revision)
  useEffect(() => {
    if (outcome === undefined) return
    const timer = setTimeout(() => { setOutcome(undefined) }, outcome.failed ? TOAST_FAILED_MS : TOAST_MS)
    return () => { clearTimeout(timer) }
  }, [outcome, setOutcome])
  const chips = remote.status === 'ready' ? remoteChips(remote.state) : undefined
  const fetchError = remote.status === 'ready' && remote.state.kind === 'tracking' ? remote.state.fetchError : undefined
  const title = fetchError === undefined ? stateText : `${stateText} (the remote did not answer: ${fetchError})`
  return (
    <>
      {chips !== undefined && (
        <span className="acrylBlendsRemoteChips" data-testid="remote-chips">
          {chips.synced && <span className="acrylBlendsRemoteChip" data-synced title={title} aria-label={title}>✓</span>}
          {chips.pull !== undefined && (
            <button type="button" className="acrylBlendsRemoteChip" title={`${title} · Pull`} aria-label={`Pull: ${title}`} disabled={busy !== undefined} onClick={() => act('pull')}>
              {busy === 'pull' ? '…' : chips.pull}
            </button>
          )}
          {chips.push !== undefined && (
            <button type="button" className="acrylBlendsRemoteChip" title={`${title} · Push`} aria-label={`Push: ${title}`} disabled={busy !== undefined} onClick={() => act('push')}>
              {busy === 'push' ? '…' : chips.push}
            </button>
          )}
        </span>
      )}
      {outcome !== undefined && (
        <button
          type="button"
          className="acrylBlendsToast"
          data-testid="git-sync-outcome"
          role="status"
          title="Dismiss"
          {...(outcome.failed ? { 'data-error': '' } : {})}
          onClick={() => { setOutcome(undefined) }}
        >
          {outcome.message}
        </button>
      )}
    </>
  )
}
