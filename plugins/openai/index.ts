/**
 * A real model for the agent: any OpenAI-compatible chat completions API (OpenAI, DeepSeek, Ollama, LM Studio, a local server), called
 * with `fetch`, no SDK. It provides the same `model` service as the scripted model, so the agent, its tools and the builder do not change.
 * Each step is stateless: the conversation is rebuilt from the run's question and tool-call trace.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Model, ModelInput, Step } from '../agent/index.ts'
import { SYSTEM_PROMPT } from './prompt.ts'

export interface OpenAIConfig {
  /** For example https://api.openai.com/v1, https://api.deepseek.com/v1, http://127.0.0.1:11434/v1 (Ollama). */
  baseUrl: string
  model: string
  /** Sent as a bearer token. Local servers need none. Keep it out of files the app commits. */
  apiKey?: string
  /** Replaces the default system prompt (how to write a Cordis plugin that installs). */
  system?: string
  temperature?: number
}

/** The model configuration from an environment-shaped object, or `undefined` when none is set. Pass it `process.env` in main.ts. */
export function modelConfigFrom(
  env: Readonly<Record<string, string | undefined>>,
): OpenAIConfig | undefined {
  const baseUrl = env.ACRYLBLENDS_MODEL_URL?.trim()
  const model = env.ACRYLBLENDS_MODEL?.trim()
  if (!baseUrl || !model) return undefined
  const apiKey = env.ACRYLBLENDS_MODEL_KEY?.trim()
  return { baseUrl, model, ...(apiKey ? { apiKey } : {}) }
}

interface ToolCallMessage {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

type Message =
  | { role: 'system' | 'user'; content: string }
  | {
      role: 'assistant'
      content: string | null
      tool_calls?: ToolCallMessage[]
      reasoning_content?: string
    }
  | { role: 'tool'; tool_call_id: string; content: string }

/** The chat messages for a step: system, the question, then each tool call and its result. */
export function messagesFor(input: ModelInput, system: string): Message[] {
  const messages: Message[] = [
    { role: 'system', content: system },
    { role: 'user', content: input.question },
  ]
  for (const [index, call] of (input.trace ?? []).entries()) {
    const id = `call_${index}`
    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id,
          type: 'function',
          function: { name: call.tool, arguments: JSON.stringify(call.input ?? {}) },
        },
      ],
      // A thinking model (DeepSeek) refuses the next request unless its reasoning for the call comes back with it.
      ...(call.reasoning !== undefined ? { reasoning_content: call.reasoning } : {}),
    })
    messages.push({
      role: 'tool',
      tool_call_id: id,
      content: JSON.stringify(
        call.error === undefined ? (call.result ?? null) : { error: call.error },
      ),
    })
  }
  return messages
}

export class ModelError extends Error {
  override name = 'ModelError'
}

/** One step: ask the API, and turn its answer into a tool call or final text. */
export async function complete(
  config: OpenAIConfig,
  input: ModelInput,
  signal?: AbortSignal,
): Promise<Step> {
  const response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature ?? 0,
      messages: messagesFor(input, config.system ?? SYSTEM_PROMPT),
      tools: (input.tools ?? []).map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: { type: 'object', additionalProperties: true },
        },
      })),
    }),
    ...(signal ? { signal } : {}),
  })
  if (!response.ok)
    throw new ModelError(
      `the model API answered ${response.status}: ${(await response.text()).slice(0, 300)}`,
    )
  const answer = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null
        reasoning_content?: string | null
        tool_calls?: ToolCallMessage[]
      }
    }>
  }
  const message = answer.choices?.[0]?.message
  if (!message) throw new ModelError('the model API answered without a message')
  const call = message.tool_calls?.[0]
  if (call) {
    let parsed: unknown
    try {
      parsed = call.function.arguments ? JSON.parse(call.function.arguments) : {}
    } catch {
      return {
        tool: call.function.name,
        input: { invalidArguments: call.function.arguments },
        ...(typeof message.reasoning_content === 'string'
          ? { reasoning: message.reasoning_content }
          : {}),
      }
    }
    return {
      tool: call.function.name,
      input: parsed,
      ...(typeof message.reasoning_content === 'string'
        ? { reasoning: message.reasoning_content }
        : {}),
    }
  }
  return { text: (message.content ?? '').trim() || '(no answer)' }
}

/** The plugin: provides `model`, in place of the scripted one. */
export const openai = {
  name: 'openai',
  apply(ctx: Context, config: OpenAIConfig) {
    if (!config?.baseUrl || !config.model)
      throw new ModelError('openai needs { baseUrl, model } (and apiKey for hosted APIs)')
    ctx.provide('model', { complete: (input) => complete(config, input) } satisfies Model)
  },
}
