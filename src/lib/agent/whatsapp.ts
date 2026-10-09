import { timingSafeEqual } from 'node:crypto';
import { getAgentContext } from './context';
import { FALLBACK_REPLY, normalizeHistory, runAgent, type ChatTurn } from './run';

/**
 * Customer chats on WhatsApp: the whatsapp-agent service (linked to the shop's WhatsApp
 * account) forwards each message a customer writes and sends back the reply returned here.
 * Authenticated with the shared WHATSAPP_AGENT_TOKEN.
 */

export function whatsAppTokenMatches(header: string | null) {
  const wanted = process.env.WHATSAPP_AGENT_TOKEN ?? '';
  const given = String(header ?? '').replace(/^Bearer\s+/i, '');
  if (wanted.length < 24 || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(wanted);
  return a.length === b.length && timingSafeEqual(a, b);
}

const HISTORY_TTL_MS = 60 * 60 * 1000;
const MAX_CHATS = 500;
const histories = new Map<string, { turns: ChatTurn[]; at: number }>();

function loadHistory(chat: string): ChatTurn[] {
  const entry = histories.get(chat);
  if (!entry || Date.now() - entry.at > HISTORY_TTL_MS) return [];
  return entry.turns;
}

function saveHistory(chat: string, turns: ChatTurn[]) {
  histories.delete(chat); // re-insert so the Map stays ordered by last use
  histories.set(chat, { turns: normalizeHistory(turns), at: Date.now() });
  while (histories.size > MAX_CHATS) {
    const oldest = histories.keys().next().value;
    if (oldest === undefined) break;
    histories.delete(oldest);
  }
}

/** Markdown → WhatsApp: **bold** → *bold*, headings and [text](url) links → plain text. */
function toWhatsAppFormat(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1: $2');
}

const RESET = /^\s*(\/start|\/reset|fillo|start)\s*$/i;

/** Answer one customer message; returns the text to send back. Never throws. */
export async function answerWhatsAppMessage(input: {
  chat: string;
  phone: string | null;
  name: string | null;
  text: string;
}): Promise<string> {
  const text = input.text.trim();
  if (RESET.test(text)) {
    saveHistory(input.chat, []);
    return 'Përshëndetje! Jam asistenti i dyqanit. Mund të më pyesni për produkte, çmime dhe dërgesë, ose të bëni porosi këtu.';
  }
  try {
    const { context, shopName } = await getAgentContext();
    const history = loadHistory(input.chat);
    const who = [input.name, input.phone ? `+${input.phone}` : null].filter(Boolean).join(', ');
    const reply = await runAgent({
      env: {
        context,
        channel: 'whatsapp',
        sessionKey: `wa:${input.chat}`,
        phone: input.phone ?? undefined,
        contactHint: who ? `WhatsApp: ${who}` : undefined,
      },
      shopName,
      history,
      message: text,
    });
    saveHistory(input.chat, [...history, { role: 'user', text }, { role: 'assistant', text: reply }]);
    return toWhatsAppFormat(reply);
  } catch (error) {
    console.error('[agent] whatsapp message failed', error instanceof Error ? error.message : error);
    return FALLBACK_REPLY;
  }
}
