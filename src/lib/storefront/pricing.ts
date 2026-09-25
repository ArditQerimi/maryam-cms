import { eq, sql } from 'drizzle-orm';
import * as schema from '@/db/schema-tenant';
import type { StorefrontContext } from './context';
import { centsToMoney } from './checkout-money';

/**
 * Storefront pricing brain — the single place where discounts, coupons, tax
 * rates and order totals are decided so that the product listing, the product
 * detail page, the cart, the checkout summary and the server-side order
 * creation all agree, cent for cent.
 *
 * Rules implemented here:
 *  - Product/category discounts: `status = 'Active'`, `startDate` null or <= now,
 *    `endDate` null or >= now. Percentage = price * (1 - value/100), Fixed =
 *    max(0, price - value). When a product *and* its category both discount the
 *    same product, the BETTER (lower) price wins — each rule is evaluated
 *    against the original list price and the lowest result is used; rules are
 *    never stacked.
 *  - Coupons: matched case-insensitively, must be Active and inside its date
 *    window. `usageLimit` is informational only (there is no usage counter
 *    column anywhere in the schema), so a limited coupon is still accepted.
 *  - Tax: most-specific enabled `tax_rates` row wins — exact postcode >
 *    state > country > empty-country wildcard — ties broken by `priority` ASC
 *    then `id` ASC.
 *
 * All money arithmetic happens in integer cents using BigInt (half-up
 * rounding), never with raw float accumulation.
 */

export class StorefrontPricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorefrontPricingError';
  }
}

/** Structural handle: every loader only needs the drizzle `select` builder. */
export type PricingDb = Pick<StorefrontContext['db'], 'select'>;

export type DiscountType = 'Percentage' | 'Fixed';

export type DiscountRule = {
  type: DiscountType;
  /** decimal(12,2) exactly as stored in the database. */
  value: string;
};

export type PricedProduct = {
  /** List price before any discount. */
  originalPrice: number;
  /** Effective price the customer pays (rounded to 2 decimals). */
  salePrice: number;
  /** True when a discount lowered the price. */
  discounted: boolean;
};

export type ActiveDiscounts = {
  productRules: Map<number, DiscountRule[]>;
  categoryRules: Map<number, DiscountRule[]>;
};

export const EMPTY_DISCOUNTS: ActiveDiscounts = {
  productRules: new Map(),
  categoryRules: new Map(),
};

const MAX_MONEY_CENTS = BigInt('999999999999');

function scaleFactor(scale: number): bigint {
  return BigInt(Math.pow(10, scale));
}

/**
 * Parse a decimal string (e.g. a DECIMAL(12,2) or DECIMAL(8,4) column value)
 * into an integer scaled by `scale`, rounding half-up. Rejects anything that is
 * not a plain non-negative decimal number.
 */
export function decimalToScaled(value: string, scale: number): bigint {
  const raw = value.trim();
  const match = /^(\d{1,15})(?:\.(\d{1,12}))?$/.exec(raw);
  if (!match) {
    throw new StorefrontPricingError(`Invalid decimal value "${value}".`);
  }
  const fraction = match[2] ?? '';
  const kept = fraction.slice(0, scale).padEnd(scale, '0');
  let scaled = BigInt(match[1]) * scaleFactor(scale);
  if (scale > 0) scaled += BigInt(kept);
  if (fraction.length > scale && fraction.charCodeAt(scale) >= 0x35) scaled += BigInt(1);
  if (scaled > MAX_MONEY_CENTS) {
    throw new StorefrontPricingError(`Monetary value "${value}" is out of range.`);
  }
  return scaled;
}

/** Money (2 decimals) → integer cents. Accepts the decimal string or a number. */
export function toCents(value: string | number): bigint {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new StorefrontPricingError(`Invalid money value ${value}.`);
    }
    const cents = BigInt(Math.round(value * 100));
    if (cents > MAX_MONEY_CENTS) {
      throw new StorefrontPricingError(`Money value ${value} is out of range.`);
    }
    return cents;
  }
  return decimalToScaled(value, 2);
}

/** Integer cents → plain number of currency units (always 2 decimals). */
export function centsToNumber(cents: bigint | number): number {
  const asBigInt = typeof cents === 'bigint' ? cents : BigInt(cents);
  if (asBigInt < BigInt(0) || asBigInt > MAX_MONEY_CENTS) {
    throw new StorefrontPricingError('Money value is out of range.');
  }
  return Number(asBigInt) / 100;
}

/* ------------------------------------------------------------------ *
 * Product & category discounts
 * ------------------------------------------------------------------ */

type DiscountWindow = {
  status: string;
  startDate: Date | null;
  endDate: Date | null;
};

/** status = 'Active' AND startDate null-or-past AND endDate null-or-future. */
export function isDiscountActive(rule: DiscountWindow, now: Date = new Date()): boolean {
  if (rule.status !== 'Active') return false;
  if (rule.startDate && rule.startDate.getTime() > now.getTime()) return false;
  if (rule.endDate && rule.endDate.getTime() < now.getTime()) return false;
  return true;
}

function ruleDiscountCents(listCents: bigint, rule: DiscountRule): bigint {
  if (rule.type === 'Fixed') {
    const fixed = toCents(rule.value);
    return fixed > listCents ? listCents : fixed;
  }
  // Percentage: discount = price * value / 100, value carried with 2 decimals,
  // so basis = priceCents * valueCents / 10_000 (half-up).
  const valueCents = toCents(rule.value);
  if (valueCents <= BigInt(0)) return BigInt(0);
  if (valueCents >= BigInt(10000)) return listCents;
  return (listCents * valueCents + BigInt(5000)) / BigInt(10000);
}

/**
 * Apply discount rules to one list price. Every rule is evaluated against the
 * ORIGINAL list price (no stacking) and the lowest result wins, which is the
 * documented precedence between a product discount and a category discount.
 */
export function priceWithRules(
  listPrice: string | number,
  rules: readonly DiscountRule[],
): PricedProduct {
  const listCents = toCents(listPrice);
  let bestCents = listCents;
  for (const rule of rules) {
    const candidate = listCents - ruleDiscountCents(listCents, rule);
    if (candidate < bestCents) bestCents = candidate;
  }
  const originalPrice = centsToNumber(listCents);
  const salePrice = centsToNumber(bestCents);
  return {
    originalPrice,
    salePrice,
    discounted: bestCents < listCents,
  };
}

/** Price one product (product rules + category rules, better price wins). */
export function priceProduct(
  listPrice: string | number,
  productId: number,
  categoryId: number | null,
  discounts: ActiveDiscounts,
): PricedProduct {
  const rules: DiscountRule[] = [
    ...(discounts.productRules.get(productId) ?? []),
    ...(categoryId === null ? [] : discounts.categoryRules.get(categoryId) ?? []),
  ];
  return priceWithRules(listPrice, rules);
}

/** Load every currently-valid discount row (small tables; filtered in JS). */
export async function loadActiveDiscounts(
  db: PricingDb,
  now: Date = new Date(),
): Promise<ActiveDiscounts> {
  const [productRows, categoryRows] = await Promise.all([
    db
      .select({
        productId: schema.productDiscounts.productId,
        discountType: schema.productDiscounts.discountType,
        discountValue: schema.productDiscounts.discountValue,
        startDate: schema.productDiscounts.startDate,
        endDate: schema.productDiscounts.endDate,
        status: schema.productDiscounts.status,
      })
      .from(schema.productDiscounts),
    db
      .select({
        categoryId: schema.categoryDiscounts.categoryId,
        discountType: schema.categoryDiscounts.discountType,
        discountValue: schema.categoryDiscounts.discountValue,
        startDate: schema.categoryDiscounts.startDate,
        endDate: schema.categoryDiscounts.endDate,
        status: schema.categoryDiscounts.status,
      })
      .from(schema.categoryDiscounts),
  ]);

  const discounts: ActiveDiscounts = { productRules: new Map(), categoryRules: new Map() };
  for (const row of productRows) {
    if (!isDiscountActive(row, now)) continue;
    const rule: DiscountRule = { type: row.discountType, value: String(row.discountValue) };
    const existing = discounts.productRules.get(row.productId);
    if (existing) existing.push(rule);
    else discounts.productRules.set(row.productId, [rule]);
  }
  for (const row of categoryRows) {
    if (!isDiscountActive(row, now)) continue;
    const rule: DiscountRule = { type: row.discountType, value: String(row.discountValue) };
    const existing = discounts.categoryRules.get(row.categoryId);
    if (existing) existing.push(rule);
    else discounts.categoryRules.set(row.categoryId, [rule]);
  }
  return discounts;
}

export type PricingLineInput = {
  productId: number;
  categoryId: number | null;
  /** The line's own list price (product price or concrete variant price). */
  price: string | number;
};

/**
 * One query set + one discount load for a batch of lines. Returns the priced
 * result in the same order as `lines`.
 */
export async function priceLines(
  db: PricingDb,
  lines: readonly PricingLineInput[],
  now: Date = new Date(),
): Promise<PricedProduct[]> {
  if (lines.length === 0) return [];
  const discounts = await loadActiveDiscounts(db, now);
  return lines.map((line) => priceProduct(line.price, line.productId, line.categoryId, discounts));
}

/* ------------------------------------------------------------------ *
 * Coupons
 * ------------------------------------------------------------------ */

export type CouponRecord = {
  id: number;
  code: string;
  discountType: DiscountType;
  discountValue: string;
  startDate: Date | null;
  endDate: Date | null;
  usageLimit: number | null;
  status: string;
};

export type CouponEvaluation =
  | {
      ok: true;
      coupon: CouponRecord;
      /** Human-readable label, e.g. `TEST10 · 10% off`. */
      label: string;
      /** Discount in currency units (2 decimals). */
      discount: number;
      /** Same discount in integer cents — the value checkout display adds up. */
      discountCents: number;
    }
  | { ok: false; message: string };

/** Mirrors the checkout request contract's PROMOTION_PATTERN. */
export function isValidCouponCode(code: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(code.trim());
}

export function formatCouponPercent(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function couponLabel(coupon: Pick<CouponRecord, 'code' | 'discountType' | 'discountValue'>): string {
  if (coupon.discountType === 'Fixed') {
    return `${coupon.code} · ${centsToMoney(toCents(coupon.discountValue))} off`;
  }
  return `${coupon.code} · ${formatCouponPercent(coupon.discountValue)}% off`;
}

/** Look a coupon up by code, case-insensitively, within this tenant. */
export async function findCouponByCode(
  db: PricingDb,
  rawCode: string,
): Promise<CouponRecord | null> {
  const code = rawCode.trim();
  if (!isValidCouponCode(code)) return null;
  const rows = await db
    .select({
      id: schema.coupons.id,
      code: schema.coupons.code,
      discountType: schema.coupons.discountType,
      discountValue: schema.coupons.discountValue,
      startDate: schema.coupons.startDate,
      endDate: schema.coupons.endDate,
      usageLimit: schema.coupons.usageLimit,
      status: schema.coupons.status,
    })
    .from(schema.coupons)
    .where(sql`lower(${schema.coupons.code}) = lower(${code})`)
    .limit(1);
  return rows[0] ?? null;
}

/** Validate a coupon against the clock and derive its discount for a subtotal. */
export function evaluateCoupon(
  coupon: CouponRecord | null,
  subtotalCents: number,
  now: Date = new Date(),
): CouponEvaluation {
  if (!coupon) {
    return { ok: false, message: 'Invalid coupon code' };
  }
  if (coupon.status !== 'Active') {
    return { ok: false, message: 'This coupon is not active' };
  }
  if (coupon.startDate && coupon.startDate.getTime() > now.getTime()) {
    return { ok: false, message: 'This coupon is not active yet' };
  }
  if (coupon.endDate && coupon.endDate.getTime() < now.getTime()) {
    return { ok: false, message: 'This coupon expired' };
  }
  // NOTE: `usageLimit` has no matching usage-counter column anywhere in the
  // schema (sales/storefront_order_details store no coupon code), so actual
  // redemptions cannot be counted. The limit is therefore treated as
  // informational and does not block a valid code.

  if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0) {
    return { ok: false, message: 'Cart subtotal is invalid' };
  }
  const subtotal = BigInt(subtotalCents);
  let discountCents: bigint;
  if (coupon.discountType === 'Fixed') {
    discountCents = toCents(coupon.discountValue);
  } else {
    const valueCents = toCents(coupon.discountValue);
    discountCents = valueCents >= BigInt(10000)
      ? subtotal
      : (subtotal * valueCents + BigInt(5000)) / BigInt(10000);
  }
  if (discountCents > subtotal) discountCents = subtotal;

  return {
    ok: true,
    coupon,
    label: couponLabel(coupon),
    discount: centsToNumber(discountCents),
    discountCents: Number(discountCents),
  };
}

/* ------------------------------------------------------------------ *
 * Tax rates
 * ------------------------------------------------------------------ */

export type TaxDestination = {
  country: string;
  state: string;
  postcode: string;
};

export type TaxRateRow = {
  id: number;
  country: string;
  state: string;
  postcode: string;
  rate: string;
  name: string;
  shipping: boolean;
  priority: number;
  enabled: boolean;
};

function normalizePart(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

/**
 * Most-specific enabled row wins: exact postcode > state > country > the
 * empty-country wildcard. Equal specificity is broken by `priority` ASC, then
 * by `id` ASC for full determinism.
 */
export function matchTaxRate(
  rows: readonly TaxRateRow[],
  destination: TaxDestination,
): TaxRateRow | null {
  const country = normalizePart(destination.country);
  const state = normalizePart(destination.state);
  const postcode = normalizePart(destination.postcode);

  let best: TaxRateRow | null = null;
  let bestPostcode = 0;
  let bestState = 0;
  let bestCountry = 0;

  for (const row of rows) {
    if (!row.enabled) continue;
    const rowCountry = normalizePart(row.country);
    const rowState = normalizePart(row.state);
    const rowPostcode = normalizePart(row.postcode);

    if (rowCountry !== '' && (country === '' || rowCountry !== country)) continue;
    if (rowState !== '' && (state === '' || rowState !== state)) continue;
    if (rowPostcode !== '' && (postcode === '' || rowPostcode !== postcode)) continue;

    const specificityPostcode = rowPostcode === '' ? 0 : 1;
    const specificityState = rowState === '' ? 0 : 1;
    const specificityCountry = rowCountry === '' ? 0 : 1;

    if (best === null) {
      best = row;
      bestPostcode = specificityPostcode;
      bestState = specificityState;
      bestCountry = specificityCountry;
      continue;
    }
    const wins =
      specificityPostcode > bestPostcode
      || (specificityPostcode === bestPostcode && specificityState > bestState)
      || (specificityPostcode === bestPostcode
        && specificityState === bestState
        && specificityCountry > bestCountry);
    const sameSpecificity =
      specificityPostcode === bestPostcode
      && specificityState === bestState
      && specificityCountry === bestCountry;
    const beatsOnPriority = sameSpecificity
      && (row.priority < best.priority || (row.priority === best.priority && row.id < best.id));
    if (wins || beatsOnPriority) {
      best = row;
      bestPostcode = specificityPostcode;
      bestState = specificityState;
      bestCountry = specificityCountry;
    }
  }

  return best;
}

export async function loadEnabledTaxRates(db: PricingDb): Promise<TaxRateRow[]> {
  return db
    .select({
      id: schema.taxRates.id,
      country: schema.taxRates.country,
      state: schema.taxRates.state,
      postcode: schema.taxRates.postcode,
      rate: schema.taxRates.rate,
      name: schema.taxRates.name,
      shipping: schema.taxRates.shipping,
      priority: schema.taxRates.priority,
      enabled: schema.taxRates.enabled,
    })
    .from(schema.taxRates)
    .where(eq(schema.taxRates.enabled, true));
}

export async function resolveTaxRate(
  db: PricingDb,
  destination: TaxDestination,
): Promise<TaxRateRow | null> {
  const rows = await loadEnabledTaxRates(db);
  return matchTaxRate(rows, destination);
}

/** `20.0000` → `20`, `17.5000` → `17.5`. */
export function taxRatePercent(rate: string): string {
  return formatCouponPercent(rate);
}

/** `VAT (20%)` style label built from the row's own name. */
export function taxLabel(row: Pick<TaxRateRow, 'name' | 'rate'>): string {
  return `${row.name} (${taxRatePercent(row.rate)}%)`;
}

/**
 * Tax for one base amount: rate is a DECIMAL(8,4) percentage, so
 * tax = base * rate4 / 1_000_000 with half-up rounding, all in BigInt.
 */
export function taxAmountCents(baseCents: number | bigint, rate: string): number {
  const base = typeof baseCents === 'bigint' ? baseCents : BigInt(baseCents);
  if (base < BigInt(0)) throw new StorefrontPricingError('A tax base cannot be negative.');
  const rateScaled = decimalToScaled(rate, 4);
  const amount = (base * rateScaled + BigInt(500000)) / BigInt(1000000);
  if (amount > MAX_MONEY_CENTS) {
    throw new StorefrontPricingError('A tax amount is out of range.');
  }
  return Number(amount);
}

/* ------------------------------------------------------------------ *
 * Totals
 * ------------------------------------------------------------------ */

export type OrderTotalsInput = {
  /** Sum of the discounted line prices, in cents. */
  subtotalCents: number;
  /** Coupon discount, in cents (0 when no coupon). */
  couponCents: number;
  /** Shipping charged by the server, in cents. */
  shippingCents: number;
  /** Matched tax row, or null when no row matched the destination. */
  tax: Pick<TaxRateRow, 'rate' | 'shipping'> | null;
};

export type OrderTotals = {
  subtotalCents: number;
  couponCents: number;
  /** subtotal - coupon, i.e. the amount tax is computed from. */
  netCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  /** DECIMAL(12,2)-compatible strings for the sales columns. */
  subtotal: string;
  discount: string;
  tax: string;
  grandTotal: string;
};

/**
 * The canonical order total, mirrored by cart display, checkout display and
 * the server-side checkout service:
 *
 *   subtotal (after product/category discounts)
 *   - coupon discount
 *   + shipping
 *   + tax on (subtotal - coupon [+ shipping when the matched row has
 *     shipping = true])
 */
export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  const subtotalCents = BigInt(input.subtotalCents);
  const couponRaw = BigInt(input.couponCents);
  const couponCents = couponRaw > subtotalCents ? subtotalCents : couponRaw;
  const shippingCents = BigInt(input.shippingCents);
  const netCents = subtotalCents - couponCents;

  let taxCents = BigInt(0);
  if (input.tax) {
    const taxableCents = netCents + (input.tax.shipping ? shippingCents : BigInt(0));
    taxCents = BigInt(taxAmountCents(taxableCents, input.tax.rate));
  }

  const totalCents = netCents + shippingCents + taxCents;
  if (
    subtotalCents > MAX_MONEY_CENTS
    || shippingCents > MAX_MONEY_CENTS
    || totalCents > MAX_MONEY_CENTS
  ) {
    throw new StorefrontPricingError('Order totals are out of range.');
  }

  return {
    subtotalCents: Number(subtotalCents),
    couponCents: Number(couponCents),
    netCents: Number(netCents),
    shippingCents: Number(shippingCents),
    taxCents: Number(taxCents),
    totalCents: Number(totalCents),
    subtotal: centsToMoney(subtotalCents),
    discount: centsToMoney(couponCents),
    tax: centsToMoney(taxCents),
    grandTotal: centsToMoney(totalCents),
  };
}
