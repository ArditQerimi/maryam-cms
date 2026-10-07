import { and, eq, inArray } from 'drizzle-orm';
import { orderNotes } from '@/db/schema-tenant';
import { getContextDb } from '@/lib/tenant';
import { CONFIRMED_NOTE } from './order-decision';

/**
 * What the customer sees for an online order. `sales.status` has no
 * "confirmed" value, so a Pending order counts as confirmed once the shop's
 * confirmation note exists (written by the Confirm button / WhatsApp / Telegram).
 */
export type OrderPhase = 'awaiting' | 'confirmed' | 'cancelled' | 'other';

export function phaseOf(status: string, confirmed: boolean): OrderPhase {
  if (status === 'Pending') return confirmed ? 'confirmed' : 'awaiting';
  if (status === 'Cancelled') return 'cancelled';
  return 'other';
}

type Db = Awaited<ReturnType<typeof getContextDb>>;

/** Which of these orders already carry the shop's confirmation note. */
export async function confirmedOrderIds(db: Db, orderIds: number[]): Promise<Set<number>> {
  if (orderIds.length === 0) return new Set();
  const rows = await db
    .select({ orderId: orderNotes.orderId })
    .from(orderNotes)
    .where(and(inArray(orderNotes.orderId, orderIds), eq(orderNotes.body, CONFIRMED_NOTE)));
  return new Set(rows.map((row) => row.orderId));
}
