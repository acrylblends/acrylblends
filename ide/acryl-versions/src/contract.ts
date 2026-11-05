/**
 * The Versions routes and view types shared by the Host and Client halves.
 *
 * A version is a commit on the branch. Nothing else is stored: the log is `git log`, the branch and its
 * upstream are `git rev-parse` readings, and ahead/behind say whether the branch is shared.
 */

/** The prefix acryl-versions mounts on the router. */
export const VERSIONS_API_PREFIX = '/api/acryl-versions'
export const VERSIONS_LOG_PATH = `${VERSIONS_API_PREFIX}/log`
export const VERSIONS_SAVE_PATH = `${VERSIONS_API_PREFIX}/save`
export const VERSIONS_RESTORE_PATH = `${VERSIONS_API_PREFIX}/restore`
export const VERSIONS_SHARE_PATH = `${VERSIONS_API_PREFIX}/share`

/** The log's page size when the caller names none. */
export const DEFAULT_LOG_LIMIT = 50
/** The most versions one log request may return. */
export const MAX_LOG_LIMIT = 200
/** The longest commit message a save accepts. */
export const MAX_COMMIT_MESSAGE = 5000
/** A version id for restore: an abbreviated or full commit id. */
export const VERSION_HASH_PATTERN = /^[0-9a-f]{7,40}$/i

/** One version, as `git log` reports the commit. */
export interface VersionsEntry {
  /** Full commit id. */
  readonly hash: string
  /** Abbreviated commit id, as git chose it. */
  readonly short: string
  /** First line of the commit message. */
  readonly subject: string
  /** Author name. */
  readonly author: string
  /** Author time, ISO 8601. */
  readonly at: string
}

/** The branch's versions, newest first, and whether the branch is shared. */
export interface VersionsLogView {
  /** Real path of the worktree the log was read from. */
  readonly path: string
  /** The checked-out branch, or null when HEAD is detached. */
  readonly branch: string | null
  /** The branch's upstream (`origin/main`), or null when it has none. */
  readonly upstream: string | null
  /** Commits on HEAD that the upstream does not have (0 without an upstream). */
  readonly ahead: number
  /** Commits on the upstream that HEAD does not have (0 without an upstream). */
  readonly behind: number
  readonly entries: readonly VersionsEntry[]
}

/** A commit without the worktree status: what a save or a restore made. */
export interface VersionsCommitView {
  /** Full commit id. */
  readonly hash: string
  /** Abbreviated commit id. */
  readonly short: string
  /** First line of the commit message. */
  readonly subject: string
}

/** The answer to a save: the new version in full and its three identifying fields. */
export interface VersionsSaveView {
  readonly entry: VersionsEntry
  readonly commit: VersionsCommitView
}

/** The answer to a restore: the version that was brought back and the commit that records it. */
export interface VersionsRestoreView {
  /** Abbreviated id of the version that was restored. */
  readonly restored: string
  /** The new commit; history was not rewritten. */
  readonly commit: VersionsCommitView
}

/** The answer to a share: the push went through to this upstream. */
export interface VersionsShareView {
  readonly pushed: true
  readonly upstream: string
}
