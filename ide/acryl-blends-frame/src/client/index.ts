/**
 * Cordis Client plugin: the Blends frame owns the page's `root` slot and draws the workbench around the app (docs/design/blends-frame-mockup.html).
 * It composes no IDE workbench: the ACRYL IDE keeps its own root owner (`acryl-workspace` through `acryl-app-shell`), and a Blueprint mounts one
 * of the two, never both, since `root` is a single slot.
 */

// Pulls `ctx.slots` and the `root` SlotMap key augmentation into this module.
import '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@acryl/ui/frame'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// The conversation slot maps (the composer overlay the chip sits in) and the scoped input events the send hook writes through.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionInput } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { DesktopLayoutState, DesktopThemePresenter, provideDesktopLayout, stripLaunchToken } from 'acryl-app-shell/client'
import { createVersionsApi } from 'acryl-versions/client'
import { ChatSavesStore, createChatSavesApi } from './chat-saves.ts'
import { TurnSaveFooter } from './TurnSaveFooter.tsx'
import { BlendsFrame } from './BlendsFrame.tsx'
import { AppCanvasState } from './canvas/app-canvas.ts'
import { createBlankChatApi } from './blank-chat.ts'
import { ChatsStore, createRealChatsApi, type MainViewNavigation, type WorkspaceRegistration } from './chats.ts'
import { FrameStateStore } from './frame-state.ts'
import { FILES_SEARCH_EVENT } from './FilesView.tsx'
import { AgentsState, agentsSettingsPlugin, createWorkspaceAgentsApi, settingsSharedPlugin } from 'acryl-workspace/ui'
import { ShortcutsRow } from './ShortcutsRow.tsx'
import { createSidebarRightStandIn } from './sidebar-right-stand-in.ts'
import { createBranchesApi } from './branches.ts'
import { BranchChatsStore, createBranchChatsApi } from './branch-chats.ts'
import { createFeedbackApi, feedbackTask } from './feedback.ts'
import { installFrameView } from './frame-view.ts'
import { draftInChat } from './chat-draft.ts'
import type { FeedbackPort } from './LeftPanel.tsx'
import { appPluginRow, createAppPluginsApi, framePluginRow, type NavigatorPlugin } from './plugins-navigator.ts'
import { PluginsSection } from './PluginsSection.tsx'
import { SelectionChip, type SelectionChipInjected } from './SelectionChip.tsx'
import { SelectionStore, contextToInsert } from './selection.ts'
import { SettingsLauncher } from './SettingsLauncher.tsx'
import { installFrameStyles } from './styles.ts'
import { FILES_TAB, FrameTabs, tabOfTerminal } from './tabs.ts'
import { createFrameTools, installXtermStyles } from './tools.ts'
import { createSharedVersionsApi } from './versions.ts'
import { createGitSyncApi, type GitSyncPort } from './git-sync.ts'
import { FrameViewState, type ViewStorage } from './view-state.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The centre canvas: `ctx.appCanvas.address()`, `.navigate(path)`, `.reload()`, `.pageWindow()`. */
    appCanvas: AppCanvasState
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'acryl.blendsFrame': 'plugins'
  }
}

const LOCALE_NAMESPACE = 'acryl.blendsFrame'
/** The Loader row that composes the app's own plugins (`frame/app-plugins.mjs`): loading it again applies a switch in `blend.yaml`. */

export const name = 'acryl-blends-frame-client'

/** How often a visible frame reads its state again (branches, the newest version, unsaved files). */
const FRAME_STATE_INTERVAL_MS = 5000
// `theme` is read by the theme presenter; Cordis rejects reading a service a plugin did not declare.
export const inject = ['slots', 'theme']

/** The frame's own first run: a step that stays pending and renders nothing, so DSH's blocking steps never mount inside the frame. */
function NoOnboarding(): null {
  return null
}

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
  const selection = new SelectionStore()
  const frameState = new FrameStateStore()
  const view = new FrameViewState(pageStorage())
  // `uiWorkspace` (DSH's navigation) and `workspaces` (its workspace registry) are DSH services this package does not import the types of; the
  // small interfaces in `./chats.ts` describe the calls it makes, so a frame without them composed still works.
  const chats = new ChatsStore(
    () => (ctx.get as (name: string) => MainViewNavigation | undefined)('uiWorkspace'),
    () => (ctx.get as (name: string) => WorkspaceRegistration | undefined)('workspaces'),
    createRealChatsApi(),
    createBlankChatApi(),
  )
  const versionsApi = createVersionsApi()
  const sharedVersionsApi = createSharedVersionsApi()
  const branchesApi = createBranchesApi()
  const gitSyncApi = createGitSyncApi()
  // A push moves the upstream (the left panel's shared marks), a pull the head and the app's files: the frame reads its state again, and the app page reloads when a pull brought versions in.
  const gitSync: GitSyncPort = {
    remote: fetchFirst => gitSyncApi.remote(fetchFirst),
    push: async () => {
      const result = await gitSyncApi.push()
      await frameState.refresh()
      return result
    },
    pull: async () => {
      const headOf = (): string | undefined => { const view = frameState.getSnapshot(); return view.status === 'ready' ? view.state.head : undefined }
      const before = headOf()
      const result = await gitSyncApi.pull()
      await frameState.refresh()
      if (headOf() !== before) canvas.reload()
      return result
    },
  }
  const branchChats = new BranchChatsStore(createBranchChatsApi())
  const tabs = new FrameTabs(pageStorage())
  const tools = createFrameTools()
  // The line under an answer that changed the app: what the Host's auto-save made of the turn. A new save changes the versions and the unsaved count, so the frame reads its state again.
  const chatSaves = new ChatSavesStore(createChatSavesApi(), () => { void frameState.refresh() })
  // Feedback from users: the notes, and handing one to the chat as a task the builder reads and sends.
  const feedback: FeedbackPort = {
    api: createFeedbackApi(),
    hand(note) {
      const current = chats.getSnapshot().find(row => row.current)
      tabs.activate('chat')
      view.showRight()
      return current !== undefined && draftInChat(ctx, current.id, feedbackTask(note))
    },
  }

  ctx.effect(() => provideDesktopLayout(ctx, layout), 'acryl-blends-frame: layout service')
  // DSH's views read the open keyed panel through the standard `usePanelInfo` hook, which the root supplies.
  ctx.effect(() => ctx.slots.provideRoot({ hooks: { panelInfo: layout.panelInfo } }), 'acryl-blends-frame: panel info')
  ctx.effect(() => {
    const dispose = ctx.reflect.provide('appCanvas', canvas)
    return () => { void dispose() }
  }, 'acryl-blends-frame: the canvas service')
  // The app's own client plugins read the frame's mode from the canvas page: Build keeps their build-time controls out of the canvas, Preview shows
  // what production shows, and a mode change reaches them without a reload.
  ctx.effect(() => installFrameView(canvas, view), 'acryl-blends-frame: the app page view')
  // DSH's chat view opens the links of an answer through `sidebarRight`; the frame has no DSH right sidebar, so it answers for it (a web link opens in a new tab).
  ctx.effect(() => {
    const dispose = ctx.reflect.provide('sidebarRight', createSidebarRightStandIn(url => { window.open(url, '_blank', 'noopener,noreferrer') }))
    return () => { void dispose() }
  }, 'acryl-blends-frame: the right sidebar stand-in')

  // The launch token was exchanged for the cookie before this client ran; left in the address bar a reconnect could spend it again.
  ctx.effect(() => {
    const stripped = stripLaunchToken(window.location.href)
    if (stripped !== undefined) window.history.replaceState(window.history.state, '', stripped)
    return () => {}
  }, 'acryl-blends-frame: strip the launch token')

  ctx.effect(() => installFrameStyles(), 'acryl-blends-frame: styles')
  ctx.effect(() => installXtermStyles(), 'acryl-blends-frame: terminal styles')
  // A terminal whose process ended, or that the Host no longer knows (it restarted), leaves the strip; its title names what it runs.
  ctx.effect(() => {
    const closeTabOf = (terminalId: string) => {
      const tab = tabOfTerminal(tabs.getSnapshot(), terminalId)
      if (tab !== undefined) tabs.close(tab.id)
      tools.terminals.release(terminalId)
    }
    const offLost = tools.terminals.onLost(closeTabOf)
    const offExit = tools.terminals.onExit(closeTabOf)
    const offTitle = tools.terminals.onTitle((terminalId, title) => { tabs.setTitle(terminalId, title) })
    return () => {
      offLost()
      offExit()
      offTitle()
      tools.terminals.disposeAll()
    }
  }, 'acryl-blends-frame: terminal sessions')
  // ⌘P (Ctrl P) anywhere in the frame: Files, with its search taking the keys.
  ctx.effect(() => {
    const quickOpen = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'p' || !(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return
      event.preventDefault()
      tabs.open(FILES_TAB)
      view.showRight()
      window.setTimeout(() => { window.dispatchEvent(new Event(FILES_SEARCH_EVENT)) }, 0)
    }
    window.addEventListener('keydown', quickOpen, true)
    return () => { window.removeEventListener('keydown', quickOpen, true) }
  }, 'acryl-blends-frame: quick open')
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

  // A chat belongs to the branch it was first seen on: DSH keeps no branches, so the frame records it in the app's home and the left panel can
  // list each branch's own chats. A chat already recorded keeps its branch when the folder moves.
  ctx.effect(() => {
    void branchChats.load()
    const adopt = () => {
      const view = frameState.getSnapshot()
      if (view.status !== 'ready') return
      const current = view.state.branches.find(branch => branch.current)?.name
      if (current === undefined) return
      branchChats.adopt(chats.getSnapshot().map(row => row.id), current)
    }
    const offState = frameState.subscribe(adopt)
    const offChats = chats.subscribe(adopt)
    adopt()
    return () => {
      offState()
      offChats()
    }
  }, 'acryl-blends-frame: chats belong to the branch they were opened on')

  // Settings → Agents: the workspace's own section, on the workspace Host's agent routes.
  const agents = new AgentsState(createWorkspaceAgentsApi())
  ctx.effect(() => { void agents.refresh(); return () => {} }, 'acryl-blends-frame: load the agents')
  ctx.plugin(settingsSharedPlugin())
  ctx.plugin(agentsSettingsPlugin(agents))

  // Settings → Plugins: the app's plugins, each with its switch, and the frame's own; the Host starts the app's plugins again after a switch.
  const appPlugins = createAppPluginsApi()
  const loadPlugins = async (): Promise<readonly NavigatorPlugin[]> => {
    const view = await appPlugins.read()
    return [
      ...view.plugins.map(plugin => appPluginRow(plugin, async (on) => {
        await appPlugins.switch(plugin.kind, plugin.name, on)
        canvas.reload()
      })),
      ...view.frame.map(framePluginRow),
    ]
  }
  ctx.plugin({
    name: 'acryl-blends-frame-plugins-settings',
    inject: ['slots', 'locale'],
    apply(child: ClientContext): void {
      child.effect(() => child.locale.register(LOCALE_NAMESPACE, { en: { plugins: 'Plugins' }, zh: { plugins: '插件' } }), 'acryl-blends-frame: dictionary')
      const t = child.locale.bind(LOCALE_NAMESPACE)
      child.slots.inject('settings.section', () => child.slots.register({
        name: 'settings.section',
        id: 'acryl-blends-plugins',
        // After Models and Agents, before Support (90).
        order: 45,
        label: () => t('plugins'),
        locale: LOCALE_NAMESPACE,
        inject: () => ({ loadPlugins }),
      }, PluginsSection))
    },
  })

  // Settings > General: a short list of the shortcuts.
  ctx.plugin({
    name: 'acryl-blends-frame-shortcuts-row',
    inject: ['slots', 'shortcuts'],
    apply(child: ClientContext): void {
      child.slots.inject('settings.general.item', () => child.slots.register({
        name: 'settings.general.item',
        id: 'acryl-blends-shortcuts',
        // After Developer tools (15), before the version (100).
        order: 50,
        inject: () => ({ shortcuts: child.shortcuts }),
      }, ShortcutsRow))
    },
  })

  // DSH's chat draws a slot before each completed turn's action row (`conversation.chat.turnTail`, declared by `@deepseek-ai/dsh-client-ui-chat`): the frame
  // puts its line there. It names the slot without that package's types, which the frame does not depend on.
  const turnTail = ctx.slots as unknown as {
    inject(name: string, register: () => unknown): void
    register(entry: object, component: unknown): unknown
  }
  turnTail.inject('conversation.chat.turnTail', () => turnTail.register({
    name: 'conversation.chat.turnTail',
    id: 'acryl-blends-saves',
    inject: (sessionId: string) => ({ sessionId, chatSaves }),
  }, TurnSaveFooter))

  ctx.inject(['sessions'], (child) => {
    child.effect(() => chats.watch(child.sessions), 'acryl-blends-frame: chats follow the sessions')
  })

  // The element picked in the canvas is what the chat is about (docs/design/blends-frame-mockup.html, scenario 2): its chip sits at the left of
  // the composer's input row, and a send writes its page and selector into the message the person is sending, without touching their words.
  ctx.plugin({
    name: 'acryl-blends-frame-element-selection',
    inject: ['slots', 'sessions'],
    apply(child: ClientContext): void {
      child.slots.inject('conversation.input.overlay', () => child.slots.register({
        name: 'conversation.input.overlay',
        id: 'element-selection',
        order: 10,
        inject: (sessionId): SelectionChipInjected => {
          const actx = child.sessions.scope(sessionId)
          const composer = (): SessionInput | undefined => {
            if (actx === undefined) return undefined
            return actx.get('conversation')?.input.for(actx)
          }
          return {
            selection: {
              get: () => selection.getSnapshot().selection,
              subscribe: listener => selection.subscribe(listener),
            },
            clear: () => { selection.clear() },
            focus: () => { composer()?.focus() },
            send: () => {
              const element = selection.getSnapshot().selection
              const input = composer()
              if (element === undefined || input === undefined || actx === undefined) return
              const state = input.state.getSnapshot()
              const text = contextToInsert(state.draft, element)
              if (text === undefined) return
              // Insert at the start of the draft, where the scoped insert-text event applies a plain-text edit and keeps the reference
              // chips the person added after it. The send that triggered this reads the draft next, in the same gesture.
              const applied = actx.bail(actx, 'slash/input-insert-text', {
                text,
                span: { start: 0, end: 0, draftRev: state.draftRev },
              }) === true
              if (applied) selection.clear()
            },
          }
        },
      }, SelectionChip))
    },
  })

  // The mockup's first run is the frame itself (docs/design/blends-frame-mockup.html, scenario 1): DSH's preview notice and credential prompt are
  // blocking modals over the app, so the frame keeps one pending step that renders nothing while the chat is blank. Setting up a model lives in
  // Settings > Models, where the frame's Settings has it; nothing blocks the app's first screen.
  ctx.slots.inject('settings.onboarding', () => ctx.slots.register({
    name: 'settings.onboarding',
    id: 'acryl-blends-first-run',
    order: -1000,
  }, NoOnboarding))

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
      selection,
      frameState,
      view,
      chats,
      versions: {
        log: (path: string) => versionsApi.log(path),
        save: (path: string, message: string) => versionsApi.save(path, message),
        shared: (hashes: readonly string[]) => sharedVersionsApi.shared(hashes),
      },
      gitSync,
      tabs,
      tools,
      feedback,
      branchChats,
      branches: {
        api: branchesApi,
        changed: () => frameState.refresh(),
        // The folder moves, the frame shows the new current branch, then the app page reloads on that branch's files.
        switchTo: async (name: string) => {
          await branchesApi.switchTo(name)
          await frameState.refresh()
          canvas.reload()
        },
      },
    }),
  }, BlendsFrame), 'acryl-blends-frame: root slot')
}
