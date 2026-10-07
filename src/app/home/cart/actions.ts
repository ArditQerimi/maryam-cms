'use server';

import { inArray } from 'drizzle-orm';
import * as schema from '@/db/schema-tenant';
import { getContextDb } from '@/lib/tenant';
import {
  computeOrderTotals,
  evaluateCouponWithUsage,
  findCouponByCode,
  loadActiveDiscounts,
  priceProduct,
  resolveTaxRate,
  taxLabel,
  taxRatePercent,
} from '@/lib/storefront/pricing';
import type {
  CartPricedLine,
  CartPricingLine,
  CouponValidationResult,
  TaxQuote,
} from './pricing-types';

/**
 * Server actions backing the storefront cart and checkout display.
 *
 * Everything here is a READ path: the browser receives numbers it can only
 * render. The authoritative amounts are re-derived inside the checkout
 * transaction in `src/lib/storefront/checkout-service.ts`, which applies the
 * exact same rules from `src/lib/storefront/pricing.ts`.
 *
 * Tenant/company scoping comes from `getContextDb()` — the same helper the
 * product listing and product detail pages already use — so a coupon or tax
 * rate from another company's database can never be read.
 */

const MAX_LINES = 200;
const MAX_MONEY_CENTS = 999999999999;

function sanitizeProductId(value: unknown): number | null {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value > 0
    ? value
    : null;
}

function sanitizeMoney(value: unknown): number | null {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && Math.round(value * 100) <= MAX_MONEY_CENTS
    ? value
    : null;
}

function sanitizeCents(value: unknown): number | null {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= MAX_MONEY_CENTS
    ? value
    : null;
}

function sanitizeText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

/** DECIMAL(12,2) column value → number, or `null` when it is not usable. */
function parseListPrice(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Price a batch of cart lines: product discount + category discount, better
 * (lower) price wins, evaluated against the line's original list price.
 *
 * The discount base is the DATABASE list price (variant price when the line is
 * variant-specific, otherwise the product price) so a discounted number coming
 * from the browser can never be discounted twice. The submitted `price` is only
 * a fallback when the row cannot be read.
 *
 * Results are returned in the same order as `lines`; an empty array means
 * "not priced" and the caller should keep its own subtotal.
 */
export async function getCartPricing(
  lines: CartPricingLine[],
): Promise<CartPricedLine[]> {
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > MAX_LINES) {
    return [];
  }

  const sanitized: Array<{ productId: number; variantId: number | null; price: number }> = [];
  for (const line of lines) {
    if (!line || typeof line !== 'object') return [];
    const productId = sanitizeProductId(line.productId);
    const price = sanitizeMoney(line.price);
    const variantId = line.variantId === null || line.variantId === undefined
      ? null
      : sanitizeProductId(line.variantId);
    if (productId === null || price === null) return [];
    sanitized.push({ productId, variantId, price });
  }

  const db = await getContextDb();
  const productIds = [...new Set(sanitized.map((line) => line.productId))];
  const variantIds = [
    ...new Set(
      sanitized.flatMap((line) => (line.variantId === null ? [] : [line.variantId])),
    ),
  ];

  const [productRows, variantRows, discounts] = await Promise.all([
    db
      .select({
        id: schema.products.id,
        categoryId: schema.products.categoryId,
        price: schema.products.price,
      })
      .from(schema.products)
      .where(inArray(schema.products.id, productIds)),
    variantIds.length > 0
      ? db
          .select({
            id: schema.productVariants.id,
            productId: schema.productVariants.productId,
            status: schema.productVariants.status,
            price: schema.productVariants.price,
          })
          .from(schema.productVariants)
          .where(inArray(schema.productVariants.id, variantIds))
      : Promise.resolve([]),
    loadActiveDiscounts(db),
  ]);

  const productById = new Map(productRows.map((row) => [row.id, row]));
  const variantById = new Map(
    variantRows.filter((row) => row.status === 'Active').map((row) => [row.id, row]),
  );

  return sanitized.map((line) => {
    const product = productById.get(line.productId);
    const variant = line.variantId === null ? undefined : variantById.get(line.variantId);
    const variantListPrice = variant && variant.productId === line.productId
      ? parseListPrice(variant.price)
      : null;
    const productListPrice = product ? parseListPrice(product.price) : null;
    const listPrice = variantListPrice ?? productListPrice ?? line.price;

    return priceProduct(
      listPrice,
      line.productId,
      product ? product.categoryId : null,
      discounts,
    );
  });
}

/**
 * Validate a coupon against `coupons` for this tenant and derive its discount
 * from the current cart subtotal. Server-side only — the client never decides
 * whether a code is valid.
 *
 * `usageLimit` is informational: the schema has no usage-counter column and no
 * column anywhere stores the coupon CODE on an order, so redemptions cannot be
 * counted and the limit does not block an otherwise valid code.
 */
export async function validateCartCoupon(
  code: unknown,
  subtotalCents: unknown,
): Promise<CouponValidationResult> {
  const normalizedCode = sanitizeText(code, 64);
  const subtotal = sanitizeCents(subtotalCents);
  if (!normalizedCode) return { ok: false, message: 'Enter a coupon code.' };
  if (subtotal === null) return { ok: false, message: 'Cart subtotal is invalid' };

  try {
    const db = await getContextDb();
    const coupon = await findCouponByCode(db, normalizedCode);
    const evaluation = await evaluateCouponWithUsage(db, coupon, subtotal);
    if (!evaluation.ok) return { ok: false, message: evaluation.message };
    return {
      ok: true,
      discount: evaluation.discount,
      discountCents: evaluation.discountCents,
      label: evaluation.label,
    };
  } catch {
    return { ok: false, message: 'Coupons are temporarily unavailable. Try again.' };
  }
}

/**
 * Quote the tax line for the address the shopper is filling in, using the same
 * `tax_rates` matching and the same `computeOrderTotals` arithmetic the server
 * uses when it creates the order. Returns `null` when no enabled row matches —
 * then no tax line is shown at all.
 */
export async function getCheckoutTaxQuote(input: {
  country?: unknown;
  state?: unknown;
  postcode?: unknown;
  subtotalCents?: unknown;
  couponCents?: unknown;
  shippingCents?: unknown;
}): Promise<TaxQuote | null> {
  const destination = {
    country: sanitizeText(input?.country, 32),
    state: sanitizeText(input?.state, 64),
    postcode: sanitizeText(input?.postcode, 32),
  };
  const subtotalCents = sanitizeCents(input?.subtotalCents) ?? 0;
  const couponCents = sanitizeCents(input?.couponCents) ?? 0;
  const shippingCents = sanitizeCents(input?.shippingCents) ?? 0;

  try {
    const db = await getContextDb();
    const rate = await resolveTaxRate(db, destination);
    if (!rate) return null;

    const totals = computeOrderTotals({
      subtotalCents,
      couponCents,
      shippingCents,
      tax: rate,
    });

    return {
      name: rate.name,
      label: taxLabel(rate),
      ratePercent: taxRatePercent(rate.rate),
      appliesToShipping: rate.shipping,
      amountCents: totals.taxCents,
    };
  } catch {
    return null;
  }
}
