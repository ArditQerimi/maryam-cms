import { NextResponse, type NextRequest } from 'next/server';
import { applyOrderAction } from '@/lib/storefront/order-decision';
import { twilioConfig, twilioSendWhatsApp, twilioSignatureOk } from '@/lib/whatsapp-twilio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const xml = (status: number) =>
  new NextResponse(EMPTY_TWIML, { status, headers: { 'content-type': 'text/xml' } });

/**
 * Twilio → shop: the owner replied "KONFIRMO 123" / "ANULO 123" on WhatsApp.
 * The Twilio signature proves the request is Twilio's; only the shop owner's own
 * number may decide, and only a Pending online order can change.
 */
export async function POST(request: NextRequest) {
  const params = new URLSearchParams(await request.text());
  const config = twilioConfig();
  if (!twilioSignatureOk(config.webhookUrl, params, request.headers.get('x-twilio-signature'))) {
    return xml(403);
  }

  const from = (params.get('From') ?? '').replace(/\D/g, '');
  if (!config.owner || from !== config.owner) return xml(200);

  const match = /^\s*(konfirmo|anulo)\s+#?(\d{1,9})\s*$/i.exec(params.get('Body') ?? '');
  if (!match) return xml(200);

  try {
    const outcome = await applyOrderAction(match[1].toLowerCase() === 'konfirmo' ? 'ok' : 'no', Number(match[2]));
    await twilioSendWhatsApp(config.owner, outcome.toast).catch(() => undefined);
  } catch (error) {
    console.warn('[whatsapp-twilio] webhook failed:', error instanceof Error ? error.message : 'unknown error');
  }
  return xml(200);
}
