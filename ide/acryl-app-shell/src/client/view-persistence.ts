/**
 * The frame's own view across reloads: Build or Preview, and the panel widths the person dragged to. It is a
 * per-viewer convenience, not app state: reads are defensive and writes are ignored when storage is blocked.
 *
 * The right panel's open state is not here. Its content and lifecycle belong to the panel (which reports open
 * and closed through the layout service), so saving it here would fight the panel on the next run.
 */

import type { DesktopLayoutState, FrameMode, SavedFrameView } from './layout-state.ts'

export const FRAME_VIEW_KEY = 'acryl-app-shell:view:v1'

/** The two methods of the Storage interface this module uses. */
export interface ViewStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** @returns the page's localStorage, or undefined when it is blocked (private windows, policies). */
export function browserViewStorage(): ViewStorage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** @param value - parsed JSON of unknown shape; anything unreadable gives nothing. */
export function parseSavedFrameView(value: unknown): SavedFrameView | undefined {
  if (!isRecord(value)) return undefined
  const view: { mode?: FrameMode; sidebar?: number; details?: number } = {}
  if (value.mode === 'build' || value.mode === 'preview') view.mode = value.mode
  if (typeof value.sidebar === 'number' && Number.isFinite(value.sidebar)) view.sidebar = value.sidebar
  if (typeof value.details === 'number' && Number.isFinite(value.details)) view.details = value.details
  return Object.keys(view).length === 0 ? undefined : view
}

/** @returns what the previous run saved, or undefined for a fresh start. */
export function loadFrameView(storage: ViewStorage | undefined): SavedFrameView | undefined {
  if (storage === undefined) return undefined
  try {
    const raw = storage.getItem(FRAME_VIEW_KEY)
    return raw === null ? undefined : parseSavedFrameView(JSON.parse(raw))
  } catch {
    return undefined
  }
}

/**
 * Save the frame's view shortly after it changes, and once more on shutdown.
 * @param layout - the frame's layout state.
 * @param storage - undefined when storage is blocked; persistence then does nothing.
 * @param delayMs - debounce before a write.
 * @returns disposer, for one owning `ctx.effect`.
 */
export function startFrameViewPersistence(layout: DesktopLayoutState, storage: ViewStorage | undefined, delayMs = 300): () => void {
  if (storage === undefined) return () => {}
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = (): void => {
    timer = undefined
    const snapshot = layout.getSnapshot()
    try {
      storage.setItem(FRAME_VIEW_KEY, JSON.stringify({ mode: snapshot.mode, sidebar: snapshot.sidebar, details: snapshot.details }))
    } catch {
      // Storage full or blocked: a convenience only.
    }
  }
  const schedule = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(flush, delayMs)
  }
  const stop = layout.subscribe(schedule)
  return () => {
    stop()
    if (timer !== undefined) {
      clearTimeout(timer)
      flush()
    }
  }
}
