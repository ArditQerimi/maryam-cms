import { NextResponse } from 'next/server';
import { desc, ilike, or, sql } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import { categories, products } from '@/db/schema-tenant';
import { getSession } from '@/lib/session';
import { isCmsSession } from '@/lib/cms/session';

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

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      price: products.price,
      status: products.status,
      imageUrl: products.imageUrl,
      categoryId: products.categoryId,
      stock: products.stockQuantity,
    })
    .from(products)
    .where(condition)
    .orderBy(desc(sql`${products.status} = 'Active'`), desc(products.updatedAt))
    .limit(limit);

  const categoryRows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(categories.name);

  return NextResponse.json({ items: rows, categories: categoryRows });
}
