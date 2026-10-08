import { timingSafeEqual } from 'node:crypto';
import { getAgentContext } from './context';
import { normalizeHistory, runAgent, type ChatTurn } from './run';

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

const HISTORY_TTL_MS = 60 * 60 * 1000;
const MAX_CHATS = 500;
const histories = new Map<number, { turns: ChatTurn[]; at: number }>();

function loadHistory(chatId: number): ChatTurn[] {
  const entry = histories.get(chatId);
  if (!entry || Date.now() - entry.at > HISTORY_TTL_MS) return [];
  return entry.turns;
}

function saveHistory(chatId: number, turns: ChatTurn[]) {
  histories.set(chatId, { turns: normalizeHistory(turns), at: Date.now() });
  if (histories.size > MAX_CHATS) {
    const cutoff = Date.now() - HISTORY_TTL_MS;
    for (const [id, entry] of histories) if (entry.at < cutoff) histories.delete(id);
    // Still too many: drop the oldest.
    while (histories.size > MAX_CHATS) {
      const oldest = histories.keys().next().value;
      if (oldest === undefined) break;
      histories.delete(oldest);
    }
  }
}

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

/** Answer one customer message. Never throws. */
export async function handleAgentTelegramUpdate(update: AgentTelegramUpdate) {
  const message = update.message;
  const chatId = message?.chat?.id;
  const text = (message?.text ?? '').trim();
  if (!message || typeof chatId !== 'number' || message.chat?.type !== 'private' || message.from?.is_bot) return;
  if (!text) return;

  if (text === '/start') {
    saveHistory(chatId, []);
    await telegram('sendMessage', {
      chat_id: chatId,
      text: 'Përshëndetje! Jam asistenti i dyqanit. Mund të më pyesni për produkte, çmime dhe dërgesë, ose të bëni porosi këtu.',
    });
    return;
  }

  await telegram('sendChatAction', { chat_id: chatId, action: 'typing' });
  try {
    const { context, shopName } = await getAgentContext();
    const history = loadHistory(chatId);
    const reply = await runAgent({
      env: {
        context,
        channel: 'telegram',
        sessionKey: `tg:${chatId}`,
        contactHint: message.from?.first_name ? `Telegram: ${message.from.first_name}` : undefined,
      },
      shopName,
      history,
      message: text,
    });
    saveHistory(chatId, [...history, { role: 'user', text }, { role: 'assistant', text: reply }]);
    await telegram('sendMessage', { chat_id: chatId, text: reply.slice(0, 4000) });
  } catch (error) {
    console.error('[agent] telegram update failed', error instanceof Error ? error.message : error);
  }
}
