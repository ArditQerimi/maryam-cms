import { asc, eq, like } from 'drizzle-orm';
import * as schema from '@/db/schema-tenant';
import { sendEmail } from '@/lib/email/send';
import { buildSmtpConfig } from '@/lib/email/smtp-config';
import {
  orderCancelledEmailMessage,
  orderConfirmedEmailMessage,
  orderReceivedEmailMessage,
} from '@/lib/email/templates';
import type { getContextDb } from '@/lib/tenant';
import { formatPersistedCheckoutMoney } from './checkout-money';

type Db = Awaited<ReturnType<typeof getContextDb>>;

export type OrderEmailKind = 'received' | 'confirmed' | 'cancelled';

const SUBJECTS: Record<OrderEmailKind, (reference: string) => string> = {
  received: (reference) => `Porosia ${reference} u pranua — pret konfirmimin`,
  confirmed: (reference) => `Porosia ${reference} u konfirmua`,
  cancelled: (reference) => `Porosia ${reference} u anulua`,
};

const TEMPLATES = {
  received: orderReceivedEmailMessage,
  confirmed: orderConfirmedEmailMessage,
  cancelled: orderCancelledEmailMessage,
} as const;

/**
 * Email the customer about their order: received (waiting for confirmation),
 * confirmed, or cancelled. Uses the same channel as every other store email
 * (Resend, else the SMTP settings). Best effort — never throws, never blocks an order.
 */
export async function sendOrderEmail(db: Db, saleId: number, kind: OrderEmailKind) {
  try {
    const [order] = await db
      .select({
        reference: schema.sales.reference,
        grandTotal: schema.sales.grandTotal,
        email: schema.storefrontOrderDetails.contactEmail,
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
    if (!order?.email) return;

    const items = await db
      .select({
        name: schema.products.name,
        quantity: schema.saleItems.quantity,
      })
      .from(schema.saleItems)
      .innerJoin(schema.productVariants, eq(schema.productVariants.id, schema.saleItems.variantId))
      .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
      .where(eq(schema.saleItems.saleId, saleId))
      .orderBy(asc(schema.saleItems.id));

    const settings = await db
      .select({ key: schema.settingsStore.key, value: schema.settingsStore.value })
      .from(schema.settingsStore)
      .where(like(schema.settingsStore.key, 'smtp_%'));

    const shipping = (order.shippingAddress ?? {}) as Record<string, string>;
    const recipientName = [shipping.firstName, shipping.lastName].filter(Boolean).join(' ').trim();
    const input = {
      recipientName: recipientName || undefined,
      orderReference: order.reference,
      amountText: formatPersistedCheckoutMoney(String(order.grandTotal), order.currency),
      lines: items.map((item) => ({ name: item.name, quantity: Number(item.quantity) })),
    };

    const outcome = await sendEmail({
      to: order.email,
      subject: SUBJECTS[kind](order.reference),
      react: TEMPLATES[kind](input),
      smtp: buildSmtpConfig(settings),
    });
    if (!outcome.ok && !('notConfigured' in outcome)) {
      console.warn(`[order-email] ${kind} email failed:`, outcome.error);
    }
  } catch (error) {
    console.warn(`[order-email] ${kind} email error:`, error instanceof Error ? error.message : 'unknown error');
  }
}
