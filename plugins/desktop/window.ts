/** The one window of a desktop app: the operating system's frame around a page the app's own server serves, with the renderer locked down. */

export interface WindowSpec {
  readonly title: string
  readonly width?: number
  readonly height?: number
  /** Where the window's top left corner goes; Electron centers the window when these are left out. */
  readonly x?: number
  readonly y?: number
}

export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** How far each new window sits from the one it was opened from. */
export const CASCADE_STEP = 32

/**
 * Where a new window goes so that it does not cover another one exactly. The first free place of: a step down and to the right of `from`, and again, while the window still fits on the
 * screen; then the same steps from the top left of the work area (a row of windows cascades, then starts again); and, on a screen no bigger than the window, the steps from `from` even
 * though the window runs past the edge (two windows at one place cannot be told apart). A place is free when no window in `taken` is there.
 */
export function cascade(
  from: Rect,
  work: Rect,
  size: { width: number; height: number },
  taken: readonly { x: number; y: number }[] = [],
): { x: number; y: number } {
  const free = (place: { x: number; y: number }): boolean =>
    !taken.some((other) => other.x === place.x && other.y === place.y)
  const fits = (place: { x: number; y: number }): boolean =>
    place.x + size.width <= work.x + work.width && place.y + size.height <= work.y + work.height
  const steps = (origin: { x: number; y: number }): { x: number; y: number }[] =>
    Array.from({ length: 40 }, (_, at) => ({
      x: origin.x + CASCADE_STEP * (at + 1),
      y: origin.y + CASCADE_STEP * (at + 1),
    }))
  const fromHere = steps(from)
  const fromCorner = [{ x: work.x, y: work.y }, ...steps(work)]
  return (
    fromHere.find((place) => fits(place) && free(place)) ??
    fromCorner.find((place) => fits(place) && free(place)) ??
    fromHere.find(free) ??
    fromHere[0] ?? { x: from.x + CASCADE_STEP, y: from.y + CASCADE_STEP }
  )
}

/**
 * Secure BrowserWindow options. The settings are ACRYL Desktop's: context isolation on, no Node in the page, the sandbox on, web security on; the window stays
 * hidden until the page has painted (`show: false`, shown on `ready-to-show`).
 */
export interface WindowOptions {
  readonly title: string
  readonly width: number
  readonly height: number
  readonly minWidth: number
  readonly minHeight: number
  readonly x?: number
  readonly y?: number
  readonly show: boolean
  readonly webPreferences: {
    readonly contextIsolation: boolean
    readonly nodeIntegration: boolean
    readonly sandbox: boolean
    readonly webSecurity: boolean
  }
}

export function windowOptions(spec: WindowSpec): WindowOptions {
  return {
    title: spec.title,
    width: spec.width ?? 1100,
    height: spec.height ?? 760,
    minWidth: 480,
    minHeight: 360,
    ...(spec.x === undefined || spec.y === undefined ? {} : { x: spec.x, y: spec.y }),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  }
}
