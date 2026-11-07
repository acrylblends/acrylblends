/**
 * The generated `frame/app-plugins.mjs`: the app's own rows run under a router view that adds the frame's canvas prefix, so a plugin's
 * `ctx.router.route('/board')` answers `/app/board` in the canvas and `/board` on the app's own server (docs/plans/ide-host-inversion.md, the
 * app-route prefix fix).
 */

import { describe, expect, it } from 'vitest'
import { appPluginsRow } from '../src/frame-rows'

const row = appPluginsRow('/app')

/** The mapping exactly as the generated row runs it (the row is app code; the test evaluates its own function text). */
function rowRoutePath(): (prefix: string, path: string) => string {
  const match = /function prefixedAppRoute\(prefix, path\) \{[\s\S]*?\n\}/u.exec(row)
  if (match === null) throw new Error('the generated row has no prefixedAppRoute')
  return new Function(`return (${match[0]})`)() as (prefix: string, path: string) => string
}

/** The router view exactly as the generated row builds it. */
function rowRouter(): (router: object, prefix: string) => { request(input: unknown): unknown } {
  const source =
    /function prefixedAppRoute[\s\S]*?\n\}\n[\s\S]*?function appRouter\(router, prefix\) \{[\s\S]*?\n\}/u.exec(
      row,
    )
  if (source === null) throw new Error('the generated row has no appRouter')
  return new Function(`${source[0]}\nreturn appRouter`)() as never
}

describe('the generated app-plugins row', () => {
  it("a plugin's own request finds its route under the prefix, so its install check passes in the frame", () => {
    const asked: unknown[] = []
    const view = rowRouter()({ request: (input: unknown) => asked.push(input) }, '/app')
    view.request('/pomodoro')
    view.request('/app/pomodoro')
    const whole = new Request('http://x/pomodoro')
    view.request(whole)
    expect(asked).toEqual(['/app/pomodoro', '/app/pomodoro', whole])
  })

  it('runs the app rows under a router whose mounts land under the frame prefix', () => {
    expect(row).toContain("import { composeInto } from '../src/app.ts'")
    expect(row).toContain('const appScope = ctx.extend({ router: appRouter(ctx.router, prefix) })')
    expect(row).toContain(
      'const fibers = await composeInto(appScope, ctx.appInstance, { host: true })',
    )
  })

  it('maps a plugin route under the prefix, keeping a route already under it as it is', () => {
    const prefixedAppRoute = rowRoutePath()
    expect(prefixedAppRoute('/app', '/board')).toBe('/app/board')
    expect(prefixedAppRoute('/app', 'board')).toBe('/app/board')
    expect(prefixedAppRoute('/app', '/')).toBe('/app')
    expect(prefixedAppRoute('/app', '/app')).toBe('/app')
    expect(prefixedAppRoute('/app', '/app/client')).toBe('/app/client')
    // A nested app path keeps its own segments: only the frame's prefix is added.
    expect(prefixedAppRoute('/app', '/board/item')).toBe('/app/board/item')
    // No prefix (a host without the canvas): the app's paths stay as they are.
    expect(prefixedAppRoute('', '/board')).toBe('/board')
    expect(prefixedAppRoute('/', '/board')).toBe('/board')
  })
})
