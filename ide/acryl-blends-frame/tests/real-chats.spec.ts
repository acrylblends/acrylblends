import { describe, expect, it } from 'vitest'
import type { ChatRow } from '../src/client/LeftPanel.tsx'
import { visibleChats } from '../src/client/chats.ts'
import { RealChats } from '../src/real-chats.ts'

const row = (id: string, current = false): ChatRow => ({ id, title: 'New chat', current })

describe('the left panel lists only real chats', () => {
  it('hides a chat with no turn unless it is the open one or is running', () => {
    const rows = [row('a'), row('b', true), row('c'), row('d')]
    expect(visibleChats(rows, new Set(['c']), new Set(['d'])).map(r => r.id)).toEqual(['b', 'c', 'd'])
    expect(visibleChats(rows, new Set()).map(r => r.id)).toEqual(['b'])
  })

  it('asks the Host once for a chat that has a turn and keeps asking only about the ones that do not', async () => {
    const asked: string[] = []
    const turns = new Set(['a'])
    const real = new RealChats({ list: async () => ['a', 'b'], hasTurn: async (id) => { asked.push(id); return turns.has(id) } })
    expect(await real.read()).toEqual(['a'])
    turns.add('b')
    expect(await real.read()).toEqual(['a', 'b'])
    expect(asked).toEqual(['a', 'b', 'b'])
  })

  it('leaves out a chat that cannot be read and says why', async () => {
    const reported: unknown[] = []
    const real = new RealChats({ list: async () => ['a', 'b'], hasTurn: async (id) => { if (id === 'a') throw new Error('no log'); return true }, report: (c) => { reported.push(c) } })
    expect(await real.read()).toEqual(['b'])
    expect(reported).toHaveLength(1)
  })
})
