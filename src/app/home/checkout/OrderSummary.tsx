'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { CartItem } from '@/context/CartContext';
import type { CartPricedLine, TaxQuote } from '@/app/shop/cart/pricing-types';
import styles from './checkout.module.css';

type OrderSummaryPromotion = {
  label: string;
  discountCents: number;
};

type OrderSummaryProps = {
  headingId: string;
  cart: readonly CartItem[];
  itemCount: number;
  /** Integer cents of the subtotal AFTER product/category discounts. */
  subtotalCents: number;
  /** Server-priced cart lines; falls back to the local cart price when null. */
  pricing: CartPricedLine[] | null;
  /** Validated promotion code, or `null` when none is applied. */
  promotion: OrderSummaryPromotion | null;
  /** Matched `tax_rates` row; `null` means no tax line is shown at all. */
  taxQuote: TaxQuote | null;
  deliveryLabel: string;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number.isFinite(value) ? value : 0);
}

function formatCents(cents: number): string {
  return formatMoney(cents / 100);
}

function lineKey(item: CartItem): string {
  return `${typeof item.productId}:${String(item.productId)}|${typeof item.variantId}:${String(item.variantId)}`;
}

function canRenderImage(value: string): boolean {
  return value.startsWith('/') || value.startsWith('data:image/') || /^https?:\/\//i.test(value);
}

export default function OrderSummary({
  headingId,
  cart,
  itemCount,
  subtotalCents,
  pricing,
  promotion,
  taxQuote,
  deliveryLabel,
}: OrderSummaryProps) {
  const pricedLines = pricing && pricing.length === cart.length ? pricing : null;

  const linePriceCents = (index: number, item: CartItem): number => {
    if (pricedLines) return Math.round(pricedLines[index].salePrice * 100);
    return Math.round((Number.isFinite(item.price) ? item.price : 0) * 100);
  };

  const lineCompareAtCents = (index: number): number | null => {
    const line = pricedLines?.[index];
    return line && line.discounted ? Math.round(line.originalPrice * 100) : null;
  };

  return (
    <div className={styles.summaryCard}>
      <div className={styles.summaryHeadingRow}>
        <div>
          <p className={styles.summaryEyebrow}>Current cart</p>
          <h2 className={styles.summaryHeading} id={headingId}>Order summary</h2>
        </div>
        <span className={styles.itemCount}>
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </span>
      </div>

      <ul className={styles.summaryItems} aria-label="Items in your current cart">
        {cart.map((item, index) => {
          const compareAtCents = lineCompareAtCents(index);
          return (
            <li className={styles.summaryItem} key={lineKey(item)}>
              <div className={styles.summaryImageWrap} aria-hidden="true">
                {canRenderImage(item.imageUrl) ? (
                  <Image
                    alt=""
                    className={styles.summaryImage}
                    height={84}
                    src={item.imageUrl}
                    unoptimized
                    width={64}
                  />
                ) : (
                  <span className={styles.summaryImageFallback} />
                )}
                <span className={styles.summaryQuantity}>{item.quantity}</span>
              </div>
              <div className={styles.summaryItemDetails}>
                <p className={styles.summaryItemName}>{item.name}</p>
                {item.variantId !== null ? (
                  <p className={styles.summaryVariant}>Variant {String(item.variantId)}</p>
                ) : (
                  <p className={styles.summaryVariant}>Default variant</p>
                )}
              </div>
              <p className={styles.summaryLinePrice}>
                {formatCents(linePriceCents(index, item) * item.quantity)}
                {compareAtCents !== null ? (
                  <s className={styles.summaryLineOriginal}>
                    {formatCents(compareAtCents * item.quantity)}
                  </s>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>

      <dl className={styles.summaryTotals}>
        <div className={styles.summaryTotalRow}>
          <dt>Cart subtotal</dt>
          <dd>{formatCents(subtotalCents)}</dd>
        </div>
        <div className={styles.summaryTotalRow}>
          <dt>Promotion</dt>
          <dd>
            {promotion
              ? `${promotion.label} · −${formatCents(promotion.discountCents)}`
              : 'Not applied'}
          </dd>
        </div>
        <div className={styles.summaryTotalRow}>
          <dt>Delivery</dt>
          <dd>{deliveryLabel}</dd>
        </div>
        {taxQuote ? (
          <div className={styles.summaryTotalRow}>
            <dt>{taxQuote.label}</dt>
            <dd>{formatCents(taxQuote.amountCents)}</dd>
          </div>
        ) : null}
      </dl>

      <div className={styles.estimateNotice}>
        <span className={styles.estimateDot} aria-hidden="true" />
        <p>
          These browser totals are display-only. The server must verify stock,
          variants, promotions, delivery, tax, and the final amount.
        </p>
      </div>

      <Link className={styles.editCartLink} href="/shop/cart">
        Edit cart
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
