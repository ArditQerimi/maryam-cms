import { randomBytes } from 'node:crypto';
import { and, asc, eq, gt, gte, isNull, sql } from 'drizzle-orm';
import type {
  CheckoutConfirmation,
  CheckoutFieldErrors,
  CheckoutRequest,
} from '@/app/home/checkout/checkout-contract';
import * as schema from '@/db/schema-tenant';
import type { StorefrontContext } from './context';
import {
  ORDER_CONFIRMATION_PATH,
  ORDER_ACCESS_TTL_MS,
  createOrderAccessMaterial,
  orderAccessMaterialMatchesHash,
} from './checkout-access';
import {
  CheckoutOwnershipError,
  resolveCheckoutOwner,
  type CheckoutOwner,
} from './checkout-authorization';
import type { CheckoutRuntimeConfig } from './checkout-config';
import {
  CheckoutIdempotencyInputError,
  checkoutScope,
  classifyIdempotencyRecord,
  hashCheckoutRequest,
  hashIdempotencyKey,
  storedConfirmationMatches,
  type StoredIdempotencyRecord,
} from './checkout-idempotency';
import {
  CheckoutMoneyError,
  centsToMoney,
  moneyToCents,
  multiplyMoney,
  sumCheckoutSubtotal,
} from './checkout-money';
import {
  computeOrderTotals,
  evaluateCoupon,
  findCouponByCode,
  loadActiveDiscounts,
  priceProduct,
  resolveTaxRate,
  toCents,
  type OrderTotals,
} from './pricing';
import {
  CheckoutStockError,
  assertSharedParentStock,
  buildCatalogLockPlan,
  buildStockLockOrder,
  planStockAllocation,
  type CheckoutCartLineIdentity,
} from './checkout-stock';
import {
  MAX_CART_ITEMS,
  MAX_CART_TOTAL_QUANTITY,
} from './validation';

export class CheckoutServiceError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly fieldErrors?: CheckoutFieldErrors;

  constructor(input: {
    code: string;
    message: string;
    status: number;
    retryable: boolean;
    fieldErrors?: CheckoutFieldErrors;
  }) {
    super(input.message);
    this.name = 'CheckoutServiceError';
    this.code = input.code;
    this.status = input.status;
    this.retryable = input.retryable;
    this.fieldErrors = input.fieldErrors;
  }
}

export type CheckoutServiceResult = {
  confirmation: CheckoutConfirmation;
  replayed: boolean;
  guestAccessToken: string | null;
};

type TenantDatabase = StorefrontContext['db'];
type TenantTransaction = Parameters<Parameters<TenantDatabase['transaction']>[0]>[0];
type LockedCartLine = CheckoutCartLineIdentity & {
  id: number;
  unitPrice: string;
};

type LockedCatalogRow = {
  productId: number;
  variantId: number;
  price: string;
  categoryId: number | null;
  parentQuantity: number | null;
};

function cartOwnerCondition(owner: CheckoutOwner) {
  return owner.kind === 'customer'
    ? eq(schema.carts.userId, owner.userId)
    : and(eq(schema.carts.id, owner.cartId), isNull(schema.carts.userId));
}

function serviceError(
  code: string,
  message: string,
  status: number,
  retryable: boolean,
  fieldErrors?: CheckoutFieldErrors,
) {
  return new CheckoutServiceError({ code, message, status, retryable, fieldErrors });
}

export function assertCheckoutCapabilities(
  request: CheckoutRequest,
  config: CheckoutRuntimeConfig,
) {
  // Promotion codes are supported: the code itself is validated against the
  // `coupons` table inside the order transaction (see checkoutInTransaction),
  // so only the server decides whether it is real.
  if (!config.deliveryMethodIds.has(request.delivery.methodId)) {
    throw serviceError(
      'delivery-method-unavailable',
      'The selected delivery method is not currently available.',
      422,
      false,
      { 'delivery.methodId': 'Choose an available delivery method.' },
    );
  }
  if (!config.paymentMethodIds.has(request.payment.methodId)) {
    throw serviceError(
      'payment-method-unavailable',
      'The selected payment method is not currently available. No card details were collected.',
      422,
      false,
      { 'payment.methodId': 'Choose an available payment method.' },
    );
  }
}

function createOrderReference() {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `SF-${day}-${randomBytes(12).toString('base64url')}`;
}

function asStoredIdempotencyRecord(row: {
  scopeKind: string;
  scopeHash: string;
  idempotencyKeyHash: string;
  requestHash: string;
  status: string;
  saleId: number | null;
  responsePayload: unknown;
  completedAt: Date | null;
}): StoredIdempotencyRecord {
  return {
    scopeKind: row.scopeKind === 'guest' ? 'guest' : 'customer',
    scopeHash: row.scopeHash,
    idempotencyKeyHash: row.idempotencyKeyHash,
    requestHash: row.requestHash,
    status: row.status === 'completed' ? 'completed' : 'processing',
    saleId: row.saleId,
    responsePayload: row.responsePayload,
    completedAt: row.completedAt,
  };
}

async function loadAuthoritativeConfirmation(
  tx: TenantTransaction,
  owner: CheckoutOwner,
  saleId: number,
): Promise<CheckoutConfirmation | null> {
  const ownership = owner.kind === 'customer'
    ? and(
        eq(schema.sales.customerUserId, owner.userId),
        eq(schema.sales.isOnline, true),
      )
    : eq(schema.sales.isOnline, true);
  const [row] = await tx
    .select({
      id: schema.sales.id,
      reference: schema.sales.reference,
      contactEmail: schema.storefrontOrderDetails.contactEmail,
      currency: schema.storefrontOrderDetails.currency,
    })
    .from(schema.sales)
    .innerJoin(
      schema.storefrontOrderDetails,
      eq(schema.storefrontOrderDetails.saleId, schema.sales.id),
    )
    .where(and(eq(schema.sales.id, saleId), ownership))
    .limit(1);

  if (!row) return null;
  return {
    orderId: String(row.id),
    orderNumber: row.reference,
    contactEmail: row.contactEmail,
    currency: row.currency,
    confirmationPath: ORDER_CONFIRMATION_PATH,
  };
}

async function guestAccessTokenForReplay(
  tx: TenantTransaction,
  saleId: number,
  secret: string,
  tenantSubdomain: string,
  now: Date,
) {
  const [access] = await tx
    .select({
      accessId: schema.storefrontOrderAccess.accessId,
      tokenHash: schema.storefrontOrderAccess.tokenHash,
    })
    .from(schema.storefrontOrderAccess)
    .where(and(
      eq(schema.storefrontOrderAccess.saleId, saleId),
      isNull(schema.storefrontOrderAccess.revokedAt),
      gt(schema.storefrontOrderAccess.expiresAt, now),
    ))
    .limit(1);
  if (!access) return null;
  return orderAccessMaterialMatchesHash(
    secret,
    tenantSubdomain,
    access.accessId,
    access.tokenHash,
  )?.token ?? null;
}

async function lockOwnedCart(tx: TenantTransaction, owner: CheckoutOwner) {
  const ownedCarts = await tx
    .select({ id: schema.carts.id })
    .from(schema.carts)
    .where(cartOwnerCondition(owner))
    .orderBy(asc(schema.carts.id))
    .for('update');
  if (ownedCarts.length !== 1) {
    throw serviceError(
      'cart-not-found',
      'The server cart is no longer available. No order was created.',
      404,
      false,
    );
  }

  const cartId = ownedCarts[0].id;
  const items = await tx
    .select({
      id: schema.cartItems.id,
      productId: schema.cartItems.productId,
      variantId: schema.cartItems.variantId,
      quantity: schema.cartItems.quantity,
    })
    .from(schema.cartItems)
    .where(eq(schema.cartItems.cartId, cartId))
    .orderBy(asc(schema.cartItems.id))
    .for('update');

  if (items.length === 0) {
    throw serviceError(
      'cart-empty',
      'Your cart is empty. No order was created.',
      409,
      false,
    );
  }
  if (items.length > MAX_CART_ITEMS) {
    throw serviceError('cart-invalid', 'The server cart is invalid.', 409, false);
  }
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  if (!Number.isSafeInteger(totalQuantity) || totalQuantity > MAX_CART_TOTAL_QUANTITY) {
    throw serviceError('cart-invalid', 'The server cart is invalid.', 409, false);
  }

  return { cartId, items };
}

async function lockCatalogAndResolveLines(
  tx: TenantTransaction,
  items: Awaited<ReturnType<typeof lockOwnedCart>>['items'],
) {
  const catalogKeys = buildCatalogLockPlan(items);
  const lockedCatalog = new Map<string, LockedCatalogRow>();

  // Deterministic order: product id, then variant id. Each product is locked
  // before its concrete variant, and no stock row is touched in this phase.
  for (const key of catalogKeys) {
    const [product] = await tx
      .select({
        id: schema.products.id,
        status: schema.products.status,
        stockQuantity: schema.products.stockQuantity,
        categoryId: schema.products.categoryId,
      })
      .from(schema.products)
      .where(eq(schema.products.id, key.productId))
      .for('update');

    const [variant] = await tx
      .select({
        id: schema.productVariants.id,
        productId: schema.productVariants.productId,
        status: schema.productVariants.status,
        price: schema.productVariants.price,
      })
      .from(schema.productVariants)
      .where(and(
        eq(schema.productVariants.id, key.variantId),
        eq(schema.productVariants.productId, key.productId),
      ))
      .for('update');

    if (!product || product.status !== 'Active' || !variant || variant.status !== 'Active') {
      throw serviceError(
        'product-or-variant-unavailable',
        'One or more products are no longer available. No order was created.',
        409,
        true,
      );
    }

    lockedCatalog.set(`${key.productId}:${key.variantId}`, {
      productId: key.productId,
      variantId: key.variantId,
      price: String(variant.price),
      categoryId: product.categoryId,
      parentQuantity: product.stockQuantity,
    });
  }

  return lockedCatalog;
}

async function resolveAndLockStock(
  tx: TenantTransaction,
  items: Awaited<ReturnType<typeof lockOwnedCart>>['items'],
  catalog: Map<string, LockedCatalogRow>,
) {
  const stockLockOrder = buildStockLockOrder([...catalog.values()]);
  const lineByVariant = new Map(items.map((line) => [line.variantId, line]));
  const allocations = new Map<number, {
    line: CheckoutCartLineIdentity;
    catalog: LockedCatalogRow;
    source: 'variant-rows' | 'parent-fallback';
    currentRows: Map<number, number>;
    decrements: Array<{ stockRowId: number; quantity: number }>;
  }>();

  // Stock locks are a second deterministic phase: variant id, warehouse id,
  // stock-row id. A parent row was already locked with its product.
  for (const variantId of stockLockOrder) {
    const line = lineByVariant.get(variantId);
    const catalogRow = catalog.get(`${line!.productId}:${variantId}`);
    if (!line || !catalogRow) throw new CheckoutStockError('invalid-cart');

    const stockRows = await tx
      .select({
        id: schema.productStocks.id,
        warehouseId: schema.productStocks.warehouseId,
        quantity: schema.productStocks.quantity,
      })
      .from(schema.productStocks)
      .where(eq(schema.productStocks.variantId, variantId))
      .orderBy(asc(schema.productStocks.warehouseId), asc(schema.productStocks.id))
      .for('update');

    const allocation = planStockAllocation({
      variantId,
      requestedQuantity: line.quantity,
      stockRows,
      parentQuantity: catalogRow.parentQuantity,
    });
    allocations.set(variantId, {
      line,
      catalog: catalogRow,
      source: allocation.source,
      currentRows: new Map(stockRows.map((row) => [row.id, row.quantity])),
      decrements: allocation.decrements,
    });
  }

  // Several fallback variants can share one parent stock pool. Recheck that
  // shared pool after every variant/stock row has been locked.
  assertSharedParentStock([...allocations.values()]
    .filter((allocation) => allocation.source === 'parent-fallback')
    .map((allocation) => ({
      productId: allocation.catalog.productId,
      parentQuantity: allocation.catalog.parentQuantity,
      quantity: allocation.line.quantity,
    })));

  return allocations;
}

async function decrementLockedStock(
  tx: TenantTransaction,
  allocations: Awaited<ReturnType<typeof resolveAndLockStock>>,
) {
  const parentCurrent = new Map<number, number>();
  for (const variantId of [...allocations.keys()].sort((left, right) => left - right)) {
    const allocation = allocations.get(variantId)!;
    if (allocation.source === 'parent-fallback') {
      const productId = allocation.catalog.productId;
      const current = parentCurrent.get(productId) ?? allocation.catalog.parentQuantity ?? 0;
      if (current < allocation.line.quantity) throw new CheckoutStockError('insufficient-stock');
      const updated = await tx
        .update(schema.products)
        .set({ stockQuantity: sqlSubtract(current, allocation.line.quantity) })
        .where(and(
          eq(schema.products.id, productId),
          eq(schema.products.stockQuantity, current),
          gte(schema.products.stockQuantity, allocation.line.quantity),
        ))
        .returning({ id: schema.products.id });
      if (updated.length !== 1) throw new CheckoutStockError('insufficient-stock');
      parentCurrent.set(productId, current - allocation.line.quantity);
      continue;
    }

    for (const decrement of allocation.decrements) {
      const current = allocation.currentRows.get(decrement.stockRowId);
      if (current === undefined) throw new CheckoutStockError('invalid-stock');
      const updated = await tx
        .update(schema.productStocks)
        .set({ quantity: sqlSubtract(current, decrement.quantity) })
        .where(and(
          eq(schema.productStocks.id, decrement.stockRowId),
          eq(schema.productStocks.quantity, current),
          gte(schema.productStocks.quantity, decrement.quantity),
        ))
        .returning({ id: schema.productStocks.id });
      if (updated.length !== 1) throw new CheckoutStockError('insufficient-stock');
    }
  }
}

/**
 * Stock decrements arrive as untyped parameters (`$1 - $2`), which PostgreSQL
 * rejects with "operator is not unique: unknown - unknown" (42725) because it
 * cannot pick a `-` overload before the parameter types are known. The explicit
 * `integer` casts let the parser resolve `int4 - int4` immediately.
 */
function sqlSubtract(current: number, quantity: number) {
  return sql`${current}::integer - ${quantity}::integer`;
}

async function createSaleAndItems(input: {
  tx: TenantTransaction;
  owner: CheckoutOwner;
  request: CheckoutRequest;
  lines: LockedCartLine[];
  totals: OrderTotals;
  config: CheckoutRuntimeConfig;
}) {
  const [sale] = await input.tx
    .insert(schema.sales)
    .values({
      customerUserId: input.owner.kind === 'customer' ? input.owner.userId : null,
      customerId: null,
      userId: null,
      warehouseId: null,
      reference: createOrderReference(),
      // `totalAmount` is the discounted merchandise subtotal (before coupon,
      // shipping and tax); the coupon amount lives in `discount`.
      totalAmount: input.totals.subtotal,
      discount: input.totals.discount,
      tax: input.totals.tax,
      grandTotal: input.totals.grandTotal,
      status: 'Pending',
      paymentMethod: input.request.payment.methodId,
      isOnline: true,
    })
    .returning({ id: schema.sales.id, reference: schema.sales.reference });
  if (!sale) throw new Error('Sale insert did not return an id.');

  await input.tx.insert(schema.saleItems).values(input.lines.map((line) => ({
    saleId: sale.id,
    variantId: line.variantId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    subtotal: multiplyMoney(line.unitPrice, line.quantity),
  })));

  await input.tx.insert(schema.storefrontOrderDetails).values({
    saleId: sale.id,
    currency: input.config.currency,
    contactEmail: input.request.contact.email,
    contactPhone: input.request.contact.phone || null,
    marketingOptIn: input.request.contact.marketingOptIn,
    shippingAddress: input.request.shippingAddress,
    billingAddress: input.request.billing.address,
    billingSameAsShipping: input.request.billing.sameAsShipping,
    deliveryMethodId: input.request.delivery.methodId,
    paymentMethodId: input.request.payment.methodId,
    termsAcceptedAt: new Date(),
  });

  let guestAccessToken: string | null = null;
  if (input.owner.kind === 'guest') {
    const access = createOrderAccessMaterial(
      input.config.orderAccessSecret,
      input.config.tenantSubdomain,
    );
    await input.tx.insert(schema.storefrontOrderAccess).values({
      accessId: access.accessId,
      saleId: sale.id,
      tokenHash: access.tokenHash,
      expiresAt: new Date(Date.now() + ORDER_ACCESS_TTL_MS),
    });
    guestAccessToken = access.token;
  }

  return {
    confirmation: {
      orderId: String(sale.id),
      orderNumber: sale.reference,
      contactEmail: input.request.contact.email,
      currency: input.config.currency,
      confirmationPath: ORDER_CONFIRMATION_PATH,
    } satisfies CheckoutConfirmation,
    guestAccessToken,
  };
}

async function completeIdempotency(input: {
  tx: TenantTransaction;
  scopeHash: string;
  idempotencyKeyHash: string;
  confirmation: CheckoutConfirmation;
}) {
  const completed = await input.tx
    .update(schema.storefrontCheckoutIdempotency)
    .set({
      status: 'completed',
      saleId: Number(input.confirmation.orderId),
      responsePayload: input.confirmation,
      completedAt: new Date(),
    })
    .where(and(
      eq(schema.storefrontCheckoutIdempotency.scopeHash, input.scopeHash),
      eq(schema.storefrontCheckoutIdempotency.idempotencyKeyHash, input.idempotencyKeyHash),
      eq(schema.storefrontCheckoutIdempotency.status, 'processing'),
    ))
    .returning({ scopeHash: schema.storefrontCheckoutIdempotency.scopeHash });
  if (completed.length !== 1) {
    throw serviceError(
      'idempotency-conflict',
      'The checkout request could not be completed. No additional order was created.',
      409,
      true,
    );
  }
}

async function checkoutInTransaction(input: {
  context: StorefrontContext;
  owner: CheckoutOwner;
  request: CheckoutRequest;
  idempotencyKey: string;
  config: CheckoutRuntimeConfig;
}): Promise<CheckoutServiceResult> {
  const scope = checkoutScope(input.owner);
  const idempotencyKeyHash = hashIdempotencyKey(input.idempotencyKey);
  const requestHash = hashCheckoutRequest(input.request);

  return input.context.db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(schema.storefrontCheckoutIdempotency)
      .values({
        scopeKind: scope.kind,
        scopeHash: scope.hash,
        idempotencyKeyHash,
        requestHash,
        status: 'processing',
      })
      .onConflictDoNothing()
      .returning({ scopeHash: schema.storefrontCheckoutIdempotency.scopeHash });

    const [stored] = await tx
      .select({
        scopeKind: schema.storefrontCheckoutIdempotency.scopeKind,
        scopeHash: schema.storefrontCheckoutIdempotency.scopeHash,
        idempotencyKeyHash: schema.storefrontCheckoutIdempotency.idempotencyKeyHash,
        requestHash: schema.storefrontCheckoutIdempotency.requestHash,
        status: schema.storefrontCheckoutIdempotency.status,
        saleId: schema.storefrontCheckoutIdempotency.saleId,
        responsePayload: schema.storefrontCheckoutIdempotency.responsePayload,
        completedAt: schema.storefrontCheckoutIdempotency.completedAt,
      })
      .from(schema.storefrontCheckoutIdempotency)
      .where(and(
        eq(schema.storefrontCheckoutIdempotency.scopeHash, scope.hash),
        eq(schema.storefrontCheckoutIdempotency.idempotencyKeyHash, idempotencyKeyHash),
      ))
      .limit(1);

    if (!inserted && !stored) {
      throw serviceError(
        'idempotency-conflict',
        'The checkout identity could not be reserved. No order was created.',
        409,
        true,
      );
    }

    const decision = inserted
      ? { kind: 'new' as const }
      : classifyIdempotencyRecord(
          stored ? asStoredIdempotencyRecord(stored) : null,
          {
            scopeKind: scope.kind,
            scopeHash: scope.hash,
            idempotencyKeyHash,
            requestHash,
          },
        );
    if (decision.kind === 'conflict') {
      throw serviceError(
        'idempotency-conflict',
        'This Idempotency-Key was already used for a different checkout request.',
        409,
        false,
      );
    }
    if (decision.kind === 'in-progress') {
      throw serviceError(
        'checkout-in-progress',
        'This checkout is still being processed. Retry with the same Idempotency-Key.',
        409,
        true,
      );
    }
    if (decision.kind === 'invalid-result') {
      throw serviceError(
        'idempotency-result-invalid',
        'The previous checkout result is unavailable. No additional order was created.',
        409,
        false,
      );
    }
    if (decision.kind === 'replay') {
      const confirmation = await loadAuthoritativeConfirmation(tx, input.owner, decision.saleId);
      const guestAccessToken = input.owner.kind === 'guest'
        ? await guestAccessTokenForReplay(
            tx,
            decision.saleId,
            input.config.orderAccessSecret,
            input.config.tenantSubdomain,
            new Date(),
          )
        : null;
      if (
        !confirmation
        || !storedConfirmationMatches(decision.responsePayload, confirmation)
        || (input.owner.kind === 'guest' && !guestAccessToken)
      ) {
        throw serviceError(
          'idempotency-result-invalid',
          'The previous checkout result is unavailable. No additional order was created.',
          409,
          false,
        );
      }
      return {
        confirmation,
        replayed: true,
        guestAccessToken,
      };
    }

    assertCheckoutCapabilities(input.request, input.config);
    const { cartId, items } = await lockOwnedCart(tx, input.owner);
    const catalog = await lockCatalogAndResolveLines(tx, items);
    const allocations = await resolveAndLockStock(tx, items, catalog);

    // Same discount rules as every storefront surface: each rule is evaluated
    // against the ORIGINAL list price and the lowest result wins.
    const discounts = await loadActiveDiscounts(tx);
    const lines: LockedCartLine[] = items.map((item) => {
      const catalogRow = catalog.get(`${item.productId}:${item.variantId}`);
      if (!catalogRow) throw new CheckoutStockError('invalid-cart');
      const priced = priceProduct(
        catalogRow.price,
        item.productId,
        catalogRow.categoryId,
        discounts,
      );
      return { ...item, unitPrice: centsToMoney(toCents(priced.salePrice)) };
    });

    const subtotalCents = Number(moneyToCents(sumCheckoutSubtotal(lines)));

    // The promotion code is re-read from `coupons` INSIDE this transaction:
    // the browser only ever sends a code, never an amount.
    let couponCents = 0;
    if (input.request.promotionCode !== null) {
      const coupon = await findCouponByCode(tx, input.request.promotionCode);
      const evaluation = evaluateCoupon(coupon, subtotalCents);
      if (!evaluation.ok) {
        throw serviceError(
          'promotion-code-invalid',
          evaluation.message,
          422,
          false,
        );
      }
      couponCents = evaluation.discountCents;
    }

    // Tax comes from `tax_rates` for the shipped-to address, never from the
    // request: exact postcode > state > country > empty-country wildcard, ties
    // by priority ASC then id ASC. No enabled match means no tax at all.
    const taxRate = await resolveTaxRate(tx, {
      country: input.request.shippingAddress.country,
      state: input.request.shippingAddress.region,
      postcode: input.request.shippingAddress.postalCode,
    });

    const totals = computeOrderTotals({
      subtotalCents,
      couponCents,
      shippingCents: input.config.shippingCents,
      tax: taxRate,
    });

    // Stock, order rows, and cart consumption share one transaction. A sale is
    // never inserted until every catalog, capability, quantity, stock, and
    // money validation above has passed.
    await decrementLockedStock(tx, allocations);
    const created = await createSaleAndItems({
      tx,
      owner: input.owner,
      request: input.request,
      lines,
      totals,
      config: input.config,
    });

    // Locking the cart row blocks new FK item inserts; locked item rows block
    // updates/deletes. Only this confirmed order's owned cart is consumed.
    await tx.delete(schema.cartItems).where(eq(schema.cartItems.cartId, cartId));
    await completeIdempotency({
      tx,
      scopeHash: scope.hash,
      idempotencyKeyHash,
      confirmation: created.confirmation,
    });

    return { confirmation: created.confirmation, replayed: false, guestAccessToken: created.guestAccessToken };
  });
}

function isRetryableTransactionError(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return code === '40P01' || code === '40001';
}

export async function placeStorefrontCheckout(input: {
  context: StorefrontContext;
  guestCartId: string | null;
  request: CheckoutRequest;
  idempotencyKey: string;
  config: CheckoutRuntimeConfig;
}) {
  const owner = resolveCheckoutOwner(input.context.customer?.id ?? null, input.guestCartId);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await checkoutInTransaction({ ...input, owner });
    } catch (error) {
      if (attempt === 0 && isRetryableTransactionError(error)) continue;
      if (error instanceof CheckoutServiceError) throw error;
      if (error instanceof CheckoutOwnershipError) {
        throw serviceError(
          'cart-not-found',
          'A server cart is required before checkout. No order was created.',
          404,
          false,
        );
      }
      if (error instanceof CheckoutIdempotencyInputError) {
        throw serviceError('invalid-idempotency-key', error.message, 400, false);
      }
      if (error instanceof CheckoutStockError) {
        throw serviceError(
          error.code,
          error.code === 'insufficient-stock'
            ? 'One or more items no longer have sufficient stock. No order was created.'
            : 'Catalog inventory is invalid. No order was created.',
          error.code === 'insufficient-stock' ? 409 : 503,
          error.code === 'insufficient-stock',
        );
      }
      if (error instanceof CheckoutMoneyError) {
        throw serviceError(
          'pricing-unavailable',
          'Catalog pricing is invalid. No order was created.',
          503,
          false,
        );
      }
      throw error;
    }
  }

  throw serviceError(
    'checkout-temporarily-unavailable',
    'The checkout could not be completed. Retry with the same Idempotency-Key.',
    503,
    true,
  );
}
