import { permanentRedirect } from 'next/navigation';
import { getCategories } from '@/lib/actions';

const PRODUCT_CATALOG_PATH = '/home/products';

export const dynamic = 'force-dynamic';

function normalizeCollectionSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default async function ShopCollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const requestedSlug = normalizeCollectionSlug(slug);
  const categories = await getCategories().catch(() => []);
  const category = requestedSlug
    ? categories.find(
        (candidate) =>
          candidate.status === 'Active' &&
          normalizeCollectionSlug(candidate.name) === requestedSlug,
      )
    : undefined;

  if (category) {
    permanentRedirect(`${PRODUCT_CATALOG_PATH}?category=${category.id}`);
  }

  // The old collection catalog rendered demo products. Keep every legacy URL
  // on the canonical, database-backed catalog instead.
  permanentRedirect(PRODUCT_CATALOG_PATH);
}
