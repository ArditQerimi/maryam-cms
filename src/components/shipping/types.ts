/** Shared, serializable shapes passed from the zones page to client components. */

export type ZoneLocationView = {
  id: number;
  type: string;
  code: string;
  /** Resolved display label, e.g. "Germany" or "Kosovo (XK)" or "California — United States". */
  label: string;
};

export type ZoneMethodView = {
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

export type ZoneView = {
  id: number;
  name: string;
  priority: number;
  locations: ZoneLocationView[];
  methods: ZoneMethodView[];
};

export type LocationChoice = {
  type: 'country' | 'state';
  code: string;
  label: string;
};

export type CountryOption = {
  code: string;
  name: string;
};

export type StateOption = {
  /** Numeric `cms_states.id`, stored as the location code (column max length 10). */
  code: string;
  countryName: string;
  name: string;
};

export const METHOD_TYPE_LABELS: Record<string, string> = {
  flat_rate: 'Flat Rate',
  free_shipping: 'Free Shipping',
  local_pickup: 'Local Pickup',
};
