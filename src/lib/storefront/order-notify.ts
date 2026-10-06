import { asc, eq } from 'drizzle-orm';
import * as schema from '@/db/schema-tenant';
import type { StorefrontContext } from './context';
import { buildWhatsAppOrderMessage } from './whatsapp-order';

/**
 * Free, server-side order notifications — sent by the server the moment an
 * order is stored, so nobody has to open WhatsApp and nothing can be edited on
 * the way. Every channel is optional and configured with environment variables
 * (secrets never go into the code or the database):
 *
 *  - WhatsApp via CallMeBot (free, unofficial; notifies YOUR number):
 *      CALLMEBOT_PHONE   your number with country code, e.g. 38344123456
 *      CALLMEBOT_APIKEY  the key the bot sends you after you activate it
 *  - Telegram bot (free, official):
 *      TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 *
 * A failing channel is logged (without secrets) and never fails the order.
 */

type Db = StorefrontContext['db'];

async function loadOrderForNotification(db: Db, saleId: number) {
  const [sale] = await db
    .select({
      reference: schema.sales.reference,
      grandTotal: schema.sales.grandTotal,
      contactPhone: schema.storefrontOrderDetails.contactPhone,
      currency: schema.storefrontOrderDetails.currency,
      shippingAddress: schema.storefrontOrderDetails.shippingAddress,
    })
    .from(schema.sales)
    .innerJoin(
      schema.storefrontOrderDetails,
      eq(schema.storefrontOrderDetails.saleId, schema.sales.id),
    )
    .where(eq(schema.sales.id, saleId))
    .limit(1);
  if (!sale) return null;

  const rows = await db
    .select({
      productName: schema.products.name,
      variantName: schema.productVariants.name,
      quantity: schema.saleItems.quantity,
      subtotal: schema.saleItems.subtotal,
    })
    .from(schema.saleItems)
    .innerJoin(schema.productVariants, eq(schema.productVariants.id, schema.saleItems.variantId))
    .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
    .where(eq(schema.saleItems.saleId, saleId))
    .orderBy(asc(schema.saleItems.id));

  return {
    orderNumber: sale.reference,
    currency: sale.currency,
    total: String(sale.grandTotal),
    contactPhone: sale.contactPhone,
    shippingAddress: (sale.shippingAddress ?? {}) as Record<string, string>,
    lines: rows.map((row) => ({
      name: row.productName,
      variant: row.variantName && row.variantName !== row.productName ? row.variantName : null,
      quantity: Number(row.quantity),
      total: String(row.subtotal),
    })),
  };
}

async function post(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(8000), cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

async function sendCallMeBot(text: string) {
  const phone = (process.env.CALLMEBOT_PHONE ?? '').replace(/\D/g, '');
  const apikey = process.env.CALLMEBOT_APIKEY ?? '';
  if (!phone || !apikey) return 'skipped';
  const query = new URLSearchParams({ phone, text, apikey });
  await post(`https://api.callmebot.com/whatsapp.php?${query.toString()}`);
  return 'sent';
}

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? '';
  const chatId = process.env.TELEGRAM_CHAT_ID ?? '';
  if (!token || !chatId) return 'skipped';
  await post(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return 'sent';
}

/** Tell the shop about a freshly stored order. Never throws. */
export async function notifyNewOrder(db: Db, saleId: number) {
  try {
    const order = await loadOrderForNotification(db, saleId);
    if (!order) return;
    const text = `🛒 Porosi e re\n\n${buildWhatsAppOrderMessage(order)}`;

    const channels: Array<[string, (text: string) => Promise<string>]> = [
      ['whatsapp-callmebot', sendCallMeBot],
      ['telegram', sendTelegram],
    ];
    for (const [name, send] of channels) {
      try {
        await send(text);
      } catch (error) {
        console.warn(`[order-notify] ${name} failed:`, error instanceof Error ? error.message : 'unknown error');
      }
    }
  } catch (error) {
    console.warn('[order-notify] could not prepare notification:', error instanceof Error ? error.message : 'unknown error');
  }
}
