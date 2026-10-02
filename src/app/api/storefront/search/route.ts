import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { products } from '@/db/schema-tenant';
import { getContextDb } from '@/lib/tenant';
import { parseImageUrl } from '@/lib/image-url';
import { foldSearchText } from '@/lib/search-text';

const MAX_RESULTS = 8;

/**
 * Live product suggestions for the header search bar.
 * GET /api/storefront/search?q=nektar → up to 8 active products whose name or
 * SKU contains the words typed, ignoring case and accents (ë = e, ç = c).
 */
export async function GET(request: NextRequest) {
  const query = foldSearchText(request.nextUrl.searchParams.get('q') ?? '');
  if (query.length < 2) return NextResponse.json({ items: [] });

  try {
    const db = await getContextDb();
    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        price: products.price,
        imageUrl: products.imageUrl,
      })
      .from(products)
      .where(eq(products.status, 'Active'))
      .limit(2000);

    const words = query.split(' ').filter(Boolean);
    const items = rows
      .map((row) => {
        const name = foldSearchText(row.name);
        const sku = foldSearchText(row.sku ?? '');
        const haystack = `${name} ${sku}`;
        if (!words.every((word) => haystack.includes(word))) return null;
        // Names that start with the query rank first, then shorter names.
        const rank = name.startsWith(query) ? 0 : name.includes(query) ? 1 : 2;
        return { row, rank };
      })
      .filter((entry): entry is { row: (typeof rows)[number]; rank: number } => entry !== null)
      .sort((a, b) => a.rank - b.rank || a.row.name.length - b.row.name.length)
      .slice(0, MAX_RESULTS)
      .map(({ row }) => ({
        id: row.id,
        name: row.name,
        price: row.price,
        image: parseImageUrl(row.imageUrl) || null,
        href: `/home/products/${row.id}`,
      }));

    return NextResponse.json(
      { items },
      { headers: { 'Cache-Control': 'private, max-age=30' } },
    );
  } catch {
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
