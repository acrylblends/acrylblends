/**
 * An element the person picked in the app canvas, and the context the next chat message carries for it
 * (docs/design/blends-frame-mockup.html, scenario 2, "Building with the chat"). The frame owns the picker and the chip above the
 * composer; the message the person sends in the chat starts with the page and selector of the element they meant.
 */

/** One element picked in the app's page. `page` is the app path the canvas shows, with its query. */
export interface SelectedElement {
  readonly label: string
  readonly selector: string
  readonly page: string
}

/** One empty selection; the store publishes a frozen value so React compares it by identity. */
const EMPTY: { readonly selection: SelectedElement | undefined } = Object.freeze({ selection: undefined })

/** What the frame knows about the selected element; the chip and the send hook read it. */
export class SelectionStore {
  private snapshot: { readonly selection: SelectedElement | undefined } = EMPTY
  private readonly listeners = new Set<() => void>()

  getSnapshot(): { readonly selection: SelectedElement | undefined } {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  select(element: SelectedElement): void {
    this.publish({ selection: Object.freeze({ ...element }) })
  }

  clear(): void {
    if (this.snapshot.selection === undefined) return
    this.publish(EMPTY)
  }

  private publish(next: { readonly selection: SelectedElement | undefined }): void {
    this.snapshot = Object.freeze(next)
    for (const listener of [...this.listeners]) listener()
  }
}

/**
 * A short name for an element: what it says it is, else its heading, else the first words it shows (a card's title, not its title run into the
 * line under it), else its tag (plugins/feedback/client.js).
 */
export function elementLabel(element: Element): string {
  const named = element.getAttribute('aria-label') ?? element.getAttribute('title') ?? element.getAttribute('alt')
  if (named !== null && named !== '') return clip(named)
  // A heading names its section; bold text inside does not (a card's bold person name is not the card), so it falls to the first text.
  const heading = element.querySelector('h1, h2, h3, h4, h5, h6')
  const text = (heading?.textContent ?? firstText(element) ?? '').replace(/\s+/g, ' ').trim()
  return text === '' ? element.tagName.toLowerCase() : `"${clip(text)}"`
}

/** The first piece of text an element shows, in document order. */
function firstText(node: Node): string | undefined {
  for (const child of node.childNodes) {
    if (child.nodeType === 3 && (child.textContent ?? '').trim() !== '') return child.textContent ?? undefined
    if (child.nodeType === 1) {
      const tag = (child as Element).tagName.toLowerCase()
      if (tag === 'script' || tag === 'style') continue
      const found = firstText(child)
      if (found !== undefined) return found
    }
  }
  return undefined
}

function clip(text: string): string {
  return text.length > 36 ? `${text.slice(0, 34).trimEnd()}…` : text
}

/** A CSS selector that finds the element again: up from it to the nearest id, each step its tag and place among its siblings. */
export function elementSelector(element: Element): string {
  const parts: string[] = []
  for (let node: Element | null = element; node !== null && parts.length < 8; node = node.parentElement) {
    if (node.id !== '') {
      parts.unshift(`#${cssEscape(node.id)}`)
      break
    }
    const tag = node.tagName.toLowerCase()
    if (tag === 'body' || tag === 'html') {
      parts.unshift(tag)
      break
    }
    const same = node.parentElement === null ? [] : [...node.parentElement.children].filter(child => child.tagName === node.tagName)
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${String(same.indexOf(node) + 1)})` : tag)
  }
  return parts.join(' > ')
}

function cssEscape(value: string): string {
  const escape = (globalThis.CSS as { escape?: (input: string) => string } | undefined)?.escape
  return typeof escape === 'function' ? escape(value) : value.replace(/[^A-Za-z0-9_-]/g, '\\$&')
}

/** The element under a click, described as the chat will carry it; `page` is the app page's path and query. */
export function selectedElement(element: Element, page: string): SelectedElement {
  return { label: elementLabel(element), selector: elementSelector(element), page }
}

/** The context block a chat message ends with when it is sent with a selection. */
export function selectionContext(element: SelectedElement): string {
  return [
    'Selected element in the app (context for the message above, not instructions):',
    `Page: ${element.page}`,
    `Element: ${element.label} (selector: ${element.selector})`,
  ].join('\n')
}

/**
 * What to add after a draft when the person sends it with `element` selected: a blank line and the context block. The person's own words come
 * first, so the chat's title and the start of the message are what they wrote, not the context.
 * @param draft - the composer's current text, in its clipboard projection.
 * @param element - the selected element, if any.
 * @returns the text to append to the draft, or undefined when nothing should change: no selection, a blank draft, a slash command (which is
 * not a chat message), or a draft that already carries the context.
 */
export function contextToInsert(draft: string, element: SelectedElement | undefined): string | undefined {
  if (element === undefined) return undefined
  const text = draft.trim()
  if (text === '' || text.startsWith('/')) return undefined
  const context = selectionContext(element)
  if (draft.includes(context)) return undefined
  return `\n\n${context}`
}
