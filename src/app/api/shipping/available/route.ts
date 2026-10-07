import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getContextCompany, getContextDb } from '@/lib/tenant';
import { resolveShippingMethods, type AvailableShippingMethod } from '@/lib/storefront/shipping-quote';
import { DEFAULT_SHIPPING_COST, DEFAULT_SHIPPING_TITLE } from '@/lib/storefront/shipping-defaults';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type { AvailableShippingMethod };

/**
 * Public fallback so checkout never breaks when no zone matches the address:
 * a single flat rate (the default post price).
 */
const FALLBACK_METHODS: AvailableShippingMethod[] = [
  {
    id: 0,
    type: 'flat_rate',
    title: DEFAULT_SHIPPING_TITLE,
    cost: DEFAULT_SHIPPING_COST.toFixed(2),
    minOrderAmount: '0.00',
    instructions: null,
  },
];

function fallbackResponse() {
  return NextResponse.json({ ok: true, methods: FALLBACK_METHODS });
}

/**
 * GET /api/shipping/available?country=XX&state=YY&orderTotal=123
 *
 * Public read (checkout needs it before login). The tenant is resolved from
 * the request host via `getContextDb()`, so a request can only ever see the
 * zones and methods of its own tenant database — never another company's.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const country = (params.get('country') ?? '').trim().toUpperCase();
  const state = (params.get('state') ?? '').trim();
  const orderTotalRaw = Number.parseFloat(params.get('orderTotal') ?? '0');
  const orderTotal = Number.isFinite(orderTotalRaw) && orderTotalRaw > 0 ? orderTotalRaw : 0;

  // No session required: guests may quote shipping before signing in.
  try {
    const company = await getContextCompany();
    const db = await getContextDb();
    const methods = await resolveShippingMethods(db, company.id, { country, state }, orderTotal);
    return methods ? NextResponse.json({ ok: true, methods }) : fallbackResponse();
  } catch (error) {
    // Never fail the checkout quote: degrade to the implicit free method.
    console.error('shipping/available failed', error);
    return fallbackResponse();
  }
}
