'use client';

import type { CartItem } from '@/context/CartContext';
import type { CartPricedLine } from '@/app/home/cart/pricing-types';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import styles from './checkout.module.css';

type OrderSummaryProps = {
  headingId: string;
  cart: readonly CartItem[];
  itemCount: number;
  /** Server-priced cart lines; falls back to the local cart price when null. */
  pricing: CartPricedLine[] | null;
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

/**
 * The "Your order" panel: a WooCommerce-style Product / Subtotal table only.
 * Totals, coupon and payment live outside this component in the checkout aside.
 */
export default function OrderSummary({
  headingId,
  cart,
  itemCount,
  pricing,
}: OrderSummaryProps) {
  const { t } = useLocale();
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
    <div className={styles.orderSummary}>
      <div className={styles.orderHeadingRow}>
        <h2 className={styles.orderHeading} id={headingId}>
          {t('checkout.order.heading')}
        </h2>
        <span className={styles.itemCount}>
          {itemCount === 1
            ? t('checkout.summary.itemCount.one', { count: itemCount })
            : t('checkout.summary.itemCount.other', { count: itemCount })}
        </span>
      </div>

      <div className={styles.orderTableHead}>
        <span>{t('checkout.order.product')}</span>
        <span>{t('checkout.order.subtotal')}</span>
      </div>

      <ul className={styles.summaryItems} aria-label={t('checkout.summary.itemsAria')}>
        {cart.map((item, index) => {
          const unitCents = linePriceCents(index, item);
          const compareAtCents = lineCompareAtCents(index);
          return (
            <li className={styles.summaryItem} key={lineKey(item)}>
              <div className={styles.summaryItemDetails}>
                <p className={styles.summaryItemName}>{item.name}</p>
                <p className={styles.summaryQuantityLine}>
                  {item.quantity} <span aria-hidden="true">&times;</span> {formatCents(unitCents)}
                </p>
              </div>
              <p className={styles.summaryLinePrice}>
                {formatCents(unitCents * item.quantity)}
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
    </div>
  );
}
