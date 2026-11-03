/**
 * The centre of the frame: the app's own page (docs/plans/ide-host-inversion.md section 31, boundary A). Registered into `desktop.main` below the
 * workspace canvas (-2 against its -1; a lower priority renders), and only when the Host serves an app, so a surface without one keeps the workspace
 * canvas. Provides `appCanvas` to the frame's other plugins.
 */

import '@deepseek-ai/dsh-client-ui-renderer/client'
import 'acryl-app-shell/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { AppCanvasState } from './app-canvas.ts'
import { AppCanvas } from './AppCanvas.tsx'
import { installAppCanvasStyles } from './styles.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The centre canvas: `ctx.appCanvas.address()`, `.navigate(path)`, `.reload()`, `.pageWindow()`. */
    appCanvas: AppCanvasState
  }
}

export const name = 'acryl-app-canvas-client'
export const inject = ['slots']

/** Below the workspace canvas (-1), which is below the shell's default (100): the lowest priority renders. */
export const APP_CANVAS_PRIORITY = -2

/** The workspace's capabilities route (`ide/acryl-workspace/src/capabilities/contract.ts`): where the Host says what it serves. */
export const CAPABILITIES_PATH = '/api/acryl-workspace/capabilities'

/** The app's own page, absolute, or undefined when the Host serves none (ACRYL Web, Desktop, a failed request). */
export async function appPage(fetchImpl: typeof fetch = (input, init) => fetch(input, init)): Promise<string | undefined> {
  try {
    const response = await fetchImpl(CAPABILITIES_PATH, { credentials: 'same-origin' })
    if (response.status !== 200) return undefined
    const body = (await response.json()) as { appPage?: unknown }
    if (typeof body.appPage !== 'string' || !body.appPage.startsWith('/')) return undefined
    return new URL(body.appPage, window.location.origin).href
  } catch {
    return undefined
  }
}

export function apply(ctx: ClientContext): void {
  const canvas = new AppCanvasState()
  ctx.effect(() => {
    const dispose = ctx.reflect.provide('appCanvas', canvas)
    return () => {
      void dispose()
    }
  }, 'acryl-app-canvas: the canvas service')
  ctx.effect(() => installAppCanvasStyles(), 'acryl-app-canvas: styles')
  ctx.effect(() => {
    let cancelled = false
    let unregister: (() => void) | undefined
    void appPage().then((address) => {
      if (cancelled || address === undefined) return
      canvas.setAddress(address)
      try {
        unregister = ctx.slots.register(
          { name: 'desktop.main', priority: APP_CANVAS_PRIORITY, inject: () => ({ canvas }) },
          AppCanvas,
        )
      } catch (cause) {
        ctx.logger.warn(
          `acryl-app-canvas: could not register the centre: ${cause instanceof Error ? cause.message : String(cause)}`,
        )
      }
    })
    return () => {
      cancelled = true
      unregister?.()
    }
  }, 'acryl-app-canvas: the centre')
}
