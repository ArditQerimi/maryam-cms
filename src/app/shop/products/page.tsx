import type { Metadata } from 'next';
import { connection } from 'next/server';
import bookstore from '../bookstore.module.css';
import ShopProductsClient, {
  type CatalogCategory,
  type CatalogProduct,
  type FacetValue,
} from './ShopProductsClient';
import { getCategories, getProducts } from '@/lib/actions';
import { parseImageUrl } from '@/lib/image-url';
import { getContextDb } from '@/lib/tenant';
import {
  EMPTY_DISCOUNTS,
  loadActiveDiscounts,
  priceProduct,
  type ActiveDiscounts,
} from '@/lib/storefront/pricing';
import {
  getSingleActiveCatalogVariant,
  getStorefrontCatalogStock,
} from '../catalog-variants';

export const metadata: Metadata = {
  title: 'Shop — Të gjithë librat',
  description: 'Shfleto koleksionin tonë të plotë të librave — filtro sipas kategorisë, çmimit dhe më shumë.',
  alternates: {
    canonical: '/shop/products',
  },
};

type ProductAttributeEntry = {
  value?: string | null;
  attribute?: { name?: string | null } | null;
};

type ProductVariantEntry = {
  id: number;
  status: string;
  price?: string | number | null;
  stocks?: Array<{ quantity?: number | null }> | null;
};

const SIZE_ATTRIBUTE_NAMES = new Set(['size', 'madhesia', 'madhesi']);
const COLOR_ATTRIBUTE_NAMES = new Set(['color', 'colour', 'ngjyra']);

function toFiniteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toTimestamp(value: unknown): number {
  if (value instanceof Date) return value.getTime();

  const timestamp = new Date(value as string | number).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeFacetName(value: string): string {
  return value.trim().toLocaleLowerCase('en');
}

function getAttributeValue(
  entries: ProductAttributeEntry[],
  supportedNames: Set<string>,
): string | null {
  for (const entry of entries) {
    const attributeName = entry.attribute?.name?.trim();
    const value = entry.value?.trim();

    if (attributeName && value && supportedNames.has(normalizeFacetName(attributeName))) {
      return value;
    }
  }

  return null;
}

function buildFacetValues(
  products: CatalogProduct[],
  key: 'size' | 'color',
): FacetValue[] {
  const values = new Map<string, FacetValue>();

  for (const product of products) {
    const value = product[key]?.trim();
    if (!value) continue;

    const normalized = normalizeFacetName(value);
    const current = values.get(normalized);

    if (current) {
      current.count += 1;
    } else {
      values.set(normalized, { value, count: 1 });
    }
  }

  return Array.from(values.values()).sort((a, b) =>
    a.value.localeCompare(b.value, undefined, { sensitivity: 'base' }),
  );
}

/**
 * Every currently-valid product/category discount. A failure here must never
 * break the catalog: without the rows we simply render list prices.
 */
async function loadStorefrontDiscounts(): Promise<ActiveDiscounts> {
  try {
    return await loadActiveDiscounts(await getContextDb());
  } catch {
    return EMPTY_DISCOUNTS;
  }
}

export default async function ShopProductsPage() {
  await connection();

  const [categories, products, discounts] = await Promise.all([
    getCategories().catch(() => []),
    getProducts({ limit: 500 }).catch(() => []),
    loadStorefrontDiscounts(),
  ]);

  const storefrontCategories = categories.filter((category) => category.status === 'Active');
  const storefrontCategoryIds = new Set(storefrontCategories.map((category) => category.id));
  const categoryNames = new Map(
    storefrontCategories.map((category) => [category.id, category.name.trim()]),
  );

  const catalogProducts: CatalogProduct[] = products
    .filter((product) => product.status === 'Active')
    .map((product) => {
      const attributeValues =
        'attributeValues' in product && Array.isArray(product.attributeValues)
          ? (product.attributeValues as ProductAttributeEntry[])
          : [];
      const variants =
        'variants' in product && Array.isArray(product.variants)
          ? (product.variants as ProductVariantEntry[])
          : [];
      const stockQuantity = getStorefrontCatalogStock(product.stockQuantity, variants);
      const selectedVariant = getSingleActiveCatalogVariant(variants);
      const categoryId = product.categoryId ?? null;
      const priced = priceProduct(
        toFiniteNumber(selectedVariant?.price ?? product.price),
        product.id,
        categoryId,
        discounts,
      );

      return {
        id: product.id,
        name: product.name.trim(),
        sku: product.sku?.trim() ?? '',
        price: priced.salePrice,
        originalPrice: priced.discounted ? priced.originalPrice : null,
        imageUrl: parseImageUrl(product.imageUrl),
        categoryId,
        categoryName: categoryId ? (categoryNames.get(categoryId) ?? 'Pa kategori') : 'Pa kategori',
        stockQuantity,
        variantId: selectedVariant?.id ?? null,
        description: product.description?.trim() ?? '',
        size: getAttributeValue(attributeValues, SIZE_ATTRIBUTE_NAMES),
        color: getAttributeValue(attributeValues, COLOR_ATTRIBUTE_NAMES),
        createdAt: toTimestamp(product.createdAt),
      };
    });

  const categoryCounts = new Map<number, number>();
  for (const product of catalogProducts) {
    if (product.categoryId == null || !storefrontCategoryIds.has(product.categoryId)) continue;
    categoryCounts.set(
      product.categoryId,
      (categoryCounts.get(product.categoryId) ?? 0) + 1,
    );
  }

  const catalogCategories: CatalogCategory[] = storefrontCategories
    .map((category) => ({
      id: category.id,
      name: category.name.trim(),
      count: categoryCounts.get(category.id) ?? 0,
    }))
    .filter((category) => category.name.length > 0 && category.count > 0);

  const sizeFacets = buildFacetValues(catalogProducts, 'size');
  const colorFacets = buildFacetValues(catalogProducts, 'color');

  return (
    <div className={bookstore.page}>
      <ShopProductsClient
        categories={catalogCategories}
        products={catalogProducts}
        sizeFacets={sizeFacets}
        colorFacets={colorFacets}
      />
    </div>
  );
}
