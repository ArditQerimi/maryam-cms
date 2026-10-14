import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Liveness check for uptime monitors / keep-alive pings. Deliberately touches no database, so a
 * ping every few minutes keeps the web server awake without keeping Neon's compute running.
 */
export function GET() {
  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
