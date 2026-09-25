import { and, asc, eq } from 'drizzle-orm';
import * as tenantSchema from '@/db/schema-tenant';
import { parseImageUrl } from '@/lib/image-url';
import { StorefrontError } from './errors';
import { mergeWishlistProductIds } from './merge';
import { formatServerMoney, resolveWishlistProduct } from './products';
import { requireCustomer, type StorefrontContext } from './context';
import {
  MAX_WISHLIST_ITEMS,
  type WishlistAddInput,
  type WishlistImportInput,
  type WishlistRemoveInput,
} from './validation';

export type WishlistSnapshotItem = {
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
  };
  available: boolean;
  addedAt: string;
};

export type WishlistSnapshot = {
  items: WishlistSnapshotItem[];
  count: number;
};

export type WishlistMutationResult = {
  wishlist: WishlistSnapshot;
  imported?: boolean;
};

function ownedWishlistWhere(userId: number, productId?: number) {
  return productId === undefined
    ? eq(tenantSchema.wishlistItems.userId, userId)
    : and(
      eq(tenantSchema.wishlistItems.userId, userId),
      eq(tenantSchema.wishlistItems.productId, productId),
    );
}

async function readWishlist(context: StorefrontContext, userId: number) {
  const rows = await context.db
    .select({
      productId: tenantSchema.wishlistItems.productId,
      name: tenantSchema.products.name,
      slug: tenantSchema.products.slug,
      sku: tenantSchema.products.sku,
      imageUrl: tenantSchema.products.imageUrl,
      status: tenantSchema.products.status,
      price: tenantSchema.products.price,
      stockQuantity: tenantSchema.products.stockQuantity,
      createdAt: tenantSchema.wishlistItems.createdAt,
    })
    .from(tenantSchema.wishlistItems)
    .innerJoin(tenantSchema.products, eq(tenantSchema.products.id, tenantSchema.wishlistItems.productId))
    .where(ownedWishlistWhere(userId))
    .orderBy(asc(tenantSchema.wishlistItems.createdAt));

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
    },
    available: row.status === 'Active' && Number(row.stockQuantity ?? 0) > 0,
    addedAt: row.createdAt.toISOString(),
  } satisfies WishlistSnapshotItem));

  return { items, count: items.length } satisfies WishlistSnapshot;
}

export async function getWishlist(context: StorefrontContext): Promise<WishlistSnapshot> {
  const customer = requireCustomer(context);
  return readWishlist(context, customer.id);
}

export async function addWishlistProduct(
  context: StorefrontContext,
  input: WishlistAddInput,
): Promise<WishlistMutationResult> {
  const customer = requireCustomer(context);
  const product = await resolveWishlistProduct(context, input.productId);
  const existing = await context.db
    .select({ productId: tenantSchema.wishlistItems.productId })
    .from(tenantSchema.wishlistItems)
    .where(ownedWishlistWhere(customer.id, input.productId))
    .limit(1);

  if (existing.length === 0) {
    const owned = await context.db
      .select({ productId: tenantSchema.wishlistItems.productId })
      .from(tenantSchema.wishlistItems)
      .where(ownedWishlistWhere(customer.id));
    if (owned.length >= MAX_WISHLIST_ITEMS) {
      throw new StorefrontError(409, 'wishlist-item-limit', `A wishlist cannot contain more than ${MAX_WISHLIST_ITEMS} items.`);
    }
    await context.db
      .insert(tenantSchema.wishlistItems)
      .values({
        userId: customer.id,
        productId: product.id,
      })
      .onConflictDoNothing({ target: [tenantSchema.wishlistItems.userId, tenantSchema.wishlistItems.productId] });
  }

  return { wishlist: await readWishlist(context, customer.id) };
}

export async function removeWishlistProduct(
  context: StorefrontContext,
  input: WishlistRemoveInput,
): Promise<WishlistMutationResult> {
  const customer = requireCustomer(context);
  const deleted = await context.db
    .delete(tenantSchema.wishlistItems)
    .where(ownedWishlistWhere(customer.id, input.productId))
    .returning({ productId: tenantSchema.wishlistItems.productId });
  if (deleted.length === 0) {
    throw new StorefrontError(404, 'wishlist-item-not-found', 'Wishlist item not found.');
  }
  return { wishlist: await readWishlist(context, customer.id) };
}

export async function clearWishlist(context: StorefrontContext): Promise<WishlistMutationResult> {
  const customer = requireCustomer(context);
  await context.db
    .delete(tenantSchema.wishlistItems)
    .where(ownedWishlistWhere(customer.id));
  return { wishlist: await readWishlist(context, customer.id) };
}

export async function importWishlist(
  context: StorefrontContext,
  input: WishlistImportInput,
): Promise<WishlistMutationResult> {
  const customer = requireCustomer(context);
  const existingRows = await context.db
    .select({ productId: tenantSchema.wishlistItems.productId })
    .from(tenantSchema.wishlistItems)
    .where(ownedWishlistWhere(customer.id));
  // Resolve every incoming ID against the tenant catalog before inserting.
  // The client cannot provide a display name, image, or price.
  const resolved = await Promise.all(
    input.productIds.map((productId) => resolveWishlistProduct(context, productId)),
  );
  const resolvedIds = resolved.map((product) => product.id);
  const finalIds = mergeWishlistProductIds(existingRows.map((row) => row.productId), resolvedIds);
  if (finalIds.length > MAX_WISHLIST_ITEMS) {
    throw new StorefrontError(409, 'wishlist-item-limit', `A wishlist cannot contain more than ${MAX_WISHLIST_ITEMS} items.`);
  }

  const existingSet = new Set(existingRows.map((row) => row.productId));
  const additions = finalIds.filter((productId) => !existingSet.has(productId));
  if (additions.length > 0) {
    await context.db
      .insert(tenantSchema.wishlistItems)
      .values(additions.map((productId) => ({ userId: customer.id, productId })))
      .onConflictDoNothing({ target: [tenantSchema.wishlistItems.userId, tenantSchema.wishlistItems.productId] });
  }

  return { wishlist: await readWishlist(context, customer.id), imported: true };
}
