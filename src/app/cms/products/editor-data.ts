import { asc, eq, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getContextDb } from '@/lib/tenant';
import {
  brands,
  categories,
  productStocks,
  productVariants,
  products,
  settingsStore,
  subCategories,
  units,
} from '@/db/schema-tenant';
import {
  parseProductConfig,
  parseProductDescription,
  parseProductImages,
} from '@/components/store/format-product';
import type { ProductEditorData, VariantFormValues } from '@/components/store/types';
import type { TaxonomyOption } from '@/components/store/ProductEditor';

/**
 * Raw category / brand / unit lookups for the product editor tabs.
 * (Defined here — `@/components/store/ProductEditor` only exports its runtime
 * component and `TaxonomyOption`.)
 */
export type ProductLookups = {
  categories: Array<{ id: number; name: string; subCategories: Array<{ id: number; name: string }> }>;
  brands: Array<{ id: number; name: string }>;
  units: Array<{ id: number; name: string }>;
};

/** Flattens the nested lookups into the `taxonomy` shape ProductEditor expects. */
export function toTaxonomy(lookups: ProductLookups): {
  categories: TaxonomyOption[];
  subCategories: TaxonomyOption[];
  brands: TaxonomyOption[];
  units: TaxonomyOption[];
} {
  return {
    categories: lookups.categories.map(({ id, name }) => ({ id, name })),
    subCategories: lookups.categories.flatMap((category) =>
      category.subCategories.map((sub) => ({ ...sub, categoryId: category.id })),
    ),
    brands: lookups.brands,
    units: lookups.units,
  };
}

/** Category / brand / unit lookups for the product editor tabs. */
export async function getProductLookups(): Promise<ProductLookups> {
  const db = await getContextDb();
  const [categoryRows, subCategoryRows, brandRows, unitRows] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name)),
    db
      .select({ id: subCategories.id, name: subCategories.name, categoryId: subCategories.categoryId })
      .from(subCategories)
      .orderBy(asc(subCategories.name)),
    db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(asc(brands.name)),
    db.select({ id: units.id, name: units.name }).from(units).orderBy(asc(units.name)),
  ]);

  return {
    categories: categoryRows.map((category) => ({
      id: category.id,
      name: category.name,
      subCategories: subCategoryRows
        .filter((sub) => sub.categoryId === category.id)
        .map((sub) => ({ id: sub.id, name: sub.name })),
    })),
    brands: brandRows.map((brand) => ({ id: brand.id, name: brand.name })),
    units: unitRows.map((unit) => ({ id: unit.id, name: unit.name })),
  };
}

/** Full editor payload for `/cms/products/[id]/edit`. */
export async function getProductEditorData(id: number): Promise<{
  product: ProductEditorData;
  variants: VariantFormValues[];
}> {
  const db = await getContextDb();

  const [row, configRow] = await Promise.all([
    db.select().from(products).where(eq(products.id, id)).limit(1),
    db
      .select({ value: settingsStore.value })
      .from(settingsStore)
      .where(eq(settingsStore.key, `products_config_${id}`))
      .limit(1),
  ]);
  const product = row[0];
  if (!product) notFound();

  const description = parseProductDescription(product.description);
  const config = parseProductConfig(configRow[0]?.value ?? null);

  const variantRows = await db
    .select({
      id: productVariants.id,
      name: productVariants.name,
      sku: productVariants.sku,
      price: productVariants.price,
      costPrice: productVariants.costPrice,
      stock: sql<number>`coalesce(sum(${productStocks.quantity}), 0)::int`,
      hasStockRows: sql<number>`count(${productStocks.id})::int`,
    })
    .from(productVariants)
    .leftJoin(productStocks, eq(productStocks.variantId, productVariants.id))
    .where(eq(productVariants.productId, id))
    .groupBy(productVariants.id)
    .orderBy(asc(productVariants.id));

  const parentStock = product.stockQuantity ?? 0;
  const variants: VariantFormValues[] = variantRows.map((variant) => ({
    id: variant.id,
    productId: id,
    name: variant.name,
    sku: variant.sku,
    price: variant.price,
    costPrice: variant.costPrice ?? '0.00',
    // product_stocks rows are authoritative when they exist; otherwise the
    // parent-level fallback stock is shown (mirrors the storefront rule).
    stock: String(variant.hasStockRows > 0 ? variant.stock : parentStock),
  }));

  const editor: ProductEditorData = {
    id: product.id,
    name: product.name,
    slug: product.slug ?? '',
    shortDescription: description.short,
    description: description.full,
    status: product.status as ProductEditorData['status'],
    price: product.price ?? '',
    costPrice: product.costPrice ?? '',
    salePrice: config.salePrice,
    saleFrom: config.saleFrom,
    saleTo: config.saleTo,
    rating: config.rating,
    sku: product.sku ?? '',
    barcode: product.barcode ?? '',
    stockQuantity: String(product.stockQuantity ?? 0),
    minStockLevel: String(product.minStockLevel ?? 0),
    backorder: config.backorder,
    images: parseProductImages(product.imageUrl),
    categoryId: product.categoryId ? String(product.categoryId) : '',
    subCategoryId: product.subCategoryId ? String(product.subCategoryId) : '',
    brandId: product.brandId ? String(product.brandId) : '',
    unitId: product.unitId ? String(product.unitId) : '',
  };

  return { product: editor, variants };
}
