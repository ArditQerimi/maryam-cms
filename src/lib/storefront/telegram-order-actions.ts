import { and, eq } from 'drizzle-orm';
import { timingSafeEqual } from 'node:crypto';
import { orderNotes, sales } from '@/db/schema-tenant';
import { getContextDb } from '@/lib/tenant';

/**
 * Confirm / cancel an order from the Telegram message the shop receives.
 *
 * Safety: the webhook is only accepted with TELEGRAM_WEBHOOK_SECRET (header set
 * by Telegram), the button press must come from TELEGRAM_CHAT_ID (the shop's own
 * chat), the callback data can only carry "ok:<id>" / "no:<id>", and only an
 * online order that is still Pending can change. Nothing in the callback can set
 * prices, quantities or any other field.
 */

export function secretMatches(given: string | null) {
  const wanted = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
  if (wanted.length < 16 || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(wanted);
  return a.length === b.length && timingSafeEqual(a, b);
}

type TelegramUpdate = {
  callback_query?: {
    id: string;
    data?: string;
    from?: { id?: number };
    message?: { message_id?: number; text?: string; chat?: { id?: number } };
  };
};

async function telegram(method: string, payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? '';
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  }).catch(() => undefined);
}

export type ActionOutcome = {
  toast: string;
  status: 'confirmed' | 'cancelled' | 'ignored' | 'rejected';
};

const CONFIRMED_NOTE = '✅ Porosia u konfirmua nga dyqani (Telegram).';
const CANCELLED_NOTE = '❌ Porosia u anulua nga dyqani (Telegram).';

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

/** Handle one Telegram update (a button press). Returns quietly for anything else. */
export async function handleTelegramUpdate(update: TelegramUpdate) {
  const query = update.callback_query;
  if (!query?.id) return;

  const allowedChat = process.env.TELEGRAM_CHAT_ID ?? '';
  const fromId = String(query.from?.id ?? '');
  const chatId = String(query.message?.chat?.id ?? '');
  if (!allowedChat || fromId !== allowedChat || chatId !== allowedChat) {
    await telegram('answerCallbackQuery', { callback_query_id: query.id, text: 'Nuk lejohet.' });
    return;
  }

  const match = /^(ok|no):(\d{1,9})$/.exec(query.data ?? '');
  if (!match) {
    await telegram('answerCallbackQuery', { callback_query_id: query.id });
    return;
  }

  const outcome = await applyOrderAction(match[1] as 'ok' | 'no', Number(match[2]));
  await telegram('answerCallbackQuery', { callback_query_id: query.id, text: outcome.toast });

  // Replace the buttons by the result so the order cannot be pressed twice.
  const messageId = query.message?.message_id;
  if (messageId && outcome.status !== 'rejected') {
    await telegram('editMessageText', {
      chat_id: allowedChat,
      message_id: messageId,
      text: `${query.message?.text ?? ''}\n\n${outcome.toast}`,
    });
  }
}
