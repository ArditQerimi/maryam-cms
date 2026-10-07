import { timingSafeEqual } from 'node:crypto';
import { applyOrderAction } from './order-decision';

/**
 * Telegram → shop: the shop owner pressed Konfirmo / Anulo under an order message.
 *
 * Safety: the webhook is only accepted with TELEGRAM_WEBHOOK_SECRET (header set
 * by Telegram), the press must come from TELEGRAM_CHAT_ID (the shop's own chat),
 * the callback data can only carry "ok:<id>" / "no:<id>", and only a Pending
 * online order can change (see order-decision.ts).
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
  console.log(`[telegram-webhook] ${match[1]}:${match[2]} -> ${outcome.status}`);
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
