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

/** The address the carrier is bound to. ACRYL's plugins refuse anything but loopback. */
export interface AcrylWeb {
  /** The interface the carrier listens on. */
  readonly host: string
  /** The listening port (the OS-assigned one when it was configured as zero). */
  readonly port: number
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    acrylWeb: AcrylWeb
  }
}

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
    }
    const dispose = ctx.reflect.provide('acrylWeb', port)
    return () => {
      void dispose()
    }
  }, 'acryl-web: acrylWeb')
}
