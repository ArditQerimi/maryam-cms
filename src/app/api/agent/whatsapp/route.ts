import { NextResponse, type NextRequest } from 'next/server';
import { answerWhatsAppMessage, whatsAppTokenMatches } from '@/lib/agent/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * whatsapp-agent → customer assistant: a customer wrote to the shop's WhatsApp.
 * Body { chat, phone, name, text }; the reply text comes back in the response and the
 * agent service sends it (WhatsApp does not retry, so answering synchronously is fine).
 */
export async function POST(request: NextRequest) {
  if (!whatsAppTokenMatches(request.headers.get('authorization'))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    chat?: unknown;
    phone?: unknown;
    name?: unknown;
    text?: unknown;
  } | null;

  const chat = String(body?.chat ?? '').slice(0, 80);
  const phone = String(body?.phone ?? '').replace(/\D/g, '').slice(0, 15) || null;
  const name = String(body?.name ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 60) || null;
  const text = String(body?.text ?? '').slice(0, 2000);
  if (!chat || !text.trim()) {
    return NextResponse.json({ ok: false, error: 'chat-and-text-required' }, { status: 400 });
  }

  const reply = await answerWhatsAppMessage({ chat, phone, name, text });
  return NextResponse.json({ ok: true, reply });
}
