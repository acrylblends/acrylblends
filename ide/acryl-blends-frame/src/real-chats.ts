/**
 * Which chats are real: those with at least one turn. DSH's session list marks a chat `blank` only while it is loaded, so the list alone cannot tell
 * an old empty chat from a used one; the Host reads each session's log for a `turn/start`. A chat that has a turn keeps it, so a positive answer is
 * remembered and only the chats without one are read again.
 */

export interface RealChatsDeps {
  /** The ids of every session DSH knows. */
  list(): Promise<readonly string[]>
  /** Whether the session's log holds a turn. */
  hasTurn(id: string): Promise<boolean>
  readonly report?: (cause: unknown) => void
}

export class RealChats {
  private readonly real = new Set<string>()

  constructor(private readonly deps: RealChatsDeps) {}

  /** The ids with a turn, in the order DSH lists them. A session that cannot be read is left out this time and asked again next time. */
  async read(): Promise<string[]> {
    const ids = await this.deps.list()
    const found = await Promise.all(ids.map(async (id) => {
      if (this.real.has(id)) return true
      try {
        if (!(await this.deps.hasTurn(id))) return false
      } catch (cause) {
        this.deps.report?.(cause)
        return false
      }
      this.real.add(id)
      return true
    }))
    return ids.filter((_, index) => found[index])
  }
}
