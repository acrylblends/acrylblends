/**
 * The door's verbs, one implementation for every face: `brief`, `look`, `act`, `plugin list|add|remove|reload` and `tool list|call`
 * (`verbs.ts` lists them; the operator client, MCP and the built-in chat all call these). Each verb takes plain JSON arguments,
 * returns a typed value and a text rendering, and fails with a {@link DoorError} or a {@link UiControlError} carrying a code.
 */

import { existsSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { parseUiRequest, UiControlError, type AuditEntry, type UiActionResult, type UiRequest, type UiResult, type UiSnapshot } from '../page/protocol.ts'
import { renderSnapshot } from '../page/snapshot-text.ts'
import type { AuditLog } from './audit.ts'
import { ShellError, parseShellRequest, type ShellErrorCode, type ShellOp, type ShellRequest, type ShellResult } from '../shell/protocol.ts'
import type { UiChannel } from './channel.ts'
import { NO_DESKTOP, type ShellChannel } from './shell.ts'
import { VERB_SPECS, VERBS } from './verbs.ts'

export type DoorErrorCode = 'invalid' | 'unknown-verb' | 'unavailable' | 'not-exposed' | 'outside-app' | 'failed' | ShellErrorCode

export class DoorError extends Error {
  readonly code: DoorErrorCode

  constructor(code: DoorErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'DoorError'
  }
}

/** The slice of acrylblends' `extensions` service the plugin verbs use, declared here so the door does not depend on that plugin. */
export interface ExtensionsPort {
  install(source: string): Promise<unknown>
  remove(name: string): Promise<unknown>
  reload(): Promise<unknown>
  list(): readonly unknown[]
}

/** The slice of acrylblends' `tools` registry (the `agent` plugin's) the tool verbs use, and where the built-in chat finds the verbs. */
export interface ToolsPort {
  /** @returns the function that removes the tool. @throws when the name is taken. */
  register(name: string, tool: { readonly description: string; readonly parameters?: Readonly<Record<string, unknown>>; run(input: unknown): unknown }): () => void
  list(): ReadonlyArray<{ readonly name: string; readonly description: string }>
  call(name: string, input: unknown): Promise<unknown>
}

export interface DoorDeps {
  readonly channel: UiChannel
  /** The desktop shell (the Electron main process of `npm run desktop`), when the app can have one. */
  readonly shell?: ShellChannel
  readonly audit: AuditLog
  /** The app's name, folder and, when it listens, its address (what `brief` prints so an agent can curl the running app). */
  readonly app: { readonly name: string; readonly root: string; readonly url?: string | undefined }
  /** Read at each call: the services may come and go while the door runs. */
  readonly extensions: () => ExtensionsPort | undefined
  readonly tools: () => ToolsPort | undefined
  /** The app tools the door offers; anything else is refused before it reaches the registry. */
  readonly expose: readonly string[]
  /** Reload the open pages after a plugin was added, removed or reloaded, so the page an agent looks at next is the new one. Default: true. */
  readonly reloadOnChange?: boolean
  /** How long a reload or a move may take before the new page has connected again (tests shorten it). Default 15 s. */
  readonly pageBackMs?: number
}

/** What one verb answered: the value for `--json` and programs, the text for an agent reading a terminal. */
export interface VerbAnswer {
  readonly value: unknown
  readonly text: string
}

/** A shell answer as text an agent reads: windows and menu items one to a line. */
function renderShell(result: ShellResult): string {
  if ('windows' in result) {
    return result.windows.length === 0
      ? 'no windows are open'
      : result.windows.map(window => `${String(window.id)}  ${JSON.stringify(window.title)}  ${window.path}  ${String(window.width)}x${String(window.height)}${window.focused ? '  focused' : ''}`).join('\n')
  }
  if ('items' in result) return result.items.length === 0 ? 'the app has no menu' : result.items.map(item => `${item.path}${item.enabled ? '' : '  (disabled)'}`).join('\n')
  return result.detail
}

/** The files an agent should read first, when the app has them. */
const SELF_KNOWLEDGE = ['AGENTS.md', 'CLAUDE.md', '.agents/skills', '.claude/skills', 'docs', 'plugins']

/** How long a reload or a move may take before the new page has connected to the door again. */
const PAGE_BACK_MS = 15_000

export class Door {
  private readonly deps: DoorDeps

  constructor(deps: DoorDeps) {
    this.deps = deps
  }

  /** Run one verb. @throws DoorError or UiControlError. */
  async run(verb: string, args: unknown, signal: AbortSignal): Promise<VerbAnswer> {
    const input = (typeof args === 'object' && args !== null && !Array.isArray(args) ? args : {}) as Record<string, unknown>
    switch (verb) {
      case 'brief': return this.brief()
      case 'look': {
        const snapshot = await this.look(input, signal)
        return { value: snapshot, text: renderSnapshot(snapshot, cursor => `run look --cursor ${String(cursor)}`) }
      }
      case 'act': {
        const result = await this.act(input, signal)
        return { value: result, text: `done${result.target === undefined ? '' : `: ${result.target.role} "${result.target.name}"`}${result.detail === undefined ? '' : ` (${result.detail})`}; look again before the next act` }
      }
      case 'plugin-list': return this.plugin(extensions => extensions.list(), false)
      case 'plugin-add': return this.plugin(extensions => extensions.install(this.insideApp(input.folder)))
      case 'plugin-remove': {
        const name = input.name
        if (typeof name !== 'string' || name === '') throw new DoorError('invalid', 'plugin remove needs a plugin name')
        return this.plugin(extensions => extensions.remove(name))
      }
      case 'plugin-reload': return this.plugin(extensions => extensions.reload())
      case 'tool-list': {
        const offered = this.offeredTools()
        return { value: offered, text: offered.length === 0 ? 'no app tools are offered through the door (tools.expose is empty)' : offered.map(tool => `${tool.name}: ${tool.description}`).join('\n') }
      }
      case 'tool-call': return this.callTool(input)
      case 'window-list': case 'window-open': case 'window-focus': case 'window-close': case 'window-resize': case 'menu-list': case 'menu-click':
        return this.desktop(verb, input, signal)
      default: throw new DoorError('unknown-verb', `unknown verb ${JSON.stringify(verb)}; the verbs are ${VERBS.join(', ')}`)
    }
  }

  brief(): VerbAnswer {
    const { name, root, url } = this.deps.app
    const read = SELF_KNOWLEDGE.filter(path => existsSync(resolve(root, path)))
    const value = {
      app: name,
      root,
      ...(url === undefined ? {} : { url }),
      read,
      page: this.deps.channel.connected ? 'open' : 'not open',
      plugins: this.deps.extensions() === undefined ? 'unavailable' : 'available',
      verbs: VERBS.map(verb => VERB_SPECS[verb].usage),
    }
    const text = [
      `App ${name} in ${root}.`,
      ...(url === undefined ? [] : [`Address: ${url} (the running app; curl it to check a route).`]),
      read.length === 0 ? 'No AGENTS.md or skill in the folder.' : `Read first: ${read.join(', ')}.`,
      `Page: ${value.page}${value.page === 'not open' ? ' (open the app in a browser to look and act)' : ''}.`,
      `Live plugins: ${value.plugins}.`,
      'Verbs:',
      ...value.verbs.map(line => `  ${line}`),
    ].join('\n')
    return { value, text }
  }

  look(input: Record<string, unknown>, signal: AbortSignal): Promise<UiSnapshot> {
    const request = this.parse({ ...input, op: 'snapshot' })
    return this.callPage('look', request, signal) as Promise<UiSnapshot>
  }

  async act(input: Record<string, unknown>, signal: AbortSignal): Promise<UiActionResult> {
    if (input.op === 'snapshot') throw new DoorError('invalid', 'use look to see the page')
    const request = this.parse(input)
    if (request.op !== 'reload' && request.op !== 'navigate') return await this.callPage(`act ${String(input.op)}`, request, signal) as UiActionResult
    // The page is replaced: wait for the new one to connect, so the next look sees it. The page may drop before it has answered; that is the reload working.
    const back = this.deps.channel.expectAttach(this.deps.pageBackMs ?? PAGE_BACK_MS)
    let answer: UiActionResult
    try {
      answer = await this.callPage(`act ${request.op}`, request, signal) as UiActionResult
    } catch (cause) {
      if (!(cause instanceof UiControlError && cause.code === 'disconnected')) { void back; throw cause }
      answer = { ok: true, detail: request.op === 'reload' ? 'reloading' : `going to ${request.path}` }
    }
    if (!await back) throw new UiControlError('timeout', request.op === 'reload' ? 'the page did not come back after the reload' : `the page did not come back after going to ${request.path}: is there a page at that path, and does it load the door's script?`)
    const landed = request.op === 'navigate' ? await this.statusAt(request.path) : undefined
    return { ...answer, detail: `${answer.detail ?? 'done'}${landed === undefined ? '' : `; ${landed}`}; the page is back: look again` }
  }

  /**
   * What the app answers at a path the page was sent to, so an agent that mistyped one is told ("404 at /nope") and not left to find out from a page it did not expect.
   * A second GET of the same path (a page is read-only); nothing when the app has no address or does not answer in time.
   */
  private async statusAt(path: string): Promise<string | undefined> {
    const base = this.deps.app.url
    if (base === undefined) return undefined
    try {
      const response = await fetch(new URL(path, base), { headers: { accept: 'text/html' }, signal: AbortSignal.timeout(3000) })
      await response.body?.cancel()
      return response.ok ? `${response.status} at ${path}` : `${response.status} at ${path}: the app serves no page there, look at what is shown and navigate to a path it does`
    } catch {
      return undefined
    }
  }

  /**
   * The windows and the menu of the desktop app, through the shell. Every call is audited with the window it was about; a call with no shell attached answers one line that says what to run;
   * closing the last window is refused unless the call says `force` (it ends the desktop app, and the session an agent works in with it).
   */
  private async desktop(verb: ShellOp, input: Record<string, unknown>, signal: AbortSignal): Promise<VerbAnswer> {
    const shell = this.deps.shell
    let request: ShellRequest
    try {
      request = parseShellRequest(verb, input)
    } catch (cause) {
      throw new DoorError('invalid', cause instanceof Error ? cause.message : 'invalid request')
    }
    const windowId = 'id' in request ? request.id : undefined
    const record = (outcome: AuditEntry['outcome'], detail?: string, windowOf?: number): void => {
      const id = windowOf ?? windowId
      this.deps.audit.record({
        at: new Date().toISOString(), tool: verb,
        ...(request.op === 'menu-click' ? { target: { role: 'menuitem', name: request.path } } : {}),
        ...(id === undefined ? {} : { window: id }),
        outcome, ...(detail === undefined ? {} : { detail }), approval: 'token',
      })
    }
    try {
      if (shell === undefined || !shell.connected) throw new ShellError('no-desktop', NO_DESKTOP)
      if (request.op === 'window-close' && request.force !== true) {
        const { windows } = await shell.call({ op: 'window-list' }, { signal }) as Extract<ShellResult, { windows: unknown }>
        if (windows.length === 1 && windows[0]?.id === request.id) {
          throw new ShellError('last-window', `window ${String(request.id)} is the app's last window: closing it ends the desktop app. Open another window first, or pass force to end it on purpose`)
        }
      }
      const result = await shell.call(request, { signal })
      const openedId = 'id' in result ? result.id : undefined
      record('ok', undefined, openedId)
      return { value: result, text: renderShell(result) }
    } catch (cause) {
      if (!(cause instanceof ShellError)) throw cause
      record(['invalid', 'no-such-window', 'last-window', 'no-such-menu-item', 'disabled', 'no-desktop'].includes(cause.code) ? 'refused' : 'failed', cause.code)
      throw new DoorError(cause.code, cause.message)
    }
  }

  private parse(input: Record<string, unknown>): UiRequest {
    try {
      return parseUiRequest(input)
    } catch (cause) {
      throw new DoorError('invalid', cause instanceof Error ? cause.message : 'invalid request')
    }
  }

  /** Run one call on the page and record it. The audit holds which control was touched and how it ended, never what was typed. */
  private async callPage(verb: string, request: UiRequest, signal: AbortSignal): Promise<UiResult> {
    const approval: AuditEntry['approval'] = 'token'
    try {
      const value = await this.deps.channel.call(request, { signal, ...(request.op === 'wait' ? { timeoutMs: (request.timeoutMs ?? 3000) + 5000 } : {}) })
      const target = 'target' in value ? value.target : undefined
      this.deps.audit.record({ at: new Date().toISOString(), tool: verb, ...(target === undefined ? {} : { target }), outcome: 'ok', approval })
      return value
    } catch (cause) {
      const code = cause instanceof UiControlError ? cause.code : 'failed'
      const refused = cause instanceof UiControlError && ['protected', 'sensitive', 'killed', 'invalid', 'stale-ref', 'unknown-ref', 'not-actionable'].includes(cause.code)
      this.deps.audit.record({ at: new Date().toISOString(), tool: verb, outcome: refused ? 'refused' : 'failed', detail: code, approval })
      throw cause
    }
  }

  private async plugin(run: (extensions: ExtensionsPort) => unknown, mutates = true): Promise<VerbAnswer> {
    const extensions = this.deps.extensions()
    if (extensions === undefined) throw new DoorError('unavailable', 'this app has no extensions plugin, so plugins cannot be installed while it runs')
    const value = await run(extensions)
    // The app changed under the open pages: reload them (not when the plugin was already as it should be), and answer once they are back.
    const unchanged = typeof value === 'object' && value !== null && (value as { action?: unknown }).action === 'unchanged'
    if (mutates && !unchanged && this.deps.reloadOnChange !== false) await this.deps.channel.reloadAll()
    return { value, text: JSON.stringify(value, null, 2) }
  }

  /** A folder named by an agent, resolved from the app folder; it must be inside the app. */
  private insideApp(folder: unknown): string {
    if (typeof folder !== 'string' || folder === '') throw new DoorError('invalid', 'plugin add needs a folder, e.g. plugins/pomodoro')
    const root = this.deps.app.root
    const full = resolve(root, folder)
    const path = relative(root, full)
    if (path === '' || path.startsWith('..') || isAbsolute(path)) throw new DoorError('outside-app', `${folder} is not a folder inside the app (${root})`)
    return full
  }

  private offeredTools(): Array<{ name: string; description: string }> {
    const tools = this.deps.tools()
    if (tools === undefined) return []
    const allowed = new Set(this.deps.expose)
    return tools.list().filter(tool => allowed.has(tool.name)).map(({ name, description }) => ({ name, description }))
  }

  private async callTool(input: Record<string, unknown>): Promise<VerbAnswer> {
    const name = input.tool
    if (typeof name !== 'string' || name === '') throw new DoorError('invalid', 'tool call needs --tool <name>')
    if (!this.deps.expose.includes(name)) throw new DoorError('not-exposed', `${name} is not offered through the door`)
    const tools = this.deps.tools()
    if (tools === undefined || !tools.list().some(tool => tool.name === name)) throw new DoorError('unavailable', `${name} is not available right now`)
    let value: unknown
    try {
      value = await tools.call(name, input.args ?? {})
    } catch (cause) {
      throw new DoorError('failed', cause instanceof Error ? cause.message : String(cause))
    }
    return { value, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }
  }
}
