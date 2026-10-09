import { and, asc, eq, sql } from 'drizzle-orm';
import { orderNotes, productStocks, productVariants, products, saleItems, sales } from '@/db/schema-tenant';
import { getContextDb } from '@/lib/tenant';
import { after } from 'next/server';
import { getRequestOrigin } from '@/lib/email/origin';
import { sendOrderEmail } from './order-email';

/**
 * Confirm / cancel an online order. Used by the WhatsApp reply webhook
 * ("KONFIRMO <id>" / "ANULO <id>") and by the Confirm / Cancel buttons on the
 * CMS order page. Only an online order that is still Pending can change, and
 * nothing but the status and an internal note is ever written.
 */

export type ActionOutcome = {
  toast: string;
  status: 'confirmed' | 'cancelled' | 'advanced' | 'ignored' | 'rejected';
};

/*
 * Order life cycle (sales.status has no values between Pending and Completed,
 * so the stages in between are internal order notes — no database migration):
 *   placed (Pending) → confirmed → preparing → shipped → completed (status Completed)
 *   cancelled (status Cancelled) is possible until the order is completed.
 */
export const CONFIRMED_NOTE = '✅ Porosia u konfirmua nga dyqani.';
export const PREPARING_NOTE = '📦 Porosia po përgatitet.';
export const SHIPPED_NOTE = '🚚 Porosia u dërgua.';
export const COMPLETED_NOTE = '🏁 Porosia u përfundua.';
const CANCELLED_NOTE = '❌ Porosia u anulua nga dyqani.';

export type OrderStage = 'preparing' | 'shipped' | 'completed';

const STAGE_NOTE: Record<OrderStage, string> = {
  preparing: PREPARING_NOTE,
  shipped: SHIPPED_NOTE,
  completed: COMPLETED_NOTE,
};

/**
 * Move a confirmed order along: start preparing, mark shipped, finish (close) it.
 * Only a confirmed online order can advance; each stage is written once.
 * Shipping and completing email the customer, preparing does not (no spam).
 */
export async function advanceOrder(stage: OrderStage, saleId: number): Promise<ActionOutcome> {
  const db = await getContextDb();
  const [sale] = await db
    .select({ id: sales.id, status: sales.status, reference: sales.reference })
    .from(sales)
    .where(and(eq(sales.id, saleId), eq(sales.isOnline, true)))
    .limit(1);
  if (!sale) return { toast: 'Porosia nuk u gjet.', status: 'rejected' };
  if (sale.status !== 'Pending') {
    return { toast: `Porosia është tashmë: ${sale.status}.`, status: 'ignored' };
  }
  const notes = (
    await db.select({ body: orderNotes.body }).from(orderNotes).where(eq(orderNotes.orderId, sale.id))
  ).map((note) => note.body);
  if (!notes.includes(CONFIRMED_NOTE)) {
    return { toast: 'Së pari konfirmo porosinë.', status: 'rejected' };
  }
  if (notes.includes(STAGE_NOTE[stage])) {
    return { toast: 'Ky hap është kryer tashmë.', status: 'ignored' };
  }

  if (stage === 'completed') {
    await db.update(sales).set({ status: 'Completed' }).where(eq(sales.id, sale.id));
  }
  await db.insert(orderNotes).values({ orderId: sale.id, body: STAGE_NOTE[stage], isCustomerNote: false });

  if (stage !== 'preparing') {
    const origin = await getRequestOrigin().catch(() => '');
    after(() => sendOrderEmail(db, sale.id, stage, origin));
  }
  const toast: Record<OrderStage, string> = {
    preparing: `Porosia ${sale.reference} po përgatitet.`,
    shipped: `Porosia ${sale.reference} u shënua si e dërguar.`,
    completed: `Porosia ${sale.reference} u përfundua.`,
  };
  return { toast: toast[stage], status: 'advanced' };
}

export async function applyOrderAction(action: 'ok' | 'no', saleId: number): Promise<ActionOutcome> {
  const db = await getContextDb();
  const [sale] = await db
    .select({ id: sales.id, status: sales.status, reference: sales.reference })
    .from(sales)
    .where(and(eq(sales.id, saleId), eq(sales.isOnline, true)))
    .limit(1);
  if (!sale) return { toast: 'Porosia nuk u gjet.', status: 'rejected' };
  if (sale.status !== 'Pending') {
    return { toast: `Porosia është tashmë: ${sale.status}.`, status: 'ignored' };
  }

  const notes = await db
    .select({ body: orderNotes.body })
    .from(orderNotes)
    .where(eq(orderNotes.orderId, sale.id));
  if (action === 'ok' && notes.some((note) => note.body === CONFIRMED_NOTE)) {
    return { toast: 'Kjo porosi është konfirmuar tashmë.', status: 'ignored' };
  }

  if (action === 'no') {
    // The order took its items out of stock when it was placed: a cancel gives them back.
    const cancelled = await db.transaction(async (tx) => {
      const updated = await tx
        .update(sales)
        .set({ status: 'Cancelled' })
        .where(and(eq(sales.id, sale.id), eq(sales.status, 'Pending')))
        .returning({ id: sales.id, warehouseId: sales.warehouseId });
      if (updated.length !== 1) return false;
      await restockSale(tx, sale.id, updated[0].warehouseId ?? null);
      return true;
    });
    if (!cancelled) return { toast: 'Porosia nuk është më në pritje.', status: 'ignored' };
  }
  await db.insert(orderNotes).values({
    orderId: sale.id,
    body: action === 'ok' ? CONFIRMED_NOTE : CANCELLED_NOTE,
    isCustomerNote: false,
  });
  // Tell the customer (best effort — a failed email never undoes the decision).
  // Runs after the response, so a slow mail provider can never hold up the button.
  const origin = await getRequestOrigin().catch(() => '');
  after(() => sendOrderEmail(db, sale.id, action === 'ok' ? 'confirmed' : 'cancelled', origin));
  return action === 'ok'
    ? { toast: `Porosia ${sale.reference} u konfirmua.`, status: 'confirmed' }
    : { toast: `Porosia ${sale.reference} u anulua.`, status: 'cancelled' };
}

type Db = Awaited<ReturnType<typeof getContextDb>>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Puts a cancelled order's items back into stock, the same way the desktop app's stock ledger
 * does: the product total always, and the per-warehouse row only for variants that keep rows
 * (the order's warehouse first, otherwise the first row).
 */
async function restockSale(tx: Tx, saleId: number, warehouseId: number | null) {
  const lines = await tx
    .select({ variantId: saleItems.variantId, quantity: saleItems.quantity, productId: productVariants.productId })
    .from(saleItems)
    .innerJoin(productVariants, eq(productVariants.id, saleItems.variantId))
    .where(eq(saleItems.saleId, saleId));
  for (const line of lines) {
    const quantity = Number(line.quantity) || 0;
    if (quantity <= 0 || !line.productId || !line.variantId) continue;
    await tx
      .update(products)
      .set({ stockQuantity: sql`coalesce(${products.stockQuantity}, 0) + ${quantity}::integer` })
      .where(eq(products.id, line.productId));
    const rows = await tx
      .select({ id: productStocks.id, warehouseId: productStocks.warehouseId })
      .from(productStocks)
      .where(eq(productStocks.variantId, line.variantId))
      .orderBy(asc(productStocks.warehouseId), asc(productStocks.id));
    if (rows.length === 0) continue;
    const target = rows.find((row) => row.warehouseId === warehouseId) ?? rows[0];
    await tx
      .update(productStocks)
      .set({ quantity: sql`${productStocks.quantity} + ${quantity}::integer` })
      .where(eq(productStocks.id, target.id));
  }
}
