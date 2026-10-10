import { createHmac, timingSafeEqual } from 'node:crypto';
import { after, NextResponse, type NextRequest } from 'next/server';
import { answerWhatsAppMessage } from '@/lib/agent/whatsapp';
import { applyOrderAction } from '@/lib/storefront/order-decision';
import { getContextDb } from '@/lib/tenant';
import {
  cloudMarkReadTyping,
  cloudSendText,
  loadWhatsAppCloudConfig,
  stampWhatsAppCloud,
  type CloudConfig,
} from '@/lib/whatsapp-cloud';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
 * One webhook per business: Meta calls https://<business domain>/api/whatsapp/cloud, the domain
 * selects the business (getContextDb) and with it the WhatsApp settings saved in its CMS.
 */

/** Meta's one-time webhook verification (GET with hub.* query parameters). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const db = await getContextDb();
  const config = await loadWhatsAppCloudConfig(db);
  const wanted = config.verifyToken;
  if (wanted.length >= 12 && params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === wanted) {
    await stampWhatsAppCloud(db, 'verifiedAt');
    return new NextResponse(params.get('hub.challenge') ?? '', { status: 200 });
  }
  return new NextResponse('forbidden', { status: 403 });
}

function signatureOk(secret: string, rawBody: string, header: string | null) {
  if (secret.length < 16 || !header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'));
  const given = Buffer.from(header.slice('sha256='.length));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

type IncomingMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { id?: string; title?: string }; list_reply?: { title?: string } };
};

type WebhookValue = {
  contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
  messages?: IncomingMessage[];
};

/** The owner pressed Konfirmo / Anulo, or typed "KONFIRMO 123" / "ANULO 123". */
function parseDecision(message: IncomingMessage): { action: 'ok' | 'no'; saleId: number } | null {
  const fromButton = /^(ok|no):(\d{1,9})$/.exec(message.interactive?.button_reply?.id ?? '');
  if (fromButton) return { action: fromButton[1] as 'ok' | 'no', saleId: Number(fromButton[2]) };
  const typed = /^\s*(konfirmo|anulo)\s+#?(\d{1,9})\s*$/i.exec(message.text?.body ?? '');
  if (typed) return { action: typed[1].toLowerCase() === 'konfirmo' ? 'ok' : 'no', saleId: Number(typed[2]) };
  return null;
}

/** What the customer wrote (text, or the title of a button / list option they tapped). */
function textOf(message: IncomingMessage) {
  return (
    message.text?.body ??
    message.button?.text ??
    message.interactive?.button_reply?.title ??
    message.interactive?.list_reply?.title ??
    ''
  ).trim();
}

// Meta re-delivers a webhook it thinks failed: answer each message once.
const seen = new Set<string>();
function firstTime(id: string | undefined) {
  if (!id) return true;
  if (seen.has(id)) return false;
  seen.add(id);
  if (seen.size > 5000) seen.delete(seen.values().next().value as string);
  return true;
}

const MEDIA_ONLY_REPLY = 'Për momentin kuptoj vetëm mesazhe me shkrim. Ju lutem shkruani pyetjen tuaj 🙏';

/** A customer wrote to the shop: the shop assistant answers (and can take the order). */
async function answerCustomer(config: CloudConfig, message: IncomingMessage, name: string | null) {
  const from = String(message.from ?? '').replace(/\D/g, '');
  if (!from) return;
  if (message.id) await cloudMarkReadTyping(config, message.id).catch(() => undefined);

  const text = textOf(message);
  const reply = text
    ? await answerWhatsAppMessage({ chat: `cloud:${from}`, phone: from, name, text })
    : ['image', 'audio', 'video', 'document', 'sticker', 'location'].includes(message.type ?? '')
      ? MEDIA_ONLY_REPLY
      : null; // reactions, system messages…
  if (reply) await cloudSendText(config, from, reply);
}

/**
 * WhatsApp Cloud API → shop. The signature (HMAC with the app secret) proves the request is
 * from Meta. The shop owner's own number can confirm / cancel Pending online orders; every
 * other number is a customer and gets the shop assistant (same one as the website chat and
 * Telegram). Customers always write first, so replies stay inside WhatsApp's free 24h window.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const db = await getContextDb();
  const config = await loadWhatsAppCloudConfig(db);
  if (!signatureOk(config.appSecret, raw, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const payload = JSON.parse(raw) as { entry?: Array<{ changes?: Array<{ value?: WebhookValue }> }> };
    const values = (payload.entry ?? []).flatMap((entry) => (entry.changes ?? []).map((change) => change.value ?? {}));
    if (values.some((value) => (value.messages ?? []).length > 0)) await stampWhatsAppCloud(db, 'lastInboundAt');
    for (const value of values) {
      for (const message of value.messages ?? []) {
        if (!firstTime(message.id)) continue;
        const sentAt = Number(message.timestamp ?? 0) * 1000;
        if (sentAt && Date.now() - sentAt > 10 * 60_000) continue; // a stale re-delivery

        const from = String(message.from ?? '').replace(/\D/g, '');
        const decision = config.owner && from === config.owner ? parseDecision(message) : null;
        if (decision) {
          const outcome = await applyOrderAction(decision.action, decision.saleId);
          await cloudSendText(config, config.owner, outcome.toast).catch(() => undefined);
          continue;
        }
        if (from === config.owner || !config.agentEnabled) continue; // the owner only sends decisions

        const name = value.contacts?.find((contact) => contact.wa_id === message.from)?.profile?.name ?? null;
        // Answer after the 200: Meta expects a quick response, the assistant can take seconds.
        after(() =>
          answerCustomer(config, message, name).catch((error) =>
            console.warn('[whatsapp-cloud] customer reply failed:', error instanceof Error ? error.message : 'unknown error'),
          ),
        );
      }
    }
  } catch (error) {
    console.warn('[whatsapp-cloud] webhook failed:', error instanceof Error ? error.message : 'unknown error');
  }
  // Meta retries anything that is not 200, so acknowledge authenticated requests.
  return NextResponse.json({ ok: true });
}
