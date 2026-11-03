// @vitest-environment jsdom

/** The app page's frame belongs to the canvas, not to the frame's chrome: hiding or showing the right panel and switching its tabs re-renders the
 * frame around it, and the canvas iframe must be the same element throughout - anything else would reload the app under a running agent (section 31,
 * A.6 and B.3). */

import { act, cleanup, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { AppCanvasState } from '../../src/client/app-canvas.ts'
import { AppCanvas } from '../../src/client/AppCanvas.tsx'

afterEach(cleanup)

function Frame({ canvas }: { canvas: AppCanvasState }) {
  const [details, setDetails] = useState('380px')
  const [tab, setTab] = useState('chat')
  return (
    <div>
      <button type="button" onClick={() => { setDetails((width) => (width === '0px' ? '380px' : '0px')) }}>panel</button>
      <button type="button" onClick={() => { setTab((current) => (current === 'chat' ? 'files' : 'chat')) }}>tab</button>
      <AppCanvas canvas={canvas} />
      <aside style={{ width: details }} data-tab={tab} />
    </div>
  )
}

const frame = (): HTMLIFrameElement => {
  const found = document.querySelector('iframe')
  if (found === null) throw new Error('the canvas rendered no frame')
  return found as HTMLIFrameElement
}

describe('AppCanvas identity', () => {
  it('keeps one frame while the right panel hides and shows and its tabs switch', () => {
    const canvas = new AppCanvasState()
    canvas.setAddress(`${window.location.origin}/app`)
    const { getByText } = render(<Frame canvas={canvas} />)
    const first = frame()
    act(() => { getByText('panel').click() })
    expect(frame()).toBe(first)
    act(() => { getByText('tab').click() })
    expect(frame()).toBe(first)
    act(() => { getByText('panel').click() })
    act(() => { getByText('tab').click() })
    expect(frame()).toBe(first)
    expect(first.getAttribute('src')).toBe(`${window.location.origin}/app`)
  })
})
