/**
 * The `acrylWeb` service: where the thing that serves the page listens, and nothing else.
 *
 * Ported from ACRYL (`runtime/acryl-harness-runtime/src/engine-web.ts` and `runtime/acryl-control/src/platform/web.ts`): ACRYL's plugins inject
 * `acrylWeb` only for the address itself (the loopback check, an origin to hand to a child process), never a harness service, so the carrier behind
 * it can change without touching them. Here the carrier is DSH's `webServer`; routes and upgrades stay with the framework's router
 * (`ctx.router`, `ctx.routerHttp`). The service is provided inside one effect, so a carrier that is replaced re-binds it and a plugin unload removes it.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { AcrylWeb } from 'acryl-control'

// The service's contract is declared once, by the ported acryl-control (`src/platform/web.ts`), so this package only provides it. ACRYL's own source at
// 37f4dd9c carries the same type without the two registration methods (spec 048 T008 took them out); the port carries the earlier shape, reported to the
// port owner, and what this adapter provides is the address those plugins actually read.

export const name = 'acryl-web'
export const inject = ['webServer']

export function apply(ctx: Context): void {
  ctx.effect(() => {
    const port: AcrylWeb = {
      get host() {
        return ctx.webServer.host
      },
      get port() {
        return ctx.webServer.port
      },
      // The ported contract (acryl-control's platform/web.ts) still declares these two; ACRYL's plugins no longer call them after spec 048 T008, and they
      // are thin delegates to DSH's server for the rows that do while the port owner reconciles the shape (reported).
      register: (route) => ctx.webServer.register(route),
      registerUpgrade: (route) => ctx.webServer.registerUpgrade(route),
    }
    const dispose = ctx.reflect.provide('acrylWeb', port)
    return () => {
      void dispose()
    }
  }, 'acryl-web: acrylWeb')
}
