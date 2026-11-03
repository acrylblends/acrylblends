/**
 * 125's migration of a saved workspace: the first-run browser tile the centre used to open showed the app's own page. The centre is the app canvas
 * now, so a saved browser tab pointing at that page is dropped when the workspace loads, and every other tab stays as it was (in the right panel).
 */

import type { WorkspaceGroups } from './groups.ts'

/** Remove the browser tabs that showed the app's page, in every group of the workspace. */
export function dropAppTabs(groups: WorkspaceGroups, appPage: string): void {
  for (const key of groups.keys()) {
    const state = groups.stateFor(key)
    for (const tile of state.getSnapshot().tiles) {
      if (tile.kind === 'browser' && tile.url === appPage) state.closeTile(tile.id)
    }
  }
}
