import { and, asc, eq } from 'drizzle-orm';
import * as tenantSchema from '@/db/schema-tenant';
import { parseImageUrl } from '@/lib/image-url';
import { StorefrontError } from './errors';
import { mergeWishlistProductIds } from './merge';
import { formatServerMoney, resolveWishlistProduct } from './products';
import { requireCustomer, type StorefrontContext } from './context';
import {
  MAX_COMPARE_ITEMS,
  type WishlistAddInput as CompareAddInput,
  type WishlistImportInput as CompareImportInput,
  type WishlistRemoveInput as CompareRemoveInput,
} from './validation';

/**
 * Signed-in shoppers' comparison lists (compare_items, migration 005).
 * Guests are rejected upstream by `allowGuest: false` and keep their
 * browser-local session list instead.
 */

export type CompareSnapshotItem = {
  productId: number;
  product: {
    id: number;
    name: string;
    slug: string | null;
    sku: string | null;
    imageUrl: string | null;
    status: string;
    price: string | null;
    stockQuantity: number;
    description: string;
  };
  available: boolean;
  addedAt: string;
};

export type CompareSnapshot = {
  items: CompareSnapshotItem[];
  count: number;
};

export type CompareMutationResult = {
  compare: CompareSnapshot;
  imported?: boolean;
};

function ownedCompareWhere(userId: number, productId?: number) {
  return productId === undefined
    ? eq(tenantSchema.compareItems.userId, userId)
    : and(
      eq(tenantSchema.compareItems.userId, userId),
      eq(tenantSchema.compareItems.productId, productId),
    );
}

async function readCompare(context: StorefrontContext, userId: number) {
  const rows = await context.db
    .select({
      productId: tenantSchema.compareItems.productId,
      name: tenantSchema.products.name,
      slug: tenantSchema.products.slug,
      sku: tenantSchema.products.sku,
      imageUrl: tenantSchema.products.imageUrl,
      status: tenantSchema.products.status,
      price: tenantSchema.products.price,
      stockQuantity: tenantSchema.products.stockQuantity,
      description: tenantSchema.products.description,
      createdAt: tenantSchema.compareItems.createdAt,
    })
    .from(tenantSchema.compareItems)
    .innerJoin(tenantSchema.products, eq(tenantSchema.products.id, tenantSchema.compareItems.productId))
    .where(ownedCompareWhere(userId))
    .orderBy(asc(tenantSchema.compareItems.createdAt));

  const items = rows.map((row) => ({
    productId: row.productId,
    product: {
      id: row.productId,
      name: row.name,
      slug: row.slug,
      sku: row.sku,
      imageUrl: parseImageUrl(row.imageUrl) || null,
      status: row.status,
      price: row.price === null ? null : formatServerMoney(row.price),
      stockQuantity: Number(row.stockQuantity ?? 0),
      description: row.description ?? '',
    },
    available: row.status === 'Active' && Number(row.stockQuantity ?? 0) > 0,
    addedAt: row.createdAt.toISOString(),
  } satisfies CompareSnapshotItem));

  return { items, count: items.length } satisfies CompareSnapshot;
}

export async function getCompare(context: StorefrontContext): Promise<CompareSnapshot> {
  const customer = requireCustomer(context);
  return readCompare(context, customer.id);
}

export async function addCompareProduct(
  context: StorefrontContext,
  input: CompareAddInput,
): Promise<CompareMutationResult> {
  const customer = requireCustomer(context);
  const product = await resolveWishlistProduct(context, input.productId);
  const existing = await context.db
    .select({ productId: tenantSchema.compareItems.productId })
    .from(tenantSchema.compareItems)
    .where(ownedCompareWhere(customer.id, input.productId))
    .limit(1);

  if (existing.length === 0) {
    const owned = await context.db
      .select({ productId: tenantSchema.compareItems.productId })
      .from(tenantSchema.compareItems)
      .where(ownedCompareWhere(customer.id));
    if (owned.length >= MAX_COMPARE_ITEMS) {
      throw new StorefrontError(409, 'compare-item-limit', `A comparison cannot contain more than ${MAX_COMPARE_ITEMS} items.`);
    }
    await context.db
      .insert(tenantSchema.compareItems)
      .values({
        userId: customer.id,
        productId: product.id,
      })
      .onConflictDoNothing({ target: [tenantSchema.compareItems.userId, tenantSchema.compareItems.productId] });
  }

  return { compare: await readCompare(context, customer.id) };
}

export async function removeCompareProduct(
  context: StorefrontContext,
  input: CompareRemoveInput,
): Promise<CompareMutationResult> {
  const customer = requireCustomer(context);
  const deleted = await context.db
    .delete(tenantSchema.compareItems)
    .where(ownedCompareWhere(customer.id, input.productId))
    .returning({ productId: tenantSchema.compareItems.productId });
  if (deleted.length === 0) {
    throw new StorefrontError(404, 'compare-item-not-found', 'Comparison item not found.');
  }
  return { compare: await readCompare(context, customer.id) };
}

export async function clearCompare(context: StorefrontContext): Promise<CompareMutationResult> {
  const customer = requireCustomer(context);
  await context.db
    .delete(tenantSchema.compareItems)
    .where(ownedCompareWhere(customer.id));
  return { compare: await readCompare(context, customer.id) };
}

export async function importCompare(
  context: StorefrontContext,
  input: CompareImportInput,
): Promise<CompareMutationResult> {
  const customer = requireCustomer(context);
  const existingRows = await context.db
    .select({ productId: tenantSchema.compareItems.productId })
    .from(tenantSchema.compareItems)
    .where(ownedCompareWhere(customer.id));
  // Resolve every incoming ID against the tenant catalog before inserting.
  const resolved = await Promise.all(
    input.productIds.map((productId) => resolveWishlistProduct(context, productId)),
  );
  const resolvedIds = resolved.map((product) => product.id);
  const finalIds = mergeWishlistProductIds(existingRows.map((row) => row.productId), resolvedIds);
  // Unlike the wishlist, a comparison is a small side-by-side set: importing
  // more than the slot count is truncated instead of rejected, so a stale
  // larger local list can still sync cleanly without a 409.
  const acceptedIds = finalIds.slice(0, MAX_COMPARE_ITEMS);

  const existingSet = new Set(existingRows.map((row) => row.productId));
  const additions = acceptedIds.filter((productId) => !existingSet.has(productId));
  if (additions.length > 0) {
    await context.db
      .insert(tenantSchema.compareItems)
      .values(additions.map((productId) => ({ userId: customer.id, productId })))
      .onConflictDoNothing({ target: [tenantSchema.compareItems.userId, tenantSchema.compareItems.productId] });
  }

  return { compare: await readCompare(context, customer.id), imported: true };
}
