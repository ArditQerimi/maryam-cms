'use server';

import { revalidatePath } from 'next/cache';
import { eq, like } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import {
  customers,
  orderNotes,
  orderTracking,
  productVariants,
  products,
  saleItems,
  sales,
  settingsStore,
  storefrontOrderDetails,
  users,
} from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { formatMoney } from '@/lib/cms/format';
import { buildSmtpConfig } from '@/lib/email/smtp-config';
import { advanceOrder, applyOrderAction, type OrderStage } from '@/lib/storefront/order-decision';
import { isResendConfigured, sendEmail } from '@/lib/email/send';
import { trackingEmailMessage } from '@/lib/email/templates';

export type OrderActionResult = { ok: boolean; error?: string };
export type SendEmailResult = {
  ok: boolean;
  error?: string;
  notConfigured?: boolean;
};
export type RefundResult = { ok: boolean; error?: string; refunded?: string };

const SALE_STATUSES = ['Pending', 'Completed', 'Cancelled', 'Returned'] as const;
type SaleStatus = (typeof SALE_STATUSES)[number];

function readString(formData: FormData, key: string, max = 4000) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function parsePositiveId(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/* -------------------------------------------------------------------------- */
/* Status                                                                      */
/* -------------------------------------------------------------------------- */

export async function updateOrderStatus(orderId: number, status: string): Promise<OrderActionResult> {
  await requireCmsSession();
  if (!(SALE_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: 'Unknown order status.' };
  }

  const db = await getContextDb();
  const [sale] = await db
    .select({ id: sales.id })
    .from(sales)
    .where(eq(sales.id, orderId))
    .limit(1);
  if (!sale) return { ok: false, error: 'Order not found.' };

  await db
    .update(sales)
    .set({ status: status as SaleStatus })
    .where(eq(sales.id, orderId));

  // `storefront_order_details` has no status column, so `sales.status` stays
  // the single source of truth for order state.

  revalidatePath('/cms/orders');
  revalidatePath(`/cms/orders/${orderId}`);
  revalidatePath('/cms/dashboard');
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Tracking                                                                    */
/* -------------------------------------------------------------------------- */

type TrackingInput = { trackingNumber: string; carrier: string; trackingUrl: string };

function readTracking(formData: FormData): TrackingInput {
  return {
    trackingNumber: readString(formData, 'trackingNumber', 255).trim(),
    carrier: readString(formData, 'carrier', 255).trim(),
    trackingUrl: readString(formData, 'trackingUrl', 1000).trim(),
  };
}

async function upsertTracking(
  db: Awaited<ReturnType<typeof getContextDb>>,
  orderId: number,
  input: TrackingInput,
) {
  const [existing] = await db
    .select({ id: orderTracking.id })
    .from(orderTracking)
    .where(eq(orderTracking.orderId, orderId))
    .limit(1);

  if (existing) {
    await db
      .update(orderTracking)
      .set({
        trackingNumber: input.trackingNumber || null,
        carrier: input.carrier || null,
        trackingUrl: input.trackingUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(orderTracking.id, existing.id));
    return;
  }

  await db.insert(orderTracking).values({
    orderId,
    trackingNumber: input.trackingNumber || null,
    carrier: input.carrier || null,
    trackingUrl: input.trackingUrl || null,
  });
}

export async function saveTracking(orderId: number, formData: FormData): Promise<OrderActionResult> {
  await requireCmsSession();
  const db = await getContextDb();

  const [sale] = await db.select({ id: sales.id }).from(sales).where(eq(sales.id, orderId)).limit(1);
  if (!sale) return { ok: false, error: 'Order not found.' };

  await upsertTracking(db, orderId, readTracking(formData));

  revalidatePath(`/cms/orders/${orderId}`);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Tracking email                                                              */
/* -------------------------------------------------------------------------- */

export async function sendTrackingEmail(orderId: number): Promise<SendEmailResult> {
  await requireCmsSession();
  const db = await getContextDb();

  try {
    const [sale] = await db
      .select({
        id: sales.id,
        reference: sales.reference,
        grandTotal: sales.grandTotal,
        customerId: sales.customerId,
        customerUserId: sales.customerUserId,
      })
      .from(sales)
      .where(eq(sales.id, orderId))
      .limit(1);
    if (!sale) return { ok: false, error: 'Order not found.' };

    const [details] = await db
      .select({
        contactEmail: storefrontOrderDetails.contactEmail,
        currency: storefrontOrderDetails.currency,
      })
      .from(storefrontOrderDetails)
      .where(eq(storefrontOrderDetails.saleId, orderId))
      .limit(1);

    const [customer] = sale.customerId
      ? await db
          .select({ name: customers.name, email: customers.email })
          .from(customers)
          .where(eq(customers.id, sale.customerId))
          .limit(1)
      : [];

    const [user] = sale.customerUserId
      ? await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, sale.customerUserId))
          .limit(1)
      : [];

    const to = details?.contactEmail || customer?.email || user?.email || '';
    if (!to) return { ok: false, error: 'This order has no customer email address.' };

    const [tracking] = await db
      .select()
      .from(orderTracking)
      .where(eq(orderTracking.orderId, orderId))
      .limit(1);
    if (!tracking || !tracking.trackingNumber) {
      return { ok: false, error: 'Save a tracking number first.' };
    }

    const settings = await db
      .select({ key: settingsStore.key, value: settingsStore.value })
      .from(settingsStore)
      .where(like(settingsStore.key, 'smtp_%'));

    const config = buildSmtpConfig(settings);
    const resendReady = isResendConfigured();
    if (!config && !resendReady) {
      return {
        ok: false,
        notConfigured: true,
        error:
          'No email provider configured — add RESEND_API_KEY to the .env file (Resend) or save your SMTP settings at /cms/settings/email first.',
      };
    }

    const recipientName = customer?.name || user?.name || '';
    const currency = details?.currency || 'EUR';
    const amountText = formatMoney(sale.grandTotal, currency);
    const lines = [
      recipientName ? `Hello ${recipientName},` : 'Hello,',
      '',
      `Your order ${sale.reference} (${amountText}) is on its way.`,
      '',
      `Tracking number: ${tracking.trackingNumber}`,
      tracking.carrier ? `Carrier: ${tracking.carrier}` : '',
      tracking.trackingUrl ? `Track it here: ${tracking.trackingUrl}` : '',
      '',
      'Thank you for shopping with us!',
    ].filter((line) => line !== '');

    const outcome = await sendEmail({
      to,
      subject: `Tracking details for order ${sale.reference}`,
      text: lines.join('\n'),
      react: trackingEmailMessage({
        recipientName: recipientName || undefined,
        orderReference: sale.reference,
        amountText,
        trackingNumber: tracking.trackingNumber,
        carrier: tracking.carrier,
        trackingUrl: tracking.trackingUrl,
      }),
      smtp: config,
    });

    if (!outcome.ok) {
      if ('notConfigured' in outcome) {
        return {
          ok: false,
          notConfigured: true,
          error:
            'No email provider configured — add RESEND_API_KEY to the .env file (Resend) or save your SMTP settings at /cms/settings/email first.',
        };
      }
      return { ok: false, error: `Could not send the tracking email: ${outcome.error}` };
    }

    const [existing] = await db
      .select({ id: orderTracking.id })
      .from(orderTracking)
      .where(eq(orderTracking.orderId, orderId))
      .limit(1);
    if (existing) {
      await db
        .update(orderTracking)
        .set({ sentAt: new Date(), updatedAt: new Date() })
        .where(eq(orderTracking.id, existing.id));
    }

    revalidatePath(`/cms/orders/${orderId}`);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { ok: false, error: `Could not send the email: ${message}` };
  }
}

/* -------------------------------------------------------------------------- */
/* Notes                                                                       */
/* -------------------------------------------------------------------------- */

export async function addOrderNote(formData: FormData): Promise<OrderActionResult> {
  const session = await requireCmsSession();
  const orderId = parsePositiveId(readString(formData, 'orderId'));
  const body = readString(formData, 'body', 4000).trim();
  if (!orderId) return { ok: false, error: 'Order not found.' };
  if (!body) return { ok: false, error: 'The note cannot be empty.' };

  const db = await getContextDb();
  const [sale] = await db.select({ id: sales.id }).from(sales).where(eq(sales.id, orderId)).limit(1);
  if (!sale) return { ok: false, error: 'Order not found.' };

  await db.insert(orderNotes).values({
    orderId,
    body,
    isCustomerNote: formData.get('isCustomerNote') === 'on',
    createdByUserId: parsePositiveId(session.userId),
  });

  revalidatePath(`/cms/orders/${orderId}`);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Addresses                                                                   */
/* -------------------------------------------------------------------------- */

export async function updateOrderAddress(
  orderId: number,
  mode: 'storefront' | 'customer',
  kind: 'billing' | 'shipping',
  formData: FormData,
): Promise<OrderActionResult> {
  await requireCmsSession();
  const db = await getContextDb();

  const [sale] = await db
    .select({ id: sales.id, customerId: sales.customerId })
    .from(sales)
    .where(eq(sales.id, orderId))
    .limit(1);
  if (!sale) return { ok: false, error: 'Order not found.' };

  if (mode === 'storefront') {
    const [details] = await db
      .select({ saleId: storefrontOrderDetails.saleId })
      .from(storefrontOrderDetails)
      .where(eq(storefrontOrderDetails.saleId, orderId))
      .limit(1);
    if (!details) return { ok: false, error: 'This order has no storefront address record.' };

    const address = {
      firstName: readString(formData, 'firstName', 100).trim(),
      lastName: readString(formData, 'lastName', 100).trim(),
      company: readString(formData, 'company', 160).trim(),
      address1: readString(formData, 'address1', 240).trim(),
      address2: readString(formData, 'address2', 240).trim(),
      city: readString(formData, 'city', 100).trim(),
      region: readString(formData, 'region', 100).trim(),
      postalCode: readString(formData, 'postalCode', 40).trim(),
      country: readString(formData, 'country', 100).trim(),
    };
    if (!address.address1) return { ok: false, error: 'The address line is required.' };

    if (kind === 'billing') {
      await db
        .update(storefrontOrderDetails)
        .set({ billingAddress: address })
        .where(eq(storefrontOrderDetails.saleId, orderId));
    } else {
      await db
        .update(storefrontOrderDetails)
        .set({ shippingAddress: address })
        .where(eq(storefrontOrderDetails.saleId, orderId));
    }

    revalidatePath(`/cms/orders/${orderId}`);
    return { ok: true };
  }

  if (!sale.customerId) {
    return { ok: false, error: 'This order has no customer record to edit.' };
  }

  await db
    .update(customers)
    .set({
      address: readString(formData, 'address', 1000).trim() || null,
      city: readString(formData, 'city', 100).trim() || null,
      state: readString(formData, 'state', 100).trim() || null,
      country: readString(formData, 'country', 100).trim() || null,
      postalCode: readString(formData, 'postalCode', 30).trim() || null,
    })
    .where(eq(customers.id, sale.customerId));

  revalidatePath(`/cms/orders/${orderId}`);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Refunds                                                                     */
/* -------------------------------------------------------------------------- */

export type RefundItemInput = { saleItemId: number; quantity: number };

export async function refundOrder(
  orderId: number,
  payload: { reason: string; items: RefundItemInput[] },
): Promise<RefundResult> {
  await requireCmsSession();

  const reason = (payload.reason || '').trim().slice(0, 1000);
  const requested = Array.isArray(payload.items) ? payload.items : [];
  const quantities = new Map<number, number>();
  for (const item of requested) {
    const id = parsePositiveId(item?.saleItemId);
    const qty = Math.floor(Number(item?.quantity));
    if (!id || !Number.isFinite(qty) || qty <= 0) continue;
    quantities.set(id, (quantities.get(id) || 0) + qty);
  }
  if (quantities.size === 0) return { ok: false, error: 'Pick at least one item and quantity to refund.' };

  const db = await getContextDb();
  const [sale] = await db
    .select({ id: sales.id, status: sales.status, reference: sales.reference })
    .from(sales)
    .where(eq(sales.id, orderId))
    .limit(1);
  if (!sale) return { ok: false, error: 'Order not found.' };

  const lines = await db
    .select({
      id: saleItems.id,
      quantity: saleItems.quantity,
      unitPrice: saleItems.unitPrice,
      subtotal: saleItems.subtotal,
      variantName: productVariants.name,
      productName: products.name,
    })
    .from(saleItems)
    .innerJoin(productVariants, eq(saleItems.variantId, productVariants.id))
    .leftJoin(products, eq(productVariants.productId, products.id))
    .where(eq(saleItems.saleId, orderId));

  const byId = new Map(lines.map((line) => [line.id, line]));
  let refunded = 0;
  const noteLines: string[] = [];

  for (const [saleItemId, quantity] of quantities) {
    const line = byId.get(saleItemId);
    if (!line) return { ok: false, error: 'One of the selected items no longer exists.' };
    if (quantity > line.quantity) {
      return {
        ok: false,
        error: `Only ${line.quantity} × ${line.productName || 'item'} can be refunded.`,
      };
    }
    const amount = Number(line.unitPrice) * quantity;
    refunded += amount;
    noteLines.push(
      `- ${quantity} × ${line.productName || 'Product'}${line.variantName ? ` (${line.variantName})` : ''} — ${formatMoney(amount)}`,
    );
  }

  const body = [
    `Refund recorded — ${formatMoney(refunded)} refunded.`,
    ...(reason ? [`Reason: ${reason}`] : []),
    ...noteLines,
  ].join('\n');

  await db.insert(orderNotes).values({
    orderId,
    body,
    isCustomerNote: false,
    createdByUserId: null,
  });

  if (sale.status !== 'Returned') {
    await db.update(sales).set({ status: 'Returned' }).where(eq(sales.id, orderId));
  }

  revalidatePath('/cms/orders');
  revalidatePath(`/cms/orders/${orderId}`);
  return { ok: true, refunded: formatMoney(refunded) };
}

/**
 * Confirm or cancel a still-Pending online order from the order page — the same
 * action (and the same internal note) as replying KONFIRMO / ANULO on WhatsApp.
 */
export async function decideOrder(orderId: number, decision: 'confirm' | 'cancel'): Promise<OrderActionResult & { message?: string }> {
  await requireCmsSession();
  const id = parsePositiveId(orderId);
  if (!id) return { ok: false, error: 'Unknown order.' };
  const outcome = await applyOrderAction(decision === 'confirm' ? 'ok' : 'no', id);
  revalidatePath('/cms/orders');
  revalidatePath(`/cms/orders/${id}`);
  revalidatePath('/cms/dashboard');
  return outcome.status === 'rejected'
    ? { ok: false, error: outcome.toast }
    : { ok: true, message: outcome.toast };
}

/** Move a confirmed order along: start preparing, mark shipped, complete (close) it. */
export async function advanceOrderStage(orderId: number, stage: OrderStage): Promise<OrderActionResult & { message?: string }> {
  await requireCmsSession();
  const id = parsePositiveId(orderId);
  if (!id || !['preparing', 'shipped', 'completed'].includes(stage)) return { ok: false, error: 'Unknown order.' };
  const outcome = await advanceOrder(stage, id);
  revalidatePath('/cms/orders');
  revalidatePath(`/cms/orders/${id}`);
  revalidatePath('/cms/dashboard');
  return outcome.status === 'advanced'
    ? { ok: true, message: outcome.toast }
    : { ok: false, error: outcome.toast };
}
