import { timingSafeEqual } from 'node:crypto';
import { getAgentContext } from './context';
import { normalizeHistory, runAgent } from './run';
import { loadConversation, saveConversation } from './store';

/**
 * Customer-facing Telegram bot (a separate bot from the order bot that messages the shop):
 * customers write to it, the agent answers and can take orders. Needs
 * TELEGRAM_AGENT_BOT_TOKEN and TELEGRAM_AGENT_WEBHOOK_SECRET.
 */

export function agentSecretMatches(given: string | null) {
  const wanted = process.env.TELEGRAM_AGENT_WEBHOOK_SECRET ?? '';
  if (wanted.length < 16 || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(wanted);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type AgentTelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number; type?: string };
    from?: { id?: number; first_name?: string; is_bot?: boolean };
  };
};

async function telegram(method: string, payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_AGENT_BOT_TOKEN ?? '';
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

/** The model writes Markdown; Telegram shows HTML: **bold** → <b>, [text](url) → link, headings → bold. */
export function markdownToTelegramHtml(text: string) {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<b>$1</b>')
    .replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

/** Sends the reply formatted; if Telegram rejects the HTML, sends it as plain text. */
async function sendFormatted(chatId: number, text: string) {
  const token = process.env.TELEGRAM_AGENT_BOT_TOKEN ?? '';
  if (!token) return;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: markdownToTelegramHtml(text), parse_mode: 'HTML', disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response || !response.ok) {
    await telegram('sendMessage', { chat_id: chatId, text: text.replace(/\*\*(.+?)\*\*/g, '$1') });
  }
}

/** Answer one customer message. Never throws. */
export async function handleAgentTelegramUpdate(update: AgentTelegramUpdate) {
  const message = update.message;
  const chatId = message?.chat?.id;
  const text = (message?.text ?? '').trim();
  if (!message || typeof chatId !== 'number' || message.chat?.type !== 'private' || message.from?.is_bot) return;
  if (!text) return;

  const sessionKey = `tg:${chatId}`;
  if (text === '/start') {
    try {
      const { context } = await getAgentContext();
      await saveConversation(context.db, sessionKey, 'telegram', []);
    } catch {
      // A fresh start without memory is fine.
    }
    await telegram('sendMessage', {
      chat_id: chatId,
      text: 'Përshëndetje! Jam asistenti i dyqanit. Mund të më pyesni për produkte, çmime dhe dërgesë, ose të bëni porosi këtu.',
    });
    return;
  }

  await telegram('sendChatAction', { chat_id: chatId, action: 'typing' });
  try {
    const { context, shopName } = await getAgentContext();
    // Memory lives in the database: a restart or deploy never forgets an order in progress.
    const history = await loadConversation(context.db, sessionKey);
    const reply = await runAgent({
      env: {
        context,
        channel: 'telegram',
        sessionKey,
        contactHint: message.from?.first_name ? `Telegram: ${message.from.first_name}` : undefined,
      },
      shopName,
      history,
      message: text,
    });
    await saveConversation(context.db, sessionKey, 'telegram', normalizeHistory([...history, { role: 'user', text }, { role: 'assistant', text: reply }]));
    await sendFormatted(chatId, reply.slice(0, 4000));
  } catch (error) {
    console.error('[agent] telegram update failed', error instanceof Error ? error.message : error);
  }
}
