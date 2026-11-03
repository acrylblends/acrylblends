/**
 * The top bar's gear. DSH's Settings (`dsh-client-ui-settings-general`) is a modal that renders inside its own `sidebar.settings` slot, opened by
 * whatever fills that slot's `settings.launcher`; the frame renders the slot in its top bar and fills the launcher with this gear, so the gear opens
 * DSH's real Settings and nothing else. The Desktop's Settings... menu item reaches the same launcher through a window event.
 */

import type { PropsRuntime } from '@acryl/ui/frame'
import { useEffect } from 'react'

/** The window event the Desktop's Settings... menu item sends (`plugins/desktop/frame.ts`, `openFrameSettings`); keep the string in step. */
export const OPEN_SETTINGS_EVENT = 'acryl:open-settings'

const GearIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <circle cx="8" cy="8" r="2.2" />
    <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
  </svg>
)

export function SettingsLauncher({ settingsOpen, openSettings, settingsShortcut }: PropsRuntime<'settings.launcher'>) {
  useEffect(() => {
    window.addEventListener(OPEN_SETTINGS_EVENT, openSettings)
    return () => { window.removeEventListener(OPEN_SETTINGS_EVENT, openSettings) }
  }, [openSettings])
  return (
    <button
      type="button"
      className="acrylBlendsIconButton"
      aria-label="Settings"
      title="Settings"
      aria-haspopup="dialog"
      aria-expanded={settingsOpen}
      aria-keyshortcuts={settingsShortcut?.aria}
      onClick={openSettings}
    >
      <GearIcon />
    </button>
  )
}
