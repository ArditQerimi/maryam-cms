import { eq } from 'drizzle-orm';
import { settingsStore } from '@/db/schema-tenant';
import { getContextDb } from '@/lib/tenant';
import { formatPersistedCheckoutMoney } from './checkout-money';
import type { StorefrontOrderConfirmation } from './checkout-order-confirmation';

/** `settings_store` key edited in CMS → Settings → General. */
export const WHATSAPP_NUMBER_SETTING = 'general_whatsapp_number';

/** wa.me wants digits only, country code included (no +, spaces or leading zeros). */
export function normalizeWhatsAppNumber(raw: string | null | undefined) {
  const digits = String(raw ?? '').replace(/\D/g, '').replace(/^00/, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

function parseStoredValue(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === 'string' || typeof parsed === 'number' ? String(parsed) : '';
  } catch {
    return raw;
  }
}

/**
 * The shop's WhatsApp number: the CMS setting first, `WHATSAPP_ORDER_NUMBER`
 * (environment) as a fallback. `null` means WhatsApp ordering is not set up.
 */
export async function getWhatsAppOrderNumber() {
  try {
    const db = await getContextDb();
    const [row] = await db
      .select({ value: settingsStore.value })
      .from(settingsStore)
      .where(eq(settingsStore.key, WHATSAPP_NUMBER_SETTING))
      .limit(1);
    const fromSettings = row ? normalizeWhatsAppNumber(parseStoredValue(row.value)) : null;
    if (fromSettings) return fromSettings;
  } catch {
    // Fall through to the environment value.
  }
  return normalizeWhatsAppNumber(process.env.WHATSAPP_ORDER_NUMBER);
}

/**
 * The order message, built ONLY from the order as stored by the server —
 * product names, quantities, line totals and the grand total come from the
 * database, never from anything the browser sent. The customer can still edit
 * the text inside WhatsApp, which is why the order of record is the stored one:
 * the order number below identifies it in the CMS.
 */
export type WhatsAppOrderSource = Pick<
  StorefrontOrderConfirmation,
  'orderNumber' | 'currency' | 'total' | 'lines' | 'shippingAddress' | 'contactPhone'
>;

export function buildWhatsAppOrderMessage(order: WhatsAppOrderSource) {
  const money = (value: string) => formatPersistedCheckoutMoney(value, order.currency);
  const shipping = order.shippingAddress ?? {};
  const name = [shipping.firstName, shipping.lastName].filter(Boolean).join(' ').trim();
  const place = [shipping.address1, shipping.city].filter(Boolean).join(', ');

  const lines = order.lines.map(
    (line) =>
      `• ${line.name}${line.variant ? ` (${line.variant})` : ''} × ${line.quantity} — ${money(line.total)}`,
  );

  return [
    `Përshëndetje! Po e konfirmoj porosinë ${order.orderNumber}:`,
    '',
    ...lines,
    '',
    `Totali: ${money(order.total)}`,
    name ? `Emri: ${name}` : '',
    place ? `Adresa: ${place}` : '',
    order.contactPhone ? `Telefoni: ${order.contactPhone}` : '',
  ]
    .filter((line, index, all) => line !== '' || (index > 0 && all[index - 1] !== ''))
    .join('\n');
}

export function buildWhatsAppOrderUrl(order: StorefrontOrderConfirmation, number: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(buildWhatsAppOrderMessage(order))}`;
}
