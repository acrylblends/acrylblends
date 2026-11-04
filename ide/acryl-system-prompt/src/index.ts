/**
 * ACRYL system prompt shaping (ACRYL spec 037, pi.dev-like prompt). pi.dev owns one builder function that produces a structured, tagged prompt; the
 * frame composes its agent's prompt from the harness's sections (a pinned upstream we do not fork), so this plugin applies the same shape as a
 * pass-through: on the harness's `system-prompt/assemble` waterfall it puts the identity first, wraps every other section in a tag, drops empty ones,
 * and records what upstream contributed so a harness update shows exactly what changed. It rewrites nothing else.
 *
 * Provides: `acrylSystemPrompt` ({ lastUpstream() }). Requires: `systemPrompt`.
 */
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { DEFAULT_IDENTITY, type PromptSection, shapeSections, upstreamSnapshot } from './transform.ts'

export const name = 'acryl-system-prompt'
export const inject = ['systemPrompt']

export interface Config {
  identity: string
  tagSections: boolean
  dropEmpty: boolean
}

export const Config: Schema<Config> = Schema.object({
  identity: Schema.string().default(DEFAULT_IDENTITY).description('The opening identity line (replaces the harness "You are an AI agent powered by ..." line).'),
  tagSections: Schema.boolean().default(true).description('Wrap every section in a pi.dev-style tag.'),
  dropEmpty: Schema.boolean().default(true).description('Drop sections with no text.'),
})

/** The assembled prompt as the waterfall passes it: its sections, and whatever else the harness carries, kept as it is. */
interface Assembled {
  readonly sections: readonly PromptSection[]
}

type AssembleListener = (assembly: unknown, context: unknown, next: () => Promise<Assembled>) => Promise<Assembled>

export function apply(ctx: Context, config: Config): void {
  let upstream: { name: string; hash: string }[] = []
  ctx.provide('acrylSystemPrompt', { lastUpstream: () => upstream })
  const on = ctx.on.bind(ctx) as unknown as (name: 'system-prompt/assemble', listener: AssembleListener) => () => void
  ctx.effect(() => on('system-prompt/assemble', async (_assembly, _context, next) => {
    const assembled = await next()
    upstream = upstreamSnapshot(assembled.sections)
    return { ...assembled, sections: shapeSections(assembled.sections, config) }
  }), 'acryl-system-prompt: assemble listener')
}
