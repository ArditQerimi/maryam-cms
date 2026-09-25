import { and, eq, inArray, or } from 'drizzle-orm';
import * as tenantSchema from '@/db/schema-tenant';
import { StorefrontError } from './errors';
import type { StorefrontContext } from './context';
import type { CartLineInput } from './validation';

export type StorefrontMoney = string;

export type ResolvedCartLine = CartLineInput & {
  productName: string;
  productSku: string | null;
  productImageUrl: string | null;
  variantName: string;
  variantSku: string;
  unitPrice: StorefrontMoney;
  availableQuantity: number;
};

export type ResolvedWishlistProduct = {
  id: number;
  name: string;
  slug: string | null;
  sku: string | null;
  imageUrl: string | null;
  price: string | null;
  status: string;
  stockQuantity: number;
};

function catalogError(message: string) {
  return new StorefrontError(500, 'invalid-catalog-data', message);
}

export function formatServerMoney(value: string | number | null | undefined): StorefrontMoney {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw catalogError('Catalog price is invalid.');

  const whole = BigInt(match[1]);
  const fraction = (match[2] || '').padEnd(2, '0');
  const cents = whole * BigInt(100) + BigInt(fraction);
  return `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, '0')}`;
}

export function multiplyServerMoney(unitPrice: string, quantity: number) {
  const normalized = formatServerMoney(unitPrice);
  const [whole, fraction] = normalized.split('.');
  const cents = (BigInt(whole) * BigInt(100) + BigInt(fraction)) * BigInt(quantity);
  return `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, '0')}`;
}

function safeStock(value: number | null | undefined) {
  const stock = Number(value ?? 0);
  if (!Number.isSafeInteger(stock) || stock < 0) {
    throw catalogError('Catalog stock is invalid.');
  }
  return stock;
}

/**
 * Product stock is a parent-level compatibility fallback only. Stock rows
 * are variant/warehouse-specific; when rows exist for the selected variant,
 * their sum is authoritative. The default-variant migration deliberately does
 * not copy parent stock into product_stocks.
 */
async function getVariantAvailability(
  db: StorefrontContext['db'],
  variantId: number,
  productStock: number | null,
) {
  const stockRows = await db
    .select({ quantity: tenantSchema.productStocks.quantity })
    .from(tenantSchema.productStocks)
    .where(eq(tenantSchema.productStocks.variantId, variantId));

  if (stockRows.length === 0) {
    return safeStock(productStock);
  }

  return stockRows.reduce((total, row) => {
    const quantity = safeStock(row.quantity);
    const next = total + quantity;
    if (!Number.isSafeInteger(next)) throw catalogError('Catalog stock is invalid.');
    return next;
  }, 0);
}

export async function resolveCartLine(
  context: StorefrontContext,
  input: CartLineInput,
): Promise<ResolvedCartLine> {
  const [row] = await context.db
    .select({
      productId: tenantSchema.products.id,
      productName: tenantSchema.products.name,
      productSku: tenantSchema.products.sku,
      productImageUrl: tenantSchema.products.imageUrl,
      productStock: tenantSchema.products.stockQuantity,
      variantId: tenantSchema.productVariants.id,
      variantName: tenantSchema.productVariants.name,
      variantSku: tenantSchema.productVariants.sku,
      variantPrice: tenantSchema.productVariants.price,
    })
    .from(tenantSchema.products)
    .innerJoin(
      tenantSchema.productVariants,
      and(
        eq(tenantSchema.productVariants.productId, tenantSchema.products.id),
        eq(tenantSchema.productVariants.id, input.variantId),
      ),
    )
    .where(
      and(
        eq(tenantSchema.products.id, input.productId),
        eq(tenantSchema.products.status, 'Active'),
        eq(tenantSchema.productVariants.status, 'Active'),
      ),
    )
    .limit(1);

  if (!row) {
    throw new StorefrontError(404, 'product-or-variant-unavailable', 'The selected product or variant is unavailable.');
  }

  return {
    ...input,
    productName: row.productName,
    productSku: row.productSku,
    productImageUrl: row.productImageUrl,
    variantName: row.variantName,
    variantSku: row.variantSku,
    unitPrice: formatServerMoney(row.variantPrice),
    availableQuantity: await getVariantAvailability(context.db, row.variantId, row.productStock),
  };
}

export async function resolveCartLines(
  context: StorefrontContext,
  inputs: CartLineInput[],
) {
  if (inputs.length === 0) return [];

  const pairConditions = inputs.map((input) => and(
    eq(tenantSchema.products.id, input.productId),
    eq(tenantSchema.productVariants.id, input.variantId),
  ));
  const rows = await context.db
    .select({
      productId: tenantSchema.products.id,
      productName: tenantSchema.products.name,
      productSku: tenantSchema.products.sku,
      productImageUrl: tenantSchema.products.imageUrl,
      productStock: tenantSchema.products.stockQuantity,
      variantId: tenantSchema.productVariants.id,
      variantName: tenantSchema.productVariants.name,
      variantSku: tenantSchema.productVariants.sku,
      variantPrice: tenantSchema.productVariants.price,
    })
    .from(tenantSchema.products)
    .innerJoin(
      tenantSchema.productVariants,
      and(
        eq(tenantSchema.productVariants.productId, tenantSchema.products.id),
        inArray(tenantSchema.productVariants.id, inputs.map((input) => input.variantId)),
      ),
    )
    .where(and(
      eq(tenantSchema.products.status, 'Active'),
      eq(tenantSchema.productVariants.status, 'Active'),
      or(...pairConditions),
    ));

  const rowsByKey = new Map(rows.map((row) => [`${row.productId}:${row.variantId}`, row]));
  const variantIds = [...new Set(inputs.map((input) => input.variantId))];
  const stockRows = await context.db
    .select({
      variantId: tenantSchema.productStocks.variantId,
      quantity: tenantSchema.productStocks.quantity,
    })
    .from(tenantSchema.productStocks)
    .where(inArray(tenantSchema.productStocks.variantId, variantIds));

  const stockByVariant = new Map<number, number>();
  for (const stockRow of stockRows) {
    const next = (stockByVariant.get(stockRow.variantId) || 0) + safeStock(stockRow.quantity);
    if (!Number.isSafeInteger(next)) throw catalogError('Catalog stock is invalid.');
    stockByVariant.set(stockRow.variantId, next);
  }

  return inputs.map((input) => {
    const row = rowsByKey.get(`${input.productId}:${input.variantId}`);
    if (!row) {
      throw new StorefrontError(404, 'product-or-variant-unavailable', 'The selected product or variant is unavailable.');
    }

    // A missing row for this concrete variant is the only case where the
    // parent product quantity is used; any variant-specific rows are summed.
    const availableQuantity = stockByVariant.has(row.variantId)
      ? stockByVariant.get(row.variantId)!
      : safeStock(row.productStock);

    return {
      ...input,
      productName: row.productName,
      productSku: row.productSku,
      productImageUrl: row.productImageUrl,
      variantName: row.variantName,
      variantSku: row.variantSku,
      unitPrice: formatServerMoney(row.variantPrice),
      availableQuantity,
    } satisfies ResolvedCartLine;
  });
}

export async function resolveWishlistProduct(
  context: StorefrontContext,
  productId: number,
): Promise<ResolvedWishlistProduct> {
  const [row] = await context.db
    .select({
      id: tenantSchema.products.id,
      name: tenantSchema.products.name,
      slug: tenantSchema.products.slug,
      sku: tenantSchema.products.sku,
      imageUrl: tenantSchema.products.imageUrl,
      price: tenantSchema.products.price,
      status: tenantSchema.products.status,
      stockQuantity: tenantSchema.products.stockQuantity,
    })
    .from(tenantSchema.products)
    .where(and(eq(tenantSchema.products.id, productId), eq(tenantSchema.products.status, 'Active')))
    .limit(1);

  if (!row) {
    throw new StorefrontError(404, 'product-unavailable', 'The selected product is unavailable.');
  }

  return {
    ...row,
    stockQuantity: safeStock(row.stockQuantity),
  };
}
