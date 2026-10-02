'use server';

import { revalidatePath } from 'next/cache';
import { asc, eq, ilike, sql } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import {
  products,
  productVariants,
  productStocks,
  productDiscounts,
  settingsStore,
  warehouses,
} from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { slugify } from '@/lib/cms/format';
import {
  parseProductConfig,
  parseProductDescription,
  serializeProductConfig,
  serializeProductDescription,
  serializeProductImages,
} from '@/components/store/format-product';
import type {
  ActionResult,
  BackorderPolicy,
  ProductFormValues,
  VariantFormValues,
  VariantSaveResult,
} from '@/components/store/types';

type Db = Awaited<ReturnType<typeof getContextDb>>;

/* -------------------------------------------------------------------------- */
/* Small coercion helpers                                                      */
/* -------------------------------------------------------------------------- */

function text(value: unknown, max = 255): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/** "12.5" → "12.50"; invalid → null. */
function money(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw === '') return '0.00';
  const parsed = Number(raw.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 99_999_999) return null;
  return parsed.toFixed(2);
}

function int(value: unknown, fallback = 0): number | null {
  const raw = typeof value === 'string' ? value.trim() : String(value ?? '');
  if (raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function optionalId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function dateString(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function toDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isBackorder(value: unknown): BackorderPolicy {
  return value === 'notify' || value === 'allow' ? value : 'deny';
}

function isStatus(value: unknown): value is ProductFormValues['status'] {
  return (
    value === 'Active' ||
    value === 'Inactive' ||
    value === 'Archived' ||
    value === 'Pending' ||
    value === 'Suspended'
  );
}

async function uniqueSlug(db: Db, requested: string, productId?: number): Promise<string> {
  const base = slugify(requested) || 'product';
  let candidate = base;
  let attempt = 1;
  // Products have no unique slug index, but duplicates are still avoided.
  for (;;) {
    const rows = await db
      .select({ id: products.id })
      .from(products)
      .where(ilike(products.slug, candidate))
      .limit(5);
    const clash = rows.some((row) => row.id !== productId);
    if (!clash) return candidate;
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }
}

async function readConfig(db: Db, productId: number) {
  const [row] = await db
    .select({ value: settingsStore.value })
    .from(settingsStore)
    .where(eq(settingsStore.key, `products_config_${productId}`))
    .limit(1);
  return parseProductConfig(row?.value ?? null);
}

type ConfigInput = {
  salePrice: string;
  saleFrom: string;
  saleTo: string;
  backorder: BackorderPolicy;
  /** Validated '1'…'5' or '' — the card stars. */
  rating: string;
};

async function writeConfig(db: Db, productId: number, config: ConfigInput) {
  const serialized = serializeProductConfig({
    salePrice: text(config.salePrice, 40),
    saleFrom: dateString(config.saleFrom),
    saleTo: dateString(config.saleTo),
    backorder: isBackorder(config.backorder),
    rating: text(config.rating, 2),
  });
  const key = `products_config_${productId}`;
  const [existing] = await db
    .select({ id: settingsStore.id })
    .from(settingsStore)
    .where(eq(settingsStore.key, key))
    .limit(1);

  if (!serialized) {
    if (existing) await db.delete(settingsStore).where(eq(settingsStore.id, existing.id));
    return;
  }
  if (existing) {
    await db.update(settingsStore).set({ value: serialized, updatedAt: new Date() }).where(eq(settingsStore.id, existing.id));
  } else {
    await db.insert(settingsStore).values({ key, value: serialized });
  }
}

type ValidatedProduct = {
  values: {
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
    status: ProductFormValues['status'];
    price: string;
    costPrice: string;
    sku: string | null;
    barcode: string | null;
    stockQuantity: number;
    minStockLevel: number;
    categoryId: number | null;
    subCategoryId: number | null;
    brandId: number | null;
    unitId: number | null;
  };
  config: {
    salePrice: string;
    saleFrom: string;
    saleTo: string;
    backorder: BackorderPolicy;
    rating: string;
  };
};

function validate(values: ProductFormValues): { ok: true; data: ValidatedProduct } | { ok: false; error: string } {
  const name = text(values.name, 255).trim();
  if (!name) return { ok: false, error: 'A product name is required.' };

  const price = money(values.price);
  if (price === null) return { ok: false, error: 'Regular price must be a positive number.' };
  const costPrice = money(values.costPrice);
  if (costPrice === null) return { ok: false, error: 'Cost price must be a positive number.' };

  const stockQuantity = int(values.stockQuantity, 0);
  if (stockQuantity === null) return { ok: false, error: 'Stock quantity must be zero or a positive whole number.' };
  const minStockLevel = int(values.minStockLevel, 0);
  if (minStockLevel === null) return { ok: false, error: 'Low stock level must be zero or a positive whole number.' };

  const salePrice = text(values.salePrice, 40).trim();
  if (salePrice) {
    const parsedSale = money(salePrice);
    if (parsedSale === null || Number(parsedSale) <= 0) {
      return { ok: false, error: 'Sale price must be a positive number.' };
    }
    if (Number(parsedSale) >= Number(price)) {
      return { ok: false, error: 'Sale price must be lower than the regular price.' };
    }
  }
  const saleFrom = dateString(values.saleFrom);
  const saleTo = dateString(values.saleTo);
  if (saleFrom && saleTo && saleTo < saleFrom) {
    return { ok: false, error: 'The sale end date must be after the start date.' };
  }

  // Store rating: '' (no stars) or a whole number 1–5 (shown on every card).
  const ratingRaw = text(values.rating, 4).trim();
  let rating = '';
  if (ratingRaw) {
    const parsedRating = Number(ratingRaw);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return { ok: false, error: 'Store rating must be a whole number from 1 to 5.' };
    }
    rating = String(parsedRating);
  }

  return {
    ok: true,
    data: {
      values: {
        name,
        slug: text(values.slug, 255).trim(),
        description: serializeProductDescription(
          text(values.description, 50_000),
          text(values.shortDescription, 5_000),
        ),
        imageUrl: serializeProductImages(Array.isArray(values.images) ? values.images : []),
        status: isStatus(values.status) ? values.status : 'Active',
        price,
        costPrice,
        sku: text(values.sku, 100).trim() || null,
        barcode: text(values.barcode, 100).trim() || null,
        stockQuantity,
        minStockLevel,
        categoryId: optionalId(values.categoryId),
        subCategoryId: optionalId(values.subCategoryId),
        brandId: optionalId(values.brandId),
        unitId: optionalId(values.unitId),
      },
      config: {
        salePrice,
        saleFrom,
        saleTo,
        backorder: isBackorder(values.backorder),
        rating,
      },
    },
  };
}

function fkOrUniqueCode(error: unknown): string | null {
  const code = (error as { code?: string; cause?: { code?: string } })?.code ||
    (error as { cause?: { code?: string } })?.cause?.code;
  if (code === '23503') return 'A linked record no longer exists — refresh and try again.';
  if (code === '23505') return 'That SKU or code is already in use.';
  return null;
}

/* -------------------------------------------------------------------------- */
/* Product CRUD                                                                */
/* -------------------------------------------------------------------------- */

export async function createProduct(values: ProductFormValues): Promise<ActionResult> {
  await requireCmsSession();
  const validated = validate(values);
  if (!validated.ok) return { ok: false, error: validated.error };

  const db = await getContextDb();
  const slug = await uniqueSlug(db, validated.data.values.slug || validated.data.values.name);
  const data = { ...validated.data.values, slug };

  try {
    const [product] = await db.insert(products).values(data).returning({ id: products.id });
    if (!product) return { ok: false, error: 'Could not create the product.' };

    await writeConfig(db, product.id, validated.data.config);

    // The storefront can only sell concrete variants, so give every new product
    // a default variant (mirrors what the POS product admin does).
    await ensureDefaultVariant(db, product.id, data.sku, data.price);

    revalidatePath('/cms/products');
    revalidatePath(`/cms/products/${product.id}/edit`);
    revalidatePath('/home/products');
    return { ok: true, id: product.id };
  } catch (error) {
    return { ok: false, error: fkOrUniqueCode(error) || 'Could not create the product.' };
  }
}

async function ensureDefaultVariant(
  db: Db,
  productId: number,
  productSku: string | null,
  price: string,
) {
  const [existing] = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .limit(1);
  if (existing) return;

  const candidates = [productSku, `SKU-${productId}`].filter((sku): sku is string => Boolean(sku));
  for (const sku of candidates) {
    try {
      await db.insert(productVariants).values({
        productId,
        name: 'Default',
        sku: sku.slice(0, 100),
        price,
        costPrice: price,
        status: 'Active',
      });
      return;
    } catch (error) {
      if (fkOrUniqueCode(error) !== 'That SKU or code is already in use.') throw error;
    }
  }
}

export async function updateProduct(id: number, values: ProductFormValues): Promise<ActionResult> {
  await requireCmsSession();
  const validated = validate(values);
  if (!validated.ok) return { ok: false, error: validated.error };

  const db = await getContextDb();
  const [current] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  if (!current) return { ok: false, error: 'Product not found.' };

  const slug = await uniqueSlug(db, validated.data.values.slug || validated.data.values.name, id);

  try {
    await db
      .update(products)
      .set({ ...validated.data.values, slug, updatedAt: new Date() })
      .where(eq(products.id, id));
    await writeConfig(db, id, validated.data.config);

    revalidatePath('/cms/products');
    revalidatePath(`/cms/products/${id}/edit`);
    revalidatePath('/home/products');
    revalidatePath(`/home/products/${id}`);
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: fkOrUniqueCode(error) || 'Could not save the product.' };
  }
}

export async function duplicateProduct(id: number): Promise<ActionResult> {
  await requireCmsSession();
  const db = await getContextDb();

  const [source] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!source) return { ok: false, error: 'Product not found.' };

  try {
    const name = `${source.name} (copy)`.slice(0, 255);
    const slug = await uniqueSlug(db, `${source.slug || source.name}-copy`);
    const sku = source.sku ? `${source.sku}-copy`.slice(0, 100) : null;

    const [copy] = await db
      .insert(products)
      .values({
        categoryId: source.categoryId,
        subCategoryId: source.subCategoryId,
        brandId: source.brandId,
        unitId: source.unitId,
        storeId: source.storeId,
        warehouseId: source.warehouseId,
        warrantyId: source.warrantyId,
        name,
        slug,
        sku,
        barcode: source.barcode,
        itemCode: source.itemCode,
        productType: source.productType,
        price: source.price,
        costPrice: source.costPrice,
        taxRate: source.taxRate,
        discountType: source.discountType,
        discountValue: source.discountValue,
        stockQuantity: source.stockQuantity,
        minStockLevel: source.minStockLevel,
        description: source.description,
        imageUrl: source.imageUrl,
        status: 'Pending',
      })
      .returning({ id: products.id });
    if (!copy) return { ok: false, error: 'Could not duplicate the product.' };

    // Copy variants with fresh, unique SKUs.
    const variants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, id));
    for (const [index, variant] of variants.entries()) {
      const variantSku = `${variant.sku}-copy-${index + 1}`.slice(0, 100);
      await db.insert(productVariants).values({
        productId: copy.id,
        name: variant.name,
        sku: variantSku,
        barcode: variant.barcode,
        price: variant.price,
        costPrice: variant.costPrice,
        status: variant.status,
      });
    }

    const config = await readConfig(db, id);
    await writeConfig(db, copy.id, config);

    revalidatePath('/cms/products');
    return { ok: true, id: copy.id };
  } catch (error) {
    return { ok: false, error: fkOrUniqueCode(error) || 'Could not duplicate the product.' };
  }
}

export async function deleteProduct(id: number): Promise<ActionResult> {
  await requireCmsSession();
  const db = await getContextDb();

  try {
    const configKey = `products_config_${id}`;
    await db.delete(products).where(eq(products.id, id));
    await db.delete(settingsStore).where(eq(settingsStore.key, configKey));
    // product_discounts cascade with the product, this one is defensive.
    await db.delete(productDiscounts).where(eq(productDiscounts.productId, id));

    revalidatePath('/cms/products');
    revalidatePath('/home/products');
    revalidatePath(`/home/products/${id}`);
    return { ok: true, id };
  } catch (error) {
    const referenced =
      (error as { code?: string; cause?: { code?: string } })?.code === '23503' ||
      (error as { cause?: { code?: string } })?.cause?.code === '23503';
    if (referenced) {
      return {
        ok: false,
        error: 'This product has order history and cannot be deleted — set its status to Archived instead.',
      };
    }
    return { ok: false, error: 'Could not delete the product.' };
  }
}

/* -------------------------------------------------------------------------- */
/* Variants                                                                    */
/* -------------------------------------------------------------------------- */

async function applyVariantStock(
  db: Db,
  variantId: number,
  productId: number,
  target: number,
): Promise<string | null> {
  const [warehouse] = await db
    .select({ id: warehouses.id })
    .from(warehouses)
    .orderBy(asc(warehouses.id))
    .limit(1);
  if (!warehouse) {
    return 'No warehouse exists yet — create a warehouse before editing variant stock.';
  }

  const rows = await db
    .select()
    .from(productStocks)
    .where(eq(productStocks.variantId, variantId));

  if (rows.length === 0) {
    await db.insert(productStocks).values({
      warehouseId: warehouse.id,
      variantId,
      quantity: target,
      minStockLevel: 0,
    });
  } else {
    const others = rows.slice(1).reduce((total, row) => total + row.quantity, 0);
    const firstQuantity = target - others;
    if (firstQuantity < 0) {
      return `Stock cannot drop below ${others} — that quantity is held in other warehouses.`;
    }
    await db
      .update(productStocks)
      .set({ quantity: firstQuantity, updatedAt: new Date() })
      .where(eq(productStocks.id, rows[0].id));
  }

  // Keep the parent fallback stock in sync with the authoritative rows.
  const [sumRow] = await db
    .select({ total: sql<number>`coalesce(sum(${productStocks.quantity}), 0)::int` })
    .from(productStocks)
    .innerJoin(productVariants, eq(productStocks.variantId, productVariants.id))
    .where(eq(productVariants.productId, productId));
  await db
    .update(products)
    .set({ stockQuantity: sumRow?.total ?? 0, updatedAt: new Date() })
    .where(eq(products.id, productId));
  return null;
}

type VariantPayload =
  | { ok: false; error: string }
  | {
      ok: true;
      name: string;
      sku: string;
      price: string;
      costPrice: string;
      stock: number;
      productId: number;
    };

async function variantPayload(input: VariantFormValues): Promise<VariantPayload> {
  const name = text(input.name, 255).trim();
  const sku = text(input.sku, 100).trim();
  const price = money(input.price);
  const costPrice = money(input.costPrice ?? '');
  if (!name) return { ok: false, error: 'A variant name is required.' };
  if (!sku) return { ok: false, error: 'A variant SKU is required.' };
  if (price === null) return { ok: false, error: 'Variant price must be a positive number.' };
  if (costPrice === null) {
    return { ok: false, error: 'Variant cost price must be a positive number.' };
  }
  const stock = int(input.stock, 0);
  if (stock === null) {
    return { ok: false, error: 'Variant stock must be zero or a positive whole number.' };
  }
  const productId = optionalId(input.productId);
  if (!productId) return { ok: false, error: 'The product is missing.' };
  return { ok: true, name, sku, price, costPrice, stock, productId };
}

export async function saveVariant(input: VariantFormValues): Promise<VariantSaveResult> {
  await requireCmsSession();
  const payload = await variantPayload(input);
  if (!payload.ok) return { ok: false, error: payload.error };

  const db = await getContextDb();

  try {
    if (input.id) {
      const stockError = await applyVariantStock(db, input.id, payload.productId, payload.stock);
      if (stockError) return { ok: false, error: stockError };

      const [updated] = await db
        .update(productVariants)
        .set({
          name: payload.name,
          sku: payload.sku,
          price: payload.price,
          costPrice: payload.costPrice,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, input.id))
        .returning({ id: productVariants.id });
      if (!updated) return { ok: false, error: 'Variant not found.' };
      return {
        ok: true,
        variant: { ...input, id: updated.id, ...payload, stock: String(payload.stock) },
      };
    }

    const [inserted] = await db
      .insert(productVariants)
      .values({
        productId: payload.productId,
        name: payload.name,
        sku: payload.sku,
        price: payload.price,
        costPrice: payload.costPrice,
        status: 'Active',
      })
      .returning({ id: productVariants.id });
    if (!inserted) return { ok: false, error: 'Could not create the variant.' };

    const newStockError = await applyVariantStock(db, inserted.id, payload.productId, payload.stock);
    if (newStockError) return { ok: false, error: newStockError };

    revalidatePath('/cms/products');
    revalidatePath(`/cms/products/${payload.productId}/edit`);
    return {
      ok: true,
      variant: { ...input, id: inserted.id, ...payload, stock: String(payload.stock) },
    };
  } catch (error) {
    return { ok: false, error: fkOrUniqueCode(error) || 'Could not save the variant.' };
  }
}

export async function deleteVariant(variantId: number, productId: number): Promise<ActionResult> {
  await requireCmsSession();
  const db = await getContextDb();
  try {
    await db.delete(productVariants).where(eq(productVariants.id, variantId));
    const [sumRow] = await db
      .select({ total: sql<number>`coalesce(sum(${productStocks.quantity}), 0)::int` })
      .from(productStocks)
      .innerJoin(productVariants, eq(productStocks.variantId, productVariants.id))
      .where(eq(productVariants.productId, productId));
    const hasRows = await db
      .select({ id: productStocks.id })
      .from(productStocks)
      .innerJoin(productVariants, eq(productStocks.variantId, productVariants.id))
      .where(eq(productVariants.productId, productId))
      .limit(1);
    if (hasRows.length > 0) {
      await db
        .update(products)
        .set({ stockQuantity: sumRow?.total ?? 0, updatedAt: new Date() })
        .where(eq(products.id, productId));
    }
    revalidatePath(`/cms/products/${productId}/edit`);
    return { ok: true, id: variantId };
  } catch (error) {
    const code = (error as { code?: string; cause?: { code?: string } })?.code ||
      (error as { cause?: { code?: string } })?.cause?.code;
    if (code === '23503') {
      return { ok: false, error: 'This variant appears in existing orders and cannot be deleted.' };
    }
    return { ok: false, error: 'Could not delete the variant.' };
  }
}

/** Used by the edit page to re-read the config after tab edits. */
export async function readProductConfigFor(productId: number): Promise<string> {
  await requireCmsSession();
  const db = await getContextDb();
  const config = await readConfig(db, productId);
  return JSON.stringify(config);
}
