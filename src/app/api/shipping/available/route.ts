import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { getContextCompany, getContextDb } from '@/lib/tenant';
import { shippingMethods, shippingZoneLocations, shippingZones } from '@/db/schema-tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type AvailableShippingMethod = {
  id: number;
  type: string;
  title: string;
  cost: string;
  minOrderAmount: string;
  instructions: string | null;
};

/**
 * Public fallback so checkout never breaks when no zone matches the address:
 * a single free flat rate named "Standard shipping".
 */
const FALLBACK_METHODS: AvailableShippingMethod[] = [
  {
    id: 0,
    type: 'flat_rate',
    title: 'Standard shipping',
    cost: '0.00',
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
  // A staff session (getSession()) grants nothing extra here — results are
  // always scoped to the host-resolved tenant database.

  try {
    const company = await getContextCompany();
    const db = await getContextDb();

    const zones = await db
      .select({ id: shippingZones.id })
      .from(shippingZones)
      .where(eq(shippingZones.companyId, company.id))
      .limit(500);
    if (zones.length === 0) return fallbackResponse();

    const zoneIds = zones.map((zone) => zone.id);
    const locations = await db
      .select({
        zoneId: shippingZoneLocations.zoneId,
        type: shippingZoneLocations.type,
        code: shippingZoneLocations.code,
      })
      .from(shippingZoneLocations)
      .where(inArray(shippingZoneLocations.zoneId, zoneIds));

    const matchedZoneIds = new Set<number>();
    if (country) {
      for (const location of locations) {
        if (
          location.type.trim().toLowerCase() === 'country'
          && location.code.trim().toUpperCase() === country
        ) {
          matchedZoneIds.add(location.zoneId);
        }
      }
    }
    if (state) {
      const stateNeedle = state.toUpperCase();
      for (const location of locations) {
        if (location.type.trim().toLowerCase() !== 'state') continue;
        const code = location.code.trim();
        if (code === state || code.toUpperCase() === stateNeedle) {
          matchedZoneIds.add(location.zoneId);
        }
      }
    }
    if (matchedZoneIds.size === 0) return fallbackResponse();

    const rows = await db
      .select()
      .from(shippingMethods)
      .where(inArray(shippingMethods.zoneId, [...matchedZoneIds]));

    const eligible = rows.filter((method) => {
      if (!method.enabled) return false;
      const minRaw = Number(method.minOrderAmount);
      const min = Number.isFinite(minRaw) && minRaw > 0 ? minRaw : 0;
      // `free_shipping` with minOrderAmount 0 therefore always qualifies.
      return orderTotal >= min;
    });

    eligible.sort((left, right) => {
      const bySort = left.sortOrder - right.sortOrder;
      if (bySort !== 0) return bySort;
      return Number(left.cost) - Number(right.cost);
    });

    if (eligible.length === 0) return fallbackResponse();

    const methods: AvailableShippingMethod[] = eligible.map((method) => ({
      id: method.id,
      type: method.type,
      title: method.title,
      cost: String(method.cost),
      minOrderAmount: String(method.minOrderAmount),
      instructions: method.instructions ?? null,
    }));

    return NextResponse.json({ ok: true, methods });
  } catch (error) {
    // Never fail the checkout quote: degrade to the implicit free method.
    console.error('shipping/available failed', error);
    return fallbackResponse();
  }
}
