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
 * Where a new window goes so that it does not cover another one exactly: down and to the right of `from` by one step, and back at the top left of the work area when that would put
 * it past the edge of the screen (so a row of windows cascades, then starts again).
 */
export function cascade(
  from: Rect,
  work: Rect,
  size: { width: number; height: number },
): { x: number; y: number } {
  const x = from.x + CASCADE_STEP
  const y = from.y + CASCADE_STEP
  const fitsRight = x + size.width <= work.x + work.width
  const fitsBottom = y + size.height <= work.y + work.height
  return { x: fitsRight ? x : work.x, y: fitsBottom ? y : work.y }
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
