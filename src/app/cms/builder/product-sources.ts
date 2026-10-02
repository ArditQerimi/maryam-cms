/**
 * Shared "which products does this section show?" brain — the single place
 * that answers the storefront product-source spec:
 *
 *  - `manual`        ⭐ Featured      → the admin picks the exact products
 *  - `best_sellers`  🔥 Best sellers  → sorted automatically by units sold
 *  - `latest`        🆕 New arrivals  → newest catalogue products first
 *  - `discounted`    🏷️ Discounted    → automatically, anything on sale
 *  - `category`      📦 One category  → filtered to the chosen category
 *  - `featured`      (legacy)         → newest products that still have stock
 *
 * Used by the builder canvas (client), the shared `BlockRenderer` and
 * `/home` (server) so the preview and the storefront can never disagree.
 * Pure functions only — no imports, safe on either side of the boundary.
 */

export type ProductSource =
  | 'manual'
  | 'best_sellers'
  | 'latest'
  | 'discounted'
  | 'category'
  | 'featured';

export type ProductSourceOption = {
  value: ProductSource;
  label: string;
  /** Shown under the select so the admin knows what each source does. */
  hint?: string;
};

/** Canonical options, in spec order — feeds every product-source select. */
export const PRODUCT_SOURCE_OPTIONS: ProductSourceOption[] = [
  {
    value: 'manual',
    label: '⭐ Featured — hand-picked',
    hint: 'Use “Pick products” below to choose the exact products, in order.',
  },
  {
    value: 'best_sellers',
    label: '🔥 Best sellers (auto, by sales)',
    hint: 'Sorted by units sold across all sales — no picking needed.',
  },
  {
    value: 'latest',
    label: '🆕 New arrivals (auto, newest first)',
    hint: 'The newest products in the catalogue, updated automatically.',
  },
  {
    value: 'discounted',
    label: '🏷️ Discounted products (auto, on sale)',
    hint: 'Everything currently reduced by a product or category discount.',
  },
  {
    value: 'category',
    label: '📦 One category',
    hint: 'Pick the exact category in the “Category” field below.',
  },
  {
    value: 'featured',
    label: 'In stock (newest first)',
    hint: 'Newest products that still have stock. Legacy source.',
  },
];

/**
 * Structural shape the resolver needs. `BlockRenderer.RendererProduct`,
 * `ProductRecord`s from `getProducts()` and the `/api/cms/products` rows all
 * satisfy it (extra fields are fine — the generics preserve them).
 */
export type SourceProduct = {
  id: number;
  price?: string | number | null;
  categoryId?: number | null;
  stock?: number | null;
  /** Powers "new arrivals" — ISO string, Date, or epoch milliseconds. */
  createdAt?: string | number | Date | null;
  /** Units sold across non-cancelled sales — powers "best sellers". */
  soldCount?: number | null;
  /** Effective discounted price when a sale applies; null otherwise. */
  salePrice?: string | number | null;
  /** Used by previews to mirror the storefront's Active-only filtering. */
  status?: string | null;
  /** Image URL (raw or JSON media string) — sections hide imageless items. */
  image?: string | null;
};

export type SourceSelection = {
  source?: unknown;
  /** Manual/featured picks, in the admin's order (`manualIds` / `productIds`). */
  ids?: unknown;
  categoryId?: unknown;
  limit?: unknown;
  offset?: unknown;
};

function num(value: unknown): number {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : NaN;
  return Number.isFinite(n) ? n : 0;
}

function time(value: SourceProduct['createdAt']): number {
  if (value == null) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** True when a discount rule (or the section's sale price) lowered the price. */
export function isDiscounted(product: SourceProduct): boolean {
  if (product.salePrice == null) return false;
  const sale = num(product.salePrice);
  return sale > 0 && sale < num(product.price);
}

/** Price to display: the sale price when discounted, otherwise the list price. */
export function displayPrice(product: SourceProduct): string {
  if (isDiscounted(product)) return String(product.salePrice);
  return String(product.price ?? '');
}

/**
 * Resolve the product list for a section block. `limit`/`offset` window the
 * result (pass them only when the caller does not window itself — `/home`
 * lets `BookstoreProducts` apply its own window).
 */
export function selectSourceProducts<T extends SourceProduct>(
  products: readonly T[],
  selection: SourceSelection,
): T[] {
  const source = String(selection.source ?? 'latest');
  let list: T[];

  if (source === 'manual') {
    const ids = Array.isArray(selection.ids)
      ? selection.ids.map(Number).filter((id) => Number.isFinite(id))
      : [];
    // Keep the admin's chosen order rather than the catalogue's. An empty
    // pick means "nothing featured yet" — never silently show everything.
    list = ids
      .map((id) => products.find((product) => product.id === id))
      .filter((product): product is T => Boolean(product));
  } else if (source === 'category') {
    const categoryId = num(selection.categoryId);
    list = categoryId > 0 ? products.filter((product) => product.categoryId === categoryId) : [];
  } else if (source === 'featured') {
    list = products.filter((product) => num(product.stock) > 0);
  } else if (source === 'best_sellers') {
    // Only products that actually sold — never pad the row with zero-sale
    // items (the empty state explains "no sales yet" instead). Stable sort:
    // equal sales keep catalogue order.
    const sold = products.filter((product) => num(product.soldCount) > 0);
    list = [...sold].sort((a, b) => num(b.soldCount) - num(a.soldCount));
  } else if (source === 'discounted') {
    list = products.filter(isDiscounted);
  } else {
    // `latest` (and any unknown value): newest first when timestamps exist.
    list = [...products];
    if (list.some((product) => time(product.createdAt) > 0)) {
      list.sort((a, b) => time(b.createdAt) - time(a.createdAt));
    }
  }

  const offset = Math.max(0, num(selection.offset));
  const limit = num(selection.limit);
  if (offset > 0 || limit > 0) {
    list = list.slice(offset, limit > 0 ? offset + limit : undefined);
  }
  return list;
}

/** Canvas/empty-state copy that tells the admin how to fill the section. */
export function sourceEmptyCopy(source: unknown): string {
  switch (String(source ?? 'latest')) {
    case 'manual':
      return 'No products picked yet — open this block’s settings and choose the products to feature.';
    case 'category':
      return 'This category has no published products yet.';
    case 'discounted':
      return 'No products are on sale right now. Add a discount and they will appear here automatically.';
    case 'best_sellers':
      return 'No sales recorded yet — best sellers appear here automatically once orders come in.';
    case 'featured':
      return 'No in-stock products to show yet.';
    default:
      return 'The catalogue is empty — add products and they will appear here.';
  }
}
