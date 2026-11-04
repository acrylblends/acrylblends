/**
 * The chat of an app in the frame starts quiet, as the mockup draws it: completed turns fold, the live process and settled reasoning previews stay
 * closed, and the composer keeps compact statistics. DSH's chat owns these display preferences (Settings > General > Work details and Token usage) and
 * exposes them through its settings service; the frame writes the quiet defaults through that service, once, only where the person has not chosen a
 * value. It never edits DSH's document and never re-renders messages itself.
 *
 * The service's inherited section also holds a value for Token usage (DSH's schema default, `detailed`) even before anyone chose it; these are user
 * display preferences, so the frame's default applies over that default. A choice the person saves is in their own section, and that always stays.
 */

/** The chat settings namespace and its display fields (the contract of `@deepseek-ai/dsh-client-ui-chat`). */
export const CHAT_SETTINGS_NS = 'ui-chat'
export const TRANSCRIPT_VIEW_FIELD = 'transcriptView'
export const PERFORMANCE_USAGE_FIELD = 'performanceUsage'

/** The frame's quiet defaults: the mockup's folded work details and compact usage. */
export const FRAME_CHAT_DEFAULTS: Readonly<Record<string, string>> = {
  [TRANSCRIPT_VIEW_FIELD]: 'compact',
  [PERFORMANCE_USAGE_FIELD]: 'compact',
}

/** One settings form as the default reads it: the chat entry and the person's own section. */
export interface ChatSettingsDescriptor {
  readonly ns: string
  readonly revision: number
  readonly user?: unknown
}

/** The settings service as the default uses it. */
export interface ChatSettingsService {
  readonly writable: boolean
  describe(): readonly ChatSettingsDescriptor[]
  update(ns: string, patch: Record<string, unknown>, expectedRevision?: number): Promise<void>
}

const fieldIn = (section: unknown, field: string): unknown =>
  section !== null && typeof section === 'object' ? (section as Record<string, unknown>)[field] : undefined

/**
 * The fields of {@link FRAME_CHAT_DEFAULTS} still to write: a field the person's own section does not name. `undefined` when the chat form is absent, the
 * profile refuses writes, or every field is already chosen (there is nothing to do, and nothing to wait for).
 */
export function quietChatPatch(
  descriptor: ChatSettingsDescriptor | undefined,
  writable = true,
): Readonly<Record<string, string>> | undefined {
  if (descriptor === undefined || !writable) return undefined
  const patch: Record<string, string> = {}
  for (const [field, value] of Object.entries(FRAME_CHAT_DEFAULTS))
    if (fieldIn(descriptor.user, field) == null) patch[field] = value
  return Object.keys(patch).length === 0 ? undefined : patch
}

/**
 * Write the quiet defaults when the chat form appears: the chat row can activate after the frame, so the form is waited for, and a person's save made
 * meanwhile wins at the service's own revision check. Returns a disposer that stops the wait; a refusal ends the attempt and leaves the chat as it is.
 */
export function defaultQuietChat(
  settings: ChatSettingsService,
  report: (message: string) => void = () => {},
  waitMs = 15_000,
): () => void {
  const deadline = Date.now() + waitMs
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  const attempt = async (): Promise<void> => {
    if (stopped) return
    try {
      const descriptor = settings.describe().find(entry => entry.ns === CHAT_SETTINGS_NS)
      const patch = quietChatPatch(descriptor, settings.writable)
      if (patch !== undefined) {
        await settings.update(CHAT_SETTINGS_NS, patch, (descriptor as ChatSettingsDescriptor).revision)
        return
      }
      if (descriptor !== undefined) return
    } catch (cause) {
      report(`the chat's quiet defaults were not written: ${cause instanceof Error ? cause.message : String(cause)}`)
      return
    }
    if (stopped || Date.now() >= deadline) return
    timer = setTimeout(() => { void attempt() }, 250)
  }
  void attempt()
  return () => {
    stopped = true
    if (timer !== undefined) clearTimeout(timer)
  }
}
