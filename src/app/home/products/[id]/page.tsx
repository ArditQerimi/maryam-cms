import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '@/db/schema-tenant';
import { getContextDb } from '@/lib/tenant';
import { getProductById, getProducts } from '@/lib/actions';
import ProductDetailsClient, {
  type DetailPromo,
  type DetailProduct,
  type DetailVariantOption,
  type RelatedProduct,
} from './ProductDetailsClient';
import type { ProductReviewQuery } from './ProductReviews';
import { loadProductReviews, type ReviewNotice } from '@/lib/storefront/reviews';
import {
  priceProduct,
  type ActiveDiscounts,
  type PricedProduct,
} from '@/lib/storefront/pricing';
import { loadSectionProductData } from '@/lib/storefront/section-data';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/** List price → `{ salePrice, compareAtPrice }` for one product. */
function priceForProduct(
  listPrice: number | null,
  productId: number,
  categoryId: number | null,
  discounts: ActiveDiscounts,
): { price: number | null; compareAtPrice: number | null } {
  if (listPrice === null) return { price: null, compareAtPrice: null };
  const priced: PricedProduct = priceProduct(listPrice, productId, categoryId, discounts);
  return {
    price: priced.salePrice,
    compareAtPrice: priced.discounted ? priced.originalPrice : null,
  };
}

type RawStock = {
  quantity?: number | null;
};

type RawVariant = {
  id: number;
  name: string;
  sku: string;
  price: string | number | null;
  status: string;
  stocks?: RawStock[] | null;
};

type RawProduct = {
  id: number;
  name: string;
  sku?: string | null;
  price?: string | number | null;
  stockQuantity?: number | null;
  description?: string | null;
  imageUrl?: string | null;
  status: string;
  categoryId?: number | null;
  brandId?: number | null;
  /** Powers the 🆕 recency half of the related-products ranking. */
  createdAt?: Date | string | null;
  category?: { id: number; name: string; status?: string } | null;
  brand?: { id: number; name: string; status?: string } | null;
  variants?: RawVariant[] | null;
};

type VariantOptionRow = {
  variantId: number;
  attributeId: number;
  attributeName: string;
  attributeValueId: number;
  value: string;
};

type NormalizedVariants = {
  variants: DetailProduct['variants'];
  stockQuantity: number;
  stockSource: 'variant' | 'parent';
  defaultVariantId: number | null;
};

const getActiveProduct = cache(async (id: number) => {
  const product = await getProductById(id).catch(() => null);
  return product?.status === 'Active' ? product : null;
});

function parseProductId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toMoney(value: unknown): number | null {
  const parsed = toFiniteNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

function toStock(value: unknown): number {
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed <= 0) return 0;
  return Number.isSafeInteger(parsed)
    ? parsed
    : Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(parsed));
}

function sumStock(values: readonly number[]): number {
  return values.reduce<number>((total, value) => {
    const next = total + value;
    return Number.isSafeInteger(next) ? next : Number.MAX_SAFE_INTEGER;
  }, 0);
}

function safeImageCandidate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.username && !parsed.password) {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function imageCandidatesFromValue(value: unknown): string[] {
  const direct = safeImageCandidate(value);
  return direct ? [direct] : [];
}

function parseGallery(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const direct = safeImageCandidate(raw);
    return direct ? [direct] : [];
  }

  const values = Array.isArray(parsed) ? parsed : [parsed];
  const gallery: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (typeof value === 'string') {
      for (const candidate of imageCandidatesFromValue(value)) {
        if (!seen.has(candidate)) {
          seen.add(candidate);
          gallery.push(candidate);
        }
      }
      continue;
    }

    if (!value || typeof value !== 'object') continue;
    const item = value as { src?: unknown; url?: unknown; secure_url?: unknown };
    for (const candidateValue of [item.src, item.url, item.secure_url]) {
      const candidate = safeImageCandidate(candidateValue);
      if (candidate && !seen.has(candidate)) {
        seen.add(candidate);
        gallery.push(candidate);
      }
    }
  }

  return gallery;
}

function normalizeDescription(raw: string | null | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) return '';

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === 'string') return parsed.trim();
    if (parsed && typeof parsed === 'object') {
      const text = (parsed as { text?: unknown }).text;
      if (typeof text === 'string') return text.trim();
    }
  } catch {
    return trimmed;
  }

  return '';
}

function metadataImageUrl(imageUrl: string): string | undefined {
  if (!imageUrl) return undefined;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    || `http://${process.env.NEXT_PUBLIC_DOMAIN || 'localhost:3000'}`;

  try {
    const parsed = new URL(imageUrl, siteUrl);
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.username || parsed.password) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/**
 * Optional merchandising banner from tenant settings (`pdp_banner_*` keys the
 * admin fills under Settings). Hidden entirely until both image and title
 * exist so the page never shows placeholder marketing copy.
 */
async function loadPromoSettings(): Promise<DetailPromo | null> {
  try {
    const db = await getContextDb();
    const rows = await db
      .select({ key: schema.settingsStore.key, value: schema.settingsStore.value })
      .from(schema.settingsStore)
      .where(inArray(schema.settingsStore.key, [
        'pdp_banner_image',
        'pdp_banner_title',
        'pdp_banner_text',
        'pdp_banner_cta_label',
        'pdp_banner_cta_href',
      ]));
    const values = Object.fromEntries(
      rows.map((row) => [row.key, (row.value ?? '').trim()]),
    );
    const image = values.pdp_banner_image ?? '';
    const title = values.pdp_banner_title ?? '';
    if (!image || !title) return null;
    return {
      image,
      title,
      text: values.pdp_banner_text || null,
      ctaLabel: values.pdp_banner_cta_label || null,
      ctaHref: values.pdp_banner_cta_href || null,
    };
  } catch (error) {
    console.error('[Product page] Promo settings load failed', error);
    return null;
  }
}

async function getVariantOptionRows(variantIds: number[]): Promise<VariantOptionRow[]> {
  if (variantIds.length === 0) return [];

  try {
    const db = await getContextDb();
    return await db
      .select({
        variantId: schema.variantOptions.variantId,
        attributeId: schema.variantAttributes.id,
        attributeName: schema.variantAttributes.name,
        attributeValueId: schema.variantAttributeValues.id,
        value: schema.variantAttributeValues.value,
      })
      .from(schema.variantOptions)
      .innerJoin(
        schema.variantAttributeValues,
        eq(schema.variantOptions.attributeValueId, schema.variantAttributeValues.id),
      )
      .innerJoin(
        schema.variantAttributes,
        eq(schema.variantAttributeValues.attributeId, schema.variantAttributes.id),
      )
      .where(inArray(schema.variantOptions.variantId, variantIds));
  } catch {
    return [];
  }
}

function normalizeOptions(
  variantId: number,
  rows: VariantOptionRow[],
): DetailVariantOption[] {
  const byKey = new Map<string, DetailVariantOption>();

  for (const row of rows) {
    if (row.variantId !== variantId) continue;
    const attributeName = row.attributeName.trim();
    const value = row.value.trim();
    if (!attributeName || !value) continue;

    const key = `${row.attributeId}:${row.attributeValueId}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        attributeId: row.attributeId,
        attributeName,
        valueId: row.attributeValueId,
        value,
      });
    }
  }

  return Array.from(byKey.values()).sort(
    (left, right) =>
      left.attributeName.localeCompare(right.attributeName, undefined, { sensitivity: 'base' })
      || left.value.localeCompare(right.value, undefined, { sensitivity: 'base', numeric: true }),
  );
}

function normalizeVariants(product: RawProduct, optionRows: VariantOptionRow[]): NormalizedVariants {
  const activeVariants = (product.variants ?? [])
    .filter((variant) => variant.status === 'Active')
    .slice()
    .sort((left, right) => left.id - right.id);
  const hasVariantStockRows = activeVariants.some(
    (variant) => (variant.stocks?.length ?? 0) > 0,
  );
  const parentStock = toStock(product.stockQuantity);

  const variants = activeVariants.map((variant) => {
    const stockRows = variant.stocks ?? [];
    const stockQuantity = hasVariantStockRows
      ? sumStock(stockRows.map((stock) => toStock(stock.quantity)))
      : parentStock;

    return {
      id: variant.id,
      name: variant.name.trim() || `Variant ${variant.id}`,
      sku: variant.sku.trim(),
      price: toMoney(variant.price) ?? 0,
      compareAtPrice: null,
      stockQuantity,
      options: normalizeOptions(variant.id, optionRows),
    };
  });

  const stockQuantity = variants.length === 0
    ? parentStock
    : hasVariantStockRows
      ? sumStock(variants.map((variant) => variant.stockQuantity))
      : parentStock;

  return {
    variants,
    stockQuantity,
    stockSource: hasVariantStockRows ? 'variant' : 'parent',
    defaultVariantId: variants.length === 1 ? variants[0].id : null,
  };
}

function normalizeRelatedProduct(product: RawProduct): RelatedProduct {
  const normalized = normalizeVariants(product, []);
  const gallery = parseGallery(product.imageUrl);
  const defaultVariant = normalized.defaultVariantId == null
    ? null
    : normalized.variants.find((variant) => variant.id === normalized.defaultVariantId) ?? null;

  return {
    id: product.id,
    name: product.name.trim(),
    sku: product.sku?.trim() ?? '',
    description: normalizeDescription(product.description),
    price: toMoney(product.price),
    compareAtPrice: null,
    imageUrl: gallery[0] ?? '',
    stockQuantity: normalized.stockQuantity,
    stockSource: normalized.stockSource,
    categoryId: product.categoryId ?? null,
    categoryName: product.category?.name.trim() ?? '',
    brandId: product.brandId ?? null,
    brandName: product.brand?.name.trim() ?? '',
    variantId: defaultVariant?.id ?? null,
    defaultVariantId: normalized.defaultVariantId,
    variants: normalized.variants,
  };
}

function relatedScore(candidate: RawProduct, current: RawProduct): number {
  let score = 0;
  if (current.categoryId != null && candidate.categoryId === current.categoryId) score += 8;
  if (current.brandId != null && candidate.brandId === current.brandId) score += 4;
  if (parseGallery(candidate.imageUrl).length > 0) score += 1;
  if (normalizeVariants(candidate, []).stockQuantity > 0) score += 1;
  return score;
}

/** Epoch milliseconds for the 🆕 recency tie-break; 0 when unknown. */
function candidateTime(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

/**
 * Related-products order — the storefront's automatic logic:
 * relatedness first (same category ≫ same brand, in-stock/with-image bonus),
 * then 🔥 best sellers by units sold, then 🆕 newest. Equal items fall back
 * to newest-first so the row never looks stale.
 */
function rankRelated(
  candidates: RawProduct[],
  current: RawProduct,
  soldCounts: Map<number, number>,
): RawProduct[] {
  return [...candidates].sort(
    (left, right) =>
      relatedScore(right, current) - relatedScore(left, current) ||
      (soldCounts.get(right.id) ?? 0) - (soldCounts.get(left.id) ?? 0) ||
      candidateTime(right.createdAt) - candidateTime(left.createdAt) ||
      right.id - left.id,
  );
}

async function metadataForMissingProduct(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('catalog.meta.product_not_found'),
    robots: { index: false, follow: false },
  };
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const productId = parseProductId(id);
  if (productId === null) return metadataForMissingProduct();

  const product = await getActiveProduct(productId);
  if (!product || !product.name.trim()) return metadataForMissingProduct();

  const description = normalizeDescription(product.description) || undefined;
  const image = metadataImageUrl(parseGallery(product.imageUrl)[0] ?? '');
  const canonical = `/home/products/${product.id}`;

  return {
    title: product.name.trim(),
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: canonical,
      title: product.name.trim(),
      description,
      images: image ? [{ url: image, alt: product.name.trim() }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: product.name.trim(),
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ShopProductDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const productId = parseProductId(id);
  if (productId === null) notFound();

  const product = await getActiveProduct(productId);
  if (!product || !product.name.trim()) notFound();

  const productVariants: RawVariant[] = product.variants ?? [];
  const activeVariantIds = productVariants
    .filter((variant) => variant.status === 'Active')
    .map((variant) => variant.id);

  const [optionRows, sameCategory, sameBrand, sectionData] = await Promise.all([
    getVariantOptionRows(activeVariantIds),
    product.categoryId
      ? getProducts({ categoryId: product.categoryId, limit: 50 }).catch(() => [])
      : Promise.resolve([]),
    product.brandId
      ? getProducts({ brandId: product.brandId, limit: 50 }).catch(() => [])
      : Promise.resolve([]),
    // Discount rules + per-product sales totals in one go: the rules price
    // everything below, the totals rank the 🔥 related-products logic.
    loadSectionProductData(),
  ]);
  const discounts = sectionData.discounts;
  const soldCounts = sectionData.soldCounts;

  const variantData = normalizeVariants(product, optionRows);
  const gallery = parseGallery(product.imageUrl);
  const categoryName = product.category?.name.trim() ?? '';
  const brandName = product.brand?.name.trim() ?? '';

  const basePrice = priceForProduct(
    toMoney(product.price),
    product.id,
    product.categoryId ?? null,
    discounts,
  );
  const pricedVariants = variantData.variants.map((variant) => {
    const priced = priceForProduct(
      variant.price,
      product.id,
      product.categoryId ?? null,
      discounts,
    );
    return {
      ...variant,
      price: priced.price ?? variant.price,
      compareAtPrice: priced.compareAtPrice,
    };
  });

  const detail: DetailProduct = {
    id: product.id,
    name: product.name.trim(),
    sku: product.sku?.trim() ?? '',
    description: normalizeDescription(product.description),
    price: basePrice.price,
    compareAtPrice: basePrice.compareAtPrice,
    imageUrl: gallery[0] ?? '',
    galleryImages: gallery,
    stockQuantity: variantData.stockQuantity,
    stockSource: variantData.stockSource,
    categoryId: product.categoryId ?? null,
    categoryName,
    brandId: product.brandId ?? null,
    brandName,
    variants: pricedVariants,
    defaultVariantId: variantData.defaultVariantId,
    rating: sectionData.ratings.get(product.id) ?? 0,
  };

  /** How many related items the row should try to fill. */
  const RELATED_LIMIT = 4;

  const candidates = new Map<number, RawProduct>();
  for (const candidate of [...sameCategory, ...sameBrand]) {
    if (
      candidate.status === 'Active'
      && candidate.id !== product.id
      && (candidate.categoryId === product.categoryId || candidate.brandId === product.brandId)
    ) {
      candidates.set(candidate.id, candidate);
    }
  }

  // A product with no category/brand (or a thin pool) still deserves a full
  // row: widen to the whole catalogue — ranking keeps real relatives on top
  // and fills the gaps with 🔥 best sellers / 🆕 newest products.
  if (candidates.size < RELATED_LIMIT) {
    const wide = await getProducts({ limit: 500 }).catch(() => []);
    for (const candidate of wide) {
      if (
        candidate.status === 'Active'
        && candidate.id !== product.id
        && !candidates.has(candidate.id)
      ) {
        candidates.set(candidate.id, candidate);
      }
    }
  }

  const related: RelatedProduct[] = rankRelated(
    Array.from(candidates.values()),
    product,
    soldCounts,
  )
    .slice(0, RELATED_LIMIT)
    .map((candidate) => {
      const normalized = normalizeRelatedProduct(candidate);
      const priced = priceForProduct(
        normalized.price,
        normalized.id,
        normalized.categoryId,
        discounts,
      );
      return {
        ...normalized,
        price: priced.price,
        compareAtPrice: priced.compareAtPrice,
      };
    });

  const queryValue = (key: string): string | undefined => {
    const raw = query[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };

  const requestedTab = queryValue('tab');
  const hasReviewQuery = [
    'reviewsPage',
    'reviewsRating',
    'reviewsSort',
    'reviewsVerified',
  ].some((key) => queryValue(key) !== undefined);
  const initialTab = requestedTab === 'reviews' || hasReviewQuery
    ? 'reviews'
    : requestedTab === 'details'
      ? 'details'
      : 'description';

  // Review filters arrive as plain GET params from the reviews tab controls.
  const reviewsPageRaw = Number(queryValue('reviewsPage') ?? '1');
  const reviewsRatingRaw = Number(queryValue('reviewsRating'));
  const reviewsSortRaw = queryValue('reviewsSort');
  const reviewsQuery: ProductReviewQuery = {
    page: Number.isInteger(reviewsPageRaw) && reviewsPageRaw > 0
      ? reviewsPageRaw
      : undefined,
    rating: Number.isInteger(reviewsRatingRaw)
      && reviewsRatingRaw >= 1
      && reviewsRatingRaw <= 5
      ? (reviewsRatingRaw as ProductReviewQuery['rating'] & number)
      : null,
    verifiedOnly: queryValue('reviewsVerified') === '1',
    sort: reviewsSortRaw === 'oldest'
      || reviewsSortRaw === 'highest'
      || reviewsSortRaw === 'lowest'
      ? reviewsSortRaw
      : 'newest',
  };
  const reviewStatusRaw = queryValue('reviewStatus');
  const reviewNotice: ReviewNotice | null =
    reviewStatusRaw === 'created'
    || reviewStatusRaw === 'rate-limited'
    || reviewStatusRaw === 'invalid'
    || reviewStatusRaw === 'denied'
      ? reviewStatusRaw
      : null;

  const [promo, reviews] = await Promise.all([
    loadPromoSettings(),
    loadProductReviews(detail.id, reviewsQuery, reviewNotice),
  ]);

  return (
    <ProductDetailsClient
      key={detail.id}
      product={detail}
      related={related}
      reviews={reviews}
      promo={promo}
      initialTab={initialTab}
    />
  );
}
