import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesktopLayoutState } from '../src/client/layout-state.ts'
import {
  FRAME_VIEW_KEY,
  loadFrameView,
  parseSavedFrameView,
  startFrameViewPersistence,
  type ViewStorage,
} from '../src/client/view-persistence.ts'

afterEach(() => { vi.useRealTimers() })

function storage(initial: string | null = null): ViewStorage & { readonly writes: string[] } {
  const writes: string[] = []
  let value = initial
  return {
    writes,
    getItem: () => value,
    setItem: (_key, next) => { value = next; writes.push(next) },
  }
}

describe('the frame view survives a reload', () => {
  it('reads only what it recognises', () => {
    expect(parseSavedFrameView({ mode: 'preview', sidebar: 0, details: 420 })).toEqual({ mode: 'preview', sidebar: 0, details: 420 })
    expect(parseSavedFrameView({ mode: 'production', sidebar: 'wide' })).toBeUndefined()
    expect(parseSavedFrameView(null)).toBeUndefined()
    expect(parseSavedFrameView([])).toBeUndefined()
  })

  it('loads a saved view and survives damaged storage', () => {
    const saved = storage(JSON.stringify({ mode: 'preview', sidebar: 0, details: 300 }))
    expect(loadFrameView(saved)).toEqual({ mode: 'preview', sidebar: 0, details: 300 })
    expect(loadFrameView(storage('{not json'))).toBeUndefined()
    expect(loadFrameView(undefined)).toBeUndefined()
  })

  it('saves the mode and widths shortly after a change, and once more on disposal', () => {
    vi.useFakeTimers()
    const target = storage()
    const layout = new DesktopLayoutState()
    const stop = startFrameViewPersistence(layout, target, 200)
    layout.setMode('preview')
    vi.advanceTimersByTime(200)
    expect(target.writes).toHaveLength(1)
    expect(JSON.parse(target.writes[0] as string)).toMatchObject({ mode: 'preview' })
    layout.toggleSidebar()
    stop()
    expect(target.writes).toHaveLength(2)
    expect(JSON.parse(target.writes[1] as string)).toMatchObject({ mode: 'preview', sidebar: 0 })
    expect(FRAME_VIEW_KEY).toBe('acryl-app-shell:view:v1')
  })
})
