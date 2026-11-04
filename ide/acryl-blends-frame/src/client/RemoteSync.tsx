/**
 * The branch against its remote, with Pull and Push and the line the last one said: the Git tab's remote row, and the same row under the left
 * panel's versions. Read again whenever `revision` changes; `fetchOnOpen` asks the remote (a fetch) on the first read, later reads use the local
 * refs, and each push or pull asks it anyway.
 */

import { useEffect, useRef, useState } from 'react'
import type { GitRemoteState } from '../contract.ts'
import { remoteLabel, syncActions, type GitSyncPort } from './git-sync.ts'

type Remote =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly state: GitRemoteState }
  | { readonly status: 'error'; readonly message: string }

/** What the last push or pull said: one line, git's own when it failed. */
type Outcome = { readonly message: string; readonly failed: boolean }

const messageOf = (cause: unknown, fallback: string): string => (cause instanceof Error && cause.message !== '' ? cause.message : fallback)

export interface RemoteSyncProps {
  readonly sync: GitSyncPort
  readonly root: string
  readonly revision: string
  readonly fetchOnOpen?: boolean
  /** The row's heading. */
  readonly label?: string
}

export function RemoteSync({ sync, root, revision, fetchOnOpen = true, label = 'Remote' }: RemoteSyncProps) {
  const [remote, setRemote] = useState<Remote>({ status: 'loading' })
  const [busy, setBusy] = useState<'push' | 'pull' | undefined>(undefined)
  const [outcome, setOutcome] = useState<Outcome | undefined>(undefined)
  const asked = useRef(!fetchOnOpen)

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
  const actions = remote.status === 'ready' ? syncActions(remote.state) : { push: false, pull: false }
  return (
    <>
      <div className="acrylBlendsLabel acrylBlendsGitLabel">{label}</div>
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
