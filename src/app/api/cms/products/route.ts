import { NextResponse } from 'next/server';
import { desc, ilike, or, sql } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import { categories, products } from '@/db/schema-tenant';
import { getSession } from '@/lib/session';
import { isCmsSession } from '@/lib/cms/session';
import { loadSectionProductData, sectionSalePrice } from '@/lib/storefront/section-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession().catch(() => null);
  if (!isCmsSession(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = (url.searchParams.get('q') || '').trim().slice(0, 120);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 500, 1000);

  const db = await getContextDb();
  const condition = search
    ? or(ilike(products.name, `%${search}%`), ilike(products.sku, `%${search}%`))
    : undefined;

  // Products, categories and the automatic-source data (sales + discounts)
  // resolve together so the builder preview picks what `/home` will show.
  const [rows, categoryRows, sectionData] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        price: products.price,
        status: products.status,
        imageUrl: products.imageUrl,
        categoryId: products.categoryId,
        stock: products.stockQuantity,
        createdAt: products.createdAt,
      })
      .from(products)
      .where(condition)
      .orderBy(desc(sql`${products.status} = 'Active'`), desc(products.updatedAt))
      .limit(limit),
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(categories.name),
    loadSectionProductData(db),
  ]);

  const items = rows.map((row) => {
    const salePrice = sectionSalePrice(row.price, row.id, row.categoryId, sectionData);
    return {
      ...row,
      /** Units sold — lets the canvas sort 🔥 Best sellers like the shop. */
      soldCount: sectionData.soldCounts.get(row.id) ?? 0,
      /** Effective sale price (or null when the product is not on sale). */
      salePrice: salePrice === null ? null : salePrice.toFixed(2),
      /** Admin store rating 1–5 (0 = no stars) — preview matches `/home`. */
      rating: sectionData.ratings.get(row.id) ?? 0,
    };
  });

  return NextResponse.json({ items, categories: categoryRows });
}
