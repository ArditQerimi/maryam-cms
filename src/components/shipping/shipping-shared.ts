/**
 * Pure helpers + serializable DTO shapes shared by the shipping admin UI,
 * the shipping server actions and the public /api/shipping/available route.
 *
 * This module must stay free of server-only or client-only imports so it can
 * be imported from React server components, client components and route
 * handlers alike.
 */

export const SHIPPING_METHOD_TYPES = ['flat_rate', 'free_shipping', 'local_pickup'] as const;
export type ShippingMethodType = (typeof SHIPPING_METHOD_TYPES)[number];

export const METHOD_TYPE_LABELS: Record<ShippingMethodType, string> = {
  flat_rate: 'Flat rate',
  free_shipping: 'Free shipping',
  local_pickup: 'Local pickup',
};

export function isShippingMethodType(value: string): value is ShippingMethodType {
  return (SHIPPING_METHOD_TYPES as readonly string[]).includes(value);
}

export function methodTypeLabel(value: string): string {
  return isShippingMethodType(value) ? METHOD_TYPE_LABELS[value] : value;
}

/* -------------------------------------------------------------------------- */
/* Location codes                                                             */
/* -------------------------------------------------------------------------- */

export type LocationType = 'country' | 'state';

export type ZoneLocationDto = {
  id: number;
  type: LocationType;
  code: string;
  /** Readable name resolved from cmsCountries / cmsStates ('XK' = Kosovo). */
  label: string;
};

export type ZoneMethodDto = {
  id: number;
  type: string;
  title: string;
  cost: string;
  minOrderAmount: string;
  enabled: boolean;
  instructions: string | null;
  sortOrder: number;
};

export type ZoneDto = {
  id: number;
  name: string;
  priority: number;
  locations: ZoneLocationDto[];
  methods: ZoneMethodDto[];
};

/** A pickable country/state entry for the location picker. */
export type LocationOption = {
  /** Stable value used in the picker + persistence: `country:AL`. */
  key: string;
  type: LocationType;
  /** Persisted `shipping_zone_locations.code`. */
  code: string;
  label: string;
  /** Grouping label — the country name (or "Kosovo (XK)" for states). */
  group: string;
};

/** `shipping_zone_locations.code` is varchar(10) — everything must fit. */
export const LOCATION_CODE_MAX = 10;

/** Lowercased alphanumeric form used to compare free-text state input. */
export function normalizeLocationText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function countryLocationCode(countryCode: string): string {
  return countryCode.trim().toUpperCase().slice(0, LOCATION_CODE_MAX);
}

/**
 * State locations are stored as `<country><normalized state name>` truncated
 * to the 10-character column so a state can never match another country.
 */
export function stateLocationCode(countryCode: string, stateName: string): string {
  const country = countryLocationCode(countryCode);
  return `${country}${normalizeLocationText(stateName)}`.slice(0, LOCATION_CODE_MAX);
}

/** Rebuilds the stored code from a checkout `country` + `state` query pair. */
export function stateLocationCodeFromQuery(country: string, state: string): string {
  return stateLocationCode(country, state);
}

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

/** Accepts `12`, `12.5`, `12,5`, `€12.50` → `12.50` (never NaN). */
export function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Canonical decimal string for the money columns (precision 10,2). */
export function toMoneyValue(value: string | number | null | undefined): string {
  return parseMoney(value).toFixed(2);
}

/* -------------------------------------------------------------------------- */
/* Zone matching (shared by the public availability route)                    */
/* -------------------------------------------------------------------------- */

export type ZoneLocationRow = {
  id: number;
  zoneId: number;
  type: string;
  code: string;
};

/** Returns the ids of the zones whose locations cover the destination. */
export function matchZoneIds(
  locations: readonly ZoneLocationRow[],
  country: string,
  state: string,
): number[] {
  const normalizedCountry = countryLocationCode(country);
  const normalizedState = state ? stateLocationCodeFromQuery(country, state) : '';
  const matched = new Set<number>();

  for (const location of locations) {
    if (location.type === 'country') {
      if (normalizedCountry && location.code.toUpperCase() === normalizedCountry) {
        matched.add(location.zoneId);
      }
      continue;
    }
    if (location.type === 'state' && normalizedState && location.code === normalizedState) {
      matched.add(location.zoneId);
    }
  }

  return [...matched];
}

export type AvailableShippingMethod = {
  id: number;
  type: string;
  title: string;
  cost: number;
  minOrderAmount: number;
  instructions: string | null;
};

export type ShippingMethodRow = {
  id: number;
  zoneId: number;
  type: string;
  title: string;
  cost: string;
  minOrderAmount: string;
  enabled: boolean;
  instructions: string | null;
  sortOrder: number;
};

/**
 * Enabled methods whose minimum order is satisfied by `orderTotal`, sorted by
 * `sortOrder` then cost. Free shipping with a zero minimum always qualifies.
 */
export function selectAvailableMethods(
  rows: readonly ShippingMethodRow[],
  orderTotal: number,
): AvailableShippingMethod[] {
  return rows
    .filter((row) => {
      if (!row.enabled) return false;
      const min = parseMoney(row.minOrderAmount);
      if (min <= 0) return true;
      return orderTotal >= min;
    })
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return parseMoney(a.cost) - parseMoney(b.cost);
    })
    .map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      cost: parseMoney(row.cost),
      minOrderAmount: parseMoney(row.minOrderAmount),
      instructions: row.instructions ?? null,
    }));
}

/** Implicit method returned when no zone/method matches, so checkout works. */
export const FALLBACK_SHIPPING_METHOD: AvailableShippingMethod = {
  id: 0,
  type: 'flat_rate',
  title: 'Standard shipping',
  cost: 0,
  minOrderAmount: 0,
  instructions: null,
};
