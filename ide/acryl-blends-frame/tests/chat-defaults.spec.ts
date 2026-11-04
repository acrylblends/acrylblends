/**
 * The frame's quiet chat defaults: only the display fields neither the person nor the app's composition chose are written, through the chat settings form,
 * at its own revision; a refusal ends the attempt and a dispose stops the wait.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHAT_SETTINGS_NS, defaultQuietChat, quietChatPatch, type ChatSettingsDescriptor, type ChatSettingsService } from '../src/chat-defaults.ts'

const descriptor = (user?: unknown): ChatSettingsDescriptor => ({
  ns: CHAT_SETTINGS_NS,
  revision: 7,
  ...(user === undefined ? {} : { user }),
})

interface FakeSettings extends ChatSettingsService {
  readonly writes: readonly unknown[][]
  forms: readonly ChatSettingsDescriptor[]
  failure?: string
}

function service(forms: readonly ChatSettingsDescriptor[], writable = true): FakeSettings {
  const writes: unknown[][] = []
  const value: FakeSettings = {
    writable,
    writes,
    forms,
    describe: () => value.forms,
    update: async (...args: unknown[]) => {
      if (value.failure !== undefined) throw new Error(value.failure)
      writes.push(args)
    },
  }
  return value
}

afterEach(() => {
  vi.useRealTimers()
})

describe("the frame's quiet chat", () => {
  it('asks for both quiet fields when the person has not chosen them', () => {
    expect(quietChatPatch(descriptor())).toEqual({ transcriptView: 'compact', performanceUsage: 'compact' })
  })

  it("leaves a person's choice alone, field by field", () => {
    expect(quietChatPatch(descriptor({ transcriptView: 'detailed' }))).toEqual({ performanceUsage: 'compact' })
    expect(quietChatPatch(descriptor({ performanceUsage: 'detailed' }))).toEqual({ transcriptView: 'compact' })
    expect(quietChatPatch(descriptor({ transcriptView: 'verbose', performanceUsage: 'detailed' }))).toBeUndefined()
    // A saved null is no choice; the client reads it as the default.
    expect(quietChatPatch(descriptor({ transcriptView: null }))).toEqual({ transcriptView: 'compact', performanceUsage: 'compact' })
  })

  it('writes nothing without the chat form or on a read-only profile', () => {
    expect(quietChatPatch(undefined)).toBeUndefined()
    expect(quietChatPatch(descriptor(), false)).toBeUndefined()
  })

  it("writes through the chat namespace at the form's revision", () => {
    const settings = service([descriptor()])
    defaultQuietChat(settings)
    expect(settings.writes).toEqual([[CHAT_SETTINGS_NS, { transcriptView: 'compact', performanceUsage: 'compact' }, 7]])
  })

  it('waits for the chat form to appear, then writes once', async () => {
    vi.useFakeTimers()
    const settings = service([])
    const stop = defaultQuietChat(settings)
    expect(settings.writes).toHaveLength(0)
    settings.forms = [descriptor()]
    await vi.advanceTimersByTimeAsync(250)
    expect(settings.writes).toHaveLength(1)
    stop()
  })

  it('stops on a refusal and reports it, without trying again', async () => {
    vi.useFakeTimers()
    const reported: string[] = []
    const settings = service([descriptor()])
    settings.failure = 'read-only document'
    defaultQuietChat(settings, (message) => reported.push(message))
    await vi.advanceTimersByTimeAsync(1000)
    expect(reported).toHaveLength(1)
    expect(reported[0]).toContain('read-only document')
  })

  it('stops waiting when disposed', async () => {
    vi.useFakeTimers()
    const settings = service([])
    const stop = defaultQuietChat(settings)
    stop()
    settings.forms = [descriptor()]
    await vi.advanceTimersByTimeAsync(1000)
    expect(settings.writes).toHaveLength(0)
  })
})
