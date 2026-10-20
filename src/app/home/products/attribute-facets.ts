/*
 * Shop filters from the category attributes (category_attributes / product_attribute_values),
 * e.g. for books: author, translator, pages, volumes. One group per attribute, by its type:
 *  - text and short number lists → checkboxes (?a<id>=value, several allowed);
 *  - numbers with many values (pages) → a from–to range (?a<id>min=…&a<id>max=…);
 *  - yes / no → "Po" / "Jo".
 * An attribute with fewer than two different values filters nothing and is left out.
 * Pure functions: used by the server page (building the groups) and the client (filtering).
 */

export type AttributeFacetType = 'text' | 'number' | 'boolean';

export type AttributeFacet = {
  id: number;
  name: string;
  type: AttributeFacetType;
  /** Categories that own an attribute of this name (the group shows when one is selected or none is). */
  categoryIds: number[];
  /** Every attribute id in this group: same-named attributes of different categories are one filter. */
  attributeIds: number[];
  /** list = checkboxes, range = from–to inputs. */
  mode: 'list' | 'range';
  /** Checkbox values (most products first). Empty for ranges. */
  values: Array<{ value: string; count: number }>;
  min: number;
  max: number;
};

export type AttributeMeta = { id: number; name: string; dataType: string | null; categoryId: number | null };

/** attribute id → the product's value (booleans as "Po" / "Jo"). */
export type ProductAttributes = Record<string, string>;

/** Above this many different numbers a range is easier than a list of checkboxes. */
const MAX_NUMBER_CHOICES = 8;

export const YES = 'Po';
export const NO = 'Jo';

export const listParam = (id: number) => `a${id}`;
export const minParam = (id: number) => `a${id}min`;
export const maxParam = (id: number) => `a${id}max`;
/** Every URL key this module owns (for "clear all"). */
export const isAttributeParam = (key: string) => /^a\d{1,9}(min|max)?$/.test(key);

const fold = (value: string) => value.trim().toLocaleLowerCase('sq');

export function toNumber(value: string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function typeOf(dataType: string | null): AttributeFacetType {
  if (dataType === 'number') return 'number';
  if (dataType === 'boolean') return 'boolean';
  return 'text';
}

/** The value as the shop shows it, or null when it is empty / not usable for this type. */
export function displayValue(type: AttributeFacetType, raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  if (type === 'boolean') {
    const answer = fold(value);
    if (['true', 'po', 'yes', '1', 'p'].includes(answer)) return YES;
    if (['false', 'jo', 'no', '0', 'j'].includes(answer)) return NO;
    return null;
  }
  if (type === 'number') {
    const number = toNumber(value);
    return number === null ? null : String(number);
  }
  return value.replace(/\s+/g, ' ');
}

/**
 * Groups for the shop sidebar. Attributes with the same name in different categories (e.g. "Autori"
 * in Books and Libra) become one group keyed by the first attribute id; `aliases` maps the others.
 */
export function buildAttributeFacets(
  products: Array<{ attributes: ProductAttributes }>,
  metas: AttributeMeta[],
  skipNames: Set<string> = new Set(),
): AttributeFacet[] {
  const groups = new Map<string, { facet: AttributeFacet; counts: Map<string, { value: string; count: number }>; numbers: number[] }>();
  const groupOfId = new Map<number, string>();
  for (const meta of metas) {
    const name = meta.name.trim();
    if (!name || skipNames.has(fold(name))) continue;
    const type = typeOf(meta.dataType);
    const key = `${fold(name)}|${type}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        facet: { id: meta.id, name, type, categoryIds: [], attributeIds: [], mode: 'list', values: [], min: 0, max: 0 },
        counts: new Map(),
        numbers: [],
      };
      groups.set(key, group);
    }
    group.facet.attributeIds.push(meta.id);
    if (meta.categoryId != null && !group.facet.categoryIds.includes(meta.categoryId)) group.facet.categoryIds.push(meta.categoryId);
    groupOfId.set(meta.id, key);
  }

  for (const product of products) {
    for (const [rawId, value] of Object.entries(product.attributes)) {
      const group = groups.get(groupOfId.get(Number(rawId)) ?? '');
      if (!group || !value) continue;
      const folded = fold(value);
      const current = group.counts.get(folded);
      if (current) current.count += 1;
      else group.counts.set(folded, { value, count: 1 });
      if (group.facet.type === 'number') {
        const number = toNumber(value);
        if (number !== null) group.numbers.push(number);
      }
    }
  }

  const facets: AttributeFacet[] = [];
  for (const { facet, counts, numbers } of groups.values()) {
    if (counts.size < 2) continue;
    const values = [...counts.values()];
    if (facet.type === 'number' && counts.size > MAX_NUMBER_CHOICES) {
      facet.mode = 'range';
      facet.min = Math.floor(Math.min(...numbers));
      facet.max = Math.ceil(Math.max(...numbers));
      if (facet.max <= facet.min) continue;
    } else if (facet.type === 'number') {
      facet.values = values.sort((a, b) => (toNumber(a.value) ?? 0) - (toNumber(b.value) ?? 0));
    } else if (facet.type === 'boolean') {
      facet.values = values.sort((a) => (a.value === YES ? -1 : 1));
    } else {
      facet.values = values.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'sq', { sensitivity: 'base' }));
    }
    facets.push(facet);
  }
  return facets;
}

export type ActiveAttributeFilter =
  | { facet: AttributeFacet; kind: 'list'; values: Set<string> }
  | { facet: AttributeFacet; kind: 'range'; min: number; max: number };

/** Reads the active attribute filters from the URL (unknown values are ignored). */
export function readAttributeFilters(params: URLSearchParams, facets: AttributeFacet[]): ActiveAttributeFilter[] {
  const active: ActiveAttributeFilter[] = [];
  for (const facet of facets) {
    if (facet.mode === 'range') {
      const low = toNumber(params.get(minParam(facet.id)));
      const high = toNumber(params.get(maxParam(facet.id)));
      if (low === null && high === null) continue;
      const min = Math.max(facet.min, Math.min(low ?? facet.min, high ?? facet.max));
      const max = Math.min(facet.max, Math.max(low ?? facet.min, high ?? facet.max));
      if (min <= facet.min && max >= facet.max) continue;
      active.push({ facet, kind: 'range', min, max });
      continue;
    }
    const wanted = new Set(params.getAll(listParam(facet.id)).map(fold));
    const values = new Set(facet.values.filter((item) => wanted.has(fold(item.value))).map((item) => item.value));
    if (values.size > 0) active.push({ facet, kind: 'list', values });
  }
  return active;
}

/** True when the product passes every active attribute filter. */
export function matchesAttributeFilters(attributes: ProductAttributes, filters: ActiveAttributeFilter[]): boolean {
  return filters.every((filter) => {
    const own = filter.facet.attributeIds
      .map((id) => attributes[String(id)])
      .filter((value): value is string => Boolean(value));
    if (filter.kind === 'range') {
      return own.some((value) => {
        const number = toNumber(value);
        return number !== null && number >= filter.min && number <= filter.max;
      });
    }
    const wanted = new Set([...filter.values].map(fold));
    return own.some((value) => wanted.has(fold(value)));
  });
}
