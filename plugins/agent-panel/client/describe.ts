// One line for a tool event of the panel's conversation: what the tool is doing, not only its name. A coding agent started in the folder reports its own log (`{ tool: 'codex', info }`):
// its bookkeeping is dropped and its command or sentence is kept. The app's own agent reports a call (`{ tool, input, result | error }`): the name and a short form of the arguments.

const MAX = 160

const clip = (text: string): string => (text.length > MAX ? `${text.slice(0, MAX - 1)}…` : text)

/** A shell command as the agent's log writes it: `/bin/zsh -lc 'npm test' in /path/to/app` becomes `npm test`. */
function commandOf(line: string): string {
  const withoutCwd = line.replace(/ in \/\S+\s*$/u, '')
  const wrapped = /^(?:\/\S*\/)?(?:ba|z|da)?sh -l?c (['"])([\s\S]*)\1$/u.exec(withoutCwd.trim())
  return wrapped?.[2] ?? withoutCwd.trim()
}

/** @returns the line to show, or `undefined` when the event says nothing worth a line (a hook ran, a token count). */
export function describeTool(data: Record<string, unknown>): string | undefined {
  const tool = String(data.tool ?? '')
  if (typeof data.info === 'string') {
    const lines = data.info
      .split('\n')
      .map((line) => line.trim())
      .filter(
        (line) =>
          line !== '' &&
          !/^hook:/u.test(line) &&
          !/^tokens used/u.test(line) &&
          !/^[\d,]+$/u.test(line),
      )
    if (lines.length === 0) return undefined
    const [first = '', second = ''] = lines
    if (first === 'exec') return second === '' ? undefined : `${tool}: $ ${clip(commandOf(second))}`
    // The output of a command that ran: only a failure is worth a line.
    if (/^succeeded in /u.test(first)) return undefined
    if (/^exited \d+/u.test(first)) return `${tool}: ${clip(first.replace(/:$/u, ''))}`
    return `${tool}: ${clip(lines.join(' '))}`
  }
  const input =
    data.input === undefined ||
    (typeof data.input === 'object' && data.input !== null && Object.keys(data.input).length === 0)
      ? ''
      : ` ${clip(JSON.stringify(data.input))}`
  const failed = data.error ? ` failed: ${clip(String(data.error))}` : ''
  return `${tool}${input}${failed}`
}
