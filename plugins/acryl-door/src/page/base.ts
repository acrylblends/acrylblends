/**
 * Where a host serves the app's pages under a prefix (the ACRYL frame's canvas, `/app`): the meta the door puts on each page, and where an app path
 * lands under that prefix. Empty at the root, which is the app's own server.
 */

/** The app base a page carries (`<meta name="acryl-app-base">`, the host's prefix for the app); '' at the root. */
export function appBaseOf(document: Document): string {
  const content = document.querySelector('meta[name="acryl-app-base"]')?.getAttribute('content')?.trim() ?? ''
  return content.startsWith('/') && content !== '/' ? content.replace(/\/+$/u, '') : ''
}

/** `path` (an app path) under `base`: '/board' under '/app' is '/app/board'; without a base, the path as written. */
export function underAppBase(base: string, path: string): string {
  if (base === '' || path === base || path.startsWith(`${base}/`)) return path
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}
