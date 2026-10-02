/**
 * Shapes returned by the cart/checkout server actions
 * (`src/app/home/cart/actions.ts`).
 *
 * This module is intentionally free of runtime imports: it is imported by
 * client components, and only `import type` may ever pull in server-only code.
 */
import type { PricedProduct } from '@/lib/storefront/pricing';

/** One cart line as the browser knows it (identity + list price). */
export type CartPricingLine = {
  productId: number;
  /** Optional variant; the server prefers the variant's own list price. */
  variantId?: number | null;
  /** List price the cart is already displaying, before any discount. */
  price: number;
};

/** `PricedProduct` for one cart line; results come back in the same order. */
export type CartPricedLine = PricedProduct;

export type CouponValidationResult =
  | {
      ok: true;
      /** Discount in currency units (2 decimals). */
      discount: number;
      /** Same discount in integer cents. */
      discountCents: number;
      /** Server-built label, e.g. `TEST10 · 10% off`. */
      label: string;
    }
  | { ok: false; message: string };

export type TaxQuote = {
  /** The `tax_rates.name` column, e.g. `VAT`. */
  name: string;
  /** `VAT (20%)`-style display label. */
  label: string;
  /** Formatted percentage, e.g. `20`. */
  ratePercent: string;
  /** True when the matched row taxes shipping as well. */
  appliesToShipping: boolean;
  /** Tax in integer cents for the submitted totals. */
  amountCents: number;
};
