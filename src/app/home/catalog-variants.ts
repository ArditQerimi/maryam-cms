export type StorefrontCatalogVariant = {
  id: number;
  status: string;
  price?: string | number | null;
  stocks?: Array<{ quantity?: number | null }> | null;
};

function toStock(value: unknown): number {
  const stock = Number(value ?? 0);
  return Number.isFinite(stock) ? Math.max(0, Math.trunc(stock)) : 0;
}

/**
 * A listing may submit a concrete variant to the cart only when the product
 * has exactly one active variant. Products with multiple variants must be
 * opened on their detail route so the shopper can choose a real combination.
 */
export function getSingleActiveCatalogVariant<T extends StorefrontCatalogVariant>(
  variants: readonly T[] | null | undefined,
): T | null {
  const active = (variants ?? []).filter((variant) => variant.status === 'Active');
  return active.length === 1 && Number.isSafeInteger(active[0].id) && active[0].id > 0
    ? active[0]
    : null;
}

export function getSingleActiveCatalogVariantId(
  variants: readonly StorefrontCatalogVariant[] | null | undefined,
): number | null {
  return getSingleActiveCatalogVariant(variants)?.id ?? null;
}

/**
 * Variant/warehouse stock rows are authoritative when at least one active
 * variant has a stock row. Parent stock is only a compatibility fallback when
 * none of the active variants has a stock row.
 */
export function getStorefrontCatalogStock(
  parentStock: unknown,
  variants: readonly StorefrontCatalogVariant[] | null | undefined,
): number {
  const stockRows = (variants ?? [])
    .filter((variant) => variant.status === 'Active')
    .flatMap((variant) => variant.stocks ?? []);

  if (stockRows.length === 0) return toStock(parentStock);
  return stockRows.reduce((total, row) => total + toStock(row.quantity), 0);
}
