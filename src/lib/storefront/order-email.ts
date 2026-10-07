import { asc, eq } from 'drizzle-orm';
import * as schema from '@/db/schema-tenant';
import { addressLines } from '@/lib/account/addresses';
import { sendEmail } from '@/lib/email/send';
import { buildSmtpConfig } from '@/lib/email/smtp-config';
import {
  orderCancelledEmailMessage,
  orderConfirmedEmailMessage,
  orderReceivedEmailMessage,
  type OrderEmailData,
} from '@/lib/email/order-templates';
import type { getContextDb } from '@/lib/tenant';
import { formatPersistedCheckoutMoney } from './checkout-money';

type Db = Awaited<ReturnType<typeof getContextDb>>;

export type OrderEmailKind = 'received' | 'confirmed' | 'cancelled';

const SUBJECTS: Record<OrderEmailKind, (reference: string) => string> = {
  received: (reference) => `Porosia ${reference} u bë — po pritet konfirmimi`,
  confirmed: (reference) => `Porosia ${reference} u konfirmua`,
  cancelled: (reference) => `Porosia ${reference} u anulua`,
};

const TEMPLATES = {
  received: orderReceivedEmailMessage,
  confirmed: orderConfirmedEmailMessage,
  cancelled: orderCancelledEmailMessage,
} as const;

const PAYMENT_LABELS: Record<string, string> = {
  cash_on_delivery: 'Pagesa në dorëzim',
  card: 'Pagesa me kartë',
};

function parseSetting(raw: string | undefined) {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === 'string' ? parsed.trim() : '';
  } catch {
    return raw.trim();
  }
}

/**
 * Email the customer about their order: placed (waiting for confirmation),
 * confirmed, or cancelled. Everything in the email comes from the stored order.
 * Uses the same channel as every other store email (Resend, else the SMTP
 * settings). `origin` (scheme://host of the shop) builds the "view order" link.
 * Best effort — never throws, never blocks an order.
 */
export async function sendOrderEmail(db: Db, saleId: number, kind: OrderEmailKind, origin = '') {
  try {
    const [order] = await db
      .select({
        id: schema.sales.id,
        reference: schema.sales.reference,
        grandTotal: schema.sales.grandTotal,
        subtotal: schema.sales.totalAmount,
        discount: schema.sales.discount,
        tax: schema.sales.tax,
        email: schema.storefrontOrderDetails.contactEmail,
        currency: schema.storefrontOrderDetails.currency,
        shippingAddress: schema.storefrontOrderDetails.shippingAddress,
        paymentMethodId: schema.storefrontOrderDetails.paymentMethodId,
      })
      .from(schema.sales)
      .innerJoin(
        schema.storefrontOrderDetails,
        eq(schema.storefrontOrderDetails.saleId, schema.sales.id),
      )
      .where(eq(schema.sales.id, saleId))
      .limit(1);
    if (!order?.email) return;

    const items = await db
      .select({
        name: schema.products.name,
        variant: schema.productVariants.name,
        quantity: schema.saleItems.quantity,
        total: schema.saleItems.subtotal,
      })
      .from(schema.saleItems)
      .innerJoin(schema.productVariants, eq(schema.productVariants.id, schema.saleItems.variantId))
      .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
      .where(eq(schema.saleItems.saleId, saleId))
      .orderBy(asc(schema.saleItems.id));

    const settings = await db
      .select({ key: schema.settingsStore.key, value: schema.settingsStore.value })
      .from(schema.settingsStore);
    const smtpRows = settings.filter((row) => row.key.toLowerCase().startsWith('smtp_'));
    const storeName =
      parseSetting(settings.find((row) => row.key === 'general_site_title')?.value) || 'Dyqani';

    const money = (value: string | number) => formatPersistedCheckoutMoney(String(value), order.currency);
    const grand = Number(order.grandTotal);
    const discount = Number(order.discount ?? 0);
    const tax = Number(order.tax ?? 0);
    // Shipping is what remains of the grand total after merchandise, coupon and tax.
    const shipping = grand - Number(order.subtotal) + discount - tax;

    const address = (order.shippingAddress ?? {}) as Record<string, string>;
    const data: OrderEmailData = {
      storeName,
      recipientName: address.firstName?.trim() || undefined,
      orderReference: order.reference,
      orderUrl: origin ? `${origin}/home/account/orders/${order.id}` : undefined,
      lines: items.map((item) => ({
        name: item.name,
        variant: item.variant && item.variant !== item.name ? item.variant : null,
        quantity: Number(item.quantity),
        total: money(item.total),
      })),
      subtotal: money(order.subtotal),
      discount: discount > 0 ? money(discount) : null,
      shipping: shipping > 0.004 ? money(shipping.toFixed(2)) : null,
      tax: tax > 0 ? money(tax) : null,
      total: money(grand),
      shippingAddress: addressLines(address),
      paymentLabel: PAYMENT_LABELS[order.paymentMethodId] ?? order.paymentMethodId.replace(/_/g, ' '),
    };

    const outcome = await sendEmail({
      to: order.email,
      subject: SUBJECTS[kind](order.reference),
      react: TEMPLATES[kind](data),
      smtp: buildSmtpConfig(smtpRows),
    });
    if (!outcome.ok && !('notConfigured' in outcome)) {
      console.warn(`[order-email] ${kind} email failed:`, outcome.error);
    }
  } catch (error) {
    console.warn(`[order-email] ${kind} email error:`, error instanceof Error ? error.message : 'unknown error');
  }
}
