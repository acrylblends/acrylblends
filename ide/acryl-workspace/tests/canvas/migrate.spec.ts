/** 125: a saved workspace drops the browser tab that showed the app's page (the canvas shows it now) and keeps every other tab. */

import { describe, expect, it } from 'vitest'
import { WorkspaceGroups } from '../../src/client/canvas/groups.ts'
import { dropAppTabs } from '../../src/client/canvas/migrate.ts'

const APP = 'http://127.0.0.1:4444/app'

describe('dropAppTabs', () => {
  it('drops the app page tab in every group and leaves the other tabs', () => {
    const groups = new WorkspaceGroups()
    const first = groups.stateFor('/p')
    first.addTile('browser', { url: APP })
    first.addTile('browser', { url: 'https://example.org' })
    first.addTile('file', { title: 'a.ts', fileWorktree: '/p', fileRel: 'a.ts' })
    const other = groups.stateFor('/q')
    other.addTile('browser', { url: APP })
    dropAppTabs(groups, APP)
    // The default chat tab is part of every tab set and is not the migration's business.
    expect(first.getSnapshot().tiles.filter((tile) => tile.kind !== 'chat').map((tile) => [tile.kind, tile.url ?? tile.title])).toEqual([
      ['browser', 'https://example.org'],
      ['file', 'a.ts'],
    ])
    expect(other.getSnapshot().tiles.filter((tile) => tile.kind !== 'chat')).toHaveLength(0)
  })
})
