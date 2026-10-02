import { createHmac } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import type {
  CheckoutCapabilities,
  CheckoutCurrency,
  CheckoutDeliveryCapability,
  CheckoutPaymentCapability,
  CheckoutQuote,
} from '@/app/home/checkout/checkout-contract';
import * as schema from '@/db/schema-tenant';
import type { StorefrontContext } from './context';
import { isSameOrigin } from './host';
import type { CheckoutRuntimeConfig } from './checkout-config';
import {
  MAX_CART_ITEMS,
  MAX_CART_TOTAL_QUANTITY,
  isValidCartId,
} from './validation';
import type { CheckoutOwner } from './checkout-authorization';
import {
  CheckoutMoneyError,
  calculateCheckoutTotals,
  moneyToCents,
  centsToMoney,
  sumCheckoutSubtotal,
} from './checkout-money';
import {
  CheckoutStockError,
  buildCatalogLockPlan,
} from './checkout-stock';
import { CheckoutServiceError } from './checkout-service';
import { loadActiveDiscounts, priceProduct, toCents } from './pricing';

const DELIVERY_ORDER = ['standard', 'express'] as const;
const PAYMENT_ORDER = ['cash_on_delivery'] as const;
const DELIVERY_LABELS: Record<(typeof DELIVERY_ORDER)[number], string> = {
  standard: 'Standard delivery',
  express: 'Express delivery',
};
const PAYMENT_LABELS: Record<(typeof PAYMENT_ORDER)[number], string> = {
  cash_on_delivery: 'Cash on delivery',
};

export type CheckoutQuoteLine = {
  productId: number;
  variantId: number;
  quantity: number;
  unitPrice: string;
};

function capabilityError(
  code: string,
  message: string,
  status: number,
  retryable: boolean,
) {
  return new CheckoutServiceError({ code, message, status, retryable });
}

export function resolveQuoteOwner(
  customerUserId: number | null,
  guestCartId: string | null,
): CheckoutOwner | null {
  if (customerUserId !== null) {
    return Number.isSafeInteger(customerUserId) && customerUserId > 0
      ? { kind: 'customer', userId: customerUserId }
      : null;
  }
  return isValidCartId(guestCartId) ? { kind: 'guest', cartId: guestCartId } : null;
}

function cartOwnerCondition(owner: CheckoutOwner) {
  return owner.kind === 'customer'
    ? eq(schema.carts.userId, owner.userId)
    : and(eq(schema.carts.id, owner.cartId), isNull(schema.carts.userId));
}

function fingerprintQuote(input: {
  currency: CheckoutCurrency;
  lines: readonly CheckoutQuoteLine[];
  totals: Omit<CheckoutQuote, 'currency' | 'lineCount' | 'totalQuantity' | 'fingerprint' | 'empty'>;
  deliveryMethodIds: readonly string[];
  paymentMethodIds: readonly string[];
  tenantSubdomain: string;
  secret: string;
}) {
  return createHmac('sha256', input.secret)
    .update(JSON.stringify({
      version: 'storefront-checkout-quote:v1',
      tenant: input.tenantSubdomain,
      currency: input.currency,
      deliveryMethodIds: input.deliveryMethodIds,
      paymentMethodIds: input.paymentMethodIds,
      lines: input.lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
      totals: input.totals,
    }))
    .digest('hex');
}

/** Pure authoritative quote calculation; no browser totals or catalog input. */
export function buildAuthoritativeCheckoutQuote(input: {
  currency: CheckoutCurrency;
  lines: readonly CheckoutQuoteLine[];
  shippingCents: number;
  taxBasisPoints: number;
  deliveryMethodIds: readonly string[];
  paymentMethodIds: readonly string[];
  tenantSubdomain: string;
  fingerprintSecret: string;
}): CheckoutQuote {
  const keys = input.lines.length > 0
    ? buildCatalogLockPlan(input.lines)
    : [];
  const lineByKey = new Map(input.lines.map((line) => [
    `${line.productId}:${line.variantId}`,
    line,
  ]));
  const lines = keys.map((key) => {
    const line = lineByKey.get(`${key.productId}:${key.variantId}`)!;
    const unitPrice = centsToMoney(moneyToCents(line.unitPrice));
    return { ...line, unitPrice };
  });
  const lineCount = lines.length;
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  if (lineCount > MAX_CART_ITEMS || totalQuantity > MAX_CART_TOTAL_QUANTITY) {
    throw new CheckoutStockError('invalid-cart');
  }

  const totals = lineCount === 0
    ? { subtotal: '0.00', shipping: '0.00', tax: '0.00', grandTotal: '0.00' }
    : calculateCheckoutTotals({
        subtotal: sumCheckoutSubtotal(lines),
        shippingCents: input.shippingCents,
        taxBasisPoints: input.taxBasisPoints,
      });

  return {
    currency: input.currency,
    lineCount,
    totalQuantity,
    ...totals,
    fingerprint: fingerprintQuote({
      currency: input.currency,
      lines,
      totals,
      deliveryMethodIds: [...input.deliveryMethodIds].sort(),
      paymentMethodIds: [...input.paymentMethodIds].sort(),
      tenantSubdomain: input.tenantSubdomain,
      secret: input.fingerprintSecret,
    }),
    empty: lineCount === 0,
  };
}

function publicDeliveryMethods(
  config: CheckoutRuntimeConfig,
): CheckoutDeliveryCapability[] {
  return DELIVERY_ORDER
    .filter((id) => config.deliveryMethodIds.has(id))
    .map((id) => ({ id, label: DELIVERY_LABELS[id] }));
}

function publicPaymentMethods(
  config: CheckoutRuntimeConfig,
): CheckoutPaymentCapability[] {
  return PAYMENT_ORDER
    .filter((id) => config.paymentMethodIds.has(id))
    .map((id) => ({ id, label: PAYMENT_LABELS[id] }));
}

export function buildPublicCheckoutCapabilities(
  config: CheckoutRuntimeConfig,
  quote: CheckoutQuote,
): CheckoutCapabilities {
  return {
    deliveryMethods: publicDeliveryMethods(config),
    paymentMethods: publicPaymentMethods(config),
    promotions: { available: false, code: 'unavailable' },
    quote,
  };
}

function buildConfiguredQuote(
  config: CheckoutRuntimeConfig,
  lines: readonly CheckoutQuoteLine[],
) {
  return buildAuthoritativeCheckoutQuote({
    currency: config.currency,
    lines,
    shippingCents: config.shippingCents,
    taxBasisPoints: config.taxBasisPoints,
    deliveryMethodIds: [...config.deliveryMethodIds],
    paymentMethodIds: [...config.paymentMethodIds],
    tenantSubdomain: config.tenantSubdomain,
    fingerprintSecret: config.orderAccessSecret,
  });
}

async function readQuoteSnapshot(input: {
  context: StorefrontContext;
  owner: CheckoutOwner | null;
  config: CheckoutRuntimeConfig;
}) {
  return input.context.db.transaction(async (tx) => {
    // Probe required tenant-local checkout/catalog schema even when this owner
    // has no cart, so missing 003 fails closed instead of returning a fake quote.
    await tx.select({ id: schema.carts.id }).from(schema.carts).limit(1);
    await tx.select({ id: schema.productVariants.id }).from(schema.productVariants).limit(1);
    await tx
      .select({ currency: schema.storefrontOrderDetails.currency })
      .from(schema.storefrontOrderDetails)
      .limit(1);

    if (!input.owner) {
      return buildConfiguredQuote(input.config, []);
    }

    const carts = await tx
      .select({ id: schema.carts.id })
      .from(schema.carts)
      .where(cartOwnerCondition(input.owner))
      .limit(2);
    if (carts.length > 1) {
      throw capabilityError('quote-unavailable', 'The server cart is unavailable.', 409, true);
    }
    if (carts.length === 0) {
      return buildConfiguredQuote(input.config, []);
    }

    const cartItems = await tx
      .select({
        productId: schema.cartItems.productId,
        variantId: schema.cartItems.variantId,
        quantity: schema.cartItems.quantity,
      })
      .from(schema.cartItems)
      .where(eq(schema.cartItems.cartId, carts[0].id))
      .orderBy(schema.cartItems.id);
    if (cartItems.length > MAX_CART_ITEMS) {
      throw capabilityError('quote-unavailable', 'The server cart is unavailable.', 409, true);
    }

    const keys = cartItems.length > 0 ? buildCatalogLockPlan(cartItems) : [];
    const itemByKey = new Map(cartItems.map((item) => [
      `${item.productId}:${item.variantId}`,
      item,
    ]));
    const lines: CheckoutQuoteLine[] = [];
    // Product/category discounts apply to the quoted unit price exactly as they
    // do when the order is written, so the public quote cannot drift from POST.
    const discounts = await loadActiveDiscounts(tx);
    // This is a repeatable-read, read-only snapshot. It deliberately takes no
    // row locks and reserves no stock; POST checkout remains final authority.
    for (const key of keys) {
      const [product] = await tx
        .select({
          id: schema.products.id,
          status: schema.products.status,
          categoryId: schema.products.categoryId,
        })
        .from(schema.products)
        .where(eq(schema.products.id, key.productId))
        .limit(1);
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
        .limit(1);
      if (!product || product.status !== 'Active' || !variant || variant.status !== 'Active') {
        throw capabilityError(
          'quote-unavailable',
          'One or more cart items are no longer available.',
          409,
          true,
        );
      }
      const item = itemByKey.get(`${key.productId}:${key.variantId}`)!;
      const priced = priceProduct(
        String(variant.price),
        key.productId,
        product.categoryId,
        discounts,
      );
      lines.push({
        ...item,
        unitPrice: centsToMoney(toCents(priced.salePrice)),
      });
    }

    return buildConfiguredQuote(input.config, lines);
  }, {
    isolationLevel: 'repeatable read',
    accessMode: 'read only',
  });
}

export async function getStorefrontCheckoutCapabilities(input: {
  context: StorefrontContext;
  guestCartId: string | null;
  config: CheckoutRuntimeConfig;
}) {
  const owner = resolveQuoteOwner(
    input.context.customer?.id ?? null,
    input.guestCartId,
  );
  try {
    const quote = await readQuoteSnapshot({ ...input, owner });
    return buildPublicCheckoutCapabilities(input.config, quote);
  } catch (error) {
    if (error instanceof CheckoutServiceError) throw error;
    if (error instanceof CheckoutStockError) {
      throw capabilityError('quote-unavailable', 'The server cart is unavailable.', 409, true);
    }
    if (error instanceof CheckoutMoneyError) {
      throw capabilityError(
        'pricing-unavailable',
        'Catalog pricing is invalid.',
        503,
        false,
      );
    }
    throw error;
  }
}

export function assertNoCheckoutQuoteInput(request: {
  nextUrl: { search: string };
  body: unknown;
  headers: { get(name: string): string | null };
}) {
  const contentLength = request.headers.get('content-length');
  const invalidLength = contentLength !== null
    && (!/^\d+$/.test(contentLength) || Number(contentLength) > 0);
  if (request.nextUrl.search || request.body !== null || invalidLength) {
    throw capabilityError(
      'invalid-request',
      'Checkout capabilities do not accept quote input.',
      400,
      false,
    );
  }
}

/** Require an exact Origin or an explicit browser same-origin Fetch Metadata signal. */
export function assertCheckoutCapabilitiesSameOrigin(
  request: { headers: { get(name: string): string | null } },
  context: Pick<StorefrontContext, 'requestAuthority' | 'requestProtocol'>,
) {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site')?.split(',', 1)[0].trim().toLowerCase() || null;
  const exactOrigin = isSameOrigin(origin, context.requestAuthority, context.requestProtocol);
  if (
    (origin && !exactOrigin)
    || (fetchSite && fetchSite !== 'same-origin')
    || (!origin && fetchSite !== 'same-origin')
  ) {
    throw capabilityError(
      'same-origin-required',
      'Checkout capabilities require a same-origin request.',
      403,
      false,
    );
  }
}
