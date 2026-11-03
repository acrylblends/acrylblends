/**
 * The left panel's window onto the Versions plugin. The plugin provides `acrylVersions`; a composition without
 * it (an app without git, or a frame that did not load the row) simply has no Versions section. The port keeps
 * the workspace independent of the plugin's package: it knows one component and nothing else.
 */

import type { ComponentType } from 'react'

/** What `acrylVersions` provides. */
export interface VersionsService {
  /** The Versions section for one worktree: the version list, Save point, Restore and Share. */
  readonly Section: ComponentType<{ readonly path: string }>
}

/** A live read of the service: it may arrive after this pane is first rendered, and leaves with its fiber. */
export interface VersionsPort {
  get(): VersionsService | undefined
  subscribe(listener: () => void): () => void
}
