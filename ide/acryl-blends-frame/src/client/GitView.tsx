/** The Git tab: what changed since the newest version, then the versions as history. Read again whenever the frame sees a new head or count. */

import { useEffect, useState } from 'react'
import type { GitStatusView, WorkspaceGitApi } from 'acryl-workspace/ui'
import type { VersionsLogView } from 'acryl-versions'
import { formatRelativeTime } from 'acryl-versions/client'
import { versionNumber, type VersionsPort } from './versions.ts'

type GitLoad =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly changes: GitStatusView; readonly log: VersionsLogView }
  | { readonly status: 'error'; readonly message: string }

export interface GitViewProps {
  readonly git: WorkspaceGitApi
  readonly versions: VersionsPort
  readonly root: string
  /** Changes when the worktree does (the frame state's head and unsaved count): the tab reads again. */
  readonly revision: string
}

/** The letter a change shows: git's own, with an untracked file as U (new), as editors show it. */
export const changeLetter = (code: string): string => (code === '?' ? 'U' : code)

export function GitView({ git, versions, root, revision }: GitViewProps) {
  const [load, setLoad] = useState<GitLoad>({ status: 'loading' })

  useEffect(() => {
    let live = true
    Promise.all([git.status(root), versions.log(root)]).then(
      ([changes, log]) => { if (live) setLoad({ status: 'ready', changes, log }) },
      (cause: unknown) => { if (live) setLoad({ status: 'error', message: cause instanceof Error ? cause.message : 'Git could not be read.' }) },
    )
    return () => { live = false }
  }, [git, versions, root, revision])

  if (load.status === 'loading') return <div className="acrylBlendsGit" />
  if (load.status === 'error') return <div className="acrylBlendsGit"><p className="acrylBlendsNote" data-error>{load.message}</p></div>
  const { changes, log } = load
  const newest = log.entries.length > 0 ? `v${String(log.entries.length)}` : undefined
  return (
    <div className="acrylBlendsGit">
      <div className="acrylBlendsLabel acrylBlendsGitLabel">{newest === undefined ? 'Changes' : `Changes since ${newest}`}</div>
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
