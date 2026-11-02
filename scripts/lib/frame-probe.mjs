/**
 * What every surface of the ACRYL frame must show, asserted through a DevTools connection to the page: the left panel (Projects and its rows), the right
 * panel (Files, Changes, Review), Settings with its sections, and the app's own page in the frame's browser tile. The selectors and the way each surface is
 * opened are the frame gate's (`scripts/verify-ide-template.mjs`), which checks the same things in headless Chrome; the desktop gate checks them in the
 * Electron window. `evaluate` runs an expression in the page and returns its value.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function until(fn, ms, every = 300) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const value = await fn().catch(() => undefined)
    if (value) return value
    await sleep(every)
  }
}

/** `evaluate` over a DevTools session, by value; an exception in the page is a thrown error with its text. */
export function evaluator(session) {
  return async (expression) => {
    const answer = await session.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    const details = answer.result?.exceptionDetails
    if (details !== undefined)
      throw new Error(details.exception?.description ?? details.text ?? 'evaluation failed')
    return answer.result?.result?.value
  }
}

/**
 * Assert the frame. `appText` is text the app's own page shows in the tile. Returns what it found, for the gate's log; throws with what the page held when a
 * surface is missing.
 */
export async function assertFrame(evaluate, { appText, timeoutMs = 30_000 }) {
  const click = (label) =>
    evaluate(`(() => {
      const element = [...document.querySelectorAll('button,[role=button],[role=menuitem],a')]
        .find(candidate => candidate.getAttribute('aria-label') === ${JSON.stringify(label)} || candidate.textContent.trim() === ${JSON.stringify(label)})
      if (element === undefined) return false
      element.click()
      return true
    })()`)
  const body = () => evaluate(`document.body?.innerText?.slice(0, 1500) ?? ''`)

  const left = await until(async () => {
    const snapshot = await evaluate(`(() => {
      const side = document.querySelector('.dshWorkspaceSide')
      return { head: side?.querySelector('.dshWorkspaceSideProjectsHead') != null, rows: side?.querySelectorAll('[role=treeitem]').length ?? 0 }
    })()`)
    return snapshot?.head === true && snapshot.rows >= 1 ? snapshot : undefined
  }, timeoutMs)
  if (left === undefined)
    throw new Error(`the left panel has no Projects/session rows: ${JSON.stringify(await body())}`)

  const tile = await until(
    () =>
      evaluate(`(() => {
        const frame = document.querySelector('iframe.dshWorkspaceBrowserFrame')
        const text = frame?.contentDocument?.body?.innerText ?? ''
        return text.includes(${JSON.stringify(appText)}) ? text.slice(0, 120) : undefined
      })()`),
    timeoutMs,
  )
  if (tile === undefined)
    throw new Error(
      `the app's page is not in the frame's browser tile: ${JSON.stringify(
        await evaluate(`(() => {
          const frame = document.querySelector('iframe.dshWorkspaceBrowserFrame')
          return { src: frame?.getAttribute('src') ?? null, text: frame?.contentDocument?.body?.innerText?.slice(0, 200) ?? null }
        })()`),
      )}`,
    )

  const right = await until(async () => {
    const snapshot = await evaluate(`(() => {
      const bar = document.querySelector('[data-acryl-slot=rightbar]')
      if (bar === null || !bar.innerText.includes('Changes')) return undefined
      const labels = [...bar.querySelectorAll('button,[role=tab]')]
        .map(element => element.getAttribute('aria-label') ?? element.getAttribute('title') ?? element.textContent.trim())
        .filter(Boolean)
      return { text: bar.innerText.slice(0, 600), labels: labels.slice(0, 60) }
    })()`)
    if (snapshot !== undefined) return snapshot
    await click('Show right panel')
    return undefined
  }, timeoutMs)
  if (right === undefined) throw new Error('the right panel did not open with its views')
  const rightText = `${right.text}\n${right.labels.join('\n')}`
  for (const label of ['Changes', 'Review'])
    if (!rightText.includes(label))
      throw new Error(`the right panel has no ${label} view: ${rightText}`)
  if (!rightText.includes('Files') && !rightText.includes('Code'))
    throw new Error(`the right panel has no files view: ${rightText}`)

  // Settings the way a person opens it (the left panel's foot), pressed only while no Settings dialog is up; only a visible dialog whose nav has a real section counts.
  const opened = await until(
    () =>
      evaluate(`(() => {
        const isSection = (button) => ['Models', '模型'].includes((button.getAttribute('aria-label') ?? '').trim() || (button.textContent ?? '').replace(/\\s+/g, ' ').trim())
        const open = [...document.querySelectorAll('[role=dialog]')].some((dialog) =>
          dialog.getClientRects().length > 0 && [...dialog.querySelectorAll('nav button')].some(isSection))
        if (open) return true
        const buttons = [...document.querySelectorAll('.dshWorkspaceSide button')].filter((candidate) =>
          (candidate.getAttribute('aria-label') ?? candidate.textContent.trim()) === 'Settings')
        for (const button of buttons) button.click()
        if (buttons.length === 0)
          [...document.querySelectorAll('button[aria-haspopup="dialog"]')]
            .find((button) => ['Settings', '设置'].includes(button.getAttribute('aria-label') ?? ''))?.click()
        return false
      })()`),
    timeoutMs,
    500,
  )
  if (opened !== true) throw new Error(`Settings did not open: ${JSON.stringify(await body())}`)
  const settingsText = await until(async () => {
    const text = await evaluate(`(() => {
      const labels = [...document.querySelectorAll('button,[role=tab],[role=menuitem],a')]
        .map(element => element.getAttribute('aria-label') ?? element.textContent.trim()).filter(Boolean)
      return document.body.innerText.slice(-4000) + '\\n' + labels.slice(0, 120).join('\\n')
    })()`)
    return /Shortcuts/iu.test(text) ? text : undefined
  }, 15_000)
  if (settingsText === undefined)
    throw new Error(`Settings did not render: ${JSON.stringify(await body())}`)
  const sections = ['General', 'Models', 'Plugins', 'Support', 'Shortcuts']
  const missing = sections.filter((section) => !new RegExp(section, 'iu').test(settingsText))
  if (missing.length > 0) throw new Error(`Settings is missing ${missing.join(', ')}`)

  return { rows: left.rows, tile: tile.trim().split('\n')[0], sections }
}
