/**
 * DSH's chat view (`dsh-client-ui-chat`) needs a `sidebarRight` service to open a link or a file from an answer. The Blends frame draws its own right panel
 * and does not mount DSH's right sidebar, so it provides this stand-in: a link to a web page opens in a new browser tab, and anything else (a DSH
 * resource address, a page type the frame has no tab for) is left alone rather than thrown at the chat.
 */

/** The part of DSH's `SidebarRightController` the chat calls. */
export interface SidebarRightStandIn {
  openResource(address: string, options?: unknown): void
  openTab(kind: string, options?: { readonly params?: { readonly url?: unknown } }): void
  openResourceIn(sessionId: string, address: string, options?: unknown): void
  openTabIn(sessionId: string, kind: string, options?: { readonly params?: { readonly url?: unknown } }): void
  isExpanded(): boolean
}

/** A web address worth a new browser tab: http or https, nothing the page itself could run. */
export function webAddress(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

export function createSidebarRightStandIn(open: (url: string) => void): SidebarRightStandIn {
  const openWeb = (value: unknown): void => {
    const url = webAddress(value)
    if (url !== undefined) open(url)
  }
  return {
    openResource: (address) => { openWeb(address) },
    openTab: (kind, options) => { if (kind === 'browser') openWeb(options?.params?.url) },
    openResourceIn: (_sessionId, address) => { openWeb(address) },
    openTabIn: (_sessionId, kind, options) => { if (kind === 'browser') openWeb(options?.params?.url) },
    isExpanded: () => false,
  }
}
