import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import * as tenantSchema from '@/db/schema-tenant';
import { parseImageUrl } from '@/lib/image-url';
import { StorefrontError } from './errors';
import { mergeCartLines } from './merge';
import {
  formatServerMoney,
  multiplyServerMoney,
  resolveCartLine,
  resolveCartLines,
} from './products';
import type { StorefrontContext } from './context';
import {
  MAX_CART_ITEMS,
  MAX_CART_LINE_QUANTITY,
  MAX_CART_TOTAL_QUANTITY,
  type CartAddInput,
  type CartImportInput,
  type CartRemoveInput,
  type CartUpdateInput,
} from './validation';

export type CartOwner =
  | { kind: 'guest'; cartId: string }
  | { kind: 'user'; userId: number };

export type CartCookieAction =
  | { type: 'set'; cartId: string }
  | { type: 'clear' };

export type CartSnapshotItem = {
  id: number;
  productId: number;
  variantId: number;
  quantity: number;
  product: {
    id: number;
    name: string;
    slug: string | null;
    sku: string | null;
    imageUrl: string | null;
    status: string;
  };
  variant: {
    id: number;
    name: string;
    sku: string;
    price: string;
    status: string;
  };
  unitPrice: string;
  lineTotal: string;
  available: boolean;
};

export type CartSnapshot = {
  owner: 'guest' | 'customer';
  items: CartSnapshotItem[];
  itemCount: number;
  totalQuantity: number;
  subtotal: string;
  mergeAvailable?: boolean;
};

export type CartMutationResult = {
  cart: CartSnapshot;
  cookieAction?: CartCookieAction;
  merged?: boolean;
  imported?: boolean;
  created?: boolean;
};

function ownerCondition(owner: CartOwner) {
  return owner.kind === 'user'
    ? eq(tenantSchema.carts.userId, owner.userId)
    : and(
      eq(tenantSchema.carts.id, owner.cartId),
      isNull(tenantSchema.carts.userId),
    );
}

function ownedCartIds(db: StorefrontContext['db'], owner: CartOwner) {
  return db
    .select({ id: tenantSchema.carts.id })
    .from(tenantSchema.carts)
    .where(ownerCondition(owner));
}

function ownerForRequest(context: StorefrontContext, guestCartId: string | null): CartOwner {
  if (context.customer) {
    return { kind: 'user', userId: context.customer.id };
  }
  if (!guestCartId) {
    throw new StorefrontError(404, 'cart-not-found', 'No guest cart is available.');
  }
  return { kind: 'guest', cartId: guestCartId };
}

function emptySnapshot(owner: CartOwner, mergeAvailable = false): CartSnapshot {
  return {
    owner: owner.kind === 'user' ? 'customer' : 'guest',
    items: [],
    itemCount: 0,
    totalQuantity: 0,
    subtotal: '0.00',
    ...(mergeAvailable ? { mergeAvailable: true } : {}),
  };
}

async function findOwnedCart(db: StorefrontContext['db'], owner: CartOwner) {
  const [cart] = await db
    .select({ id: tenantSchema.carts.id })
    .from(tenantSchema.carts)
    .where(ownerCondition(owner))
    .limit(1);
  return cart || null;
}

async function ensureUserCart(db: StorefrontContext['db'], userId: number) {
  const existing = await findOwnedCart(db, { kind: 'user', userId });
  if (existing) return existing;

  const candidateId = randomUUID();
  await db
    .insert(tenantSchema.carts)
    .values({ id: candidateId, userId })
    .onConflictDoNothing();

  const selected = await findOwnedCart(db, { kind: 'user', userId });
  if (!selected) {
    throw new StorefrontError(409, 'cart-create-conflict', 'The cart could not be created.');
  }
  return selected;
}

async function ensureGuestCart(db: StorefrontContext['db'], guestCartId: string | null) {
  if (guestCartId) {
    const existing = await findOwnedCart(db, { kind: 'guest', cartId: guestCartId });
    if (existing) return { cart: existing, cookieAction: undefined as CartCookieAction | undefined };
  }

  const cart = { id: randomUUID() };
  await db.insert(tenantSchema.carts).values({ id: cart.id, userId: null });
  return { cart, cookieAction: { type: 'set', cartId: cart.id } as CartCookieAction };
}

async function mergeGuestCartIntoUser(
  db: StorefrontContext['db'],
  userId: number,
  guestCartId: string,
) {
  return db.transaction(async (tx) => {
    const [guestCart] = await tx
      .select({ id: tenantSchema.carts.id })
      .from(tenantSchema.carts)
      .where(and(eq(tenantSchema.carts.id, guestCartId), isNull(tenantSchema.carts.userId)))
      .limit(1);

    if (!guestCart) {
      return { userCartId: null, merged: false };
    }

    let [userCart] = await tx
      .select({ id: tenantSchema.carts.id })
      .from(tenantSchema.carts)
      .where(eq(tenantSchema.carts.userId, userId))
      .limit(1);

    if (!userCart) {
      const candidateId = randomUUID();
      await tx
        .insert(tenantSchema.carts)
        .values({ id: candidateId, userId })
        .onConflictDoNothing();
      [userCart] = await tx
        .select({ id: tenantSchema.carts.id })
        .from(tenantSchema.carts)
        .where(eq(tenantSchema.carts.userId, userId))
        .limit(1);
    }

    if (!userCart) {
      throw new StorefrontError(409, 'cart-create-conflict', 'The customer cart could not be created.');
    }

    const guestLines = await tx
      .select({
        productId: tenantSchema.cartItems.productId,
        variantId: tenantSchema.cartItems.variantId,
        quantity: tenantSchema.cartItems.quantity,
      })
      .from(tenantSchema.cartItems)
      .innerJoin(tenantSchema.carts, eq(tenantSchema.cartItems.cartId, tenantSchema.carts.id))
      .where(and(
        eq(tenantSchema.carts.id, guestCartId),
        isNull(tenantSchema.carts.userId),
      ));

    const userLines = await tx
      .select({
        productId: tenantSchema.cartItems.productId,
        variantId: tenantSchema.cartItems.variantId,
        quantity: tenantSchema.cartItems.quantity,
      })
      .from(tenantSchema.cartItems)
      .innerJoin(tenantSchema.carts, eq(tenantSchema.cartItems.cartId, tenantSchema.carts.id))
      .where(and(
        eq(tenantSchema.carts.userId, userId),
        eq(tenantSchema.cartItems.cartId, userCart.id),
      ));

    const mergedLines = mergeCartLines(userLines, guestLines);
    const ownedGuestCartIds = tx
      .select({ id: tenantSchema.carts.id })
      .from(tenantSchema.carts)
      .where(and(eq(tenantSchema.carts.id, guestCartId), isNull(tenantSchema.carts.userId)));
    await tx.delete(tenantSchema.cartItems).where(inArray(tenantSchema.cartItems.cartId, ownedGuestCartIds));

    const ownedUserCartIds = tx
      .select({ id: tenantSchema.carts.id })
      .from(tenantSchema.carts)
      .where(eq(tenantSchema.carts.userId, userId));
    await tx.delete(tenantSchema.cartItems).where(inArray(tenantSchema.cartItems.cartId, ownedUserCartIds));

    if (mergedLines.length > 0) {
      await tx.insert(tenantSchema.cartItems).values(
        mergedLines.map((line) => ({
          cartId: userCart.id,
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
        })),
      );
    }

    // The ownership predicate is repeated for the cart delete as well: a
    // caller can never remove a user cart by supplying a guest UUID.
    await tx.delete(tenantSchema.carts).where(and(
      eq(tenantSchema.carts.id, guestCartId),
      isNull(tenantSchema.carts.userId),
    ));

    return { userCartId: userCart.id, merged: true };
  });
}

async function ensureCartForMutation(
  context: StorefrontContext,
  guestCartId: string | null,
  mergeGuest: boolean,
) {
  if (context.customer) {
    let cookieAction: CartCookieAction | undefined;
    let merged = false;
    let cart: { id: string };
    if (mergeGuest && guestCartId) {
      const mergeResult = await mergeGuestCartIntoUser(
        context.db,
        context.customer.id,
        guestCartId,
      );
      merged = mergeResult.merged;
      cookieAction = { type: 'clear' };
      cart = merged && mergeResult.userCartId
        ? { id: mergeResult.userCartId }
        : await ensureUserCart(context.db, context.customer.id);
    } else {
      cart = await ensureUserCart(context.db, context.customer.id);
    }
    return {
      cart,
      owner: { kind: 'user', userId: context.customer.id } as CartOwner,
      cookieAction,
      merged,
    };
  }

  const ensured = await ensureGuestCart(context.db, guestCartId);
  return {
    cart: ensured.cart,
    owner: { kind: 'guest', cartId: ensured.cart.id } as CartOwner,
    cookieAction: ensured.cookieAction,
    merged: false,
  };
}

async function readOwnedLines(db: StorefrontContext['db'], owner: CartOwner) {
  return db
    .select({
      productId: tenantSchema.cartItems.productId,
      variantId: tenantSchema.cartItems.variantId,
      quantity: tenantSchema.cartItems.quantity,
    })
    .from(tenantSchema.cartItems)
    .innerJoin(tenantSchema.carts, eq(tenantSchema.cartItems.cartId, tenantSchema.carts.id))
    .where(ownerCondition(owner))
    .orderBy(asc(tenantSchema.cartItems.id));
}

async function readCartSnapshot(
  context: StorefrontContext,
  owner: CartOwner,
  mergeAvailable = false,
): Promise<CartSnapshot> {
  const rows = await context.db
    .select({
      itemId: tenantSchema.cartItems.id,
      productId: tenantSchema.products.id,
      variantId: tenantSchema.productVariants.id,
      quantity: tenantSchema.cartItems.quantity,
      productName: tenantSchema.products.name,
      productSlug: tenantSchema.products.slug,
      productSku: tenantSchema.products.sku,
      productImageUrl: tenantSchema.products.imageUrl,
      productStatus: tenantSchema.products.status,
      variantName: tenantSchema.productVariants.name,
      variantSku: tenantSchema.productVariants.sku,
      variantPrice: tenantSchema.productVariants.price,
      variantStatus: tenantSchema.productVariants.status,
    })
    .from(tenantSchema.cartItems)
    .innerJoin(tenantSchema.carts, eq(tenantSchema.cartItems.cartId, tenantSchema.carts.id))
    .innerJoin(
      tenantSchema.products,
      eq(tenantSchema.products.id, tenantSchema.cartItems.productId),
    )
    .innerJoin(
      tenantSchema.productVariants,
      and(
        eq(tenantSchema.productVariants.id, tenantSchema.cartItems.variantId),
        eq(tenantSchema.productVariants.productId, tenantSchema.products.id),
      ),
    )
    .where(ownerCondition(owner))
    .orderBy(asc(tenantSchema.cartItems.id));

  const items = rows.map((row) => {
    const unitPrice = formatServerMoney(row.variantPrice);
    return {
      id: row.itemId,
      productId: row.productId,
      variantId: row.variantId,
      quantity: row.quantity,
      product: {
        id: row.productId,
        name: row.productName,
        slug: row.productSlug,
        sku: row.productSku,
        imageUrl: parseImageUrl(row.productImageUrl) || null,
        status: row.productStatus,
      },
      variant: {
        id: row.variantId,
        name: row.variantName,
        sku: row.variantSku,
        price: unitPrice,
        status: row.variantStatus,
      },
      unitPrice,
      lineTotal: multiplyServerMoney(unitPrice, row.quantity),
      available: row.productStatus === 'Active' && row.variantStatus === 'Active',
    } satisfies CartSnapshotItem;
  });

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + BigInt(item.lineTotal.replace('.', '')), BigInt(0));
  const subtotalString = `${subtotal / BigInt(100)}.${String(subtotal % BigInt(100)).padStart(2, '0')}`;

  return {
    owner: owner.kind === 'user' ? 'customer' : 'guest',
    items,
    itemCount: items.length,
    totalQuantity,
    subtotal: subtotalString,
    ...(mergeAvailable ? { mergeAvailable: true } : {}),
  };
}

export async function getCartSnapshot(
  context: StorefrontContext,
  guestCartId: string | null,
) {
  if (!context.customer && !guestCartId) {
    return emptySnapshot({ kind: 'guest', cartId: '' });
  }

  const owner = ownerForRequest(context, guestCartId);
  if (owner.kind === 'guest') {
    const cart = await findOwnedCart(context.db, owner);
    if (!cart) return emptySnapshot(owner);
  }
  return readCartSnapshot(
    context,
    owner,
    context.customer !== null && Boolean(guestCartId),
  );
}

export async function addCartItem(
  context: StorefrontContext,
  guestCartId: string | null,
  input: CartAddInput,
): Promise<CartMutationResult> {
  const resolved = await resolveCartLine(context, input);
  const prepared = await ensureCartForMutation(context, guestCartId, true);
  const owner = prepared.owner;

  const [existing] = await context.db
    .select({
      id: tenantSchema.cartItems.id,
      quantity: tenantSchema.cartItems.quantity,
    })
    .from(tenantSchema.cartItems)
    .innerJoin(tenantSchema.carts, eq(tenantSchema.cartItems.cartId, tenantSchema.carts.id))
    .where(and(
      ownerCondition(owner),
      eq(tenantSchema.cartItems.productId, input.productId),
      eq(tenantSchema.cartItems.variantId, input.variantId),
    ))
    .limit(1);
  const currentLines = await readOwnedLines(context.db, owner);
  const currentTotal = currentLines.reduce((sum, line) => sum + line.quantity, 0);
  const desiredQuantity = (existing?.quantity || 0) + input.quantity;
  if (desiredQuantity > MAX_CART_LINE_QUANTITY) {
    throw new StorefrontError(409, 'cart-quantity-limit', `A cart item cannot exceed ${MAX_CART_LINE_QUANTITY} units.`);
  }
  if (currentTotal - (existing?.quantity || 0) + desiredQuantity > MAX_CART_TOTAL_QUANTITY) {
    throw new StorefrontError(409, 'cart-total-limit', `A cart cannot contain more than ${MAX_CART_TOTAL_QUANTITY} total units.`);
  }
  if (desiredQuantity > resolved.availableQuantity) {
    throw new StorefrontError(409, 'insufficient-stock', 'The requested quantity is not currently available.');
  }

  let created = false;
  if (existing) {
    const owned = ownedCartIds(context.db, owner);
    const updated = await context.db
      .update(tenantSchema.cartItems)
      .set({ quantity: desiredQuantity, updatedAt: new Date() })
      .where(and(
        eq(tenantSchema.cartItems.id, existing.id),
        inArray(tenantSchema.cartItems.cartId, owned),
      ))
      .returning({ id: tenantSchema.cartItems.id });
    if (updated.length !== 1) {
      throw new StorefrontError(409, 'cart-update-conflict', 'The cart changed; please retry.');
    }
  } else {
    if (currentLines.length >= MAX_CART_ITEMS) {
      throw new StorefrontError(409, 'cart-item-limit', `A cart cannot contain more than ${MAX_CART_ITEMS} items.`);
    }
    const owned = await ownedCartIds(context.db, owner);
    if (owned.length !== 1) {
      throw new StorefrontError(409, 'cart-update-conflict', 'The cart is no longer available.');
    }
    await context.db.insert(tenantSchema.cartItems).values({
      cartId: prepared.cart.id,
      productId: input.productId,
      variantId: input.variantId,
      quantity: input.quantity,
    });
    created = true;
  }

  return {
    cart: await readCartSnapshot(context, owner),
    cookieAction: prepared.cookieAction,
    merged: prepared.merged,
    created,
  };
}

export async function updateCartItem(
  context: StorefrontContext,
  guestCartId: string | null,
  input: CartUpdateInput,
): Promise<CartMutationResult> {
  const prepared = context.customer && guestCartId
    ? await ensureCartForMutation(context, guestCartId, true)
    : {
      cart: null,
      owner: ownerForRequest(context, guestCartId),
      cookieAction: undefined as CartCookieAction | undefined,
      merged: false,
    };
  const owner = prepared.owner;

  const [line] = await context.db
    .select({
      productId: tenantSchema.cartItems.productId,
      variantId: tenantSchema.cartItems.variantId,
      quantity: tenantSchema.cartItems.quantity,
    })
    .from(tenantSchema.cartItems)
    .innerJoin(tenantSchema.carts, eq(tenantSchema.cartItems.cartId, tenantSchema.carts.id))
    .where(and(ownerCondition(owner), eq(tenantSchema.cartItems.id, input.itemId)))
    .limit(1);

  if (!line) {
    throw new StorefrontError(404, 'cart-item-not-found', 'Cart item not found.');
  }

  const resolved = await resolveCartLine(context, {
    productId: line.productId,
    variantId: line.variantId,
    quantity: input.quantity,
  });
  if (input.quantity > resolved.availableQuantity) {
    throw new StorefrontError(409, 'insufficient-stock', 'The requested quantity is not currently available.');
  }
  const currentLines = await readOwnedLines(context.db, owner);
  const currentTotal = currentLines.reduce((sum, currentLine) => sum + currentLine.quantity, 0);
  if (currentTotal - line.quantity + input.quantity > MAX_CART_TOTAL_QUANTITY) {
    throw new StorefrontError(409, 'cart-total-limit', `A cart cannot contain more than ${MAX_CART_TOTAL_QUANTITY} total units.`);
  }

  const owned = ownedCartIds(context.db, owner);
  const updated = await context.db
    .update(tenantSchema.cartItems)
    .set({ quantity: input.quantity, updatedAt: new Date() })
    .where(and(
      eq(tenantSchema.cartItems.id, input.itemId),
      inArray(tenantSchema.cartItems.cartId, owned),
    ))
    .returning({ id: tenantSchema.cartItems.id });
  if (updated.length !== 1) {
    throw new StorefrontError(409, 'cart-update-conflict', 'The cart changed; please retry.');
  }

  return {
    cart: await readCartSnapshot(context, owner),
    cookieAction: prepared.cookieAction,
    merged: prepared.merged,
  };
}

export async function removeCartItem(
  context: StorefrontContext,
  guestCartId: string | null,
  input: CartRemoveInput,
): Promise<CartMutationResult> {
  const prepared = context.customer && guestCartId
    ? await ensureCartForMutation(context, guestCartId, true)
    : {
      cart: null,
      owner: ownerForRequest(context, guestCartId),
      cookieAction: undefined as CartCookieAction | undefined,
      merged: false,
    };
  const owner = prepared.owner;

  const owned = ownedCartIds(context.db, owner);
  const deleted = await context.db
    .delete(tenantSchema.cartItems)
    .where(and(
      eq(tenantSchema.cartItems.id, input.itemId),
      inArray(tenantSchema.cartItems.cartId, owned),
    ))
    .returning({ id: tenantSchema.cartItems.id });
  if (deleted.length !== 1) {
    throw new StorefrontError(404, 'cart-item-not-found', 'Cart item not found.');
  }

  return {
    cart: await readCartSnapshot(context, owner),
    cookieAction: prepared.cookieAction,
    merged: prepared.merged,
  };
}

export async function clearCart(
  context: StorefrontContext,
  guestCartId: string | null,
): Promise<CartMutationResult> {
  if (context.customer) {
    const userOwner: CartOwner = { kind: 'user', userId: context.customer.id };
    await context.db
      .delete(tenantSchema.cartItems)
      .where(inArray(tenantSchema.cartItems.cartId, ownedCartIds(context.db, userOwner)));

    if (guestCartId) {
      const guestOwner: CartOwner = { kind: 'guest', cartId: guestCartId };
      await context.db
        .delete(tenantSchema.cartItems)
        .where(inArray(tenantSchema.cartItems.cartId, ownedCartIds(context.db, guestOwner)));
      await context.db
        .delete(tenantSchema.carts)
        .where(and(eq(tenantSchema.carts.id, guestCartId), isNull(tenantSchema.carts.userId)));
    }

    return {
      cart: await readCartSnapshot(context, userOwner),
      cookieAction: guestCartId ? { type: 'clear' } : undefined,
    };
  }

  if (!guestCartId) {
    return { cart: emptySnapshot({ kind: 'guest', cartId: '00000000-0000-4000-8000-000000000000' }) };
  }

  const guestOwner: CartOwner = { kind: 'guest', cartId: guestCartId };
  await context.db
    .delete(tenantSchema.cartItems)
    .where(inArray(tenantSchema.cartItems.cartId, ownedCartIds(context.db, guestOwner)));
  await context.db
    .delete(tenantSchema.carts)
    .where(and(eq(tenantSchema.carts.id, guestCartId), isNull(tenantSchema.carts.userId)));

  return {
    cart: emptySnapshot(guestOwner),
    cookieAction: { type: 'clear' },
  };
}

export async function mergeGuestCart(
  context: StorefrontContext,
  guestCartId: string | null,
): Promise<CartMutationResult> {
  if (!context.customer) {
    throw new StorefrontError(401, 'authentication-required', 'Sign in as a Customer to merge the guest cart.');
  }
  if (!guestCartId) {
    return { cart: await readCartSnapshot(context, { kind: 'user', userId: context.customer.id }) };
  }

  const mergeResult = await mergeGuestCartIntoUser(
    context.db,
    context.customer.id,
    guestCartId,
  );
  const owner: CartOwner = { kind: 'user', userId: context.customer.id };
  return {
    cart: await readCartSnapshot(context, owner),
    cookieAction: { type: 'clear' },
    merged: mergeResult.merged,
  };
}

export async function importCart(
  context: StorefrontContext,
  guestCartId: string | null,
  input: CartImportInput,
): Promise<CartMutationResult> {
  // Resolve the client payload before creating a guest cart. Invalid legacy
  // data must not leave an orphaned empty cart behind.
  await resolveCartLines(context, input.items);
  if (input.items.length === 0 && !context.customer && !guestCartId) {
    return {
      cart: emptySnapshot({ kind: 'guest', cartId: '' }),
      imported: true,
    };
  }

  let prepared: {
    cart: { id: string } | null;
    owner: CartOwner;
    cookieAction?: CartCookieAction;
    merged: boolean;
  } | null = null;

  if (input.items.length > 0 || (context.customer && guestCartId)) {
    prepared = await ensureCartForMutation(context, guestCartId, true);
  }

  const owner = prepared?.owner || (context.customer
    ? { kind: 'user', userId: context.customer.id } as CartOwner
    : { kind: 'guest', cartId: guestCartId || '' } as CartOwner);
  const existing = await readOwnedLines(context.db, owner);
  const merged = mergeCartLines(existing, input.items);
  const resolved = merged.length > 0 ? await resolveCartLines(context, merged) : [];
  for (const line of resolved) {
    if (line.quantity > line.availableQuantity) {
      throw new StorefrontError(409, 'insufficient-stock', 'One or more cart items are no longer available in that quantity.');
    }
  }

  if (merged.length > 0) {
    await context.db.transaction(async (tx) => {
      const owned = await tx
        .select({ id: tenantSchema.carts.id })
        .from(tenantSchema.carts)
        .where(ownerCondition(owner));
      if (owned.length !== 1) {
        throw new StorefrontError(409, 'cart-update-conflict', 'The cart is no longer available.');
      }

      await tx.delete(tenantSchema.cartItems).where(
        inArray(tenantSchema.cartItems.cartId, owned.map((row) => row.id)),
      );
      await tx.insert(tenantSchema.cartItems).values(
        merged.map((line) => ({
          cartId: owned[0].id,
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
        })),
      );
    });
  }

  return {
    cart: await readCartSnapshot(context, owner),
    cookieAction: prepared?.cookieAction,
    merged: prepared?.merged,
    imported: true,
  };
}
