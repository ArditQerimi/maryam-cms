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
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b' },
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

export type LlmReply = {
  message: Extract<LlmMessage, { role: 'assistant' }>;
  usage: { promptTokens: number; completionTokens: number };
};

export async function chat(input: {
  system: string;
  messages: LlmMessage[];
  tools: LlmTool[];
}): Promise<LlmReply> {
  const { key, baseUrl, model } = settings();
  if (!key) throw new LlmError('AGENT_API_KEY is not set', 503);

  const request = () =>
    fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: input.system }, ...input.messages],
        tools: input.tools.map((tool) => ({ type: 'function', function: tool })),
        tool_choice: 'auto',
        temperature: 0.4,
        max_tokens: 900,
        // gpt-oss reasons before answering; a little is enough here and saves the free token quota.
        ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
      }),
      signal: AbortSignal.timeout(30_000),
    });

  // Free tiers cap tokens per minute: wait what the provider asks for ("retry-after" header or
  // "try again in 2.9s" in the message) and try again, up to 3 times / ~25 s in total.
  let response = await request();
  let waited = 0;
  for (let attempt = 0; response.status === 429 && attempt < 3 && waited < 25_000; attempt += 1) {
    const header = Number(response.headers.get('retry-after'));
    const body = await response.clone().text().catch(() => '');
    const inText = Number(/try again in ([\d.]+)\s*s/i.exec(body)?.[1]);
    const askedMs = Number.isFinite(header) && header > 0 ? header * 1000 : Number.isFinite(inText) && inText > 0 ? inText * 1000 : 4000;
    const waitMs = Math.min(askedMs + 300, 12_000, 25_000 - waited);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    waited += waitMs;
    response = await request();
  }

  const payload = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: LlmToolCall[] } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string } | string;
  };
  if (!response.ok) {
    const detail = typeof payload.error === 'string' ? payload.error : payload.error?.message;
    throw new LlmError(detail ?? `LLM ${response.status}`, response.status);
  }
  const message = payload.choices?.[0]?.message;
  if (!message) throw new LlmError('The model returned no message', 502);
  return {
    message: {
      role: 'assistant',
      content: message.content ?? null,
      ...(message.tool_calls?.length ? { tool_calls: message.tool_calls } : {}),
    },
    // Tokens the provider reports (0 when it does not say): for the audit trail and cost.
    usage: {
      promptTokens: Number(payload.usage?.prompt_tokens) || 0,
      completionTokens: Number(payload.usage?.completion_tokens) || 0,
    },
  };
}
