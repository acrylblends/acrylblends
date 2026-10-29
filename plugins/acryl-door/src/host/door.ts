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
import type { UiChannel } from './channel.ts'
import { VERB_SPECS, VERBS } from './verbs.ts'

export type DoorErrorCode = 'invalid' | 'unknown-verb' | 'unavailable' | 'not-exposed' | 'outside-app' | 'failed'

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
    return { ...answer, detail: `${answer.detail ?? 'done'}; the page is back: look again` }
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
