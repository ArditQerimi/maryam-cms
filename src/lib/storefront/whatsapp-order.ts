import { formatPersistedCheckoutMoney } from './checkout-money';
import type { StorefrontOrderConfirmation } from './checkout-order-confirmation';

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
