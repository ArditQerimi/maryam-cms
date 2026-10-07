/**
 * WhatsApp Cloud API (Meta) — the official API, no QR code and no phone kept
 * online. Free tier: Meta's test number can message up to 5 verified numbers,
 * and service conversations (replies within 24h) have a monthly free allowance.
 *
 * Environment (secrets live in the environment only):
 *   WHATSAPP_CLOUD_TOKEN        access token of the Meta app
 *   WHATSAPP_PHONE_NUMBER_ID    the sending number's ID (not the phone number itself)
 *   WHATSAPP_OWNER_TO           the shop owner's number that receives orders (country code, digits)
 *   WHATSAPP_APP_SECRET         app secret, used to verify the webhook signature
 *   WHATSAPP_VERIFY_TOKEN       any random string you also paste into the webhook setup
 *   WHATSAPP_ORDER_TEMPLATE     optional: approved template name (utility, 3 body variables:
 *                               order number, summary, total) used when the 24h window is closed
 */
export function whatsAppCloudConfig() {
  const token = process.env.WHATSAPP_CLOUD_TOKEN ?? '';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  const owner = (process.env.WHATSAPP_OWNER_TO ?? '').replace(/\D/g, '');
  return {
    token,
    phoneNumberId,
    owner,
    template: process.env.WHATSAPP_ORDER_TEMPLATE ?? '',
    configured: Boolean(token && phoneNumberId && owner),
  };
}

const GRAPH = 'https://graph.facebook.com/v21.0';

export async function cloudSend(payload: Record<string, unknown>) {
  const { token, phoneNumberId } = whatsAppCloudConfig();
  const response = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { code?: number } } | null;
    throw Object.assign(new Error(`cloud-api-${response.status}`), { code: body?.error?.code });
  }
}

export function cloudSendText(to: string, text: string) {
  return cloudSend({ to, type: 'text', text: { body: text.slice(0, 4000) } });
}

/** Order message with two reply buttons (works while the owner's 24h window is open). */
export function cloudSendOrderButtons(to: string, text: string, saleId: number) {
  return cloudSend({
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: text.slice(0, 1000) },
      action: {
        buttons: [
          { type: 'reply', reply: { id: `ok:${saleId}`, title: '✅ Konfirmo' } },
          { type: 'reply', reply: { id: `no:${saleId}`, title: '❌ Anulo' } },
        ],
      },
    },
  });
}

/** Template message for when the 24h window is closed (business-initiated). */
export function cloudSendOrderTemplate(
  to: string,
  template: string,
  values: [string, string, string],
) {
  return cloudSend({
    to,
    type: 'template',
    template: {
      name: template,
      language: { code: 'sq' },
      components: [{ type: 'body', parameters: values.map((text) => ({ type: 'text', text: text.slice(0, 900) })) }],
    },
  });
}
