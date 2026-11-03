/**
 * Cordis Client plugin: the Blends frame owns the page's `root` slot and draws the workbench around the app (docs/design/blends-frame-mockup.html).
 * It composes no IDE workbench: the ACRYL IDE keeps its own root owner (`acryl-workspace` through `acryl-app-shell`), and a Blueprint mounts one
 * of the two, never both, since `root` is a single slot.
 */

// Pulls `ctx.slots` and the `root` SlotMap key augmentation into this module.
import '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@acryl/ui/frame'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { DesktopLayoutState, DesktopThemePresenter, provideDesktopLayout, stripLaunchToken } from 'acryl-app-shell/client'
import { createVersionsApi } from 'acryl-versions/client'
import { BlendsFrame } from './BlendsFrame.tsx'
import { AppCanvasState } from './canvas/app-canvas.ts'
import { ChatsStore, type MainViewNavigation } from './chats.ts'
import { FrameStateStore } from './frame-state.ts'
import { SettingsLauncher } from './SettingsLauncher.tsx'
import { installFrameStyles } from './styles.ts'
import { FrameViewState, type ViewStorage } from './view-state.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The centre canvas: `ctx.appCanvas.address()`, `.navigate(path)`, `.reload()`, `.pageWindow()`. */
    appCanvas: AppCanvasState
  }
}

export const name = 'acryl-blends-frame-client'

/** How often a visible frame reads its state again (branches, the newest version, unsaved files). */
const FRAME_STATE_INTERVAL_MS = 5000
// `theme` is read by the theme presenter; Cordis rejects reading a service a plugin did not declare.
export const inject = ['slots', 'theme']

function pageStorage(): ViewStorage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function apply(ctx: ClientContext): void {
  const layout = new DesktopLayoutState()
  const canvas = new AppCanvasState()
  const frameState = new FrameStateStore()
  const view = new FrameViewState(pageStorage())
  const chats = new ChatsStore(() => (ctx.get as (name: string) => MainViewNavigation | undefined)('uiWorkspace'))
  const versionsApi = createVersionsApi()

  ctx.effect(() => provideDesktopLayout(ctx, layout), 'acryl-blends-frame: layout service')
  // DSH's views read the open keyed panel through the standard `usePanelInfo` hook, which the root supplies.
  ctx.effect(() => ctx.slots.provideRoot({ hooks: { panelInfo: layout.panelInfo } }), 'acryl-blends-frame: panel info')
  ctx.effect(() => {
    const dispose = ctx.reflect.provide('appCanvas', canvas)
    return () => { void dispose() }
  }, 'acryl-blends-frame: the canvas service')

  // The launch token was exchanged for the cookie before this client ran; left in the address bar a reconnect could spend it again.
  ctx.effect(() => {
    const stripped = stripLaunchToken(window.location.href)
    if (stripped !== undefined) window.history.replaceState(window.history.state, '', stripped)
    return () => {}
  }, 'acryl-blends-frame: strip the launch token')

  ctx.effect(() => installFrameStyles(), 'acryl-blends-frame: styles')
  ctx.slots.inject('settings.launcher', () => ctx.slots.register({ name: 'settings.launcher' }, SettingsLauncher))
  ctx.effect(() => {
    const presenter = new DesktopThemePresenter()
    presenter.apply(ctx.theme.getTheme())
    const off = ctx.on('theme/change', snapshot => { presenter.apply(snapshot) })
    return () => {
      off()
      presenter.dispose()
    }
  }, 'acryl-blends-frame: theme presenter')

  ctx.effect(() => {
    const read = () => { if (document.visibilityState === 'visible') void frameState.refresh() }
    void frameState.refresh()
    const timer = window.setInterval(read, FRAME_STATE_INTERVAL_MS)
    document.addEventListener('visibilitychange', read)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', read)
    }
  }, 'acryl-blends-frame: read the frame state')

  ctx.inject(['sessions'], (child) => {
    child.effect(() => chats.watch(child.sessions), 'acryl-blends-frame: chats follow the sessions')
  })

  ctx.effect(() => ctx.slots.register({
    name: 'root',
    children: {
      'main': { kind: 'keyed', scope: 'root' },
      'sidebar': { kind: 'single', scope: 'root' },
      'rightbar': { kind: 'single', scope: 'root' },
      'shell.overlay': { kind: 'list', scope: 'root' },
      'shell.leading': { kind: 'single', scope: 'root' },
      // DSH's Settings modal and its launcher (`dsh-client-ui-settings-general`), drawn in the top bar.
      'sidebar.settings': { kind: 'single', scope: 'root' },
    },
    inject: () => ({
      layout,
      canvas,
      frameState,
      view,
      chats,
      versions: { log: (path: string) => versionsApi.log(path), save: (path: string, message: string) => versionsApi.save(path, message) },
    }),
  }, BlendsFrame), 'acryl-blends-frame: root slot')
}
