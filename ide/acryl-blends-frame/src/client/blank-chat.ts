/**
 * The blank chat the Host handed out for the checked-out branch (`../blank-chats.ts`): the frame opens it instead of letting DSH create a session
 * on every load, and tells the Host about a blank chat DSH made so the next load finds it.
 */

import { FRAME_BLANK_CHAT_PATH, parseBlankChat } from '../contract.ts'

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface BlankChatApi {
  /** The blank chat of the checked-out branch, if the Host has one. */
  read(): Promise<string | undefined>
  /** Offer a chat as the branch's blank one; false when the Host does not take it (it has a turn, or is unknown). */
  record(id: string): Promise<boolean>
}

export function createBlankChatApi(fetcher: FetchLike = (input, init) => fetch(input, init)): BlankChatApi {
  return {
    async read() {
      const response = await fetcher(FRAME_BLANK_CHAT_PATH, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`the blank chat could not be read (HTTP ${String(response.status)})`)
      return parseBlankChat(await response.json())
    },
    async record(id) {
      const response = await fetcher(FRAME_BLANK_CHAT_PATH, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!response.ok) return false
      const body = (await response.json().catch(() => ({}))) as { recorded?: unknown }
      return body.recorded === true
    },
  }
}
