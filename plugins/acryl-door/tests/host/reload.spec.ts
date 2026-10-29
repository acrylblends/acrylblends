/**
 * Reload and navigate, and the reload after a live plugin change: the Door with a real channel and pages that stand in for the browser. A page that is told to reload ends its stream
 * and a new page connects; the verb answers once it is back, so the next look sees the new page.
 */

import { describe, expect, it } from 'vitest'
import { Door, type ExtensionsPort } from '../../src/host/door.ts'
import { UiChannel, type PageStream } from '../../src/host/channel.ts'
import type { AuditLog } from '../../src/host/audit.ts'
import type { ChannelToPage } from '../../src/page/protocol.ts'

const audit = { record: () => undefined } as unknown as AuditLog
const never = new AbortController().signal

/** A page: it records the calls it gets, and on a reload/navigate call it answers (or not) and comes back as a new window after `backAfterMs` (never when undefined). */
function browser(channel: UiChannel, options: { answers?: boolean; backAfterMs?: number | undefined } = {}) {
  const calls: ChannelToPage[] = []
  let counter = 0
  const open = (): void => {
    counter += 1
    const windowId = `w${String(counter)}`
    const stream: PageStream = {
      send(data) {
        const frame = JSON.parse(data) as ChannelToPage
        calls.push(frame)
        if (frame.request.op !== 'reload' && frame.request.op !== 'navigate') return
        const detail = frame.request.op === 'reload' ? 'reloading' : `going to ${frame.request.path}`
        if (options.answers !== false) channel.receive(windowId, { t: 'result', id: frame.id, value: { ok: true, detail } })
        if (options.backAfterMs !== undefined) {
          setTimeout(() => { end(); open() }, options.backAfterMs)
        }
      },
      close() { /* nothing */ },
    }
    const end = channel.attach(windowId, true, stream)
  }
  open()
  return { calls }
}

function door(channel: UiChannel, extra: { extensions?: ExtensionsPort; reloadOnChange?: boolean; pageBackMs?: number } = {}): Door {
  return new Door({
    channel,
    audit,
    app: { name: 'demo', root: '/tmp/demo' },
    extensions: () => extra.extensions,
    tools: () => undefined,
    expose: [],
    ...(extra.reloadOnChange === undefined ? {} : { reloadOnChange: extra.reloadOnChange }),
    pageBackMs: extra.pageBackMs ?? 1000,
  })
}

describe('act reload and act navigate', () => {
  it('answer once the page is back, and say so', async () => {
    const channel = new UiChannel()
    const page = browser(channel, { backAfterMs: 20 })
    const reload = await door(channel).run('act', { op: 'reload' }, never)
    expect(reload.text).toContain('reloading; the page is back: look again')
    const moved = await door(channel).run('act', { op: 'navigate', path: '/demo' }, never)
    expect(moved.text).toContain('going to /demo; the page is back')
    expect(page.calls.map((call) => call.request.op)).toEqual(['reload', 'navigate'])
  })

  it('count the page dropping before it answered as the reload working', async () => {
    const channel = new UiChannel()
    browser(channel, { answers: false, backAfterMs: 20 })
    const reload = await door(channel).run('act', { op: 'reload' }, never)
    expect(reload.text).toContain('the page is back')
  })

  it('fail with a timeout that names the cause when the page does not come back, and refuse a path that leaves the app', async () => {
    const channel = new UiChannel()
    browser(channel, { backAfterMs: undefined })
    await expect(door(channel, { pageBackMs: 60 }).run('act', { op: 'navigate', path: '/nowhere' }, never)).rejects.toMatchObject({ code: 'timeout', message: expect.stringContaining('/nowhere') })
    await expect(door(channel).run('act', { op: 'navigate', path: '//evil.example' }, never)).rejects.toMatchObject({ code: 'invalid' })
    await expect(door(new UiChannel()).run('act', { op: 'reload' }, never)).rejects.toMatchObject({ code: 'no-window' })
  })
})

describe('the open pages reload after a live plugin change', () => {
  const extensions = (action = 'installed'): ExtensionsPort => ({
    install: async () => ({ ok: true, name: 'demo-ui', action }),
    remove: async () => ({ ok: true }),
    reload: async () => [],
    list: () => [],
  })

  it('on add, remove and reload, and the verb answers once the page is back', async () => {
    const channel = new UiChannel()
    const page = browser(channel, { backAfterMs: 20 })
    const d = door(channel, { extensions: extensions() })
    await d.run('plugin-add', { folder: 'plugins/demo-ui' }, never)
    await d.run('plugin-reload', {}, never)
    await d.run('plugin-remove', { name: 'demo-ui' }, never)
    expect(page.calls.filter((call) => call.request.op === 'reload')).toHaveLength(3)
  })

  it('not for a list, for a plugin that was already as it should be, or when switched off; and with no page open nothing is waited for', async () => {
    const channel = new UiChannel()
    const page = browser(channel, { backAfterMs: 20 })
    await door(channel, { extensions: extensions() }).run('plugin-list', {}, never)
    await door(channel, { extensions: extensions('unchanged') }).run('plugin-add', { folder: 'plugins/demo-ui' }, never)
    await door(channel, { extensions: extensions(), reloadOnChange: false }).run('plugin-add', { folder: 'plugins/demo-ui' }, never)
    expect(page.calls).toEqual([])
    const started = Date.now()
    await door(new UiChannel(), { extensions: extensions() }).run('plugin-add', { folder: 'plugins/demo-ui' }, never)
    expect(Date.now() - started).toBeLessThan(500)
  })
})
