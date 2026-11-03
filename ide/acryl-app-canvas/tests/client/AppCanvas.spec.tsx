// @vitest-environment jsdom

/** The centre renders a frame per address and per attempt: a navigation mounts a NEW frame, so a late load from an earlier address can never land on
 * the current one (docs/plans/ide-host-inversion.md section 30, the browser-tile cause). */

import { cleanup, render } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { AppCanvasState } from '../../src/client/app-canvas.ts'
import { AppCanvas } from '../../src/client/AppCanvas.tsx'

afterEach(() => {
  cleanup()
})

const frame = (container: HTMLElement): HTMLIFrameElement => {
  const found = container.querySelector('iframe')
  if (found === null) throw new Error('the canvas rendered no frame')
  return found as HTMLIFrameElement
}

describe('AppCanvas', () => {
  it('renders nothing until the Host serves an app', () => {
    const canvas = new AppCanvasState()
    const { container } = render(<AppCanvas canvas={canvas} />)
    expect(container.querySelector('iframe')).toBeNull()
  })

  it('renders the app page in one frame that is never re-pointed', () => {
    const canvas = new AppCanvasState()
    canvas.setAddress(`${window.location.origin}/app`)
    const { container } = render(<AppCanvas canvas={canvas} />)
    const first = frame(container)
    expect(first.getAttribute('src')).toBe(`${window.location.origin}/app`)
    // A navigation mounts a new frame with the new address; the old element is gone, never re-pointed.
    act(() => { canvas.navigate('/app/settings') })
    const second = frame(container)
    expect(second).not.toBe(first)
    expect(second.getAttribute('src')).toBe(`${window.location.origin}/app/settings`)
    expect(first.getAttribute('src')).toBe(`${window.location.origin}/app`)
    // A reload mounts a new frame at the same address.
    act(() => { canvas.reload() })
    const third = frame(container)
    expect(third).not.toBe(second)
    expect(third.getAttribute('src')).toBe(`${window.location.origin}/app/settings`)
  })

  it('hands its live frame to the service for the door page window id', () => {
    const canvas = new AppCanvasState()
    canvas.setAddress(`${window.location.origin}/app`)
    render(<AppCanvas canvas={canvas} />)
    // jsdom does not run the door script; the page publishes the key itself on its window, and the service reads the frame the component rendered.
    const view = frame(document.body).contentWindow as Window
    Object.defineProperty(view, Symbol.for('acryl.door.page'), {
      value: { windowId: 'window-1' },
      configurable: true,
    })
    expect(canvas.pageWindow()).toBe('window-1')
  })
})
