// The Feedback button on every page of the app (./index.ts serves this file and calls start with the routes' prefix). Plain browser code, no build:
// the button and its popover live in a shadow root, so the app's styles and these never touch. Pressing Feedback turns the picker on: the element
// under the pointer is outlined, a click pins it (the click does nothing else), and "Nothing specific" sends a note about the whole page.

const STYLE = `
:host { all: initial; }
* { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
.button { position: fixed; right: 16px; bottom: 16px; z-index: 2147483646; border: 0; border-radius: 99px; padding: 8px 14px; background: #1d1c1a; color: #fff; font-size: 12.5px; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.18); }
.button[aria-expanded="true"] { background: #c2410c; }
.pop { position: fixed; right: 16px; bottom: 58px; z-index: 2147483646; width: 320px; max-width: calc(100vw - 32px); background: #fff; color: #1d1c1a; border: 1px solid #e3dfd5; border-radius: 10px; padding: 10px 12px; box-shadow: 0 10px 30px rgba(0,0,0,.18); font-size: 12.5px; }
.pop[hidden] { display: none; }
b { font-weight: 600; }
.options { display: flex; gap: 6px; margin: 6px 0 2px; flex-wrap: wrap; }
.option { font-size: 11px; border: 1px solid #e3dfd5; border-radius: 99px; padding: 2px 9px; color: #77736b; background: transparent; cursor: pointer; text-align: left; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.option[aria-pressed="true"] { border-color: #e0a43a; background: #fdf3e2; color: #1d1c1a; }
textarea { display: block; width: 100%; min-height: 64px; resize: vertical; border: 1px solid #e3dfd5; border-radius: 6px; padding: 6px 8px; margin: 6px 0; color: #1d1c1a; font-size: 12.5px; }
textarea:focus { outline: none; border-color: #c2410c; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 10px; color: #77736b; font-size: 11px; }
.send { border: 0; border-radius: 6px; padding: 4px 11px; background: #c2410c; color: #fff; font-size: 12px; cursor: pointer; flex: none; }
.send:disabled { opacity: .5; cursor: default; }
.note[data-error] { color: #b42318; }
.outline { position: fixed; z-index: 2147483645; pointer-events: none; border: 2px dashed #e0a43a; border-radius: 6px; display: none; }
.outline[data-picked] { display: block; }
.outline span { position: absolute; right: 6px; top: -11px; background: #e0a43a; color: #1d1c1a; font-size: 10.5px; font-weight: 600; padding: 1px 7px; border-radius: 4px; white-space: nowrap; }
`

/** A short name for an element: what it says it is, else the words it shows, else its tag. */
export function elementLabel(element) {
  const named = element.getAttribute('aria-label') || element.getAttribute('title') || element.getAttribute('alt')
  if (named) return clip(named)
  const heading = element.querySelector('h1, h2, h3, h4, b, strong')
  const text = (heading?.textContent || element.textContent || '').replace(/\s+/g, ' ').trim()
  return text === '' ? element.tagName.toLowerCase() : `"${clip(text)}"`
}

function clip(text) {
  return text.length > 36 ? `${text.slice(0, 34).trimEnd()}…` : text
}

/** A CSS selector that finds the element again: up from it to the nearest id, each step its tag and place among its siblings. */
export function elementSelector(element) {
  const parts = []
  for (let node = element; node && node.nodeType === 1 && parts.length < 8; node = node.parentElement) {
    if (node.id) { parts.unshift(`#${cssEscape(node.id)}`); break }
    const tag = node.tagName.toLowerCase()
    if (tag === 'body' || tag === 'html') { parts.unshift(tag); break }
    const same = node.parentElement ? [...node.parentElement.children].filter((child) => child.tagName === node.tagName) : []
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(node) + 1})` : tag)
  }
  return parts.join(' > ')
}

function cssEscape(value) {
  return typeof globalThis.CSS?.escape === 'function' ? globalThis.CSS.escape(value) : value.replace(/[^A-Za-z0-9_-]/g, '\\$&')
}

function start(prefix) {
  if (document.querySelector('acryl-feedback')) return
  const host = document.createElement('acryl-feedback')
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = `<style>${STYLE}</style>
<div class="outline"><span></span></div>
<div class="pop" role="dialog" aria-label="Your feedback" hidden>
  <b>Your feedback</b>
  <div class="options">
    <button type="button" class="option" data-choice="element" aria-pressed="true">⌖ Click the element you mean</button>
    <button type="button" class="option" data-choice="page" aria-pressed="false">Nothing specific</button>
  </div>
  <textarea aria-label="Your note" placeholder="What happened, or what would help?" maxlength="2000"></textarea>
  <div class="row"><span class="note">Pressing Feedback turns the picker on; click anything, or choose "Nothing specific".</span><button type="button" class="send" disabled>Send</button></div>
</div>
<button type="button" class="button" aria-expanded="false">Feedback</button>`
  document.body.appendChild(host)

  const button = root.querySelector('.button')
  const pop = root.querySelector('.pop')
  const outline = root.querySelector('.outline')
  const outlineLabel = outline.querySelector('span')
  const onElement = root.querySelector('[data-choice="element"]')
  const nothing = root.querySelector('[data-choice="page"]')
  const text = root.querySelector('textarea')
  const send = root.querySelector('.send')
  const note = root.querySelector('.note')
  const hint = note.textContent

  /** @type {{ open: boolean, picking: boolean, picked: Element | null, choice: 'element' | 'page' }} */
  const state = { open: false, picking: false, picked: null, choice: 'element' }

  const place = (element, label) => {
    if (!element) { outline.removeAttribute('data-picked'); return }
    const box = element.getBoundingClientRect()
    Object.assign(outline.style, { left: `${box.left - 3}px`, top: `${box.top - 3}px`, width: `${box.width + 6}px`, height: `${box.height + 6}px` })
    outlineLabel.textContent = label
    outline.setAttribute('data-picked', '')
  }
  const render = () => {
    button.setAttribute('aria-expanded', String(state.open))
    pop.hidden = !state.open
    onElement.setAttribute('aria-pressed', String(state.choice === 'element'))
    nothing.setAttribute('aria-pressed', String(state.choice === 'page'))
    onElement.textContent = state.picked ? `⌖ On this element: ${elementLabel(state.picked)}` : '⌖ Click the element you mean'
    send.disabled = text.value.trim() === '' || (state.choice === 'element' && !state.picked)
    if (state.open && state.choice === 'element' && state.picked) place(state.picked, `Picked: ${elementLabel(state.picked)}`)
    else if (!state.picking) place(null)
  }
  const ours = (event) => event.composedPath().includes(host)
  const onMove = (event) => {
    if (!state.picking || ours(event)) return
    const target = event.target instanceof Element ? event.target : null
    if (target) place(target, elementLabel(target))
  }
  const onClick = (event) => {
    if (!state.picking || ours(event)) return
    event.preventDefault()
    event.stopPropagation()
    if (!(event.target instanceof Element)) return
    state.picked = event.target
    state.picking = false
    state.choice = 'element'
    render()
    text.focus()
  }
  const onKey = (event) => { if (event.key === 'Escape' && state.open) close() }
  const reposition = () => { if (state.open) render() }
  const open = () => {
    state.open = true
    state.picking = true
    state.picked = null
    state.choice = 'element'
    note.textContent = hint
    note.removeAttribute('data-error')
    render()
  }
  const close = () => {
    state.open = false
    state.picking = false
    state.picked = null
    render()
  }

  button.addEventListener('click', () => { if (state.open) close(); else open() })
  onElement.addEventListener('click', () => { state.choice = 'element'; state.picking = true; state.picked = null; render() })
  nothing.addEventListener('click', () => { state.choice = 'page'; state.picking = false; state.picked = null; render(); text.focus() })
  text.addEventListener('input', render)
  send.addEventListener('click', async () => {
    send.disabled = true
    const element = state.choice === 'element' && state.picked ? { selector: elementSelector(state.picked), label: elementLabel(state.picked) } : undefined
    try {
      const response = await fetch(`${prefix}/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: text.value, page: location.pathname + location.search, ...(element ? { element } : {}) }),
      })
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `sending failed (${response.status})`)
      text.value = ''
      close()
      button.textContent = 'Thanks, sent'
      setTimeout(() => { button.textContent = 'Feedback' }, 2500)
    } catch (error) {
      note.textContent = error instanceof Error ? error.message : 'sending failed'
      note.setAttribute('data-error', '')
      render()
    }
  })
  // agent-panel sits in the same corner: its button in development, the Assistant docked on the right in production. Stand to the left of whichever shows.
  const besideOthers = () => {
    const shadow = document.getElementById('agent-panel')?.shadowRoot
    const shown = (element) => element && getComputedStyle(element).display !== 'none' ? element.getBoundingClientRect() : null
    const box = shown(shadow?.querySelector('section.shown')) ?? shown(shadow?.querySelector('button.open'))
    const right = box && box.width > 0 ? `${Math.round(window.innerWidth - box.left + 8)}px` : ''
    button.style.right = right
    pop.style.right = right
  }
  for (const delay of [0, 500, 2000]) setTimeout(besideOthers, delay)
  window.addEventListener('agent-panel:layout', besideOthers)
  window.addEventListener('resize', besideOthers)
  document.addEventListener('mousemove', onMove, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKey, true)
  window.addEventListener('scroll', reposition, true)
  window.addEventListener('resize', reposition)
}
