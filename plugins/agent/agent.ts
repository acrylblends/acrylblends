import type { Context } from '@deepseek-ai/cordis'
import type {} from './memory.ts'
import type { Step } from './model.ts'
import type {} from './tools.ts'

/** One tool call made during a run. */
export interface ToolCall {
  readonly tool: string
  readonly input: unknown
  readonly result?: unknown
  readonly error?: string
  /** The thinking model's reasoning for this call, kept so the next step can send it back. */
  readonly reasoning?: string
}

/** How a run ended, with every tool call it made. `task` is its durable record's id when the app records tasks. */
export type RunResult = (
  | { readonly status: 'completed'; readonly output: string }
  | { readonly status: 'budget_exceeded' }
  | { readonly status: 'cancelled' }
) & { readonly steps: number; readonly trace: readonly ToolCall[]; readonly task?: string }

/** What a caller may pass to one run. */
export interface RunOptions {
  /** Aborting it stops the run: the model call or tool in flight is dropped and the run ends `{ status: 'cancelled' }`. */
  readonly signal?: AbortSignal
}

export interface Agent {
  run(question: string, options?: RunOptions): Promise<RunResult>
}

/** The step budget of one run, provided inside the run's own fiber. */
export interface Budget {
  steps: number
  readonly limit: number
}

export interface AgentConfig {
  /** Steps per run before it stops. */
  steps?: number
}

/**
 * The part of a task recorder the agent uses. Optional: when an app mounts the `tasks` plugin, each run is a durable task and each
 * tool call a task it owns; without it, runs work the same and leave no record.
 */
interface TaskRecorder {
  start(
    kind: string,
    input: unknown,
    options?: { parent?: string },
  ): {
    readonly id: string
    readonly signal: AbortSignal
    progress(detail: unknown): void
    complete(result: unknown, detail?: unknown): void
    fail(error: unknown, detail?: unknown): void
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    agent: Agent
    budget: Budget
  }
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Thrown inside a run when its signal aborts; the run turns it into `cancelled`. */
class Cancelled extends Error {}

/** The promise, or a rejection with `Cancelled` as soon as the signal aborts (a model or tool that ignores the signal cannot hold the run). */
function until<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Cancelled())
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Cancelled())
    signal.addEventListener('abort', onAbort, { once: true })
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}

/**
 * The agent. Every run is its own child fiber that holds the run's budget and is disposed when the run ends, however it ends: a
 * scope per task, written with plain Cordis plugins. A tool that throws does not end the run: the model sees the error as the result.
 * When the app records tasks, the run's record is written before the answer is returned, and cancelling it stops the run.
 */
export const agent = {
  name: 'agent',
  inject: ['model', 'tools', 'memory'],
  apply(ctx: Context, config?: AgentConfig) {
    const limit = config?.steps ?? 6
    let runs = 0
    ctx.provide('agent', {
      async run(question, options) {
        runs += 1
        const trace: ToolCall[] = []
        const recorder = (ctx.get as (name: string) => unknown)('tasks') as TaskRecorder | undefined
        const record = recorder?.start('agent-run', { question })
        // The run stops when its task is cancelled or the caller's signal aborts.
        const signal = AbortSignal.any(
          [record?.signal, options?.signal].filter((s): s is AbortSignal => s !== undefined),
        )
        // Assigned inside the run's fiber; `as` keeps TypeScript from narrowing it to this first value.
        let result = { status: 'budget_exceeded', steps: 0, trace } as RunResult
        const task = ctx.plugin({
          name: `task-${runs}`,
          inject: ['model', 'tools', 'memory'],
          async apply(scope: Context) {
            scope.provide('budget', { steps: 0, limit } satisfies Budget)
            const budget = scope.budget
            let toolResult: unknown
            while (budget.steps < budget.limit) {
              if (signal.aborted) {
                result = { status: 'cancelled', steps: budget.steps, trace }
                return
              }
              let step: Step
              try {
                step = await until(
                  scope.model.complete({
                    question,
                    step: budget.steps,
                    toolResult,
                    trace: [...trace],
                    tools: scope.tools.list(),
                    signal,
                  }),
                  signal,
                )
              } catch (error) {
                if (!(error instanceof Cancelled)) throw error
                result = { status: 'cancelled', steps: budget.steps, trace }
                return
              }
              budget.steps += 1
              if (step.tool === undefined) {
                scope.memory.remember(`${question} => ${step.text}`)
                result = { status: 'completed', output: step.text, steps: budget.steps, trace }
                return
              }
              const call = record
                ? recorder?.start(`tool:${step.tool}`, step.input, { parent: record.id })
                : undefined
              try {
                toolResult = await until(
                  scope.tools.call(step.tool, step.input, { signal }),
                  signal,
                )
                trace.push({
                  tool: step.tool,
                  input: step.input,
                  result: toolResult,
                  ...(step.reasoning !== undefined ? { reasoning: step.reasoning } : {}),
                })
                call?.complete(toolResult)
              } catch (error) {
                if (error instanceof Cancelled) {
                  trace.push({ tool: step.tool, input: step.input, error: 'cancelled' })
                  call?.fail('the run was cancelled')
                  result = { status: 'cancelled', steps: budget.steps, trace }
                  return
                }
                toolResult = { error: message(error) }
                trace.push({
                  tool: step.tool,
                  input: step.input,
                  error: message(error),
                  ...(step.reasoning !== undefined ? { reasoning: step.reasoning } : {}),
                })
                call?.fail(error)
              }
              record?.progress({ steps: budget.steps, trace })
            }
            result = { status: 'budget_exceeded', steps: budget.steps, trace }
          },
        })
        try {
          await task.await()
        } catch (error) {
          record?.fail(error, { trace })
          throw error
        } finally {
          await task.dispose()
        }
        if (result.status === 'completed')
          record?.complete(result.output, { steps: result.steps, trace })
        else if (result.status === 'cancelled') {
          if (!record?.signal.aborted)
            record?.fail('the run was cancelled', { steps: result.steps, trace })
        } else if (result.status === 'budget_exceeded')
          record?.fail('the run used its whole step budget', { steps: result.steps, trace })
        return record ? { ...result, task: record.id } : result
      },
    } satisfies Agent)
  },
}
