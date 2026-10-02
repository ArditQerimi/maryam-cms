'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import ShopPageHeader from '../components/ShopPageHeader';
import styles from './cart.module.css';
import { useCart, type CartItem, type CartItemSelector } from '@/context/CartContext';
import { useLocale, type Translator } from '@/lib/i18n/LocaleProvider';
import {
  clearStoredCoupon,
  readStoredCoupon,
  writeStoredCoupon,
} from '@/lib/cart-coupon';
import { getCartPricing, validateCartCoupon } from './actions';
import type { CartPricedLine } from './pricing-types';

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number.isFinite(value) ? value : 0);
}

/** Integer cents → formatted money */
function formatCents(cents: number): string {
  return formatMoney(cents / 100);
}

function toCents(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

function itemSelector(item: CartItem): CartItemSelector {
  return { productId: item.productId, variantId: item.variantId };
}

function itemKey(item: CartItem): string {
  return `${typeof item.productId}:${String(item.productId)}|${typeof item.variantId}:${String(item.variantId)}`;
}

function canRenderImage(value: string): boolean {
  return value.startsWith('/') || value.startsWith('data:image/') || /^https?:\/\//i.test(value);
}

type CouponMessage =
  | { text: string }
  | { key: Parameters<Translator>[0]; params?: Record<string, string | number> };

export default function ShopCartPage() {
  const {
    cart,
    removeFromCart,
    updateQty,
    maxQuantity,
    isHydrated,
    isHydrating,
    isPending,
    error,
    serverError,
    syncStatus,
    retryHydration,
    retrySync,
  } = useCart();
  const { t } = useLocale();

  // Local draft quantities map: itemKey -> string draft
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [coupon, setCoupon] = useState('');
  const [couponMessage, setCouponMessage] = useState<CouponMessage | null>(null);
  const [couponPending, setCouponPending] = useState(false);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [appliedLabel, setAppliedLabel] = useState<string | null>(null);
  const [couponDiscountCents, setCouponDiscountCents] = useState(0);
  const [pricing, setPricing] = useState<CartPricedLine[] | null>(null);

  // Address simulation for "Shipping to CA."
  const [shippingDestination, setShippingDestination] = useState('CA');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [tempDestination, setTempDestination] = useState('CA');

  const visibleError = serverError ?? error;
  const handleRetry = () => {
    if (serverError || syncStatus === 'error') retrySync();
    else retryHydration();
  };

  // Keep drafts synced with cart when not modified
  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, string> = {};
      for (const item of cart) {
        const key = itemKey(item);
        next[key] = prev[key] !== undefined ? prev[key] : String(item.quantity);
      }
      return next;
    });
  }, [cart]);

  // Check if any draft quantity differs from current cart
  const hasDraftChanges = cart.some((item) => {
    const key = itemKey(item);
    const draftVal = drafts[key];
    if (draftVal === undefined) return false;
    const parsed = Number(draftVal);
    return Number.isInteger(parsed) && parsed >= 1 && parsed !== item.quantity;
  });

  const handleDraftChange = (key: string, val: string) => {
    setDrafts((prev) => ({ ...prev, [key]: val }));
  };

  const handleStep = (item: CartItem, delta: number) => {
    const key = itemKey(item);
    const currentVal = Number(drafts[key] ?? item.quantity);
    const target = Math.max(1, Math.min(maxQuantity, (Number.isInteger(currentVal) ? currentVal : item.quantity) + delta));
    setDrafts((prev) => ({ ...prev, [key]: String(target) }));
    updateQty(itemSelector(item), target);
  };

  const commitAllDrafts = () => {
    for (const item of cart) {
      const key = itemKey(item);
      const draftVal = drafts[key];
      if (draftVal !== undefined) {
        const parsed = Number(draftVal);
        if (Number.isInteger(parsed) && parsed >= 1 && parsed <= maxQuantity) {
          if (parsed !== item.quantity) {
            updateQty(itemSelector(item), parsed);
          }
        } else {
          setDrafts((prev) => ({ ...prev, [key]: String(item.quantity) }));
        }
      }
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>, item: CartItem) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const key = itemKey(item);
      const parsed = Number(drafts[key]);
      if (Number.isInteger(parsed) && parsed >= 1 && parsed <= maxQuantity) {
        updateQty(itemSelector(item), parsed);
      } else {
        setDrafts((prev) => ({ ...prev, [key]: String(item.quantity) }));
      }
    }
  };

  /* Which lines are being priced: identity + list price */
  const pricingSignature = cart
    .map((item) => `${String(item.productId)}:${String(item.variantId)}:${item.price}`)
    .join('|');

  useEffect(() => {
    if (!isHydrated || cart.length === 0) {
      setPricing(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const priced = await getCartPricing(
          cart.map((item) => ({
            productId: Number(item.productId),
            variantId: item.variantId === null ? null : Number(item.variantId),
            price: item.price,
          })),
        );
        if (cancelled) return;
        setPricing(priced.length === cart.length ? priced : null);
      } catch {
        if (!cancelled) setPricing(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, pricingSignature, cart]);

  const priceCentsFor = (index: number): number => {
    const line = pricing?.[index];
    return line ? toCents(line.salePrice) : toCents(cart[index]?.price ?? 0);
  };

  const originalPriceFor = (index: number): number | null => {
    const line = pricing?.[index];
    return line && line.discounted ? toCents(line.originalPrice) : null;
  };

  const subtotalCents = cart.reduce(
    (total, _item, index) => total + priceCentsFor(index) * cart[index].quantity,
    0,
  );
  const discountCents = Math.min(couponDiscountCents, subtotalCents);
  const totalCents = Math.max(0, subtotalCents - discountCents);

  /* Re-validate coupon against server */
  useEffect(() => {
    if (!isHydrated || !appliedCode) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await validateCartCoupon(appliedCode, subtotalCents);
        if (cancelled) return;
        if (!result.ok) {
          setAppliedCode(null);
          setAppliedLabel(null);
          setCouponDiscountCents(0);
          setCouponMessage({ text: result.message });
          clearStoredCoupon();
          return;
        }
        setAppliedLabel(result.label);
        setCouponDiscountCents(result.discountCents);
      } catch {
        if (!cancelled) setCouponMessage({ key: 'cart.coupon.unavailable' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, appliedCode, subtotalCents]);

  /* Restore coupon on hydration */
  useEffect(() => {
    if (!isHydrated) return;
    const stored = readStoredCoupon();
    if (!stored) return;
    setAppliedCode(stored.code);
    setAppliedLabel(stored.label);
    setCoupon(stored.code);
    setCouponMessage({ key: 'cart.coupon.restored', params: { label: stored.label } });
  }, [isHydrated]);

  const removeCoupon = () => {
    setAppliedCode(null);
    setAppliedLabel(null);
    setCouponDiscountCents(0);
    setCoupon('');
    setCouponMessage({ key: 'cart.coupon.removed' });
    clearStoredCoupon();
  };

  const handleCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = coupon.trim();
    if (!code) {
      setCouponMessage({ key: 'cart.coupon.empty' });
      return;
    }
    setCouponPending(true);
    try {
      const result = await validateCartCoupon(code, subtotalCents);
      if (!result.ok) {
        setAppliedCode(null);
        setAppliedLabel(null);
        setCouponDiscountCents(0);
        setCouponMessage({ text: result.message });
        clearStoredCoupon();
        return;
      }
      setAppliedCode(code);
      setAppliedLabel(result.label);
      setCouponDiscountCents(result.discountCents);
      setCouponMessage({
        key: 'cart.coupon.applied',
        params: {
          label: result.label,
          amount: formatCents(result.discountCents),
        },
      });
      writeStoredCoupon({ code, label: result.label });
    } catch {
      setCouponMessage({ key: 'cart.coupon.unavailable' });
    } finally {
      setCouponPending(false);
    }
  };

  // Most recent or primary item for notice banner
  const latestItem = cart.length > 0 ? cart[cart.length - 1] : null;

  return (
    <div className={styles.page}>
      <ShopPageHeader
        title={t('cart.header.crumb') || 'Cart'}
        crumbs={[{ label: t('cart.header.crumb') || 'Cart' }]}
        align="center"
      />

      <main className={styles.container}>
        {/* Error notification if sync or operation failed */}
        {visibleError ? (
          <div className={styles.statusBar} data-state="error" role="alert">
            <span>{visibleError}</span>
            <button
              type="button"
              className={styles.statusRetryBtn}
              onClick={handleRetry}
              disabled={isPending}
            >
              {t('cart.error.retry') || 'Retry'}
            </button>
          </div>
        ) : null}

        {isHydrating || !isHydrated ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} aria-hidden="true" />
            <p>{t('cart.loading.title') || 'Loading your cart…'}</p>
          </div>
        ) : cart.length === 0 ? (
          <section className={styles.emptyState}>
            <h2 className={styles.emptyTitle}>
              {t('cart.empty.title') || 'Your cart is currently empty.'}
            </h2>
            <p className={styles.emptyText}>
              {t('cart.empty.text') || 'Before proceed to checkout you must add some products to your shopping cart.'}
            </p>
            <Link href="/home/products" className={styles.emptyAction}>
              {t('cart.empty.action') || 'RETURN TO SHOP'}
            </Link>
          </section>
        ) : (
          <>
            {/* Added to Cart Banner matching reference */}
            {latestItem ? (
              <aside className={styles.noticeBanner} aria-label="Cart notification">
                <p className={styles.noticeText}>
                  “{latestItem.name}” has been added to your cart.
                </p>
                <Link href="/home/products" className={styles.noticeButton}>
                  CONTINUE SHOPPING
                </Link>
              </aside>
            ) : null}

            {/* Cart Grid Layout */}
            <div className={styles.cartLayout}>
              {/* Left Column: Items Table & Actions */}
              <div className={styles.cartMain}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">{t('cart.table.product') || 'Product'}</th>
                        <th scope="col">{t('cart.table.price') || 'Price'}</th>
                        <th scope="col">{t('cart.table.quantity') || 'Quantity'}</th>
                        <th scope="col">{t('cart.table.subtotal') || 'Subtotal'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item, index) => {
                        const key = itemKey(item);
                        const draftQty = drafts[key] ?? String(item.quantity);
                        const isUnavailable = item.available === false;

                        return (
                          <tr key={`${key}-${item.quantity}`}>
                            {/* Product Cell */}
                            <td>
                              <div className={styles.productCell}>
                                <button
                                  type="button"
                                  className={styles.removeButton}
                                  onClick={() => removeFromCart(itemSelector(item))}
                                  disabled={isPending}
                                  aria-label={t('cart.item.removeAria', { name: item.name }) || `Remove ${item.name}`}
                                  title="Remove this item"
                                >
                                  ×
                                </button>
                                <Link
                                  href={`/home/products/${encodeURIComponent(String(item.productId))}`}
                                  className={styles.productImageLink}
                                >
                                  {canRenderImage(item.imageUrl) ? (
                                    <Image
                                      src={item.imageUrl}
                                      alt={item.name}
                                      width={68}
                                      height={82}
                                      unoptimized
                                      className={styles.productImage}
                                    />
                                  ) : (
                                    <span className={styles.imageFallback} aria-hidden="true" />
                                  )}
                                </Link>
                                <div className={styles.productNameWrapper}>
                                  <Link
                                    href={`/home/products/${encodeURIComponent(String(item.productId))}`}
                                    className={styles.productName}
                                  >
                                    {item.name}
                                  </Link>
                                  {item.variantId !== null ? (
                                    <span className={styles.variantLabel}>
                                      {t('cart.item.variant', { id: String(item.variantId) }) || `Variant ${String(item.variantId)}`}
                                    </span>
                                  ) : null}
                                  {isUnavailable ? (
                                    <span className={styles.unavailableLabel}>
                                      {t('cart.item.unavailable') || 'Currently unavailable'}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </td>

                            {/* Price Cell */}
                            <td className={styles.priceCell}>
                              <span>{formatCents(priceCentsFor(index))}</span>
                              {originalPriceFor(index) !== null ? (
                                <span className={styles.oldPrice}>
                                  {formatCents(originalPriceFor(index)!)}
                                </span>
                              ) : null}
                            </td>

                            {/* Quantity Cell: - 1 + */}
                            <td className={styles.quantityCell}>
                              <div className={styles.quantityControl}>
                                <button
                                  type="button"
                                  className={styles.quantityButton}
                                  onClick={() => handleStep(item, -1)}
                                  disabled={isPending || isUnavailable || item.quantity <= 1}
                                  aria-label="Decrease quantity"
                                >
                                  -
                                </button>
                                <input
                                  className={styles.quantityInput}
                                  type="number"
                                  inputMode="numeric"
                                  min={1}
                                  max={maxQuantity}
                                  value={draftQty}
                                  onChange={(e) => handleDraftChange(key, e.target.value)}
                                  onKeyDown={(e) => handleInputKeyDown(e, item)}
                                  disabled={isPending || isUnavailable}
                                  aria-label="Item quantity"
                                />
                                <button
                                  type="button"
                                  className={styles.quantityButton}
                                  onClick={() => handleStep(item, 1)}
                                  disabled={isPending || isUnavailable || item.quantity >= maxQuantity}
                                  aria-label="Increase quantity"
                                >
                                  +
                                </button>
                              </div>
                            </td>

                            {/* Subtotal Cell */}
                            <td className={styles.subtotalCell}>
                              {formatCents(priceCentsFor(index) * item.quantity)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer Actions: Coupon on Left, Update Cart on Right */}
                <div className={styles.cartActionsRow}>
                  <form className={styles.couponForm} onSubmit={handleCoupon}>
                    <div className={styles.couponInputs}>
                      <input
                        id="cart-coupon"
                        className={styles.couponInput}
                        value={coupon}
                        onChange={(e) => setCoupon(e.target.value)}
                        placeholder={t('cart.coupon.label') || 'Coupon code'}
                        autoComplete="off"
                        maxLength={64}
                      />
                      <button
                        type="submit"
                        className={styles.couponApplyBtn}
                        disabled={couponPending}
                      >
                        {couponPending
                          ? (t('cart.coupon.checking') || 'APPLYING…')
                          : (t('cart.coupon.apply') ? t('cart.coupon.apply').toUpperCase() : 'APPLY COUPON')}
                      </button>
                    </div>

                    {appliedCode ? (
                      <div>
                        <button
                          type="button"
                          className={styles.couponRemoveBtn}
                          onClick={removeCoupon}
                          disabled={couponPending}
                        >
                          {t('cart.coupon.remove') || 'Remove coupon'} ({appliedCode})
                        </button>
                      </div>
                    ) : null}

                    {couponMessage ? (
                      <p className={styles.couponFeedback} aria-live="polite">
                        {'text' in couponMessage
                          ? couponMessage.text
                          : t(couponMessage.key, couponMessage.params)}
                      </p>
                    ) : null}
                  </form>

                  <button
                    type="button"
                    className={styles.updateCartBtn}
                    data-active={hasDraftChanges}
                    onClick={commitAllDrafts}
                    disabled={!hasDraftChanges || isPending}
                  >
                    UPDATE CART
                  </button>
                </div>
              </div>

              {/* Right Column: Cart totals Sidebar Card */}
              <aside className={styles.totalsCard} aria-labelledby="cart-totals-title">
                <h2 id="cart-totals-title" className={styles.totalsTitle}>
                  Cart totals
                </h2>

                <div className={styles.totalsRow}>
                  <span className={styles.rowLabel}>
                    {t('cart.summary.subtotal') || 'Subtotal'}
                  </span>
                  <span className={styles.rowValue}>
                    {formatCents(subtotalCents)}
                  </span>
                </div>

                {appliedCode && discountCents > 0 ? (
                  <div className={styles.totalsRow}>
                    <span className={styles.rowLabel}>
                      {appliedLabel ?? (t('cart.summary.coupon') || 'Coupon')}
                    </span>
                    <span className={styles.rowValue}>
                      -{formatCents(discountCents)}
                    </span>
                  </div>
                ) : null}

                <div className={styles.totalsRow} data-align="top">
                  <span className={styles.rowLabel}>
                    {t('cart.summary.shipping') || 'Shipping'}
                  </span>
                  <div className={styles.shippingBlock}>
                    <span className={styles.shippingRate}>Flat rate</span>
                    <span className={styles.shippingDestination}>
                      Shipping to {shippingDestination}.
                    </span>
                    <button
                      type="button"
                      className={styles.shippingChangeBtn}
                      onClick={() => setShowAddressForm((prev) => !prev)}
                    >
                      Change address
                    </button>
                    {showAddressForm ? (
                      <div className={styles.shippingAddressForm}>
                        <input
                          type="text"
                          className={styles.shippingAddressInput}
                          value={tempDestination}
                          onChange={(e) => setTempDestination(e.target.value)}
                          placeholder="e.g. CA or NY"
                        />
                        <button
                          type="button"
                          className={styles.shippingAddressUpdateBtn}
                          onClick={() => {
                            if (tempDestination.trim()) {
                              setShippingDestination(tempDestination.trim());
                            }
                            setShowAddressForm(false);
                          }}
                        >
                          Update
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className={styles.totalRow}>
                  <span className={styles.totalLabel}>
                    {t('cart.summary.total') || 'Total'}
                  </span>
                  <span className={styles.totalValue}>
                    {formatCents(totalCents)}
                  </span>
                </div>

                <Link href="/home/checkout" className={styles.checkoutBtn}>
                  PROCEED TO CHECKOUT
                </Link>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
