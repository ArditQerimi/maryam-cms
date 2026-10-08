import { after, NextResponse, type NextRequest } from 'next/server';
import { agentSecretMatches, handleAgentTelegramUpdate, type AgentTelegramUpdate } from '@/lib/agent/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Telegram → customer assistant: a customer wrote to the shop's assistant bot. */
export async function POST(request: NextRequest) {
  if (!agentSecretMatches(request.headers.get('x-telegram-bot-api-secret-token'))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = (await request.json().catch(() => ({}))) as AgentTelegramUpdate;
  // Answer Telegram at once (it retries slow webhooks) and finish the reply afterwards.
  after(() => handleAgentTelegramUpdate(update));
  return NextResponse.json({ ok: true });
}
