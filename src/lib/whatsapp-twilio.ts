import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * WhatsApp through Twilio (an official WhatsApp Business API provider).
 * Works with Twilio's free WhatsApp Sandbox for testing, and with a verified
 * sender later. No Meta app of your own is needed for the sandbox.
 *
 * Environment (secrets stay in the environment):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 *   TWILIO_WHATSAPP_FROM   sender, e.g. whatsapp:+14155238886 (the sandbox number)
 *   WHATSAPP_OWNER_TO      the shop owner's number (country code, digits) — receives orders
 *   TWILIO_WEBHOOK_URL     the exact public URL set in Twilio for incoming messages,
 *                          e.g. https://your-domain/api/whatsapp/twilio
 */
export function twilioConfig() {
  const sid = process.env.TWILIO_ACCOUNT_SID ?? '';
  const token = process.env.TWILIO_AUTH_TOKEN ?? '';
  const from = process.env.TWILIO_WHATSAPP_FROM ?? '';
  const owner = (process.env.WHATSAPP_OWNER_TO ?? '').replace(/\D/g, '');
  return {
    sid,
    token,
    from,
    owner,
    webhookUrl: process.env.TWILIO_WEBHOOK_URL ?? '',
    configured: Boolean(sid && token && from && owner),
  };
}

export async function twilioSendWhatsApp(to: string, body: string) {
  const { sid, token, from } = twilioConfig();
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: from, To: `whatsapp:+${to}`, Body: body.slice(0, 1500) }),
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`twilio-${response.status}`);
}

/**
 * Twilio signs every webhook: HMAC-SHA1 over the full URL followed by the POST
 * parameters sorted by name (name+value), keyed with the auth token.
 */
export function twilioSignatureOk(url: string, params: URLSearchParams, header: string | null) {
  const { token } = twilioConfig();
  if (!token || !header || !url) return false;
  const data = [...params.keys()]
    .sort()
    .reduce((acc, key) => acc + key + (params.get(key) ?? ''), url);
  const expected = Buffer.from(createHmac('sha1', token).update(data).digest('base64'));
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
