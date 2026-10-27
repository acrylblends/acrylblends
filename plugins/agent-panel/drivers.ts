/**
 * The drivers the agent panel can offer, in one registry (the `drivers` service the panel provides). A driver is one of two kinds of session:
 *
 * - `chat`: a message in, the panel's own events out (`text`, `tool`, `error`). The app's agent, the headless coding agents and a harness chat are chat drivers.
 * - `terminal`: bytes in, bytes out, a real pseudo-terminal (the `driver-pty` plugin). Nothing is forced to speak bytes.
 *
 * The panel lists every registered driver and picks the view by `kind`. A plugin that provides drivers injects `drivers`: with no panel mounted it is pending,
 * and a panel without such a plugin simply lists none of its drivers.
 */
import type { Context } from '@deepseek-ai/cordis'

/** One event of a chat run. The panel adds `change` (a plugin was installed or removed) and `done` itself. */
export type ChatEvent =
  | { readonly event: 'text'; readonly data: { readonly text: string } }
  | { readonly event: 'tool'; readonly data: Record<string, unknown> }
  | { readonly event: 'error'; readonly data: { readonly message: string } }

export interface ChatDriver {
  readonly kind: 'chat'
  readonly name: string
  /** Runs one message. Aborting `signal` stops the run. */
  start(options: { message: string; signal: AbortSignal }): AsyncIterable<ChatEvent>
}

/** A live pseudo-terminal session. */
export interface TerminalSession {
  readonly id: string
  onData(listener: (chunk: string) => void): () => void
  onExit(listener: (code: number | null) => void): () => void
  write(data: string): void
  resize(cols: number, rows: number): void
  /** Resolves when the process (group) is gone. */
  kill(): Promise<void>
}

export interface TerminalDriver {
  readonly kind: 'terminal'
  readonly name: string
  start(options: {
    cwd: string
    env: NodeJS.ProcessEnv
    cols: number
    rows: number
  }): TerminalSession
}

export type Driver = ChatDriver | TerminalDriver

export interface Drivers {
  /** Add a driver. Returns the function that removes it; a plugin registers inside `ctx.effect` so the driver leaves with it. */
  register(driver: Driver): () => void
  list(): Driver[]
  get(name: string): Driver | undefined
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    drivers: Drivers
  }
}

export function createDrivers(): Drivers {
  const table = new Map<string, Driver>()
  return {
    register(driver) {
      if (table.has(driver.name)) throw new Error(`driver "${driver.name}" is already registered`)
      table.set(driver.name, driver)
      return () => void (table.get(driver.name) === driver && table.delete(driver.name))
    },
    list: () => [...table.values()],
    get: (name) => table.get(name),
  }
}

/** Provide the registry on `ctx` (the panel does). */
export function provideDrivers(ctx: Context): Drivers {
  const registry = createDrivers()
  ;(ctx as Context).provide('drivers', registry)
  return registry
}
