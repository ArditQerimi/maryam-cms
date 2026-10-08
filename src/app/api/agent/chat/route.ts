import { NextResponse, type NextRequest } from 'next/server';
import { getAgentContext } from '@/lib/agent/context';
import { isGeminiConfigured } from '@/lib/agent/gemini';
import { runAgent, type ChatTurn } from '@/lib/agent/run';
import { assertMutationOrigin } from '@/lib/storefront/context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 24 * 1024;

function clientKey(request: NextRequest) {
  const forwarded = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  return `web:${forwarded || request.headers.get('x-real-ip') || 'unknown'}`;
}

/** Website chat: POST { message, history: [{ role, text }] } → { reply }. */
export async function POST(request: NextRequest) {
  if (!isGeminiConfigured()) {
    return NextResponse.json({ error: 'agent-unavailable' }, { status: 503 });
  }
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) return NextResponse.json({ error: 'too-large' }, { status: 413 });

  let body: { message?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return NextResponse.json({ error: 'empty' }, { status: 400 });

  const history: ChatTurn[] = Array.isArray(body.history)
    ? body.history.flatMap((item) => {
        const turn = item as { role?: unknown; text?: unknown };
        return (turn.role === 'user' || turn.role === 'assistant') && typeof turn.text === 'string'
          ? [{ role: turn.role, text: turn.text }]
          : [];
      })
    : [];

  try {
    const { context, shopName } = await getAgentContext();
    // Same-origin only: the chat belongs to this storefront, other sites cannot drive it.
    assertMutationOrigin(request, context);
    const reply = await runAgent({
      env: { context, channel: 'web', sessionKey: clientKey(request) },
      shopName,
      history,
      message,
    });
    return NextResponse.json({ reply }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[agent] chat route failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'agent-unavailable' }, { status: 503 });
  }
}
