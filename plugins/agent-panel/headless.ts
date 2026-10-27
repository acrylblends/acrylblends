/** The panel's own drivers, all `chat`: the app's agent, and the coding agents (`claude`, `codex`, `pi`) started headless in the app folder. */
import { spawn, spawnSync } from 'node:child_process'
import type { Context } from '@deepseek-ai/cordis'
import type { ChatDriver, ChatEvent } from './drivers.ts'

export type HeadlessName = 'claude' | 'codex' | 'pi'

/** The command line of each coding agent started headless in the app folder (the same ones the product test uses). */
export function command(
  driver: HeadlessName,
  message: string,
  root: string,
): { file: string; args: string[] } {
  switch (driver) {
    case 'claude':
      return {
        file: 'claude',
        args: [
          '-p',
          message,
          '--permission-mode',
          'acceptEdits',
          '--allowedTools',
          'Read,Edit,Write,Glob,Grep,Bash(npm *),Bash(npx *),Bash(node *),Bash(.acryl/bin/acryl *),Bash(curl *)',
        ],
      }
    case 'codex':
      return {
        file: 'codex',
        args: [
          'exec',
          '--skip-git-repo-check',
          '-s',
          'workspace-write',
          '-c',
          'sandbox_workspace_write.network_access=true',
          '-C',
          root,
          message,
        ],
      }
    case 'pi':
      return {
        file: 'pi',
        args: [
          '-p',
          message,
          '--provider',
          'deepseek',
          '--model',
          'deepseek-v4-pro',
          '--no-session',
        ],
      }
  }
}

export function onPath(program: string): boolean {
  const found = spawnSync(process.platform === 'win32' ? 'where' : 'which', [program], {
    encoding: 'utf8',
  })
  return found.status === 0
}

/** The headless programs this machine can offer: installed (pi also needs its key in the environment). */
export function availableHeadless(wanted?: readonly HeadlessName[]): HeadlessName[] {
  const found: HeadlessName[] = []
  for (const driver of wanted ?? (['claude', 'codex', 'pi'] as const)) {
    if (driver === 'pi' && !process.env.DEEPSEEK_API_KEY) continue
    if (onPath(driver)) found.push(driver)
  }
  return found
}

/** The app's own agent as a chat driver: its tool calls, then its answer. Aborting the signal cancels the run. */
export function agentDriver(ctx: Context): ChatDriver {
  return {
    kind: 'chat',
    name: 'agent',
    async *start({ message, signal }) {
      const result = await ctx.agent.run(message, { signal })
      for (const call of result.trace)
        yield {
          event: 'tool',
          data: {
            tool: call.tool,
            input: call.input,
            ...(call.error ? { error: call.error } : { result: call.result }),
          },
        }
      yield {
        event: 'text',
        data: {
          text:
            result.status === 'completed'
              ? result.output
              : result.status === 'cancelled'
                ? 'The run was cancelled.'
                : `The run stopped after ${result.steps} steps without an answer.`,
        },
      }
    },
  }
}

/** A coding agent run headless in the app folder: its stdout is the answer, its stderr the tool lines. Aborting the signal ends the program. */
export function headlessDriver(name: HeadlessName, root: string): ChatDriver {
  return {
    kind: 'chat',
    name,
    async *start({ message, signal }) {
      const { file, args } = command(name, message, root)
      const child = spawn(file, args, {
        cwd: root,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const queue: ChatEvent[] = []
      let wake: (() => void) | undefined
      let ended = false
      const push = (event: ChatEvent): void => {
        queue.push(event)
        wake?.()
      }
      signal.addEventListener('abort', () => child.kill('SIGTERM'), { once: true })
      child.stdout.on('data', (chunk: Buffer) =>
        push({ event: 'text', data: { text: chunk.toString() } }),
      )
      child.stderr.on('data', (chunk: Buffer) =>
        push({ event: 'tool', data: { tool: name, info: chunk.toString().slice(0, 500) } }),
      )
      child.on('error', () => {
        ended = true
        push({ event: 'error', data: { message: `${name} could not be started` } })
      })
      child.on('exit', (code) => {
        ended = true
        if (code !== 0 && !signal.aborted)
          push({ event: 'error', data: { message: `${name} ended with exit code ${code ?? 1}` } })
        else wake?.()
      })
      try {
        for (;;) {
          const next = queue.shift()
          if (next) yield next
          else if (ended) return
          else await new Promise<void>((resolve) => (wake = resolve))
        }
      } finally {
        if (child.exitCode === null) child.kill('SIGTERM')
      }
    },
  }
}
