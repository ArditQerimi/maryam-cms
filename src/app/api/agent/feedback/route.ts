import { NextResponse, type NextRequest } from 'next/server';
import { getAgentContext } from '@/lib/agent/context';
import { rateRun } from '@/lib/agent/store';
import { allowRequest } from '@/lib/in-memory-rate-limit';
import { assertMutationOrigin } from '@/lib/storefront/context';
import { isStorefrontError } from '@/lib/storefront/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Website chat: the customer rates one answer. POST { runId, rating: 1 | -1 } → { ok }. */
export async function POST(request: NextRequest) {
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (!allowRequest(`agent-feedback:${ip}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { runId?: unknown; rating?: unknown } | null;
  const runId = typeof body?.runId === 'string' && UUID.test(body.runId) ? body.runId : null;
  const rating = body?.rating === 1 || body?.rating === -1 ? body.rating : null;
  if (!runId || !rating) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const { context } = await getAgentContext();
    // Same-origin only, like the chat itself.
    assertMutationOrigin(request, context);
    // Only answers given on the website in the last day can be rated by customers.
    const ok = await rateRun(context.db, runId, 'customer', rating);
    return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
  } catch (error) {
    if (isStorefrontError(error) && error.status < 500) {
      return NextResponse.json({ ok: false }, { status: error.status });
    }
    console.error('[agent] feedback failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
