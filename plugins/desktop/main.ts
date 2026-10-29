/**
 * The desktop shell: `npm run desktop` starts the app's own server in this Electron main process and opens one window on its address. Nothing in the app
 * imports electron; every Electron call of the app is in this file and `window.ts`, so a different shell is a change here only.
 *
 * Order matters: the user-data folder is set before anything else (and before the single-instance lock), so one app never shares window state, logs or the lock with
 * another app or with the real user's data.
 */

import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, shell } from 'electron'
import type { App } from '../../src/app.ts'
import '../acryl-node-server/src/register.ts'
import { selectInstance } from '../instance/index.ts'
import { runningApp } from './attach.ts'
import { createDesktopShutdown, installShutdownRequests } from './shutdown.ts'
import { resolveDesktopUserDataOverride } from './user-data.ts'
import { windowOptions } from './window.ts'

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
  let window: BrowserWindow | undefined

  const shutdown = createDesktopShutdown(
    async () => {
      await running?.stop()
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
    const attached = await runningApp(projectRoot)
    let url: string
    if (attached !== undefined) {
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
    window = new BrowserWindow(windowOptions({ title: chosen.name }))
    window.once('ready-to-show', () => window?.show())
    // Navigation stays on the app's own server; any other address opens in the system browser.
    window.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url)
      return { action: 'deny' }
    })
    window.webContents.on('will-navigate', (event, url) => {
      if (new URL(url).origin === origin) return
      event.preventDefault()
      void shell.openExternal(url)
    })
    await window.loadURL(new URL(startPath(), url).href)
  })
}
