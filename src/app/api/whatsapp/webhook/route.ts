import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { applyOrderAction } from '@/lib/storefront/order-decision';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function tokenOk(header: string | null) {
  const wanted = process.env.WHATSAPP_AGENT_TOKEN ?? '';
  const given = String(header ?? '').replace(/^Bearer\s+/i, '');
  if (wanted.length < 24 || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(wanted);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * whatsapp-agent → shop: the shop owner replied "KONFIRMO 123" / "ANULO 123".
 * Accepted only with the shared agent token AND only for the shop's own number
 * (WHATSAPP_AGENT_TO); it can only confirm/cancel a still-Pending online order.
 */
export async function POST(request: NextRequest) {
  if (!tokenOk(request.headers.get('authorization'))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    saleId?: unknown;
    from?: unknown;
  } | null;

  const owner = (process.env.WHATSAPP_AGENT_TO ?? '').replace(/\D/g, '');
  const from = String(body?.from ?? '').replace(/\D/g, '');
  if (!owner || from !== owner) {
    return NextResponse.json({ ok: false, toast: 'Nuk lejohet.' }, { status: 403 });
  }
  const action = body?.action === 'ok' || body?.action === 'no' ? body.action : null;
  const saleId = Number(body?.saleId);
  if (!action || !Number.isSafeInteger(saleId) || saleId < 1) {
    return NextResponse.json({ ok: false, toast: 'Kërkesë e pavlefshme.' }, { status: 400 });
  }

  try {
    const outcome = await applyOrderAction(action, saleId);
    return NextResponse.json({ ok: outcome.status !== 'rejected', toast: outcome.toast });
  } catch {
    return NextResponse.json({ ok: false, toast: 'Gabim në server.' }, { status: 500 });
  }
}
