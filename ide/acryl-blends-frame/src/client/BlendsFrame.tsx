/**
 * The Blends frame (docs/design/blends-frame-mockup.html): a top bar; on the left the branches with what is open on them, and the versions; the
 * app alone in the centre; on the right the agents as tabs. Nothing of the IDE's workbench is here - no projects, tab strip of tiles, dock or start
 * page. DSH renders only inside it: the chat is the keyed `main` entry `conversation` in the right panel, and a keyed panel DSH opens (Settings)
 * covers the frame as a dialog.
 */

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { PropsRenderSlots, PropsRuntime } from '@acryl/ui/frame'
// The `sidebar.settings` seat's type: DSH's Settings shell occupies it, the frame renders it.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { DesktopLayoutState } from 'acryl-app-shell/client'
import type { AppCanvasState } from './canvas/app-canvas.ts'
import { AppCanvas } from './canvas/AppCanvas.tsx'
import type { AppReloadStore } from './app-reload.ts'
import type { FrameStateStore } from './frame-state.ts'
import type { SelectedElement, SelectionStore } from './selection.ts'
import type { FrameViewState } from './view-state.ts'
import { LeftPanel, type BranchesPort, type ChatsPort, type FeedbackPort } from './LeftPanel.tsx'
import type { BranchChatsPort } from './branch-chats.ts'
import { savedLabel, type VersionsPort } from './versions.ts'
import type { GitSyncPort } from './git-sync.ts'
import { RightPanel } from './RightPanel.tsx'
import type { FrameTabs } from './tabs.ts'
import type { FrameTools } from './tools.ts'

export interface BlendsFrameInjected {
  readonly layout: DesktopLayoutState
  readonly canvas: AppCanvasState
  readonly selection: SelectionStore
  readonly frameState: FrameStateStore
  /** Whether the app's last code was refused (a syntax error): the bar says so while the canvas keeps the last good app. */
  readonly appReload: AppReloadStore
  readonly view: FrameViewState
  readonly chats: ChatsPort
  readonly versions: VersionsPort
  /** The Git tab's push and pull (the Host runs git). */
  readonly gitSync: GitSyncPort
  readonly tabs: FrameTabs
  readonly tools: FrameTools
  readonly feedback: FeedbackPort
  readonly branches: BranchesPort
  /** Which branch each chat was opened on (DSH keeps no branches; the Host records it). */
  readonly branchChats: BranchChatsPort
}

export type BlendsFrameProps = PropsRuntime<'root'> & PropsRenderSlots<'main' | 'shell.overlay' | 'sidebar.settings'> & BlendsFrameInjected

function useStore<T>(store: { getSnapshot(): T; subscribe(listener: () => void): () => void }): T {
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store])
  return useSyncExternalStore(subscribe, () => store.getSnapshot())
}

const PanelIcon = ({ side }: { side: 'left' | 'right' }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
    <path d={side === 'left' ? 'M6 2.5v11' : 'M10 2.5v11'} />
  </svg>
)

const SelectIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <circle cx="8" cy="8" r="4.5" />
    <path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" />
  </svg>
)

export function BlendsFrame({ layout, canvas, selection, frameState, appReload, view, chats, versions, gitSync, tabs, tools, feedback, branches, branchChats, renderSlot }: BlendsFrameProps) {
  const state = useStore(frameState)
  const appError = useStore(appReload).error
  const frameView = useStore(view)
  const activePanelId = useSyncExternalStore(layout.panelInfo.subscribe, () => layout.panelInfo.getSnapshot().activePanelId)
  const [versionLabel, setVersionLabel] = useState<string | undefined>(undefined)
  // The select control belongs to the canvas, not to the app: it turns clicks into picks until a click, Escape, or Preview ends it.
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    if (state.status === 'ready' && state.state.appPage !== undefined && canvas.address() === undefined) {
      canvas.setAddress(new URL(state.state.appPage, window.location.origin).href)
    }
  }, [state, canvas])

  // The checked-out branch: the right panel's strip shows its tabs, and a tab opened now belongs to it.
  useEffect(() => {
    if (state.status === 'ready') tabs.setBranch(state.state.branches.find(branch => branch.current)?.name)
  }, [state, tabs])

  const appName = state.status === 'ready' ? state.state.appName : ''
  const saved = state.status === 'ready' ? savedLabel(state.state.unsaved) : undefined
  const barLabel = [versionLabel, saved].filter((part): part is string => part !== undefined).join(' · ')
  const preview = frameView.mode === 'preview'
  const selected = useStore(selection).selection
  // Preview is what users see: the frame's own controls, the select control among them, leave the picture.
  useEffect(() => { if (preview) setPicking(false) }, [preview])
  // A picked element is what the chat is about: show the chat and give its composer the keyboard.
  const pick = (element: SelectedElement): void => {
    setPicking(false)
    selection.select(element)
    tabs.activate('chat')
    view.showRight()
  }
  const leftOpen = frameView.left && !preview
  const rightOpen = frameView.right && !preview
  // A keyed panel other than the conversation (one DSH or a plugin opens) is a page of its own: it covers the frame until closed.
  const dialogPanel = activePanelId !== null && activePanelId !== 'conversation' ? activePanelId : null

  return (
    <div
      className="acrylBlendsFrame"
      data-mode={frameView.mode}
      data-left={leftOpen ? 'open' : 'closed'}
      data-right={rightOpen ? 'open' : 'closed'}
    >
      <header className="acrylBlendsBar">
        <button
          type="button"
          className="acrylBlendsIconButton"
          aria-pressed={leftOpen}
          aria-label="Left panel: branches and versions"
          title="Left panel: branches and versions"
          disabled={preview}
          onClick={() => { view.toggleLeft() }}
        >
          <PanelIcon side="left" />
        </button>
        <span className="acrylBlendsAppName">
          {appName}
          {barLabel !== '' && <small>{barLabel}</small>}
        </span>
        {appError !== undefined && (
          <span className="acrylBlendsAppError" role="alert" title={`The app keeps running its last working code: the new code was refused. ${appError}`}>
            Not reloaded: {appError}
          </span>
        )}
        <span className="acrylBlendsGrow" />
        <div className="acrylBlendsModes" role="group" aria-label="Mode">
          <button type="button" aria-pressed={frameView.mode === 'build'} onClick={() => { view.setMode('build') }}>Build</button>
          <button type="button" aria-pressed={frameView.mode === 'preview'} onClick={() => { view.setMode('preview') }}>Preview</button>
        </div>
        {/* DSH's Settings: its slot draws the launcher (the gear, ./SettingsLauncher.tsx) and the modal it opens. */}
        <span className="acrylBlendsSettings">{renderSlot('sidebar.settings', { wide: false })}</span>
        <button
          type="button"
          className="acrylBlendsIconButton"
          aria-pressed={rightOpen}
          aria-label="Right panel: agents"
          title="Right panel: agents"
          disabled={preview}
          onClick={() => { view.toggleRight() }}
        >
          <PanelIcon side="right" />
        </button>
      </header>
      <div className="acrylBlendsBody">
        <aside className="acrylBlendsLeft" aria-label="Branches and versions" hidden={!leftOpen}>
          {state.status === 'ready' && (
            <LeftPanel
              state={state.state}
              chats={chats}
              versions={versions}
              tabs={tabs}
              feedback={feedback}
              branches={branches}
              branchChats={branchChats}
              showTab={(id) => {
                tabs.activate(id)
                view.showRight()
              }}
              onVersionLabel={setVersionLabel}
            />
          )}
          {state.status === 'error' && <p className="acrylBlendsNote" data-error>{state.message}</p>}
        </aside>
        <main className="acrylBlendsCanvas" aria-label="The app">
          {preview && (
            <div className="acrylBlendsBackbar">
              You are seeing what users see
              <button type="button" className="acrylBlendsSmallButton" onClick={() => { view.setMode('build') }}>Back to Build</button>
            </div>
          )}
          {!preview && (
            <div className="acrylBlendsCanvasTools">
              <button
                type="button"
                className="acrylBlendsSelectButton"
                aria-pressed={picking}
                aria-label="Select an element for the chat"
                title="Select an element for the chat"
                onClick={() => { setPicking(value => !value) }}
              >
                <SelectIcon /> Select
              </button>
              {picking && <span className="acrylBlendsPickingHint" role="status">Click an element in the app. Esc cancels.</span>}
            </div>
          )}
          <div className="acrylBlendsCanvasPage">
            <AppCanvas
              canvas={canvas}
              picking={picking && !preview}
              onPick={pick}
              onCancel={() => { setPicking(false) }}
              selected={preview ? undefined : selected}
            />
          </div>
        </main>
        <aside className="acrylBlendsRight" aria-label="Agents" hidden={!rightOpen}>
          <RightPanel
            chats={chats}
            tabs={tabs}
            tools={tools}
            versions={versions}
            gitSync={gitSync}
            state={state.status === 'ready' ? state.state : undefined}
            branchChats={branchChats}
            renderConversation={(): ReactNode => renderSlot('main', {}, { entryKey: 'conversation' })}
          />
        </aside>
      </div>
      {dialogPanel !== null && (
        <div className="acrylBlendsDialogBackdrop" onClick={(event) => { if (event.target === event.currentTarget) layout.selectPanel(null) }}>
          <div className="acrylBlendsDialog" role="dialog" aria-label={String(dialogPanel)}>
            <button type="button" className="acrylBlendsDialogClose" aria-label="Close" onClick={() => { layout.selectPanel(null) }}>×</button>
            {renderSlot('main', {}, { entryKey: dialogPanel })}
          </div>
        </div>
      )}
      <div className="acrylBlendsOverlay" data-shell-overlay>
        {renderSlot('shell.overlay', {})}
      </div>
    </div>
  )
}
