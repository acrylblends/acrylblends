/**
 * A tool call can never hold a builder's chat forever.
 *
 * DSH's agent loop awaits each stage of a tool call in turn, and its registry never abandons a stage's promise: a policy gate or a wrapper that does
 * not settle leaves the turn running with no process and no prompt, past the command's own timeout (which only arms inside the execute stage), and
 * the Stop button cannot end it either. This guard sits outside each stage and gives it a limit:
 *
 * - Before the tool runs (`tools/pre-execute`, every tool): over the limit, or on Stop, the call is refused without running. An approval is asked
 *   after this stage, so a person deciding is not counted.
 * - While a command runs (`tools/execute`, the shell tools): its own timeout plus a grace. A command past its timeout returns by itself (DSH keeps it
 *   as a job), so reaching this limit means the call is stuck. The command is asked to stop, then the call ends with a sentence that says what happened.
 *   Stop is given the same short wait. While a person has a prompt open in that chat the limit waits for them.
 * - After the tool ran (`tools/post-execute`, every tool): over the limit, the result is kept as it is.
 *
 * Each firing is reported with the stage and the tool, which is what the next stall needs for its root cause.
 *
 * One more thing can end a chat for good: an agent stopping the app's Host, which is the process running it and the frame. A shell command that kills
 * that process (by its id, its port or its script) is refused with what to do instead. It is a seat belt for an honest mistake, not a sandbox.
 */

export const PREPARE_LIMIT_MS = 120_000
export const FINISH_LIMIT_MS = 60_000
/** Past a command's timeout: what its kill escalation, its output and the session's flush may take before the call counts as stuck. */
export const COMMAND_GRACE_MS = 60_000
/** How long a command that was told to stop may take to return. */
export const STOP_WAIT_MS = 5_000
/** A command that names no timeout runs under this one (`bash-local`'s default). */
const DEFAULT_COMMAND_TIMEOUT_MS = 120_000
const SHELL_TOOLS: ReadonlySet<string> = new Set(['bash', 'pwsh'])

export const TOOL_CALL_STALLED = 'TOOL_CALL_STALLED'

/** The parts of a DSH tool execution the guard reads; `signal` it replaces for the stage, as DSH's own timeout policy does. */
export interface GuardedExecution {
  readonly name: string
  readonly arguments?: unknown
  readonly agent?: { readonly session: { readonly id: string } }
  signal: AbortSignal
}

/** The stalled call's result, in the shape DSH's timeout policy uses. */
export interface StalledResult {
  readonly content: readonly [{ readonly type: 'text'; readonly text: string }]
  readonly isError: true
  readonly error: { readonly message: string; readonly info: { readonly name: string; readonly code: string } }
}

type Decision = { readonly kind: 'deny'; readonly reason: string } | { readonly kind: 'cancel' } | { readonly kind: 'accept' } | object

/** The DSH events the guard listens on; each `on` returns its disposer. */
export interface ToolCallEvents {
  on(name: 'tools/pre-execute', listener: (exec: GuardedExecution, next: () => Promise<Decision>) => Promise<Decision>, options: { prepend: true }): () => void
  on(name: 'tools/execute', listener: (exec: GuardedExecution, next: () => Promise<object>) => Promise<object>, options: { prepend: true }): () => void
  on(name: 'tools/post-execute', listener: (exec: GuardedExecution, result: unknown, next: () => Promise<Decision>) => Promise<Decision>, options: { prepend: true }): () => void
  on(name: 'session/event', listener: (session: { readonly id: string }, event: { readonly type: string; readonly data: unknown }) => void): () => void
}

function parsed(args: unknown): Record<string, unknown> {
  if (typeof args === 'object' && args !== null) return args as Record<string, unknown>
  if (typeof args !== 'string') return {}
  try {
    const value: unknown = JSON.parse(args)
    return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

/** The limit of a shell call's execute stage; undefined for any other tool, whose run has no length to hold it to. */
export function commandLimitMs(exec: Pick<GuardedExecution, 'name' | 'arguments'>): number | undefined {
  if (!SHELL_TOOLS.has(exec.name)) return undefined
  const { timeoutMs } = parsed(exec.arguments)
  return (typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_COMMAND_TIMEOUT_MS) + COMMAND_GRACE_MS
}

const seconds = (ms: number): string => `${String(Math.round(ms / 1000))} seconds`

export function stalledResult(toolName: string, why: 'stuck' | 'stopped', limitMs: number): StalledResult {
  const message = why === 'stopped'
    ? `The ${toolName} call was stopped and did not return, so it was ended here. Its outcome is unknown.`
    : `The ${toolName} call had no result ${seconds(limitMs)} after it started, past its own timeout, so it was ended here so the chat does not hang. Its outcome is unknown. Say so to the person, and run it again only if it is still needed.`
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
    error: { message, info: { name: 'ToolCallStalled', code: TOOL_CALL_STALLED } },
  }
}

/** The Host this guard runs in, as a shell command would name it. */
export interface HostIdentity {
  readonly hostPid: number
  readonly hostPort?: number
}

/** Whether a shell call would stop the Host. A kill alone is fine: agents stop their own test servers. */
export function stopsHost(exec: Pick<GuardedExecution, 'name' | 'arguments'>, host: HostIdentity): boolean {
  if (!SHELL_TOOLS.has(exec.name)) return false
  const { command } = parsed(exec.arguments)
  if (typeof command !== 'string' || !/\b(?:kill|pkill|killall|Stop-Process|taskkill)\b/u.test(command)) return false
  const named = host.hostPort === undefined ? String(host.hostPid) : `${String(host.hostPid)}|${String(host.hostPort)}`
  return new RegExp(`\\b(?:${named})\\b|ide-host`, 'u').test(command)
}

export const HOST_REFUSAL = 'that command would stop the app\'s Host, the process running this chat and the page beside it, and end them both. It was not run. A saved change in src/ or plugins/ reloads the app by itself; if a change does not show, the reload failed, so read the error and fix it.'

/**
 * Put the guard on the tool calls of every chat.
 * @param events - the plugin's context, as the events it listens on.
 * @param report - hears each firing.
 * @param host - the Host to protect from a shell command; left out, nothing is refused.
 * @returns the disposer: the listeners and every running limit stop.
 */
export function guardToolCalls(events: ToolCallEvents, report: (line: string) => void, host?: HostIdentity): () => void {
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const after = (ms: number, then: () => void): (() => void) => {
    const timer = setTimeout(() => {
      timers.delete(timer)
      then()
    }, ms)
    timers.add(timer)
    return () => {
      clearTimeout(timer)
      timers.delete(timer)
    }
  }
  /** The approvals open in each chat: the id of each `approval/asked` until its `approval/decided`. */
  const openApprovals = new Map<string, Set<unknown>>()

  const stopPre = events.on('tools/pre-execute', async (exec, next) => {
    if (host !== undefined && stopsHost(exec, host)) {
      report(`refused a shell command that would stop the Host: ${exec.name}`)
      return { kind: 'deny', reason: HOST_REFUSAL }
    }
    const ended = Promise.withResolvers<Decision>()
    const cancel = after(PREPARE_LIMIT_MS, () => {
      report(`tool call stalled before running: ${exec.name}, ${seconds(PREPARE_LIMIT_MS)}`)
      ended.resolve({ kind: 'deny', reason: `the ${exec.name} call was held up for ${seconds(PREPARE_LIMIT_MS)} before it could run, so it did not run. Say so to the person, and try it again if it is still needed.` })
    })
    const onStop = (): void => { ended.resolve({ kind: 'cancel' }) }
    exec.signal.addEventListener('abort', onStop, { once: true })
    try {
      return await Promise.race([next(), ended.promise])
    } finally {
      cancel()
      exec.signal.removeEventListener('abort', onStop)
    }
  }, { prepend: true })

  const stopExecute = events.on('tools/execute', async (exec, next) => {
    const limit = commandLimitMs(exec)
    if (limit === undefined) return next()
    const upstream = exec.signal
    const stop = new AbortController()
    const ended = Promise.withResolvers<StalledResult>()
    let cancel = (): void => {}
    let reason: 'stuck' | 'stopped' | undefined
    const giveUp = (why: 'stuck' | 'stopped'): void => {
      reason = why
      stop.abort(new Error(`${exec.name} call ${why}`))
      cancel()
      cancel = after(STOP_WAIT_MS, () => {
        report(`tool call ${why} and did not return: ${exec.name}`)
        ended.resolve(stalledResult(exec.name, why, limit))
      })
    }
    const arm = (): void => {
      cancel = after(limit, () => {
        const session = exec.agent?.session.id
        if (session !== undefined && (openApprovals.get(session)?.size ?? 0) > 0) arm()
        else giveUp('stuck')
      })
    }
    arm()
    const onStop = (): void => { if (reason === undefined) giveUp('stopped') }
    upstream.addEventListener('abort', onStop, { once: true })
    exec.signal = AbortSignal.any([upstream, stop.signal])
    try {
      const result = await Promise.race([next(), ended.promise])
      // The command answered our stop with its own abort: the person reads why it stopped.
      return reason === 'stuck' ? stalledResult(exec.name, reason, limit) : result
    } finally {
      cancel()
      upstream.removeEventListener('abort', onStop)
      exec.signal = upstream
    }
  }, { prepend: true })

  const stopPost = events.on('tools/post-execute', async (exec, _result, next) => {
    const ended = Promise.withResolvers<Decision>()
    const cancel = after(FINISH_LIMIT_MS, () => {
      report(`tool call stalled after running: ${exec.name}, ${seconds(FINISH_LIMIT_MS)}`)
      ended.resolve({ kind: 'accept' })
    })
    try {
      return await Promise.race([next(), ended.promise])
    } finally {
      cancel()
    }
  }, { prepend: true })

  const stopApprovals = events.on('session/event', (session, event) => {
    if (event.type !== 'approval/asked' && event.type !== 'approval/decided') return
    const id = (event.data as { readonly id?: unknown } | null)?.id
    const open = openApprovals.get(session.id) ?? new Set<unknown>()
    if (event.type === 'approval/asked') open.add(id)
    else open.delete(id)
    if (open.size === 0) openApprovals.delete(session.id)
    else openApprovals.set(session.id, open)
  })

  return () => {
    stopPre()
    stopExecute()
    stopPost()
    stopApprovals()
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
  }
}
