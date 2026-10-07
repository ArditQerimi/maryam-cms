import { NextResponse, type NextRequest } from 'next/server';
import { handleTelegramUpdate, secretMatches } from '@/lib/storefront/telegram-order-actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Telegram → shop: the "Konfirmo / Anulo" buttons under an order message. */
export async function POST(request: NextRequest) {
  if (!secretMatches(request.headers.get('x-telegram-bot-api-secret-token'))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = await request.json().catch(() => null);
  if (update && typeof update === 'object') {
    try {
      await handleTelegramUpdate(update);
    } catch (error) {
      console.warn('[telegram-webhook] failed:', error instanceof Error ? error.message : 'unknown error');
    }
  }
  // Always 200 for authenticated updates so Telegram does not retry forever.
  return NextResponse.json({ ok: true });
}
