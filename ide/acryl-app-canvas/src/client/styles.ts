/** The canvas fills the centre; the app draws itself inside its own document. */

const STYLE_ID = 'acryl-app-canvas-styles'

const css = `
.acrylAppCanvasFrame {
  display: block;
  width: 100%;
  height: 100%;
  margin: 0;
  border: 0;
  background: #fff;
}
`

/** @returns disposer removing the tag this call added. */
export function installAppCanvasStyles(): () => void {
  if (document.getElementById(STYLE_ID) !== null) return () => {}
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = css
  ;(document.head ?? document.documentElement).appendChild(style)
  return () => {
    style.remove()
  }
}
