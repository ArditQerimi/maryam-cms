import { eq, inArray } from 'drizzle-orm';
import { shippingMethods, shippingZoneLocations, shippingZones } from '@/db/schema-tenant';
import type { StorefrontContext } from './context';

export type AvailableShippingMethod = {
  id: number;
  type: string;
  title: string;
  cost: string;
  minOrderAmount: string;
  instructions: string | null;
};

type ShippingDb = Pick<StorefrontContext['db'], 'select'>;

/**
 * The shipping methods a destination qualifies for, cheapest/first by the
 * shop's own order (CMS → Shipping). `null` = no zone or method matches the
 * address (callers decide the fallback). Used by the public quote endpoint AND
 * by the order itself, so the price the customer sees is the price charged.
 */
export async function resolveShippingMethods(
  db: ShippingDb,
  companyId: number,
  destination: { country: string; state?: string },
  orderTotal: number,
): Promise<AvailableShippingMethod[] | null> {
  const country = destination.country.trim().toUpperCase();
  const state = (destination.state ?? '').trim();

  const zones = await db
    .select({ id: shippingZones.id })
    .from(shippingZones)
    .where(eq(shippingZones.companyId, companyId))
    .limit(500);
  if (zones.length === 0) return null;

  const locations = await db
    .select({
      zoneId: shippingZoneLocations.zoneId,
      type: shippingZoneLocations.type,
      code: shippingZoneLocations.code,
    })
    .from(shippingZoneLocations)
    .where(inArray(shippingZoneLocations.zoneId, zones.map((zone) => zone.id)));

  const matchedZoneIds = new Set<number>();
  if (country) {
    for (const location of locations) {
      if (location.type.trim().toLowerCase() === 'country' && location.code.trim().toUpperCase() === country) {
        matchedZoneIds.add(location.zoneId);
      }
    }
  }
  if (state) {
    const stateNeedle = state.toUpperCase();
    for (const location of locations) {
      if (location.type.trim().toLowerCase() !== 'state') continue;
      const code = location.code.trim();
      if (code === state || code.toUpperCase() === stateNeedle) matchedZoneIds.add(location.zoneId);
    }
  }
  if (matchedZoneIds.size === 0) return null;

  const rows = await db
    .select()
    .from(shippingMethods)
    .where(inArray(shippingMethods.zoneId, [...matchedZoneIds]));

  const eligible = rows.filter((method) => {
    if (!method.enabled) return false;
    const minRaw = Number(method.minOrderAmount);
    const min = Number.isFinite(minRaw) && minRaw > 0 ? minRaw : 0;
    return orderTotal >= min;
  });
  eligible.sort((left, right) => {
    const bySort = left.sortOrder - right.sortOrder;
    return bySort !== 0 ? bySort : Number(left.cost) - Number(right.cost);
  });
  if (eligible.length === 0) return null;

  return eligible.map((method) => ({
    id: method.id,
    type: method.type,
    title: method.title,
    cost: String(method.cost),
    minOrderAmount: String(method.minOrderAmount),
    instructions: method.instructions ?? null,
  }));
}
