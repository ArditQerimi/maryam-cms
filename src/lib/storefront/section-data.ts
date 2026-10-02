import { eq, notInArray, sql } from 'drizzle-orm';

import * as schema from '@/db/schema-tenant';
import { getContextDb } from '@/lib/tenant';
import { parseProductConfig } from '@/components/store/format-product';
import {
  EMPTY_DISCOUNTS,
  loadActiveDiscounts,
  priceProduct,
  type ActiveDiscounts,
  type PricingDb,
} from '@/lib/storefront/pricing';

/**
 * Data the storefront *sections* need to resolve their automatic product
 * sources, loaded once per request and shared by `/home` and the builder's
 * `/api/cms/products` endpoint so both sides pick the exact same products:
 *
 *  - `soldCounts` — units sold per product (fires 🔥 Best sellers)
 *  - `discounts`  — every currently-valid product/category discount rule
 *                   (fires 🏷️ Discounted products)
 *  - `ratings`    — admin-set store rating per product (card stars ⭐)
 *
 * Everything is failure-tolerant: a broken query degrades to "no automatic
 * sources", never to a crashed storefront.
 */

export type SectionProductData = {
  /** productId → units sold across non-cancelled, non-returned sales. */
  soldCounts: Map<number, number>;
  discounts: ActiveDiscounts;
  /** productId → admin store rating 1–5; missing means "no stars". */
  ratings: Map<number, number>;
};

export const EMPTY_SECTION_DATA: SectionProductData = {
  soldCounts: new Map(),
  discounts: EMPTY_DISCOUNTS,
  ratings: new Map(),
};

/**
 * Every `products_config_{id}` row's star rating in one query — the settings
 * store holds no separate rating table, so bulk-reading the configs keeps
 * the catalogue fetch at a single extra statement.
 */
export async function loadProductRatings(
  db?: PricingDb | Awaited<ReturnType<typeof getContextDb>>,
): Promise<Map<number, number>> {
  try {
    const handle = db ?? (await getContextDb());
    const rows = await handle
      .select({ key: schema.settingsStore.key, value: schema.settingsStore.value })
      .from(schema.settingsStore)
      .where(sql`${schema.settingsStore.key} like 'products_config_%'`);
    const ratings = new Map<number, number>();
    for (const row of rows) {
      const rating = parseProductConfig(row.value ?? null).rating;
      if (!rating) continue;
      const id = Number(row.key.slice('products_config_'.length));
      if (Number.isSafeInteger(id) && id > 0) ratings.set(id, Number(rating));
    }
    return ratings;
  } catch {
    return new Map();
  }
}

/** Aggregate `sale_items × sales` into per-product totals. */
export async function loadSectionProductData(
  db?: PricingDb | Awaited<ReturnType<typeof getContextDb>>,
): Promise<SectionProductData> {
  try {
    const handle = db ?? (await getContextDb());
    const [soldRows, discounts, ratings] = await Promise.all([
      handle
        .select({
          productId: schema.productVariants.productId,
          sold: sql<number>`coalesce(sum(${schema.saleItems.quantity}), 0)`,
        })
        .from(schema.saleItems)
        .innerJoin(schema.productVariants, eq(schema.saleItems.variantId, schema.productVariants.id))
        .innerJoin(schema.sales, eq(schema.saleItems.saleId, schema.sales.id))
        // Cancelled and returned sales never counted as demand.
        .where(notInArray(schema.sales.status, ['Cancelled', 'Returned']))
        .groupBy(schema.productVariants.productId),
      loadActiveDiscounts(handle),
      loadProductRatings(handle),
    ]);

    const soldCounts = new Map<number, number>();
    for (const row of soldRows) {
      soldCounts.set(row.productId, Number(row.sold) || 0);
    }
    return { soldCounts, discounts, ratings };
  } catch {
    return EMPTY_SECTION_DATA;
  }
}

/**
 * Effective sale price for a product *in a section*: the best active
 * product/category discount rule applied to the given list price, or `null`
 * when nothing discounts it (→ the section shows the regular price).
 */
export function sectionSalePrice(
  listPrice: string | number | null | undefined,
  productId: number,
  categoryId: number | null,
  data: SectionProductData,
): number | null {
  const list =
    typeof listPrice === 'string' ? Number.parseFloat(listPrice) : (listPrice ?? Number.NaN);
  if (!Number.isFinite(list) || list <= 0) return null;
  const priced = priceProduct(list, productId, categoryId, data.discounts);
  return priced.discounted ? priced.salePrice : null;
}
