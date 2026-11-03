/** The frame's look, taken from the owner's mockup (docs/design/blends-frame-mockup.html): a dark workbench around the app's own light page. */

const STYLE_ID = 'acryl-blends-frame-styles'

const CSS = `
.acrylBlendsFrame {
  --bf-bg: #0b0b0d; --bf-side: #111113; --bf-surface: #18181b; --bf-surface-2: #222226; --bf-border: #2a2a2f;
  --bf-text: #e8e8ea; --bf-dim: #8b8b93; --bf-accent: #5468ff; --bf-accent-dim: rgba(84,104,255,.16); --bf-ok: #3fb67b;
  --bf-lw: 248px; --bf-rw: 412px;
  position: fixed; inset: 0; display: grid; grid-template-rows: 38px minmax(0, 1fr);
  background: var(--bf-bg); color: var(--bf-text); color-scheme: dark;
  font: 13px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.acrylBlendsFrame[data-left="closed"] { --bf-lw: 0px; }
.acrylBlendsFrame[data-right="closed"] { --bf-rw: 0px; }
.acrylBlendsFrame button { font: inherit; }

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

.acrylBlendsPaneHead { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 6px; }
.acrylBlendsLabel { color: var(--bf-dim); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
.acrylBlendsList { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1px; padding: 0 6px; }
.acrylBlendsSmallButton { font-size: 11px; color: #c8c8d0; background: var(--bf-surface-2); border: 1px solid #2f2f35; border-radius: 6px; padding: 2px 8px; cursor: pointer; }
.acrylBlendsSep { height: 1px; background: var(--bf-border); margin: 10px 12px; flex: none; }
.acrylBlendsNote { margin: 4px 8px; color: var(--bf-dim); font-size: 12px; }
.acrylBlendsNote[data-error] { color: #f87171; }
.acrylBlendsMeta { margin-left: auto; color: var(--bf-dim); font-size: 11px; font-weight: 400; white-space: nowrap; }
.acrylBlendsDot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #55555c; flex: none; }
.acrylBlendsDot[data-live] { background: var(--bf-ok); }

.acrylBlendsBranch { display: flex; align-items: center; gap: 6px; width: 100%; padding: 5px 8px; border: 0; border-radius: 6px; background: transparent; color: #e2e2e6; font-weight: 600; white-space: nowrap; cursor: pointer; text-align: left; }
.acrylBlendsBranch:hover { background: var(--bf-surface-2); }
.acrylBlendsBranch svg { width: 13px; height: 13px; color: var(--bf-dim); flex: none; }
.acrylBlendsBranch .acrylBlendsCaret { width: 10px; height: 10px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.4; color: var(--bf-dim); transition: transform .12s ease; }
.acrylBlendsCaret[data-open] { transform: rotate(90deg); }
.acrylBlendsBranchName { overflow: hidden; text-overflow: ellipsis; }
.acrylBlendsItem { display: flex; align-items: center; gap: 7px; width: 100%; padding: 4px 8px 4px 30px; border: 0; border-radius: 6px; background: transparent; color: #cfcfd6; white-space: nowrap; cursor: pointer; text-align: left; }
.acrylBlendsItem:hover { background: var(--bf-surface-2); }
.acrylBlendsItem[aria-current] { background: var(--bf-accent-dim); color: #fff; }
.acrylBlendsItemIcon { width: 16px; font: 10px ui-monospace, Menlo, monospace; color: var(--bf-dim); text-align: center; flex: none; }
.acrylBlendsItemTitle { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.acrylBlendsVersion { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 6px 8px; border-radius: 6px; color: #d4d4da; white-space: nowrap; }
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

.acrylBlendsTabs { display: flex; align-items: center; gap: 2px; padding: 6px 8px 0; border-bottom: 1px solid var(--bf-border); flex: none; }
.acrylBlendsTab { padding: 6px 10px; border: 0; border-radius: 6px 6px 0 0; background: transparent; color: var(--bf-dim); display: flex; align-items: center; gap: 6px; white-space: nowrap; cursor: pointer; font-size: 12px; }
.acrylBlendsTab[aria-selected="true"] { color: #fff; box-shadow: inset 0 -2px 0 var(--bf-accent); }
.acrylBlendsTabKind { font-size: 10px; color: #77777f; }
.acrylBlendsChatHead { display: flex; align-items: center; gap: 8px; padding: 8px 10px 0; flex: none; }
.acrylBlendsHistoryButton { display: flex; align-items: center; gap: 5px; font-size: 11.5px; color: #c8c8d0; background: transparent; border: 1px solid #34343a; border-radius: 6px; padding: 3px 8px; cursor: pointer; }
.acrylBlendsHistoryButton[aria-pressed="true"] { background: var(--bf-accent-dim); color: #fff; }
.acrylBlendsChatTitle { color: var(--bf-dim); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.acrylBlendsHistory { flex: 1; overflow: auto; padding: 8px 10px; display: grid; gap: 2px; align-content: start; }
.acrylBlendsHistoryRow { display: flex; justify-content: space-between; gap: 8px; padding: 6px 8px; border: 0; border-radius: 6px; background: transparent; color: #d4d4da; cursor: pointer; text-align: left; }
.acrylBlendsHistoryRow:hover { background: var(--bf-surface-2); }
.acrylBlendsHistoryRow[aria-current] { color: #fff; }
.acrylBlendsHistoryRow small { color: var(--bf-dim); font-size: 11px; }
.acrylBlendsConversation { flex: 1; min-height: 0; position: relative; display: flex; flex-direction: column; }
.acrylBlendsConversation[hidden] { display: none; }
.acrylBlendsConversation > * { flex: 1; min-height: 0; }

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
