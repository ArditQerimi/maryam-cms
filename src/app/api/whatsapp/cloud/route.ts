import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { applyOrderAction } from '@/lib/storefront/order-decision';
import { cloudSendText, whatsAppCloudConfig } from '@/lib/whatsapp-cloud';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Meta's one-time webhook verification (GET with hub.* query parameters). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const wanted = process.env.WHATSAPP_VERIFY_TOKEN ?? '';
  if (wanted.length >= 12 && params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === wanted) {
    return new NextResponse(params.get('hub.challenge') ?? '', { status: 200 });
  }
  return new NextResponse('forbidden', { status: 403 });
}

function signatureOk(rawBody: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET ?? '';
  if (secret.length < 16 || !header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'));
  const given = Buffer.from(header.slice('sha256='.length));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

type IncomingMessage = {
  from?: string;
  type?: string;
  text?: { body?: string };
  interactive?: { button_reply?: { id?: string } };
};

/** The owner pressed Konfirmo / Anulo, or typed "KONFIRMO 123" / "ANULO 123". */
function parseDecision(message: IncomingMessage): { action: 'ok' | 'no'; saleId: number } | null {
  const fromButton = /^(ok|no):(\d{1,9})$/.exec(message.interactive?.button_reply?.id ?? '');
  if (fromButton) return { action: fromButton[1] as 'ok' | 'no', saleId: Number(fromButton[2]) };
  const typed = /^\s*(konfirmo|anulo)\s+#?(\d{1,9})\s*$/i.exec(message.text?.body ?? '');
  if (typed) return { action: typed[1].toLowerCase() === 'konfirmo' ? 'ok' : 'no', saleId: Number(typed[2]) };
  return null;
}

/**
 * WhatsApp Cloud API → shop. The signature (HMAC with the app secret) proves the
 * request is from Meta; only the shop owner's own number can decide, and only a
 * Pending online order can change.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!signatureOk(raw, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const owner = whatsAppCloudConfig().owner;
  try {
    const payload = JSON.parse(raw) as {
      entry?: Array<{ changes?: Array<{ value?: { messages?: IncomingMessage[] } }> }>;
    };
    const messages = (payload.entry ?? []).flatMap((entry) =>
      (entry.changes ?? []).flatMap((change) => change.value?.messages ?? []),
    );
    for (const message of messages) {
      if (!owner || String(message.from ?? '').replace(/\D/g, '') !== owner) continue;
      const decision = parseDecision(message);
      if (!decision) continue;
      const outcome = await applyOrderAction(decision.action, decision.saleId);
      await cloudSendText(owner, outcome.toast).catch(() => undefined);
    }
  } catch (error) {
    console.warn('[whatsapp-cloud] webhook failed:', error instanceof Error ? error.message : 'unknown error');
  }
  // Meta retries anything that is not 200, so acknowledge authenticated requests.
  return NextResponse.json({ ok: true });
}
