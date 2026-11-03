# 125 port inventory

Working reading for the 125 frame redesign. It answers, for every part of the approved mockup, where the
source is today, what it does, which tests hold it, and what has to change. It is not a plan or a design: the
Cordis mini-design is Fork3's, and this document is the source map that design is built from, so the port moves
existing code and tests instead of rewriting them.

Sources read:

- The mockup: `acryl/specs/049-framework-architecture/design/blends-frame-mockup.html`, commits `f8263a89` and
  `5b544f3a` (the Decided table at lines 557-576 and the four slices at lines 578-581).
- `acrylblends` at `main` = `81bb14dc` (the branch this inventory is written on, `125-port-inventory`).
- `acryl` at `main` = `5b544f3a`, for the origin of the IDE and the control plane.

No product code was changed. No server was started.

## Which checkout 125 edits, and which one is the origin

125 is an `acrylblends` branch. The frame is booted from the `ide/*` packages by
`packages/cli/src/ide-profile.ts` (`FRAME_PACKAGES`, lines 47-64): `acryl-web`, `acryl-settings`,
`acryl-shortcuts`, `acryl-app-shell`, `acryl-workspace`, `acryl-plugin-admin`, `acryl-support`,
`acryl-sign-in`, plus the router rows and the brand row. `DRIVER_ROWS` (lines 111-152) and `CLIENT_ROWS`
(lines 159-188) mount the DSH chat, sessions and the Settings surface around them.

`ide/*` and `acryl/plugins/*` share one ancestry: the IDE client is mirrored between
`acryl_blends_project/acrylblends/ide/<package>` and `acryl/plugins/<package>`. They have diverged:

- `ide/acryl-workspace` carries the 120-123 frame fixes (the browser tile retry, the composer focus helper,
  the frame session banner, the first-run model card) and the framework port of the terminal stream
  (`src/pty/stream.ts` is on `acrylblends` router upgrades, while the ACRYL copy is still on `webServer` + `ws`).
- `acryl/plugins/acryl-workspace` carries later spec 048 work, notably the async PATH lookup in
  `src/pty/service.ts` (T005, `22018414`), and is the package the ACRYL desktop and web surfaces compose.

`diff -rq` between the two `src` trees today: 13 files differ and 3 exist only in `ide/`:

- `capabilities/contract.ts`, `client/browser/BrowserPane.tsx`, `client/canvas/state.ts`,
  `client/canvas/WorkspaceCanvas.tsx`, `client/index.ts`, `client/projects/sidebar-model.ts`,
  `client/settings/locales.ts`, `client/settings/open-settings.ts`, `client/styles.ts`,
  `client/worktrees/shell-state.ts`, `index.ts`, `private-route.ts`, `pty/stream.ts`.
- Only in `ide/`: `client/chat/composer-focus.ts`, `client/connection/`, `client/models/`.

Rule for 125: start from `ide/` (it is the frame's source and runs on the framework), and when a listed file
is touched, read the ACRYL twin first so its spec 048 changes are not lost. The ACRYL repo remains the origin
of the control plane (door, agent control, mount anchors, plugin admin, shortcuts) and of the DSH-based app
surfaces (`apps/acryl-web`, `apps/acryl-desktop`).

## The frame as it exists today

Three services and two panel systems are the ground everything below stands on.

- The advanced shell claims the columns: `ide/acryl-app-shell/src/client/advanced-shell.ts:53`
  (`applyAdvancedShell`), registering the `root` slot with `desktop.main`, `desktop.sidebar`, `main`,
  `rightbar`, `shell.overlay`, `shell.leading` (lines 97-109), the layout service (59-62), and the theme
  presenter (87-95).
- The centre is `desktop.main`, currently the workspace canvas: `AdvancedFrame.tsx:106-113` renders
  `renderSlot('main', { entryKey: 'conversation' })` as `renderConversation`, so the chat is a keyed main slot
  tied to the current DSH session.
- The right column is the `rightbar` slot (`AdvancedFrame.tsx:124-133`), whose content is DSH's
  `sidebarRight` panel. The ACRYL handle that opens it calls `ctx.get('sidebarRight')?.toggleExpanded()`
  (`ide/acryl-workspace/src/client/index.ts:204-223`), and it only works while a chat session is current.
- The right panel's tabs are DSH's `sidebarRightTabs` registry: a tab type is registered first, then its
  body in the `sidebar.right.pane.tab` slot (see `ide/acryl-workspace/src/client/files/files-tab.ts:29-50`
  and `changes/changes-tab.ts:26-61`). The upstream service is session-scoped:
  `deepseek-harness/packages/client/ui-sidebar-right/src/client/tab-domain.ts:33-37` (`openTabIn(sessionId,
  kind, options)`) and `service.ts:25` (the navigation controller).
- The left column is `desktop.sidebar`, currently `ProjectsSidebar` (`client/projects/ProjectsSidebar.tsx:52`).
  It mounts the upstream sidebar invisibly only to host the Settings trigger and dialog (lines 273-278).
- The workspace host half is one owning effect: `ide/acryl-workspace/src/index.ts:87-183` builds the PTY
  registry, agents, git, files, projects and shared context inside one `ctx.effect`, and the disposer releases
  them in reverse order (`:179-182`). The routes are mounted at `:187-188` on `router`/`routerHttp`, with the
  PTY stream as the one upgrade path.

Two panel systems coexist today and the mockup merges them: the centre canvas tab strip (our `WorkspaceState`
tiles) and the right `sidebarRight` tabs (Files/Changes/Review/Checks/Comments). The chat lives in the centre,
not in the right panel. This is the largest structural gap in the port and it is called out again under
"Questions the mini-design must settle".

## 1. The tab strip with `+`, the tab model, the Browser tab, persistence

Slice 1.

### Where it lives

| Piece | `acrylblends` `ide/acryl-workspace` | `acryl` twin |
| --- | --- | --- |
| The strip | `src/client/tabs/TabStrip.tsx:120` (component), `:178` (the `role="tablist"`), `:263` (`NewTabMenu`), `:282` (`DockButtons`) | `plugins/acryl-workspace/src/client/tabs/TabStrip.tsx` (same file, diverged only through `WorkspaceCanvas`) |
| The `+` menu | `src/client/tabs/NewTabMenu.tsx:49`, `:111` (the `+` and chevron), `:124` (surface actions), `:136` (AcrylDSH Chat), `:160` (agents), `:167-173` (manage/add) | `plugins/acryl-workspace/src/client/tabs/NewTabMenu.tsx` |
| The tab model | `src/client/canvas/state.ts:7` (kinds), `:18` (`WorkspaceTile`), `:107` (`WorkspaceState`), `:188` (`addTile`), `:235` (`restore`), `:301` (`closeTile`) | `.../canvas/state.ts:105` (the class; 4 lines different) |
| Per-worktree tab sets | `src/client/canvas/groups.ts:32` (`WorkspaceGroups`) | same |
| The plugin tab registry | `src/client/tabs/registry/tab-registry.ts:54` (registry), `:74` (`register`), `:22-32` (`WorkspaceTabType`) | same |
| Surface labels | `src/client/terminal/agent-commands.ts:15-22` (`WORKSPACE_SURFACE_ACTIONS`) | same |
| Last-used tab | `src/client/tabs/last-tab.ts:5-14` | same |
| Tab type enablement | `src/client/tabs/tab-types-state.ts:22` | same |
| Persistence | `src/client/canvas/persist.ts:20`; `src/client/canvas/persistence.ts:23` (`STORAGE_KEY`), `:34` (restorable kinds), `:38` (`SavedTile`), `:62` (`SavedGroup`) | same |
| Browser tab | `src/client/browser/BrowserPane.tsx:36` | `.../browser/BrowserPane.tsx` (the 120 fix is only in `ide/`) |

### What it does today

- The strip renders above the canvas stage (`canvas/WorkspaceCanvas.tsx:342-404`), inside the centre column:
  one tab per tile, rename in place, close, split, a running-agents pill, the `+` menu and the dock buttons.
  The branch label is a chip at the left of the strip (`TabStrip.tsx:179-183`), not a tab.
- The `+` menu is data-driven: `WORKSPACE_SURFACE_ACTIONS` (terminal, browser, file, diff, board, doc), the
  agents the Host says are installed and enabled, the DSH chat entry, and any tab types plugins registered
  through `ctx.workspaceTabs` (`tab-registry.ts:54`). The plain `+` opens the default agent, the last-used
  tab, or the terminal; the chevron opens the menu (NewTabMenu.tsx:65-83, 111-121).
- Tab sets are per worktree, per workspace: `WorkspaceGroups.stateFor(key)` (`groups.ts:32`), keyed by the
  selected worktree path (or the global key). Switching a worktree swaps the whole set
  (`WorkspaceCanvas.tsx:114-124`).
- Persistence saves, per group: the tiles whose content is in the renderer (file, browser, diff, board, doc,
  custom), terminal/agent tiles by their Host terminal id, the active/split indexes, the mode, forgotten roots
  and dismissed chats (`persistence.ts:23-80`). Chat tiles are not saved: the session list re-creates their
  tabs. `persist.ts:20` debounces writes and flushes once on disposal. The last-used `+` target is separate
  storage (`last-tab.ts`).
- On first run in a frame with an app, the workspace opens the app's own page as a browser tile and focuses it
  ahead of the chat (`index.ts:110-158`).

### Tests

`tests/tabs/` (`tab-strip.spec.tsx`, `tabs-rules.spec.ts`, `tab-registry.spec.tsx`, `tab-close.spec.ts`,
`last-tab.spec.ts`, `tab-scroll.spec.ts`), `tests/canvas/` (`state.spec.ts`, `groups.spec.ts`,
`persistence.spec.ts`, `shell-requests.spec.ts`), `tests/browser/browser-pane.spec.tsx`.

### What has to change

- Move the strip from the centre to the right panel. The canvas loses its tab strip, its stage and its split;
  it holds only the app. The centre currently renders the tile stage (`WorkspaceCanvas.tsx:374-404`), and the
  panel is DSH's `sidebarRight`; the port should keep the `WorkspaceState` model and re-home the strip, not
  build a second tab model. `TabStrip`'s props are already all model-driven, so the component itself ports.
- Drop the Browser tab and the browser surface action. The canvas is the browser: the first-run app page
  (index.ts:110-158) becomes the canvas itself, and `BrowserPane` becomes dead (its tests go with it).
- The `+` menu in the mockup is two groups, Agents (Chat, Claude, Codex, Pi) and Tools (Terminal, Files, Git).
  Today it also offers File, Diff, Board, Doc and plugin tab types. Decide which survive: the spec's four
  slices keep only agents/PTYs, terminal, Files, Git, and the chat. The board, doc, diff and custom tab types
  are not named; they are the ones to drop or defer, with `tests/board`, `tests/docs`, `tests/diff` and the
  custom-tab part of `tests/tabs`.
- Remove the branch chip from the strip (`TabStrip.tsx:179-183`): the left panel owns the branch identity.
- Remember the right panel's open state (mockup Decided: "Both panels open on first run, then remembered").
  Nothing in `canvas/persistence.ts` stores panel open state today; the layout service and `sidebarRight`
  hold it in memory. Add it to the frame's persistence (or the layout service's own storage), and make the
  first-run default both panels open.
- Keep: rename, close, close others/right, F2, wheel scrolling, the running-agents pill, one tab per chat
  session (`state.ts:190-217`), and the plugin tab registry if the `+` menu keeps plugin types. If the Tabs
  settings section is dropped (part 8), the registry's enable/disable state loses its UI; decide whether the
  registry stays (types always enabled) or goes.

## 2. PTY tabs: the registry and the spawning

Slice 1.

### Where it lives

| Piece | `ide/acryl-workspace` | `acryl` twin / origin |
| --- | --- | --- |
| Host PTY registry | `src/pty/service.ts:236` (`WorkspacePtyRegistry`), spawn seam at `src/pty/service.ts:1-80`, registry built in `src/index.ts:95-101` | `plugins/acryl-workspace/src/pty/service.ts` (async PATH lookup, spec 048 T005) |
| PTY HTTP routes | `src/pty/route.ts:19`, paths in `src/pty/contract.ts:10-15`, stream path `:15` | same |
| The stream | `src/pty/stream.ts` (router upgrade, batching, resume cursor); host wiring `src/index.ts:185-188` | the ACRYL copy is the older `webServer` + `ws` version; the port direction is `ide/` -> ACRYL |
| Spawn | `src/pty/node-pty-spawn.ts:5` (`node-pty`) | same |
| Client registry | `src/client/terminal/terminal-session.ts:237` (`TerminalRegistry`), `src/client/terminal/pty-api.ts:48` | same |
| Terminal view | `src/client/terminal/PtyPane.tsx:19` (`PtyPane`, `compact` mode) | same |
| Agent catalog | `src/agents/known-agents.ts:39` (`KNOWN_AGENTS`: claude, codex, pi, and more), `src/agents/launch.ts:29` (`planKnownLaunch`) | same |
| Agent settings | `src/agents/settings.ts`, `catalog.ts`, `file-store.ts`, `route.ts` | same |
| Dock terminal tabs | `src/client/dock/dock-tabs.ts:28` (`DockTabsState`, plain shells only), `dock/TerminalDockPanel.tsx:26` | same |

### What it does today

- One Host registry owns every PTY: `start` resolves the command (an allowlisted agent id or `shell`), starts
  node-pty in the worktree, keeps scrollback and a screen model, and streams output over a router upgrade
  (`src/pty/service.ts:236` onward; routes at `route.ts:19`; the PID, output and close paths are in
  `contract.ts:10-15`). Closing a tile releases the terminal: `WorkspaceCanvas.tsx:147-156` calls
  `terminals.release` and `api.close`.
- The agent list is closed and curated: `KNOWN_AGENTS` names the executables, their "skip approvals" flags,
  their install pages and their badge (`known-agents.ts:39`), and `planKnownLaunch` composes command, args and
  env from the agent definition, the user's override and the permission mode (`launch.ts:29`). The `+` menu
  lists installed and enabled agents; custom agents are stored in the ACRYL home.
- Claude, Codex and Pi are therefore not special-cased anywhere: they are catalog entries, spawned as their
  real TUIs in a PTY, exactly as the mockup asks. What the frame adds is the cwd (the selected worktree) and
  the title.
- A second, narrower terminal system exists for the dock: `DockTabsState` holds up to 12 plain shell tabs per
  worktree and shares the same `TerminalRegistry` (`dock-tabs.ts:28`, `terminal-stack.ts`). The canvas and the
  dock both spawn shells today.

### Tests

`tests/terminal/` (`terminal-registry.spec.ts`, `pty-stream.spec.ts`, `terminal-size.spec.ts`,
`terminal-niceties.spec.ts`, `gpu-renderer.spec.ts`), `tests/pty/` (`screen-model`, `scrollback`,
`spawn-dirs`, `stream`, `cwd`, `tui-regression`), `tests/agents/` (`catalog`, `definition`, `route`,
`settings`, `agent-status`, `agent-draft`, `agents-section`), `tests/dock/` for the dock's own tabs.

### What has to change

- Keep the registry, the spawn seam, the agent catalog and the stream. Move `PtyPane` into the right panel's
  tab body. The panel must not restart a terminal on a layout change; the panel content is hidden, not
  unmounted, in the current dock code (`DockColumns.tsx:9-10` makes the same point for the upstream panel).
  Preserve that.
- Unify the two terminal systems: the dock's plain-shell tabs and the canvas's `pty` tiles become one tab
  kind. `DockTabsState` and `TerminalDockPanel` should disappear with the dock (part 8); the canvas
  `WorkspaceTile` of kind `pty` is the survivor.
- Closing a right-panel tab must keep the existing lifecycle: release from `TerminalRegistry`, `api.close`,
  and the Host's `onLost`/`onExit` handlers (`WorkspaceCanvas.tsx:264-318`) keep working when the strip is
  re-homed. A panel hide must not close tabs.
- The mockup names Claude, Codex and Pi; the catalog has more (grok, copilot, gemini, ...). No change is
  needed to the catalog; the `+` menu's "Agents" group is a projection of it. The "PTY" tag in the mockup is a
  label, not a new mechanism.

## 3. The DSH chat in a tab, and where chat history lives

Slice 1 (the tab and its History button).

### Where it lives

| Piece | Source |
| --- | --- |
| The chat tab body | `ide/acryl-workspace/src/client/canvas/WorkspaceCanvas.tsx:172-177` (`tile.kind === 'chat'` renders `renderConversation()` and the first-run model card) |
| The conversation slot | `ide/acryl-app-shell/src/client/AdvancedFrame.tsx:106-113` (`renderSlot('main', { entryKey: 'conversation' })`) |
| Chat tiles | `.../canvas/state.ts:24` (`chatSessionId`), `:190-217` (one tile per session, the unbound tile claims the first real session) |
| Which chat is shown | `.../chat/chat-selection.ts:43` (`ChatSelection`), `:56` (`open`), `:64` (`selectTab`), `:78` (`showWorktree`), `:102` (`watch`) |
| Open/reopen/rename | `.../projects/projects-control.ts:247` (`openChat`), `:276` (`renameChat`), `:295` (`showChat`), `:323` (`newChat`); pick rule `.../sessions/session-pick.ts:19` |
| Sessions data | DSH `ISessions`, re-exported at `ide/acryl-ui/src/frame.ts:24`; list shape in `deepseek-harness/packages/api/session-controller/src/client/sessions/service.ts:54` (`ids`, `byId`, `phase`), row fields around `:20-52`: `title`, `displayTitle`, `cwd`, `running`, `blank`, `updatedAt` |
| Dismissed chats | `.../worktrees/shell-state.ts:41-43` (a set of ids), saved at `.../canvas/persistence.ts:77-79` |
| Chat availability | `.../capabilities/contract.ts:7` (`chat: boolean`), served by the Host at `src/index.ts:163-167` (`services.get('agents') !== undefined`) |

### What it does today

- The chat is the DSH conversation, rendered by the frame's `main` keyed slot into whichever tile is a chat
  tile. It is not a rebuilt chat: the composer, the transcript, the tool cards and the model picker are
  upstream DSH, and `composer-focus.ts` only focuses the composer after a reload or a tab switch.
- Each chat tab is keyed by `chatSessionId`; opening a session that already has a tab focuses it instead of
  duplicating (`state.ts:191-197`). The tab title follows the session's own title, and renaming a chat tab
  renames the session (`TabStrip.tsx:160-175`), so the left tree and the strip cannot drift.
- `ChatSelection` is the one owner of which chat is shown: user intents open a session (`open`), tab picks
  select it, a worktree pick shows its chat or creates one. Reconciling DSH's list only writes ACRYL's tab
  sets, never navigates (`chat-selection.ts:132-150`).
- History: every session the Host knows is in the DSH list, including closed ones. The left tree shows open
  items only by default (`sidebar-model.ts:104-140`: an open tab, running or selected) and puts the rest
  behind an "N earlier chats" toggle (`RepoSection.tsx:268-272`); a dismissed chat is hidden from the tree
  and the strip but never deleted (`shell-state.ts:41-43`). There is **no History button or all-chats view**
  anywhere in the client (`grep -ri history` finds only comments). The data for the mockup's History exists;
  the UI does not.
- `openChat` already handles reopening, including a blank unbound session, which it upgrades to a bound chat
  on the owning worktree (`projects-control.ts:247-274`).

### Tests

`tests/chat/chat-selection.spec.ts`, `tests/chat/composer-focus.spec.ts` (the 120 fix), `tests/sessions/`
(`session-navigation`, `session-pick`, `agent-bridge`, `running-agents`),
`tests/projects/projects-control.spec.ts`, `tests/canvas/state.spec.ts` (chat tiles and the unbound claim).

### What has to change

- Move the chat tile into the right panel as a tab. The body must keep rendering the DSH `main` conversation
  slot for the current session; a generic right-panel tab body that mounts outside the session scope will not
  see it. The frame already passes `renderConversation` into `desktop.main`; the panel host needs the same
  renderer (or the panel must render the conversation slot itself). This is the central slice 1 design
  question (see "Questions the mini-design must settle").
- Add the History button at the top left of the chat tab (mockup line 440): a panel listing all sessions,
  grouped by branch, with search, closed ones included, opening a pick as a tab through `openChat`. The left
  panel's "earlier chats" toggle moves into History. The session list row already carries everything needed
  for the list: `title`/`displayTitle`, `cwd` (which maps to a branch through `owningWorktree`), `updatedAt`,
  `running`, `blank`. Grouping and search are new client code; no new Host route is needed. Renaming and
  dismissing stay as they are, but History must be able to show a dismissed chat (it is hidden, not deleted)
  and reopening it should clear the dismissal or the left tree will still hide it; decide that in the design.
- Keep: one tab per session, title following the session, the first-run model card, and `chatAvailable` so a
  composition without DSH's `agents` row simply has no chat tab.

## 4. Files: the tree, fuzzy search, the viewer, syntax highlighting

Slice 1.

### Where it lives

| Piece | Source |
| --- | --- |
| Files tab body | `ide/acryl-workspace/src/client/files/FilesBody.tsx:33`; registered as a `sidebarRight` tab by `files/files-tab.ts:29-50` (it takes over DSH's `files` kind at the `extension` band) |
| Tree view | `files/FileTree.tsx:39`; pure model `files/tree-model.ts:34` (`visibleRows`), `:68` (`moveFor`), `:101` (`rowWindow`) |
| File routes client | `files/files-api.ts:33` (`WorkspaceFilesApi`: tree, read, write, change) |
| Host files service | `ide/acryl-workspace/src/files/service.ts:43` (`WorkspaceFiles`), `src/files/route.ts:27` (`filesRoutes`) |
| Viewer and highlighting | `files/FileEditorPane.tsx:30`; `files/CodeEditor.tsx:34` (CodeMirror 6: `basicSetup`, `oneDark`, `@codemirror/language-data` loaded on demand by filename) |
| Fuzzy scorer | `palette/fuzzy.ts:10` (`fuzzyScore`), `:57` (`matchIndexes` for highlight positions) |
| File search | `palette/file-search.ts:17` (`createFileSearch`) over the Host's `gitApi.search`; Host implementation `src/git/search.ts:17-45` (literal, case-insensitive substring: `ls-files` for names, `git grep -F -i` for content, capped) |
| Palette scopes | `palette/palette-state.ts:10` (`all`, `commands`, `files`, `content`); file hits are not re-ranked by the client (`:175-184`) |
| The shortcut | `ide/acryl-shortcuts/src/client/index.ts:42-47`: Cmd/Ctrl+Shift+P for the palette; no Cmd/Ctrl+P binding exists |
| Breadcrumbs, scratch tabs | `files/FileBreadcrumbs.tsx`, `files/ScratchFilePane.tsx`, `files/file-edit.ts` |

### What it does today

- The Files tab is a lazy tree: directories load on open, the view virtualizes rows, keyboard navigation is
  implemented (`tree-model.ts:68`), git-ignored entries are dimmed, and a file click opens an editor tab
  through the workspace (`FilesBody` calls `shell.openFile`). Editors are code tabs with breadcrumbs, save
  conflict detection (`FileConflictError` on a stale mtime), and a scratch file kind.
- Syntax highlighting exists and is per filename: CodeMirror's `LanguageDescription.matchFilename` loads the
  language support on demand (`CodeEditor.tsx:79-88`). The editor is the real port source for the mockup's
  highlighted file tab; no new highlighting work is needed.
- Search exists but is not fuzzy: the Host matches a literal substring in file names or file contents, and
  the palette displays those hits unranked (`palette-state.ts:175-184`: "File hits are already matched by
  the Host; ranking them again by name would drop content matches"). The fuzzy scorer exists and is used for
  commands only (`palette-items.ts:52-63`).
- `Cmd/Ctrl+P` is not bound; the palette's only binding is Cmd/Ctrl+Shift+P (`acryl-shortcuts/src/client/index.ts:46-47`).
  Web on Linux has no default binding for the palette because the browser refuses it.

### Tests

`tests/files/` (`tree-model`, `files-api`, `service`, `files-tab`, `panes`, `code-editor`, `entry`,
`file-edit`, `breadcrumbs`, `line-comments`), `tests/palette/` (`palette-rules`, `command-palette`),
`tests/git/search.spec.ts`.

### What has to change

- Fuzzy over every file: either feed the full file list from the Host (`git ls-files`) into the existing
  `fuzzyScore`/`matchIndexes` on the client, or add a fuzzy mode to `src/git/search.ts`. The mockup requires
  ranking and matched-letter highlighting; `matchIndexes` already returns the positions for that. The current
  content search can stay as a second scope, or be dropped if the design keeps only names; the mockup shows
  names.
- Bind Cmd/Ctrl+P to the file picker (the shortcut service and `acryl-shortcuts` own the registration). Keep
  Cmd/Ctrl+Shift+P for the command palette if the palette survives slice 1; if the palette settings section
  is dropped (part 8), decide whether the palette itself stays.
- Files becomes a right-panel tab, and a file opens as its own tab beside it (the mockup's strip has both
  `Files` and `board.ts`). The current editor tab and the Files tab already work that way; the port mostly
  re-homes them.
- Remove the line-comments coupling from the editor if Comments is dropped (part 8): `FileEditorPane.tsx:8-10,
  30` passes a `CommentStore`, and `CodeEditor.tsx:17,34` installs `lineComments`. The editor must keep working
  with `comments` absent (it already accepts `undefined`); the dead code and its tests go.

## 5. Git: changes, history, the branch tree, and a branch's open items

Slices 1 (the Git tab) and 2 (the left panel).

### Where it lives

| Piece | Source |
| --- | --- |
| Changes view | `ide/acryl-workspace/src/client/changes/ChangesBody.tsx:35`; tab registration `changes/changes-tab.ts:26-61` (kind `changes`, opens on worktree select through `shell.setReveal`) |
| Diff view | `diff/GitDiffPane.tsx:70` (diff against HEAD, line comments sent to the chat) |
| Git client API | `git/git-api.ts:30` (`WorkspaceGitApi`: repo, status, diff, checks, stage, unstage, commit, search, createWorktree); paths in `git/contract.ts:4-11` |
| Git host service | `ide/acryl-workspace/src/git/service.ts` (`WorkspaceGit`), `changes.ts:9` (`WorkspaceChanges`), `commits.ts:11` (`WorkspaceCommits`), `route.ts` (`gitRoutes`) |
| Repo/worktree discovery | `src/git/parsing.ts:7` (`parseWorktrees`, `git worktree list --porcelain`), `repo` view `git/contract.ts:24-44` (path, branch, head, main; worktrees only) |
| Branch creation | `src/git/worktrees.ts:68` (create a branch and its worktree) |
| Shell state | `client/worktrees/shell-state.ts:13` (`WorktreeState`), `:27` (`RepoState`), `:36` (`ShellSnapshot`), `:105` (class), polling `worktrees/shell-polling.ts:13` |
| Left rows | `projects/sidebar-model.ts:104` (`entriesForWorktree`), `:192` (`buildProjectRows`); `projects/RepoSection.tsx` renders them |
| Open items | `canvas/groups.ts:32` (one tab set per worktree), `chrome/worktree-agents.ts:16` (agents per worktree), chats by `cwd` (`sidebar-model.ts:104-140`) |
| Status bar | `chrome/status-line.ts:24`, `chrome/StatusLine.tsx:11`, mounted at `canvas/WorkspaceCanvas.tsx:405` |
| Versions / save | `plugins/save/index.ts:25` (`saveFolder`), `@webboxes/app-persistence`'s `saveApp` (commit and push if a remote), `save_app` tool `:42-55`; the CLI `npm run save` |
| Branch tab | no branch tab exists; the branch chip in the strip is `TabStrip.tsx:179-183` |

### What it does today

- Changes: the `changes` right-sidebar tab lists the selected worktree's status, stages/unstages, commits (never
  pushes), and opens a file's diff. The diff pane can send a line comment into the current chat and stores it
  in the Review store (`WorkspaceCanvas.tsx:186-200`). Selecting a worktree switches an open right panel to
  Changes (`changes-tab.ts:48-56`).
- History: there is none. The Host has no `git log` route (`contract.ts:4-11`: status, diff, worktree, checks,
  search, stage, unstage, commit), and the only log call is `git log -1` to name a new commit
  (`src/git/commits.ts:39`). There is no push or pull route either; `saveApp` is the existing way to commit
  and push the app folder.
- Branch tree: the left panel is a workspace-first tree (workspace -> worktree -> open agents/chats). The data
  comes from `git worktree list --porcelain` (`parsing.ts:7`), one row per worktree, labelled by its checked
  out branch (`sidebar-model.ts:192-233`). A branch with no worktree does not exist in the model. The tree's
  "+" creates a branch and a worktree together (`RepoSection.tsx:74-111`, `worktrees.ts:68`).
- Open items per worktree: the worktree's `WorkspaceGroups` tab set (PTY tiles) plus every chat session whose
  `cwd` resolves to it (`entriesForWorktree`, `sidebar-model.ts:104-140`). That is exactly "what is open on
  this branch" when branch == worktree. A chat that was started elsewhere and later moved is relocated when its
  cwd is learned (`chat-selection.ts:156-168`).
- The status bar shows branch, changed files, added/removed lines, running agents and terminal count
  (`status-line.ts:24-40`).

### Tests

`tests/changes/` (`changes-tab`, `changes-commit`), `tests/git/` (`git-api`, `service`, `search`, `checks`,
`write`), `tests/worktrees/shell-state.spec.ts`, `tests/projects/sidebar-model.spec.ts`,
`tests/diff/` (`git-diff-pane`, `unified-diff`, `line-diff`, `comment-message`), `tests/chrome/`
(`status-line`, `chrome-rules`), `tests/projects/registry*.spec.ts`.

### What has to change

- Left panel top level: branches, not worktrees. Two paths:
  (a) keep the worktree model and label rows by branch, materializing a worktree when a branch is picked
      (today's "+" already creates both), or
  (b) add a branch list route (`git for-each-ref` / `git branch --format`) and map each branch to its
      worktree when one exists. The repo view and `parseWorktrees` have no branch-without-worktree data today,
      so (b) needs a Host route.
  The mockup's left panel shows branches only and no worktree paths (`blends-frame-mockup.html:363-372`);
  the Decided row says "Git branches as the top level". The mockup's "Dropped: branches and worktrees" bullet
  (line 549) contradicts that if read literally; the detailed rows and the Decided table are the ones to
  follow, and the bullet is best read as dropping the worktree-path rows, the branch tab and the status bar.
  Flag this to Fork3.
- A branch's open items: keep `entriesForWorktree`'s rule (PTY tiles + chats by cwd), re-keyed to branch if the
  tree stops being worktree-based. Nothing else tracks open items.
- Versions: new. The mockup wants save points under the selected branch, with "go back", "keep", and "share
  through git or the Blend registry". The existing pieces are `saveApp` (commit and push the app folder) and
  the commit route; a version list needs a `git log` route, and "go back" needs a checkout/reset route with
  conflict handling. This is the largest new Host surface in the slice 2 area. Reuse `commits.ts`'s runner and
  error style; do not shell out from the client.
- The Git tab: changes + history + push/pull. Changes exists; history and push/pull are new routes (no route
  today, `contract.ts:4-11`). The commit route explicitly never pushes (`git-api.ts:47`), so push/pull must be
  separate, explicit actions with their own errors.
- Drop the status bar, the Changes tab's reveal-on-select behavior, and the branch chip; the Git tab and the
  left panel replace them. Keep `git/status` polling for the left panel's change counts (part 2's summary) if
  the panel still shows a dirty marker; the polling itself (`shell-polling.ts:13`) is cheap and stays.

## 6. Settings: the sections, and the plugin navigator

Slice 3.

### Where it lives

| Piece | Source |
| --- | --- |
| The Settings surface | DSH client rows `ui-settings-general`, `ui-settings-plugins`, `ui-settings-models` in `packages/cli/src/ide-profile.ts:159-188`; the section slot is `settings.section` |
| ACRYL sections | `ide/acryl-workspace/src/client/settings/section-plugin.ts:22` (shared dictionary and styles), `:48` (`settingsSectionPlugin`); `agents-settings-plugin.ts` (Agents, order 40), `tabs/tabs-settings-plugin.ts` (Tabs, 41), `palette/palette-settings-plugin.ts` (Command palette, 42); `settings/locales.ts:3` (section keys), `settings/open-settings.ts:61` (opens a section) |
| Other sections | `ide/acryl-shortcuts/src/client/index.ts:43-56` (Shortcuts, order 43); `ide/acryl-support` (Support, order 90); `ide/acryl-agent-control` (audit, order 91); `apps/acryl-desktop/src/client/settings/desktop-settings.ts:45` (Desktop, order 100) |
| Plugins section content | ACRYL `ide/acryl-plugin-admin/src/index.ts:52` host plugin; lifecycle routes `lifecycle/route.ts:59`; architecture route `architecture/route.ts:17`; lifecycle view `lifecycle/view.ts`; client tabs `client/lifecycle/plugin-lifecycle-settings.ts:33` (Architecture, order 4) and `:41` (Lifecycle, order 5) |
| Lifecycle data | `ide/acryl-plugin-admin/src/lifecycle/contract.ts:21-37` (`PluginLifecycleEntryView`: entryId, moduleName, enabled, hostPhase, clientPackage, clientInBootGraph, version, mutable, protectedReason, dependents), `:47-65` (`PluginLifecycleBlendView`) |
| DSH's own inventory | `deepseek-harness/packages/host/plugin-inventory` (`pluginInventory/list`: entry id, module specifier, enablement, phase, `meta.title`/`meta.description`, presets); tab UI `packages/client/ui-settings-plugin-inventory/src/client/index.ts:44-60`; the Settings section package `ui-settings-plugins` titles itself "Built-in plugins" |
| Settings storage | `ide/acryl-settings/src/service.ts` (the ACRYL settings service: profile `settings.patch.yml`), used by the workspace host at `src/index.ts:123` for the project list |

### What it does today

- The Settings dialog is DSH's; sections are registered into `settings.section`. The frame mounts General
  (shortcuts fixed list), Plugins, Models from DSH's client rows, plus ACRYL's Agents, Tabs, Command palette,
  Shortcuts, Support, Agent Control audit, and Desktop (only on Desktop).
- Settings > Plugins is DSH's "Built-in plugins" section, whose tabs come from `settings.plugins.tab`. ACRYL
  contributes two tabs: Architecture (the live Cordis graph, host and client planes, projected by
  `architecture/inspector.ts`) and Lifecycle (a list with enable/disable/reload). Lifecycle has real
  mutations, protected entries, dependent handling and receipts (`lifecycle/route.ts:59-120`).
- There is no single navigator: the lifecycle tab's data has no author or source ("made by agents", "registry",
  "frame"), no description field, and no per-plugin `plugin.json` description. DSH's read-only inventory does
  have `meta.title`/`meta.description` when the `pluginPackages` service resolves package metadata, and a
  `pluginInventory/list` Remote, but it cannot toggle. The two data sources are complementary.
- The `plugin.json` files do carry a description (e.g. `plugins/driver-pty/plugin.json`), and the extensions
  ledger records what agents installed live (`plugins/extensions/ledger.ts:19-25`: at, kind, name, version).
  Neither is joined into the lifecycle snapshot today.

### Tests

`tests/settings/` (`open-settings`, `section-plugins`), `ide/acryl-plugin-admin/tests/` (`architecture/`,
`lifecycle/`, `client/`, `plugin.spec.ts`, `plugin-tools.spec.ts`), `ide/acryl-plugin-admin/tests/lifecycle`
for enable/disable/reload and protected entries; ACRYL's `plugins/acryl-plugin-admin/tests` is the same suite.

### What has to change

- Build the navigator as a new Settings section (or replace the content of Settings > Plugins). The Decided
  row: "A navigator of every Cordis plugin the app is made of, with who made it, its state and an on/off
  switch." Reuse the lifecycle routes for state and toggling, and the inventory data (or the package metadata)
  for title/description.
- "Who made it" needs new metadata. The realistic sources: the Blend rows (which row the plugin is), the
  extensions ledger (agent-installed, with `at`), the package's `plugin.json`/`package.json` (description,
  version), and the frame's own rows. Decide the projection and add it to the lifecycle contract (private
  route, both sides in one package) or build the join client-side from the existing endpoints. Do not invent
  an author string; if the data does not exist, show the source ("frame", "app", "installed by an agent") and
  the version, which do exist.
- Keep: mutable/protected rules, dependents (`dependents` in the entry view), reload receipts, the Architecture
  tab as an advanced view (or move it under the navigator's detail), and the audit.
- Drop the Tabs and Command palette sections (part 8) from the frame's Settings. Agents stays. The "shortcuts
  list goes into General": today Shortcuts is its own section (`acryl-shortcuts`), and DSH's General already
  lists fixed shortcuts; the port must add a short ACRYL shortcut list to General and remove the separate
  section (or keep the section and treat the mockup's line as a simplification; decide).
- "Built-in plugins" (DSH's title for Settings > Plugins) is the section the navigator replaces; make sure the
  DSH section's empty-state and tab projection do not fight the new content, or replace the section wholesale.

## 7. Production, the element the agent sees, and the UI-driving surface

Slice 4, with the Build/Preview switch in slice 2.

### Where it lives

| Piece | Source |
| --- | --- |
| Production switch | `packages/cli/templates/agent/src/app.ts:70-80` (`DEVELOPMENT_ROWS`), `:96-125` (`leaveOut`, `NODE_ENV=production`, `ACRYL_PRODUCTION_KEEP` with a warning per kept row); `init` rewrites the app's `dev` script to the generated frame launcher (`packages/cli/src/ide-profile.ts`'s host script, `scripts/ide-host.mjs`), while `start` stays the app's own server (asserted at `scripts/verify-ide-template.mjs:226`) |
| Dev-only plugins | `plugins/driver-pty/index.ts:71-72` and `plugins/agent-panel/index.ts:80-81` return early on `NODE_ENV=production` or `ACRYL_DOOR=off`; the door's page script is only emitted in development (`packages/cli/templates/agent/src/routes.ts:13-15`) |
| The gate's production use | `scripts/verify-scaffolder.mjs:823` (the chat template keeps chat in production) |
| The frame token | `packages/cli/src/ide-profile.ts:330-375`: the launcher's URL carries a launch token, exchanged for a cookie; the address is reused across restarts, owner-only state file |
| The element picker | `acryl/plugins/acryl-mount-anchors/src/client/index.ts:28` (shortcut "Pick an element for the agent"), `:51` (overlay mounted directly on `document.body`), `MountAnchorInspector.tsx:70` (`selectorFor`), `:163` (component), `:194` (`preciseElementAt`, `elementsFromPoint`), `:207-222` (anchor JSON: slot, target, selector, owning file, url, timestamp, copied to the clipboard) |
| Picker entry points | `ide/acryl-workspace/src/client/palette/palette-commands.ts:60` ("Pick an element for the agent (copies where it is)"), `use-workspace-palette.ts:76` (window event), `ide/acryl-shortcuts/tests/shortcut-rows.spec.ts:11` |
| The agent's page tools | `acryl/plugins/acryl-agent-control/src/host/tools.ts:13` (`ui_snapshot`, `ui_click`, `ui_type`, `ui_select`, `ui_press`, `ui_scroll`, `ui_wait`), `approval.ts:38` (mutating tools ask; reads do not), `tools.ts:24` (`MUTATING_TOOL_NAMES`), the door protocol `acrylblends/plugins/acryl-door/src/page/protocol.ts:10` (`UI_OPS`), `:14` (`MUTATING_OPS`) |
| The door host | `plugins/acryl-door/src/host/` (`door.ts` with per-verb approval and audit, `api.ts`, `page-routes.ts`, `page-socket.ts`); the agent's CLI is `plugins/acryl-door/src/cli` (`.acryl/bin/acryl look` / `act`) |
| ACRYL control plane | `acryl/runtime/acryl-control/src/platform/web.ts` (the `acrylWeb` port), `src/agent/` (providers: claude, codex, acp, dsh-native), `src/plugins/`, `src/authorization/`; `acryl/plugins/acryl-agent-control` (tools, approval, audit, client audit section) |
| Tests | `acryl/apps/acryl-web/tests/workspace-shared.spec.ts:187-221` (the ui_* tools on a real page), `acryl/apps/acryl-desktop/tests/surface-parity.spec.ts:62`, `plugins/acryl-agent-control/tests/` (`boundary`, `host`, `client`, `scenarios`), `acryl/plugins/acryl-mount-anchors/tests/` (`pick-shortcut`, `selector`) |

### What it does today

- Production is a different process, not a mode of the frame: after `init`, `npm run dev` boots the frame
  launcher (the app mounted at `/app` in a tile), while `npm start` boots the app's own server with no frame
  at all. `NODE_ENV=production` makes
  the app's composition leave out the agent, the builder and the live install, and `ACRYL_PRODUCTION_KEEP`
  names any of those rows to keep, with a warning ("nothing here is behind a login"). The frame has no
  Build/Preview/Production switch today; Preview (hide the frame, same running app) does not exist.
- The frame is reached through the launcher's token URL (owner-only state file, cookie exchange). That is the
  "owner-only frame token" the mockup means.
- Element selection today is a user gesture that copies a JSON anchor to the clipboard (mount-anchors): slot
  from the nearest `data-acryl-slot`, precise element, CSS selector, owning plugin file from the CSS module
  stamps, url and timestamp. The agent sees it only after the person pastes it into the chat. There is no
  selection chip in the composer and no persisted selection.
- The agent can also see and drive the page by itself through the door: `acryl-agent-control` exposes
  `ui_snapshot` and the mutating verbs, each mutating call going through the harness approval pipeline with a
  sentence naming the control; protected/sensitive elements are refused by the page driver; every call lands
  in the audit log. ACRYL's `apps/acryl-web` tests drive this end to end on a real page.
- A production feedback loop does not exist: no feedback plugin or notes store, and no screenshot capture
  anywhere in the product code of either repo.

### What has to change

- Build/Preview switch: a frame-level mode that hides the panels and the chrome on the same running app,
  restores with a pill, and does not restart anything. The frame's own columns and strip are client-side, so
  this is a shell-level state and CSS change; the app in the canvas is untouched. Persist the mode per view.
- Production: the published app with no frame, no panels, no agent, no Settings. Today that is `npm start`;
  the port must decide whether Production is a composition (the frame rows absent) or a runtime mode of the
  same host. The spec says "the frame goes off with it" with `ACRYL_PRODUCTION_KEEP`; the existing switch
  already turns the agent off, so the frame's production mode should reuse it rather than invent a second
  switch. `driver-pty` and `agent-panel` already hard-stop in production.
- Feedback (new opt-in plugin): reuse the mount-anchors picker (`preciseElementAt`, `selectorFor`,
  `nearestSlot`, `resolveComponent`), the same shortcut/event pattern, and the "Nothing specific" option. Add a
  notes store and the left panel's Feedback list (mockup lines 381-386). Handing a note to an agent needs the
  page URL, selector and a screenshot: **no screenshot capability exists today**; the door's snapshot is
  textual. Decide the capture mechanism (the page can draw to a canvas only with restrictions; a Host-side
  browser capture needs a real browser; the door's DevTools channel in the gate is test-only). This is a real
  new capability, not a port.
- Assistant mode: only the agent panel, driving the app's UI through acryl-control, refused anything that
  changes the app, its code, its plugins or its secrets. Existing enforcement points: the door's
  `MUTATING_OPS` split, `acryl-agent-control`'s approval policy and audit, the page driver's protected /
  sensitive refusals, the harness's per-session permission mode (full access disables asking, so assistant
  mode must not use it), and the composition itself (no builder, no agent, no extensions rows in production).
  The assistant needs a read-only policy: deny `click`/`type`/`select`/`press`/`reload`/`navigate` or gate
  them behind the same approval with a scope that never includes app-changing tools. Decide which layer owns
  the profile; the UI tools are shared with the builder chat, so the policy must be per session/mode, not a
  global plugin setting.
- Keep the door's audit (every UI action, with the approval decision) as the record of what the assistant did.

## 8. The IDE-only parts to drop, and what depends on them

Slice 1 (Review, Checks, Comments, status bar, dock) and slice 2 (left panel, Settings sections).

| Part | Source | Tests | What depends on it today |
| --- | --- | --- | --- |
| Review | `ide/acryl-workspace/src/client/review/review-tab.ts:10` (kind `review`), `review-store.ts:60` (`ReviewStore`), `review/ReviewBody.tsx:14`; persistence `index.ts:159-160`; the store is written by the diff pane's send-comment (`canvas/WorkspaceCanvas.tsx:192-199`) | `tests/review/` (`review-store`, `review-tab`), `tests/diff/comment-message.spec.ts` | `GitDiffPane`'s `sendComment` (the diff -> chat path), `WorkspaceCanvas`'s `review` prop, the persisted `REVIEW_STORAGE_KEY`. If Review goes, decide what the diff pane does with a line comment (keep a direct "send to agent" without the store, or remove the action) |
| Checks | `checks/checks-tab.ts:10` (kind `checks`), `checks/ChecksBody.tsx:19`; the run action `:77` -> `shell.runCheck` (`worktrees/shell-state.ts:47`, `:440`), handled into a terminal tab at `canvas/shell-requests.ts:54`; the scripts come from `gitApi.checks` (`src/git/checks.ts`) | `tests/checks/checks-tab.spec.ts`, `tests/git/checks.spec.ts` | `WorkspaceShellState`'s `RunCheckRequest`/`runCheck`/`onRunCheck`, `routeShellRequests`, the terminal-tab creation path. Dropping Checks removes the only caller of the run-check plumbing; the Git tab might keep a "run" action, but the mockup does not ask for one |
| Comments (line comments) | `comments/comments-tab.ts:11`, `comments/comment-store.ts:49`, `comments/CommentsBody.tsx`, `files/line-comments.ts:372` (`lineComments` CodeMirror extension), wired at `files/FileEditorPane.tsx:30` and `canvas/WorkspaceCanvas.tsx:180`; terminal targets `comments/terminal-targets.ts` (depends on the dock) | `tests/comments/comments.spec.tsx`, `tests/files/line-comments.spec.tsx` | The editor's comment gutter and the `CommentStore` prop; `CommentsBody`'s paste targets (dock + canvas terminals). If Comments goes, `CodeEditor` loses its `comments` parameter and `line-comments.ts` can go; the editor must stay usable without it |
| Git status bar | `chrome/status-line.ts:24`, `chrome/StatusLine.tsx:11`, mounted `canvas/WorkspaceCanvas.tsx:326-333,405` | `tests/chrome/status-line.spec.tsx`, `chrome-rules.spec.ts` | Only the canvas. The branch/changed-file facts it shows are also in the left panel and the Git tab |
| Terminal dock | `dock/dock-controller.ts:30`, `dock/dock-model.ts` (three modes), `dock/dock-tabs.ts:28` (plain shells), `dock/TerminalDockPanel.tsx:26`, `dock/DockButtons.tsx:28` (the strip's dock buttons), `dock/DockColumns.tsx` (`CenterColumn`/`RightColumn`), `dock/dock-hooks.tsx:9` (`dockShellHooks`), `dock/terminal-stack.ts`; wired `client/index.ts:104-105` and `:260-273`, strip `TabStrip.tsx:282`, palette commands `palette/palette-commands.ts:56-58` and `use-workspace-palette.ts:64-66` | `tests/dock/` (`dock-rules`, `dock-views`), `tests/terminal/terminal-size.spec.ts`, `tests/comments/comments.spec.tsx` (paste targets) | The strip's right-side buttons, three palette commands, the comments paste-target list, `applyAdvancedShell`'s hooks. Removing the dock leaves one terminal system (the canvas PTY) and simplifies the frame's right column; the panel's hide-don't-unmount rule must survive in the new panel |
| IDE Settings sections | Tabs: `tabs/tabs-settings-plugin.ts` + `tabs/TabsPanel.tsx` (depends on `TabTypesState` + `TabRegistry` + `WORKSPACE_SURFACE_ACTIONS`); Command palette: `palette/palette-settings-plugin.ts` + `palette/PalettePanel.tsx` + `PaletteConfigState`; Shortcuts: `ide/acryl-shortcuts/src/client/index.ts:47-56`; Built-in plugins: DSH's `ui-settings-plugins` section (title "Built-in plugins") | `tests/settings/section-plugins.spec.ts`, `tests/tabs/tabs-rules.spec.ts`, `tests/palette/` | The `+` menu's "Add your own tab type..." (`NewTabMenu.tsx:172`, error fallback `:106`) opens the Tabs section; the palette's "what it lists" config is edited there; the shortcut catalog UI lists bindings; the plugin navigator (part 6) replaces the built-in inventory |

The mockup's "Dropped: a separate terminal dock" is unambiguous: terminals become tabs. Its "Dropped: IDE
Settings sections" names Tabs, Command palette, Shortcuts, Built-in plugins; Agents, Models, General and
Support stay.

## Slice map

| Slice | Parts | Deliverable |
| --- | --- | --- |
| 1. Right panel | 1, 2, 3, 4, 5 (Git tab), 8 (Review, Checks, Comments, status bar, dock) | The strip with `+` in the right panel; chat with History; Claude/Codex/Pi and Terminal as PTY tabs; Files with fuzzy search and highlighted file tabs; Git with changes and history; the centre is only the app |
| 2. Left panel | 5 (branches, open items, Versions), 1 (panel persistence), 7 (Build/Preview switch), 8 (IDE-only removals) | Branches with their open items; Versions; the Build/Preview switch; the dropped parts |
| 3. Settings | 6 | The Plugins navigator, with source, state and on/off |
| 4. Production modes | 7 | Feedback with the pinpoint picker; the assistant that drives the UI without changing the app |

## Questions the mini-design must settle

1. **The right panel is session-scoped today; the new one is frame-scoped.** DSH's `sidebarRight` opens tabs
   per chat session (`tab-domain.ts:33-37`) and the frame's toggle only works while a session is current
   (`ide/acryl-workspace/src/client/index.ts:204-223`). The mockup's panel must exist with no chat running,
   be branch-scoped, and hold the chat itself. Extend/observe `sidebarRight`, or introduce a frame-owned tab
   service that reuses its tab bodies? The Files/Changes tab registrations (`sidebar.right.pane.tab`) are the
   port pattern either way.
2. **Where the conversation renders.** The chat is the `main` keyed slot for the current session
   (`AdvancedFrame.tsx:106-113`), not a standalone component. A right-panel tab must render that same slot
   (pass `renderConversation` through the panel host) or the chat becomes a second, divergent chat. This is
   the riskiest part of slice 1.
3. **One tab set per branch.** Today a tab set per worktree (`WorkspaceGroups`) with the strip in the centre.
   If branches replace worktrees in the left panel, what is the map key: worktree path (as today), branch
   name, or both? A branch with no worktree has no tab set and no place to spawn a PTY.
4. **The two terminal systems.** Canvas PTY tiles and dock shell tabs share `TerminalRegistry` but not their
   state. Slice 1 merges them; the dock's three layout modes and the canvas's split both disappear with the
   centre, but the panel's own hide-vs-unmount behavior must be decided.
5. **Tab persistence after the move.** Today per worktree in `acryl-workspace:v1`, chats restored from the
   session list, terminals by Host id. The right panel's own open state and width need a home (the layout
   service, the workspace storage, or a new key). Remembering both panels open on first run is part of the
   Decided table.
6. **Versions is new Host surface.** No log, restore, push or pull route exists; `saveApp` is the only save
   path. Decide the version model (commits, save points, or Blend snapshots), the restore semantics, and
   where "shared" is recorded.
7. **History and dismissal.** Dismissed chats are hidden from the tree and the strip but still in the DSH
   list. Reopening one from History must define whether it becomes open again (clear the dismissal) or opens
   as a tab while the tree stays hidden.
8. **The plugin navigator's provenance.** Lifecycle has enable/disable, version, mutable, dependents; the
   inventory has descriptions/meta; neither has an author. Decide the projection and whether the lifecycle
   contract grows a source/author field, or the client joins ledger + Blend rows + package metadata.
9. **Settings scope.** Tabs and Command palette sections are dropped; the `workspaceTabs` registry and the
   palette config lose their settings UI. Do plugin tab types stay in the `+` menu (always on), and does the
   palette remain (as a keyboard-only feature) with a fixed item list?
10. **Production is a composition or a mode.** `npm start` (no frame) and `npm run dev` (frame) are two
    compositions today; the mockup wants Build/Preview/Production in one running app, with
    `ACRYL_PRODUCTION_KEEP` continuing to gate the development rows. Decide whether Production is a row
    filter at boot, a runtime switch, or both, and how the frame token scopes it.
11. **Feedback screenshots.** Nothing captures a shot today. The picker can name the element; the image needs
    a real capture path. Decide before building the feedback plugin.
12. **Assistant enforcement layer.** The read-only profile must live where a direct caller cannot bypass it
    (the door/agent-control boundary), and full-access sessions must not silently re-enable mutations.
13. **Review/Checks/Comments removal edges.** The diff pane's send-to-agent action, the editor's comment
    gutter, the run-check terminal path and the Comments paste targets each have one dependent outside their
    own package; name the replacement behavior or remove the action, not just the tab.
14. **Browser tab vs first-run app tile.** The first-run app page is a browser tile today; the canvas becomes
    the app. Keep the tile as an internal "app view" or replace it with a dedicated canvas surface? The tile
    model, its persistence and the BrowserPane tests follow the answer.

## Verification pointers (for the implementation slices)

- Frame gate: `scripts/verify-ide-template.mjs` (scaffold, install, boot, real Chrome, panels, Settings,
  PTY, door, tile, chat); the panel and PTY-driver steps are at `243-261`, the Settings and chat steps below
  them. It already drives the tab strip and the chat.
- Unit gates per part: the test paths named in each part; `pnpm run check` at the root (build + typecheck +
  test + workflow lint) is the full gate.
- The plugin navigator's toggles: `ide/acryl-plugin-admin/tests/lifecycle` proves enable/disable/reload,
  protected entries and dependents; extend it rather than add a parallel lifecycle.
- The assistant's read-only profile: `acryl/plugins/acryl-agent-control/tests` (approval and audit) and
  `acryl/apps/acryl-web/tests/workspace-shared.spec.ts` (the ui_* tools on a real page) are the existing
  end-to-end evidence.
