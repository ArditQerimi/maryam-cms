import { inArray } from 'drizzle-orm';
import { orderNotes } from '@/db/schema-tenant';
import { getContextDb } from '@/lib/tenant';
import { CONFIRMED_NOTE, PREPARING_NOTE, SHIPPED_NOTE } from './order-decision';

/**
 * What the customer (and the shop) sees for an online order.
 * `sales.status` only knows Pending / Completed / Cancelled / Returned, so the
 * stages in between come from the order's internal notes (see order-decision.ts):
 * awaiting → confirmed → preparing → shipped → completed.
 */
export type OrderPhase =
  | 'awaiting'
  | 'confirmed'
  | 'preparing'
  | 'shipped'
  | 'completed'
  | 'cancelled'
  | 'other';

export function phaseOf(status: string, notes: ReadonlySet<string>): OrderPhase {
  if (status === 'Cancelled') return 'cancelled';
  if (status === 'Completed') return 'completed';
  if (status !== 'Pending') return 'other';
  if (notes.has(SHIPPED_NOTE)) return 'shipped';
  if (notes.has(PREPARING_NOTE)) return 'preparing';
  if (notes.has(CONFIRMED_NOTE)) return 'confirmed';
  return 'awaiting';
}

type Db = Awaited<ReturnType<typeof getContextDb>>;

/** The phase of each of these orders, keyed by order id. */
export async function orderPhases(
  db: Db,
  orders: ReadonlyArray<{ id: number; status: string }>,
): Promise<Map<number, OrderPhase>> {
  const ids = orders.map((order) => order.id);
  const notesByOrder = new Map<number, Set<string>>();
  if (ids.length > 0) {
    const rows = await db
      .select({ orderId: orderNotes.orderId, body: orderNotes.body })
      .from(orderNotes)
      .where(inArray(orderNotes.orderId, ids));
    for (const row of rows) {
      if (!notesByOrder.has(row.orderId)) notesByOrder.set(row.orderId, new Set());
      notesByOrder.get(row.orderId)!.add(row.body);
    }
  }
  return new Map(orders.map((order) => [order.id, phaseOf(order.status, notesByOrder.get(order.id) ?? new Set())]));
}
