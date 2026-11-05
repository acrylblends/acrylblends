/**
 * The app's home page as a place plugins put their widgets (`ctx.home`).
 *
 * A feature is its own plugin, so its UI must reach the page without anyone editing the page's code: a plugin registers a widget, the home page
 * renders every widget registered at the time of the request, and the widget leaves the page with the plugin that registered it (switched off in
 * Settings > Plugins, removed, or reloaded). The widget is HTML rendered into the page itself, not a frame, so the page, its tests and the door's
 * `look` all see it.
 *
 * A widget names its plugin's URLs as the app's own server answers them (`/notes/widget.js`, `fetch('/notes/items')`): on `npm start` they are at the
 * root, and in the frame the canvas page sends them to the same routes under its prefix.
 */
import type { Context } from '@deepseek-ai/cordis'

/** One widget on the home page. */
export interface HomeWidget {
  /** Unique on the page: the name of the plugin that registers it. */
  readonly id: string
  /** The widget's heading; the page escapes it. */
  readonly title: string
  /** The widget's HTML, rendered into the page at each request. It is inserted as it is: escape any user text in it. */
  render(): string | Promise<string>
}

export interface Home {
  /**
   * Put a widget on the home page. Call it inside `ctx.effect` so the widget leaves with the plugin:
   * `ctx.effect(() => ctx.home.widget({ id: 'notes', title: 'Notes', render: () => '<div id="notes"></div>' }))`.
   * @returns the disposer, which takes the widget off the page.
   * @throws when a widget with the same id is already on the page.
   */
  widget(widget: HomeWidget): () => void
  /** The widgets on the page now, in the order they were registered. */
  widgets(): readonly HomeWidget[]
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    home: Home
  }
}

const ID = /^[a-z0-9][a-z0-9-]*$/

export function createHome(): Home {
  const registered = new Map<string, HomeWidget>()
  return {
    widget(widget) {
      if (!ID.test(widget.id))
        throw new Error(
          `a widget id is a plugin name (lowercase letters, digits and dashes), not "${widget.id}"`,
        )
      if (registered.has(widget.id))
        throw new Error(`the home page already has a widget "${widget.id}"`)
      registered.set(widget.id, widget)
      return () => {
        if (registered.get(widget.id) === widget) registered.delete(widget.id)
      }
    },
    widgets: () => [...registered.values()],
  }
}

const escapeHtml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/**
 * The widgets as one block of the page: a `<section data-widget="<id>">` with the heading and the widget's HTML for each. A widget whose render
 * throws shows one line saying so, and the page still renders.
 */
export async function renderWidgets(home: Home): Promise<string> {
  const sections = await Promise.all(
    home.widgets().map(async (widget) => {
      let body: string
      try {
        body = await widget.render()
      } catch (cause) {
        body = `<p role="alert">This widget could not be shown: ${escapeHtml(cause instanceof Error ? cause.message : String(cause))}</p>`
      }
      return `<section class="widget" data-widget="${escapeHtml(widget.id)}">\n<h2>${escapeHtml(widget.title)}</h2>\n${body}\n</section>`
    }),
  )
  return sections.join('\n')
}

/** Provides `ctx.home`. Mount it before the routes that render the home page and before the plugins that put widgets on it. */
export const name = 'home'

export function apply(ctx: Context): void {
  ctx.provide('home', createHome())
}
