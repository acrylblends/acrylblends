import { describe, expect, it } from 'vitest'
import { createSidebarRightStandIn, webAddress } from '../src/client/sidebar-right-stand-in.ts'

describe('the sidebarRight stand-in for DSH chat', () => {
  it('names only http and https addresses as web addresses', () => {
    expect(webAddress('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    expect(webAddress('http://localhost:3000/')).toBe('http://localhost:3000/')
    expect(webAddress('javascript:alert(1)')).toBeUndefined()
    expect(webAddress('dsh-resource://file/src/a.ts')).toBeUndefined()
    expect(webAddress('not a url')).toBeUndefined()
    expect(webAddress(undefined)).toBeUndefined()
  })

  it('opens a web link in a new tab and leaves every other address alone', () => {
    const opened: string[] = []
    const sidebar = createSidebarRightStandIn(url => { opened.push(url) })
    sidebar.openResource('https://example.com/docs')
    sidebar.openResource('dsh-resource://file/src/a.ts')
    sidebar.openResourceIn('session-1', 'https://example.com/in-session')
    sidebar.openTab('browser', { params: { url: 'https://example.com/page' } })
    sidebar.openTab('browser', { params: { url: 'file:///etc/passwd' } })
    sidebar.openTab('terminal')
    sidebar.openTabIn('session-1', 'browser', { params: { url: 'http://localhost:3000/' } })
    expect(opened).toEqual(['https://example.com/docs', 'https://example.com/in-session', 'https://example.com/page', 'http://localhost:3000/'])
    expect(sidebar.isExpanded()).toBe(false)
  })
})
