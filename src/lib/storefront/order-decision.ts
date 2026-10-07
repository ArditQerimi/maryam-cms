import { and, eq } from 'drizzle-orm';
import { orderNotes, sales } from '@/db/schema-tenant';
import { getContextDb } from '@/lib/tenant';

/**
 * Confirm / cancel an online order. Used by the WhatsApp reply webhook
 * ("KONFIRMO <id>" / "ANULO <id>") and by the Confirm / Cancel buttons on the
 * CMS order page. Only an online order that is still Pending can change, and
 * nothing but the status and an internal note is ever written.
 */

export type ActionOutcome = {
  toast: string;
  status: 'confirmed' | 'cancelled' | 'ignored' | 'rejected';
};

const CONFIRMED_NOTE = '✅ Porosia u konfirmua nga dyqani.';
const CANCELLED_NOTE = '❌ Porosia u anulua nga dyqani.';

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
    await db.update(sales).set({ status: 'Cancelled' }).where(eq(sales.id, sale.id));
  }
  await db.insert(orderNotes).values({
    orderId: sale.id,
    body: action === 'ok' ? CONFIRMED_NOTE : CANCELLED_NOTE,
    isCustomerNote: false,
  });
  return action === 'ok'
    ? { toast: `Porosia ${sale.reference} u konfirmua.`, status: 'confirmed' }
    : { toast: `Porosia ${sale.reference} u anulua.`, status: 'cancelled' };
}
