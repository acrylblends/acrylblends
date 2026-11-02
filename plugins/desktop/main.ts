/**
 * The desktop shell: `npm run desktop` opens the app in a window. A frame app (`scripts/ide-host.mjs`) gets the whole ACRYL frame: the window attaches to the
 * frame host that runs for this folder, or starts it as `npm run dev` does (`frame.ts`, docs/plans/ide-host-inversion.md section 27). An app made before the frame
 * starts its own server in this Electron main process and opens one window on its address. Nothing in the app imports electron; every Electron call of the app
 * is in this file and `window.ts`, so a different shell is a change here only.
 *
 * Order matters: the user-data folder is set before anything else (and before the single-instance lock), so one app never shares window state, logs or the lock with
 * another app or with the real user's data.
 */

import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, Menu, MenuItem, screen, shell } from 'electron'
import type { App } from '../../src/app.ts'
import '../acryl-node-server/src/register.ts'
import { selectInstance } from '../instance/index.ts'
import { runningApp } from './attach.ts'
import {
  type DesktopPort,
  type MenuItemPort,
  startDoorShell,
  type WindowPort,
} from './door-shell.ts'
import {
  type FrameHost,
  frameHome,
  isFrameApp,
  navigation,
  openFrameSettings,
  runningFrame,
  startFrameHost,
  withoutToken,
} from './frame.ts'
import { hasSettings, settingsPlacement } from './menu.ts'
import { createDesktopShutdown, installShutdownRequests } from './shutdown.ts'
import { resolveDesktopUserDataOverride } from './user-data.ts'
import { cascade, windowOptions } from './window.ts'

const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
const chosen = selectInstance({ projectRoot, env: process.env })

/** Where the window opens: `acrylblends.desktopPath` in package.json (the todo template sets `/todo`), else the root. */
function startPath(): string {
  const manifest = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')) as {
    acrylblends?: { desktopPath?: string }
  }
  return manifest.acrylblends?.desktopPath ?? '/'
}

/** Electron's user-data folder: an explicit DSH_DESKTOP_USER_DATA, else a folder inside the app's own home. */
const userData = resolveDesktopUserDataOverride(process.env) ?? join(chosen.home, 'electron')
mkdirSync(userData, { recursive: true, mode: 0o700 })
app.setPath('userData', userData)
app.setName(chosen.name)

if (!app.requestSingleInstanceLock()) {
  // The same app is already open: its window takes focus (see `second-instance` below) and this process ends.
  app.quit()
} else {
  let running: App | undefined
  let host: FrameHost | undefined
  let window: BrowserWindow | undefined
  let stopDoorShell: (() => void) | undefined

  const shutdown = createDesktopShutdown(
    async () => {
      stopDoorShell?.()
      await running?.stop()
      // The frame host this window started (never one it attached to) goes with the window, with every terminal it runs.
      await host?.stop()
    },
    (code) => {
      app.exit(code)
    },
  )
  installShutdownRequests(process, app, (code) => {
    void shutdown.request(code)
  })

  app.on('second-instance', () => {
    if (window === undefined) return
    if (window.isMinimized()) window.restore()
    window.focus()
  })
  // The window is the app: closing it ends the process on every platform, after the server has stopped.
  app.on('window-all-closed', () => {
    void shutdown.request(0)
  })

  void app.whenReady().then(async () => {
    // The hook above is registered before the app's modules are loaded, so the app may have .tsx pages: they are loaded here, not as a static import.
    // A dev server is already running from this folder (`npm run dev`): the door allows one process per folder, so the window opens on that server instead of starting a second one,
    // and closing the window leaves it running.
    const frame = isFrameApp(projectRoot)
    const attached = frame ? undefined : await runningApp(projectRoot)
    let url: string
    if (frame) {
      // The frame that already runs for this folder (`npm run dev`, or another window's host), else a host of this window's own.
      const runningAddress = await runningFrame(frameHome(projectRoot, process.env))
      if (runningAddress !== undefined) {
        console.log(
          `desktop: attached to the frame already running from this folder at ${new URL(runningAddress).origin} (it keeps running when the window closes)`,
        )
        url = runningAddress
      } else {
        host = startFrameHost(projectRoot, process.env, (text) => {
          process.stdout.write(text)
        })
        try {
          url = await host.ready
        } catch (cause) {
          console.error(`desktop: ${cause instanceof Error ? cause.message : String(cause)}`)
          await shutdown.request(1)
          return
        }
        console.log(
          `desktop: the frame host serves ${new URL(url).origin}; closing the window stops it`,
        )
      }
    } else if (attached !== undefined) {
      console.log(
        `desktop: attached to the app already running from this folder at ${attached.url} (its server keeps running when the window closes)`,
      )
      url = attached.url
    } else {
      const { createApp } = await import('../../src/app.ts')
      running = await createApp(chosen)
      url = running.url
    }
    const origin = new URL(url).origin
    /** Where a window opens: the frame's address (with its token) for a frame app, else a path of the app (`acrylblends.desktopPath`, else the root). */
    const addressOf = (path: string | undefined): string =>
      frame && path === undefined ? url : new URL(path ?? startPath(), url).href
    /** One window on an address of the app. Navigation follows `navigation` in frame.ts. The user agent names the window to the door (`AcrylWindow/<id>`), so an agent can drive it with `--window <id>`. */
    // Where each window was opened: `window list` shows it until the page reports its own address (Electron gives none while the first load has not started).
    const openedOn = new Map<number, string>()
    const createWindow = (path: string | undefined): BrowserWindow => {
      // A window opened while another is open sits a step down and to the right of it, not exactly on top.
      const beside =
        BrowserWindow.getFocusedWindow() ??
        BrowserWindow.getAllWindows().find((other) => !other.isDestroyed())
      const where = (() => {
        if (beside === undefined) return {}
        const bounds = beside.getBounds()
        // The places of the windows that are open: a new window never goes exactly where one already is.
        const taken = BrowserWindow.getAllWindows()
          .filter((other) => !other.isDestroyed())
          .map((other) => other.getPosition())
          .map(([x = 0, y = 0]) => ({ x, y }))
        return cascade(
          bounds,
          screen.getDisplayMatching(bounds).workArea,
          { width: 1100, height: 760 },
          taken,
        )
      })()
      const created = new BrowserWindow(windowOptions({ title: chosen.name, ...where }))
      const address = addressOf(path)
      openedOn.set(created.id, new URL(address).pathname)
      created.webContents.setUserAgent(
        `${created.webContents.getUserAgent()} AcrylWindow/${String(created.id)}`,
      )
      created.once('ready-to-show', () => created.show())
      // A new window of the page never opens inside the app: an http(s) or mailto address goes to the system browser, anything else nowhere.
      created.webContents.setWindowOpenHandler(({ url: target }) => {
        if (navigation(target, '') === 'external') void shell.openExternal(target)
        return { action: 'deny' }
      })
      // Only the main frame is checked, so the frame's tiles (the app's page in an iframe) navigate freely; the window itself stays on the app's origin.
      created.webContents.on('will-frame-navigate', (event) => {
        const decision = navigation(event.url, origin, event.isMainFrame)
        if (decision === 'stay') return
        event.preventDefault()
        if (decision === 'external') void shell.openExternal(event.url)
      })
      created.webContents.on('will-redirect', (event, target, _inPlace, isMainFrame) => {
        if (navigation(target, origin, isMainFrame) !== 'stay') event.preventDefault()
      })
      created.loadURL(address).catch((cause: unknown) => {
        console.warn(
          `desktop: the window could not load ${new URL(address).pathname}: ${cause instanceof Error ? cause.message : String(cause)}`,
        )
      })
      return created
    }
    window = createWindow(frame ? undefined : startPath())
    // The door (development) reaches the windows and the menu through this port: `acryl window list`, `acryl menu click`.
    const live = (): BrowserWindow[] =>
      BrowserWindow.getAllWindows().filter((candidate) => !candidate.isDestroyed())
    const port = (candidate: BrowserWindow): WindowPort => ({
      id: candidate.id,
      getTitle: () => candidate.getTitle(),
      // Without the frame's launch token: the door prints this address and its audit keeps it.
      getURL: () =>
        withoutToken(
          candidate.webContents.getURL() || new URL(openedOn.get(candidate.id) ?? '/', url).href,
        ),
      isFocused: () => candidate.isFocused(),
      isMinimized: () => candidate.isMinimized(),
      getSize: () => candidate.getSize(),
      getPosition: () => candidate.getPosition(),
      restore: () => candidate.restore(),
      focus: () => candidate.focus(),
      close: () => candidate.close(),
      setSize: (width, height) => candidate.setSize(width, height),
    })
    // Pressing an item as Electron's own menu does: with the window that has focus (the roles reload, zoom and close act on it).
    const menuItem = (item: MenuItem): MenuItemPort => ({
      label: item.label,
      enabled: item.enabled,
      visible: item.visible,
      type: item.type,
      role: item.role,
      // Electron gives a plain item `submenu: null` on Linux and `undefined` elsewhere.
      submenu: item.submenu ? { items: item.submenu.items.map(menuItem) } : null,
      click: () => {
        const target = BrowserWindow.getFocusedWindow() ?? live()[0]
        item.click(undefined, target, target?.webContents)
      },
    })
    const desktop: DesktopPort = {
      windows: () => live().map(port),
      open: (path) => port(createWindow(path ?? (frame ? undefined : startPath()))),
      menu: () => (Menu.getApplicationMenu()?.items ?? []).map(menuItem),
    }
    // An app that serves a /settings page gets a Settings item in the menu (Electron's own menu otherwise): it opens that page, in the window that already shows it when there is one.
    // A frame window's item opens the frame's own Settings (the dialog the left panel's button opens), in the window that has focus.
    const settingsServed = frame
      ? true
      : await fetch(new URL('/settings', url), {
          headers: { accept: 'text/html' },
          signal: AbortSignal.timeout(2000),
        }).then(
          (answer) => answer.ok,
          () => false,
        )
    const menu = Menu.getApplicationMenu()
    const placement =
      menu === null || !settingsServed || hasSettings(menu.items)
        ? undefined
        : settingsPlacement(menu.items, process.platform)
    if (menu !== null && placement !== undefined) {
      const target = menu.items[placement.menu]?.submenu
      const openSettings = (): void => {
        if (frame) {
          const target = BrowserWindow.getFocusedWindow() ?? live()[0]
          if (target === undefined) return
          if (target.isMinimized()) target.restore()
          target.focus()
          target.webContents.executeJavaScript(openFrameSettings).catch((cause: unknown) => {
            console.warn(
              `desktop: Settings could not be opened in the frame: ${cause instanceof Error ? cause.message : String(cause)}`,
            )
          })
          return
        }
        const shown = live().find(
          (candidate) =>
            new URL(candidate.webContents.getURL() || 'about:blank', url).pathname === '/settings',
        )
        if (shown === undefined) createWindow('/settings')
        else {
          if (shown.isMinimized()) shown.restore()
          shown.focus()
        }
      }
      target?.insert(
        placement.at,
        new MenuItem({ label: 'Settings...', accelerator: 'CmdOrCtrl+,', click: openSettings }),
      )
      if (placement.separatorAfter)
        target?.insert(placement.at + 1, new MenuItem({ type: 'separator' }))
      Menu.setApplicationMenu(menu)
    }
    stopDoorShell = startDoorShell(projectRoot, { desktop, log: console.log })
  })
}
