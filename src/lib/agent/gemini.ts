/**
 * Minimal Gemini client (REST, no SDK): one `generateContent` call with function calling.
 * Free keys come from https://aistudio.google.com/apikey (GEMINI_API_KEY).
 */

export type GeminiPart = {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  // Gemini 2.5 attaches opaque signatures that must be echoed back unchanged.
  [key: string]: unknown;
};

export type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };

export type GeminiFunctionDeclaration = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export class GeminiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
  }
}

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export async function generate(input: {
  system: string;
  contents: GeminiContent[];
  tools: GeminiFunctionDeclaration[];
}): Promise<GeminiContent> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new GeminiError('GEMINI_API_KEY is not set', 503);
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: input.contents,
        tools: input.tools.length ? [{ functionDeclarations: input.tools }] : undefined,
        generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
      }),
      signal: AbortSignal.timeout(25_000),
    },
  );

  const payload = (await response.json().catch(() => ({}))) as {
    candidates?: Array<{ content?: GeminiContent; finishReason?: string }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new GeminiError(payload.error?.message ?? `Gemini ${response.status}`, response.status);
  }
  const content = payload.candidates?.[0]?.content;
  if (!content?.parts?.length) {
    throw new GeminiError(`Gemini returned no content (${payload.candidates?.[0]?.finishReason ?? 'unknown'})`, 502);
  }
  return { role: 'model', parts: content.parts };
}
