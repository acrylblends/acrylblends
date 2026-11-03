/** The frame's look, taken from the owner's mockup (docs/design/blends-frame-mockup.html): a dark workbench around the app's own light page. */

const STYLE_ID = 'acryl-blends-frame-styles'

const CSS = `
/* DSH's dialogs and menus on the frame's dark surface, and its active Settings section in the frame's accent: the mockup's Settings. */
html body[data-ds-dark-theme] { --dsw-alias-bg-layer-2: #18181b; --dsw-specific-sidebar-nav-item-active: rgba(84,104,255,.16); }
.acrylBlendsFrame, .acrylBlendsPlugins {
  --bf-bg: #0b0b0d; --bf-side: #111113; --bf-surface: #18181b; --bf-surface-2: #222226; --bf-border: #2a2a2f;
  --bf-text: #e8e8ea; --bf-dim: #8b8b93; --bf-accent: #5468ff; --bf-accent-dim: rgba(84,104,255,.16); --bf-ok: #3fb67b; --bf-warn: #e0a43a;
  --bf-lw: 248px; --bf-rw: 412px;
}
.acrylBlendsFrame {
  position: fixed; inset: 0; display: grid; grid-template-rows: 38px minmax(0, 1fr);
  background: var(--bf-bg); color: var(--bf-text); color-scheme: dark;
  font: 13px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.acrylBlendsFrame[data-left="closed"] { --bf-lw: 0px; }
.acrylBlendsFrame[data-right="closed"] { --bf-rw: 0px; }
.acrylBlendsFrame button { font: inherit; }
.acrylBlendsFrame *, .acrylBlendsFrame *::before, .acrylBlendsFrame *::after { box-sizing: border-box; }

.acrylBlendsBar { display: flex; align-items: center; gap: 10px; padding: 0 10px; border-bottom: 1px solid var(--bf-border); background: var(--bf-side); -webkit-app-region: drag; }
.acrylBlendsBar button { -webkit-app-region: no-drag; }
body[data-dsh-desktop-platform="darwin"] .acrylBlendsBar { padding-left: 78px; }
.acrylBlendsAppName { font-weight: 600; white-space: nowrap; }
.acrylBlendsAppName small { color: var(--bf-dim); font-weight: 400; margin-left: 6px; font-size: 12px; }
.acrylBlendsGrow { flex: 1; }
.acrylBlendsIconButton { width: 28px; height: 26px; display: grid; place-items: center; border-radius: 6px; border: 0; background: transparent; color: #b8b8c0; cursor: pointer; }
.acrylBlendsIconButton:hover:not(:disabled) { background: var(--bf-surface-2); }
.acrylBlendsIconButton[aria-pressed="true"] { color: #fff; background: var(--bf-surface-2); }
.acrylBlendsIconButton:disabled { opacity: .4; cursor: default; }
.acrylBlendsIconButton svg { width: 16px; height: 16px; }
.acrylBlendsSettings { display: contents; }
.acrylBlendsModes { display: flex; border: 1px solid var(--bf-border); border-radius: 7px; overflow: hidden; }
.acrylBlendsModes button { font-size: 12px; padding: 3px 10px; border: 0; background: transparent; color: var(--bf-dim); cursor: pointer; }
.acrylBlendsModes button[aria-pressed="true"] { background: var(--bf-accent-dim); color: #fff; }

.acrylBlendsBody { display: grid; grid-template-columns: var(--bf-lw) minmax(0, 1fr) var(--bf-rw); min-height: 0; }
.acrylBlendsLeft, .acrylBlendsRight { background: var(--bf-side); min-width: 0; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.acrylBlendsLeft[hidden], .acrylBlendsRight[hidden] { display: none; }
/* Placed by column, so a hidden panel leaves its (zero-width) track empty instead of letting the app move into it. */
.acrylBlendsLeft { grid-column: 1; } .acrylBlendsCanvas { grid-column: 2; } .acrylBlendsRight { grid-column: 3; }
.acrylBlendsLeft, .acrylBlendsCanvas, .acrylBlendsRight { grid-row: 1; }
.acrylBlendsLeft { border-right: 1px solid var(--bf-border); overflow-y: auto; }
.acrylBlendsRight { border-left: 1px solid var(--bf-border); }

.acrylBlendsPaneHead { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px 6px; }
.acrylBlendsPaneHead .acrylBlendsSmallButton { flex: none; white-space: nowrap; }
.acrylBlendsLabel { color: var(--bf-dim); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
.acrylBlendsList { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1px; padding: 0 6px; }
.acrylBlendsSmallButton { font-size: 11px; color: #c8c8d0; background: var(--bf-surface-2); border: 1px solid #2f2f35; border-radius: 6px; padding: 2px 8px; cursor: pointer; }
.acrylBlendsSep { height: 1px; background: var(--bf-border); margin: 10px 12px; flex: none; }
.acrylBlendsNote { margin: 4px 8px; color: var(--bf-dim); font-size: 12px; }
/* Under a chat answer that changed the app (the mockup's .tool line): what it edited and the version it was saved as. */
.acrylBlendsTurnSave { margin: 6px 0 2px; color: var(--bf-dim); font: 11px/1.4 ui-monospace, "SF Mono", Menlo, monospace; overflow-wrap: anywhere; }
.acrylBlendsNote[data-error] { color: #f87171; }
.acrylBlendsMeta { margin-left: auto; color: var(--bf-dim); font-size: 11px; font-weight: 400; white-space: nowrap; }
.acrylBlendsDot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #55555c; flex: none; }
.acrylBlendsDot[data-live] { background: var(--bf-ok); }

.acrylBlendsBranchRow { display: flex; align-items: center; }
.acrylBlendsCaretButton { display: flex; align-items: center; justify-content: center; width: 18px; height: 24px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--bf-dim); cursor: pointer; flex: none; }
.acrylBlendsCaretButton:hover { background: var(--bf-surface-2); color: #e2e2e6; }
.acrylBlendsCaretSpace { width: 18px; height: 24px; flex: none; }
.acrylBlendsBranch { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; padding: 5px 8px; border: 0; border-radius: 6px; background: transparent; color: #e2e2e6; font-weight: 600; white-space: nowrap; cursor: pointer; text-align: left; }
.acrylBlendsBranch:hover { background: var(--bf-surface-2); }
.acrylBlendsBranch svg { width: 13px; height: 13px; color: var(--bf-dim); flex: none; }
.acrylBlendsCaret { width: 10px; height: 10px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.4; transition: transform .12s ease; }
.acrylBlendsCaret[data-open] { transform: rotate(90deg); }
.acrylBlendsBranchName { overflow: hidden; text-overflow: ellipsis; }
.acrylBlendsAsk { margin: 2px 8px 6px 22px; padding: 7px 8px; border: 1px solid #34343a; border-radius: 6px; background: var(--bf-surface-2); }
.acrylBlendsAsk p { margin: 0 0 7px; color: var(--bf-dim); font-size: 12px; }
.acrylBlendsAskActions { display: flex; gap: 6px; }
.acrylBlendsAskActions button { white-space: nowrap; }
.acrylBlendsBranchGroup > .acrylBlendsNote { margin: 2px 8px 6px 22px; }
.acrylBlendsItem { display: flex; align-items: center; gap: 7px; width: 100%; padding: 4px 8px 4px 30px; border: 0; border-radius: 6px; background: transparent; color: #cfcfd6; white-space: nowrap; cursor: pointer; text-align: left; }
.acrylBlendsItem:hover { background: var(--bf-surface-2); }
.acrylBlendsItem[aria-current] { background: var(--bf-accent-dim); color: #fff; }
.acrylBlendsItemIcon { width: 16px; font: 10px ui-monospace, Menlo, monospace; color: var(--bf-dim); text-align: center; flex: none; }
.acrylBlendsItemTitle { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.acrylBlendsItem .acrylBlendsItemTitle { flex: 0 1 auto; }
.acrylBlendsItemMeta { flex: 0 0 auto; max-width: 45%; overflow: hidden; text-overflow: ellipsis; }

.acrylBlendsVersion { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 6px 8px; border-radius: 6px; color: #d4d4da; white-space: nowrap; }
.acrylBlendsVersion[data-back] { cursor: pointer; }
.acrylBlendsVersion[data-back]:hover { background: var(--bf-surface-2); }
.acrylBlendsBackAsk { margin-left: 8px; }
.acrylBlendsBackAsk p[data-error] { color: #f0a0a0; }
.acrylBlendsVersion[aria-current] { background: var(--bf-accent-dim); color: #fff; }
.acrylBlendsVersionDot { width: 7px; height: 7px; border-radius: 2px; border: 1.5px solid #77777f; flex: none; }
.acrylBlendsVersion[aria-current] .acrylBlendsVersionDot { background: var(--bf-accent); border-color: var(--bf-accent); }
.acrylBlendsSaveForm { padding: 0 12px 6px; }
.acrylBlendsSaveForm input, .acrylBlendsSearch { width: 100%; box-sizing: border-box; padding: 5px 8px; border: 1px solid #34343a; border-radius: 6px; background: var(--bf-surface); color: var(--bf-text); font: inherit; }
.acrylBlendsLeftFoot { margin-top: auto; padding: 10px 12px; display: flex; align-items: center; gap: 8px; color: var(--bf-dim); border-top: 1px solid var(--bf-border); white-space: nowrap; }

.acrylBlendsCanvas { position: relative; min-width: 0; min-height: 0; display: flex; flex-direction: column; background: #fff; }
.acrylBlendsCanvasPage { flex: 1; min-height: 0; display: flex; }
.acrylAppCanvasFrame { flex: 1; display: block; width: 100%; height: 100%; border: 0; background: #fff; }
.acrylBlendsBackbar { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 6px; background: var(--bf-accent); color: #fff; font-size: 12px; }
.acrylBlendsCanvasTools { position: absolute; top: 10px; right: 10px; z-index: 4; display: flex; align-items: center; gap: 8px; }
.acrylBlendsSelectButton { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 1px solid #d8d4ca; border-radius: 7px; background: rgba(255,255,255,.96); color: #3a3a40; font-size: 12px; cursor: pointer; box-shadow: 0 3px 12px rgba(0,0,0,.12); }
.acrylBlendsSelectButton svg { width: 13px; height: 13px; }
.acrylBlendsSelectButton:hover { background: #fff; border-color: #b9b3a4; }
.acrylBlendsSelectButton[aria-pressed="true"] { background: #e0a43a; border-color: #e0a43a; color: #1d1c1a; }
.acrylBlendsPickingHint { padding: 4px 9px; border-radius: 7px; background: rgba(29,28,26,.86); color: #fff; font-size: 11.5px; white-space: nowrap; }

.acrylBlendsTabs { position: relative; flex: none; border-bottom: 1px solid var(--bf-border); }
.acrylBlendsTabStrip { display: flex; align-items: center; gap: 2px; padding: 6px 8px 0; overflow-x: auto; scrollbar-width: none; }
.acrylBlendsTabStrip::-webkit-scrollbar { display: none; }
.acrylBlendsTabWrap { position: relative; display: flex; flex: none; }
.acrylBlendsTab { padding: 6px 7px; border: 0; border-radius: 6px 6px 0 0; background: transparent; color: var(--bf-dim); display: flex; align-items: center; gap: 6px; white-space: nowrap; cursor: pointer; font-size: 12px; }
.acrylBlendsTab:hover { color: #d4d4da; }
.acrylBlendsTab[aria-selected="true"] { color: #fff; box-shadow: inset 0 -2px 0 var(--bf-accent); }
.acrylBlendsTabKind { font-size: 10px; color: #77777f; }
.acrylBlendsTabClose { width: 16px; height: 16px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--bf-dim); font-size: 13px; line-height: 1; cursor: pointer; display: grid; place-items: center; }
.acrylBlendsTabWrap .acrylBlendsTabClose { position: absolute; top: 2px; right: -4px; opacity: 0; background: var(--bf-side); }
.acrylBlendsTabWrap:hover .acrylBlendsTabClose, .acrylBlendsTabClose:focus-visible { opacity: 1; }
.acrylBlendsTabClose:hover { background: var(--bf-surface-2); color: #fff; }
.acrylBlendsPlus { margin-left: 2px; flex: none; position: sticky; right: 0; background: var(--bf-side); }
.acrylBlendsMenu { position: absolute; top: 34px; left: 8px; z-index: 5; width: 230px; background: var(--bf-surface); border: 1px solid #34343a; border-radius: 8px; padding: 6px; box-shadow: 0 10px 30px rgba(0,0,0,.45); }
.acrylBlendsMenuHead { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--bf-dim); padding: 6px 8px 2px; }
.acrylBlendsMenuItem { display: flex; gap: 8px; align-items: center; width: 100%; padding: 6px 8px; border: 0; border-radius: 6px; background: transparent; color: #e2e2e6; font-size: 13px; text-align: left; cursor: pointer; }
.acrylBlendsMenuItem:hover:not([data-gone]) { background: var(--bf-surface-2); }
.acrylBlendsMenuItem small { color: var(--bf-dim); margin-left: auto; font-size: 11px; }
.acrylBlendsMenuItem[data-gone] { color: #66666e; text-decoration: line-through; cursor: default; }
.acrylBlendsNotice { display: flex; gap: 8px; align-items: flex-start; margin: 8px 10px 0; padding: 6px 9px; border-radius: 7px; background: rgba(224,164,58,.12); color: #f0d6a4; font-size: 11.5px; flex: none; }
.acrylBlendsNotice .acrylBlendsTabClose { margin-left: auto; flex: none; }
.acrylBlendsChatPane { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.acrylBlendsChatPane[hidden] { display: none; }

.acrylBlendsTerm { flex: 1; min-height: 0; position: relative; display: flex; background: #0a0a0b; padding: 12px; }
.acrylBlendsTermScreen { flex: 1; min-width: 0; min-height: 0; }
.acrylBlendsTermScreen .xterm { width: 100%; height: 100%; }
.acrylBlendsTermScreen .xterm .xterm-viewport { background-color: #0a0a0b; scrollbar-width: thin; scrollbar-color: #3a3a40 transparent; }
.acrylBlendsTermNote { position: absolute; left: 12px; bottom: 8px; margin: 0; color: var(--bf-dim); font-size: 11px; }
.acrylBlendsTermNote[data-error] { color: #f87171; }
.acrylBlendsPtyNote { flex: none; margin: 0; font-size: 11px; color: var(--bf-dim); padding: 6px 12px; border-top: 1px solid var(--bf-border); }

.acrylBlendsFiles, .acrylBlendsFile, .acrylBlendsGit { flex: 1; min-height: 0; overflow: auto; padding: 10px 8px; }
.acrylBlendsFsearch { display: flex; gap: 8px; align-items: center; border: 1px solid var(--bf-accent); border-radius: 7px; padding: 5px 9px; margin: 0 0 8px; }
.acrylBlendsFsearch input { flex: 1; min-width: 0; border: 0; outline: 0; padding: 0; background: transparent; color: #fff; font: inherit; }
.acrylBlendsFsearch input::placeholder { color: var(--bf-dim); }
.acrylBlendsFsearch kbd { font: 10.5px ui-monospace, Menlo, monospace; color: var(--bf-dim); }
.acrylBlendsFres { margin-bottom: 10px; border-bottom: 1px solid var(--bf-border); padding-bottom: 8px; }
.acrylBlendsFres .acrylBlendsMeta { font-size: 10.5px; }
.acrylBlendsFrow { display: flex; gap: 8px; align-items: center; width: 100%; min-width: 0; padding: 4px 8px; border: 0; border-radius: 5px; background: transparent; color: #d4d4da; font-size: 13px; text-align: left; white-space: nowrap; }
button.acrylBlendsFrow { cursor: pointer; }
button.acrylBlendsFrow:hover { background: var(--bf-surface-2); }
.acrylBlendsFrow[aria-selected="true"], .acrylBlendsFrow[aria-current="true"] { background: var(--bf-accent-dim); color: #fff; }
.acrylBlendsFrow b { color: var(--bf-warn); font-weight: 600; }
.acrylBlendsFrowName { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.acrylBlendsHint { color: var(--bf-dim); font-size: 11.5px; padding: 10px 8px 0; margin: 0; }
.acrylBlendsGm { color: var(--bf-warn); font: 11px ui-monospace, Menlo, monospace; flex: none; }
.acrylBlendsGitLabel { padding: 4px 2px 8px; }
.acrylBlendsGitLabel[data-second] { padding-top: 14px; }
.acrylBlendsGitRemote { display: flex; align-items: center; gap: 6px; padding: 2px 8px 4px; font-size: 13px; color: #d4d4da; }
.acrylBlendsGitRemoteState { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.acrylBlendsGitRemote .acrylBlendsSmallButton { flex: none; }
.acrylBlendsSmallButton:disabled { opacity: .45; cursor: default; }
/* git's lines can carry a long path or URL: they wrap inside the panel. */
.acrylBlendsGit .acrylBlendsNote { overflow-wrap: anywhere; }

.acrylBlendsFile pre { margin: 0; font: 12px/1.6 ui-monospace, "SF Mono", Menlo, monospace; color: #d6d6dc; white-space: pre; }
.acrylBlendsLine { min-height: 1.6em; }
.acrylBlendsLn { color: #55555c; display: inline-block; margin-right: 1ch; text-align: right; user-select: none; }
.acrylBlendsTok-kw { color: #c678dd; } .acrylBlendsTok-fn { color: #61afef; } .acrylBlendsTok-st { color: #98c379; }
.acrylBlendsTok-ty { color: #e5c07b; } .acrylBlendsTok-pu { color: #abb2bf; } .acrylBlendsTok-va { color: #e06c75; }
.acrylBlendsTok-cm { color: #5c6370; font-style: italic; } .acrylBlendsTok-nu { color: #d19a66; }
.acrylBlendsChatHead { display: flex; align-items: center; gap: 8px; padding: 8px 10px 0; flex: none; }
.acrylBlendsHistoryButton { display: flex; align-items: center; gap: 5px; font-size: 11.5px; color: #c8c8d0; background: transparent; border: 1px solid #34343a; border-radius: 6px; padding: 3px 8px; cursor: pointer; }
.acrylBlendsHistoryButton[aria-pressed="true"] { background: var(--bf-accent-dim); color: #fff; }
.acrylBlendsChatTitle { color: var(--bf-dim); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.acrylBlendsHistory { flex: 1; overflow: auto; padding: 8px 10px; display: grid; gap: 2px; align-content: start; }
.acrylBlendsHistoryGroup { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--bf-dim); padding: 8px 9px 3px; }
.acrylBlendsHistoryRow { display: grid; gap: 1px; padding: 7px 9px; border: 0; border-radius: 6px; background: transparent; color: #d4d4da; cursor: pointer; text-align: left; }
.acrylBlendsHistoryRow:hover { background: var(--bf-surface-2); }
.acrylBlendsHistoryRow[aria-current] { color: #fff; }
.acrylBlendsHistoryRow small { color: var(--bf-dim); font-size: 11px; }
.acrylBlendsConversation { flex: 1; min-height: 0; position: relative; display: flex; flex-direction: column; }
.acrylBlendsConversation[hidden] { display: none; }
.acrylBlendsConversation > * { flex: 1; min-height: 0; }
.acrylBlendsSelectionChip { position: absolute; z-index: 2; display: inline-flex; align-items: center; gap: 4px; max-width: 60%; height: 18px; padding: 0 6px; border: 0; border-radius: 5px; background: var(--bf-surface-2); color: #c8c8d0; font-size: 11px; line-height: 18px; white-space: nowrap; }
.acrylBlendsSelectionChipLabel { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.acrylBlendsSelectionChipClear { width: 13px; height: 13px; padding: 0; border: 0; border-radius: 3px; background: transparent; color: #8b8b93; font-size: 12px; line-height: 1; cursor: pointer; display: grid; place-items: center; flex: none; opacity: 0; }
.acrylBlendsSelectionChip:hover .acrylBlendsSelectionChipClear, .acrylBlendsSelectionChipClear:focus-visible { opacity: 1; }
.acrylBlendsSelectionChipClear:hover { background: #34343a; color: #fff; }
/* First run (docs/design/blends-frame-mockup.html, scenario 1): a blank chat keeps the frame's shape, with DSH's composer at the bottom and none of
   its centered hero chrome (brand, headline, workspace picker). The composer is still DSH's own; only the blank-session presentation changes. */
.acrylBlendsConversation [data-phase="hero"] div:has(> [data-slot="conversation.composer"]) { margin-top: auto; }
.acrylBlendsConversation [data-phase="hero"] div:has(> [data-slot="conversation.composer.bar"]) { padding-bottom: 8px; }
.acrylBlendsConversation [data-phase="hero"] div:has(> [data-slot="conversation.composer.bar"]) > :not([data-slot="conversation.composer.bar"]):not([data-slot="conversation.input.dock"]) { display: none; }

.acrylBlendsPlugins { color: var(--bf-text, #e8e8ea); font-size: 13px; }
.acrylBlendsFeedbackNew { margin-left: auto; color: var(--bf-warn); font-size: 11px; }
.acrylBlendsFeedback { display: grid; gap: 2px; width: calc(100% - 12px); margin: 0 6px 4px; padding: 7px 9px; border: 0; border-radius: 6px; background: rgba(224,164,58,.14); color: #ecdcbc; font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.acrylBlendsFeedback { position: relative; padding-right: 56px; }
.acrylBlendsFeedback:hover { background: rgba(224,164,58,.22); }
.acrylBlendsFeedbackThumb { position: absolute; right: 7px; top: 7px; width: 42px; height: 32px; object-fit: cover; border-radius: 4px; border: 1px solid #34343a; background: #0b0b0d; }
.acrylBlendsFeedback[data-seen] { background: rgba(224,164,58,.07); color: #b9ad97; }
.acrylBlendsFeedback b { color: #fff; font-weight: 600; }
.acrylBlendsFeedback small { opacity: .75; font-size: 11px; }
.acrylBlendsShortcuts { padding: 14px 0; border-bottom: 1px solid var(--dsw-alias-border-l1, #26262b); font-size: 13px; }
.acrylBlendsShortcutsTitle { font-weight: 500; margin-bottom: 8px; }
.acrylBlendsShortcuts ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.acrylBlendsShortcuts li { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--dsw-alias-label-secondary, #a1a1aa); }
.acrylBlendsShortcutsKeys { display: inline-flex; gap: 3px; }
.acrylBlendsShortcutsKeys kbd { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 5px; background: rgb(127 127 127 / 16%); color: var(--dsw-alias-label-primary, #e8e8ea); font: 11px ui-sans-serif, system-ui, sans-serif; }
.acrylBlendsPlugins h3 { font-size: 15px; margin: 0 0 2px; color: #fff; }
.acrylBlendsPluginsSub { color: #8b8b93; font-size: 12px; margin: 0 0 12px; }
.acrylBlendsPluginsTools { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; align-items: center; }
.acrylBlendsPluginsTools .acrylBlendsSearch { flex: 1; width: auto; min-width: 160px; }
.acrylBlendsChip { font-size: 11px; border: 1px solid #34343a; border-radius: 99px; padding: 3px 10px; color: #c8c8d0; background: transparent; cursor: pointer; }
.acrylBlendsChip[aria-pressed="true"] { border-color: #5468ff; color: #fff; background: rgba(84,104,255,.16); }
.acrylBlendsPlug { display: grid; grid-template-columns: minmax(0,1fr) auto auto; gap: 4px 12px; align-items: center; padding: 9px 10px; border: 1px solid #2a2a2f; border-radius: 8px; margin-bottom: 6px; }
.acrylBlendsPlug b { color: #fff; font-weight: 600; font-size: 12.5px; }
.acrylBlendsPlug small { grid-column: 1; color: #8b8b93; font-size: 11.5px; }
.acrylBlendsPlugBy { font-size: 10.5px; color: #8b8b93; border: 1px solid #34343a; border-radius: 4px; padding: 1px 6px; grid-row: 1 / span 2; grid-column: 2; white-space: nowrap; }
.acrylBlendsPlugFixed { grid-row: 1 / span 2; grid-column: 3; font-size: 10.5px; color: #66666e; }
.acrylBlendsPlugState[data-state="ok"] { color: #3fb67b; } .acrylBlendsPlugState[data-state="warn"] { color: #e0a43a; }
.acrylBlendsShareButton { padding: 0; border: 0; background: transparent; color: var(--bf-accent); font: inherit; font-size: 11.5px; cursor: pointer; }
.acrylBlendsShareButton:hover:not(:disabled) { text-decoration: underline; }
.acrylBlendsShareButton:disabled { color: #66666e; cursor: default; }
.acrylBlendsShared { color: #8fb0ff; text-decoration: none; }
.acrylBlendsShared:hover { text-decoration: underline; }
.acrylBlendsBumpAsk { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; color: #e0a43a; }
.acrylBlendsBumpShare, .acrylBlendsBumpCancel { padding: 1px 7px; border: 1px solid #34343a; border-radius: 5px; background: var(--bf-surface-2); color: #cfcfd6; font: inherit; font-size: 11px; cursor: pointer; }
.acrylBlendsBumpShare { border-color: var(--bf-accent); color: #fff; background: var(--bf-accent-dim); }
.acrylBlendsTog { grid-row: 1 / span 2; grid-column: 3; width: 30px; height: 17px; border: 0; padding: 0; border-radius: 99px; background: #3a3a40; position: relative; cursor: pointer; }
.acrylBlendsTog::after { content: ""; position: absolute; top: 2px; left: 2px; width: 13px; height: 13px; border-radius: 50%; background: #fff; transition: left .12s ease; }
.acrylBlendsTog[aria-checked="true"] { background: #5468ff; }
.acrylBlendsTog[aria-checked="true"]::after { left: 15px; }
.acrylBlendsTog:disabled { opacity: .6; cursor: default; }

.acrylBlendsDialogBackdrop { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,.5); display: grid; place-items: center; }
.acrylBlendsDialog { position: relative; width: min(980px, 92vw); height: min(680px, 88vh); background: var(--bf-surface); border: 1px solid #34343a; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
.acrylBlendsDialog > :not(.acrylBlendsDialogClose) { flex: 1; min-height: 0; }
.acrylBlendsDialogClose { position: absolute; top: 8px; right: 10px; z-index: 2; width: 28px; height: 28px; border: 0; border-radius: 6px; background: transparent; color: var(--bf-dim); font-size: 18px; cursor: pointer; }
.acrylBlendsDialogClose:hover { background: var(--bf-surface-2); color: #fff; }
.acrylBlendsOverlay { position: fixed; inset: 0; pointer-events: none; z-index: 60; }
.acrylBlendsOverlay > * { pointer-events: auto; }
`

/** @returns disposer, for one owning `ctx.effect`. */
export function installFrameStyles(): () => void {
  if (document.getElementById(STYLE_ID) !== null) return () => {}
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  ;(document.head ?? document.documentElement).appendChild(style)
  return () => { style.remove() }
}
