/**
 * Provider-agnostic chat client for the shop assistant: any OpenAI-compatible
 * `/chat/completions` API with tool calling (Groq, OpenRouter, Mistral, Gemini's compat endpoint, ...).
 *
 *   AGENT_API_KEY    the provider's key (required)
 *   AGENT_PROVIDER   groq (default) | openrouter | mistral | gemini
 *   AGENT_MODEL      overrides the provider's default model
 *   AGENT_BASE_URL   overrides the provider's API base (any OpenAI-compatible server)
 *
 * A legacy GEMINI_API_KEY alone still works (provider gemini).
 */

type Provider = { baseUrl: string; model: string };

const PROVIDERS: Record<string, Provider> = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct:free' },
  mistral: { baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-flash-latest' },
};

export type LlmToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };

export type LlmMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: LlmToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export type LlmTool = { name: string; description: string; parameters: Record<string, unknown> };

export class LlmError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'LlmError';
    this.status = status;
  }
}

function settings() {
  const explicitKey = process.env.AGENT_API_KEY?.trim();
  const legacyGemini = process.env.GEMINI_API_KEY?.trim();
  const key = explicitKey || legacyGemini || '';
  const name = (process.env.AGENT_PROVIDER?.trim().toLowerCase() || (explicitKey ? 'groq' : legacyGemini ? 'gemini' : 'groq'));
  const preset = PROVIDERS[name] ?? PROVIDERS.groq;
  return {
    key,
    baseUrl: (process.env.AGENT_BASE_URL?.trim() || preset.baseUrl).replace(/\/+$/, ''),
    model: process.env.AGENT_MODEL?.trim() || preset.model,
  };
}

export function isAgentConfigured() {
  return Boolean(settings().key);
}

export async function chat(input: {
  system: string;
  messages: LlmMessage[];
  tools: LlmTool[];
}): Promise<Extract<LlmMessage, { role: 'assistant' }>> {
  const { key, baseUrl, model } = settings();
  if (!key) throw new LlmError('AGENT_API_KEY is not set', 503);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: input.system }, ...input.messages],
      tools: input.tools.map((tool) => ({ type: 'function', function: tool })),
      tool_choice: 'auto',
      temperature: 0.4,
      max_tokens: 900,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: LlmToolCall[] } }>;
    error?: { message?: string } | string;
  };
  if (!response.ok) {
    const detail = typeof payload.error === 'string' ? payload.error : payload.error?.message;
    throw new LlmError(detail ?? `LLM ${response.status}`, response.status);
  }
  const message = payload.choices?.[0]?.message;
  if (!message) throw new LlmError('The model returned no message', 502);
  return {
    role: 'assistant',
    content: message.content ?? null,
    ...(message.tool_calls?.length ? { tool_calls: message.tool_calls } : {}),
  };
}
