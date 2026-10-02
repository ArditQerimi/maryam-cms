'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import styles from '../commerce-pages.module.css';
import { useCart, type CartItem, type CartItemSelector } from '@/context/CartContext';
import {
  clearStoredCoupon,
  readStoredCoupon,
  writeStoredCoupon,
} from '@/lib/cart-coupon';
import { getCartPricing, validateCartCoupon } from './actions';
import type { CartPricedLine } from './pricing-types';

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number.isFinite(value) ? value : 0);
}

/** Integer cents → formatted money (the only conversion used by the cart). */
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

function storageLabel(scope: string): string {
  if (scope === 'local') return 'Saved in this browser';
  if (scope === 'memory') return 'Available for this tab only';
  if (scope === 'unavailable') return 'Browser storage unavailable';
  return 'Local cart';
}

function cartStatusLabel({
  syncStatus,
  isServerSynced,
  isLocalOnly,
  hasLocalDraft,
  scope,
  serverOwner,
}: {
  syncStatus: string;
  isServerSynced: boolean;
  isLocalOnly: boolean;
  hasLocalDraft: boolean;
  scope: string;
  serverOwner: 'guest' | 'customer' | null;
}): string {
  if (syncStatus === 'syncing') return 'Syncing cart with the server…';
  if (isServerSynced && !hasLocalDraft) {
    return serverOwner === 'customer' ? 'Synced to your account cart' : 'Synced to the server cart';
  }
  if (hasLocalDraft) {
    return syncStatus === 'error' ? 'Local draft — sync needs attention' : 'Local draft — waiting to sync';
  }
  if (isLocalOnly) return 'Local-only cart';
  return storageLabel(scope);
}

function canRenderImage(value: string): boolean {
  return value.startsWith('/') || value.startsWith('data:image/') || /^https?:\/\//i.test(value);
}

function QuantityControl({
  item,
  maxQuantity,
  disabled,
  onUpdate,
}: {
  item: CartItem;
  maxQuantity: number;
  disabled: boolean;
  onUpdate: (item: CartItem, quantity: number) => void;
}) {
  const [draft, setDraft] = useState(String(item.quantity));

  const commitDraft = () => {
    const parsed = Number(draft);
    if (!draft.trim()) {
      setDraft(String(item.quantity));
      return;
    }
    if (!Number.isInteger(parsed) || parsed < 1) {
      onUpdate(item, parsed);
      setDraft(String(item.quantity));
      return;
    }
    onUpdate(item, parsed);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitDraft();
    }
  };

  return (
    <div className={styles.quantityControl}>
      <button
        type="button"
        className={styles.quantityButton}
        onClick={() => onUpdate(item, item.quantity - 1)}
        disabled={disabled || item.quantity <= 1}
        aria-label={`Decrease quantity for ${item.name}`}
      >
        <Minus size={15} aria-hidden="true" />
      </button>
      <input
        className={styles.quantityInput}
        type="number"
        inputMode="numeric"
        min={1}
        max={maxQuantity}
        step={1}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label={`Quantity for ${item.name}`}
      />
      <button
        type="button"
        className={styles.quantityButton}
        onClick={() => onUpdate(item, item.quantity + 1)}
        disabled={disabled || item.quantity >= maxQuantity}
        aria-label={`Increase quantity for ${item.name}`}
      >
        <Plus size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className={styles.loadingState} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.spinner} aria-hidden="true" />
      <strong>Loading your cart…</strong>
      <span>Checking local and server cart state.</span>
    </div>
  );
}

export default function ShopCartPage() {
  const {
    cart,
    removeFromCart,
    updateQty,
    clearCart,
    totalItems,
    maxQuantity,
    isHydrated,
    isHydrating,
    isPending,
    error,
    serverError,
    storageScope,
    syncStatus,
    isServerSynced,
    isLocalOnly,
    serverOwner,
    hasLocalDraft,
    retryHydration,
    retrySync,
  } = useCart();
  const [coupon, setCoupon] = useState('');
  const [couponMessage, setCouponMessage] = useState('');
  const [couponPending, setCouponPending] = useState(false);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [appliedLabel, setAppliedLabel] = useState<string | null>(null);
  const [couponDiscountCents, setCouponDiscountCents] = useState(0);
  const [pricing, setPricing] = useState<CartPricedLine[] | null>(null);
  const visibleError = serverError ?? error;
  const handleRetry = () => {
    if (serverError || syncStatus === 'error') retrySync();
    else retryHydration();
  };

  /* Which lines are being priced: identity + list price, not quantities. */
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
    // `pricingSignature` already captures every cart field that affects pricing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, pricingSignature]);

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

  /* Re-validate a remembered (or just-applied) code against the server. */
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
          setCouponMessage(result.message);
          clearStoredCoupon();
          return;
        }
        setAppliedLabel(result.label);
        setCouponDiscountCents(result.discountCents);
      } catch {
        if (!cancelled) setCouponMessage('Coupons are temporarily unavailable. Try again.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, appliedCode, subtotalCents]);

  /* Bring the coupon chosen last time back into this cart. */
  useEffect(() => {
    if (!isHydrated) return;
    const stored = readStoredCoupon();
    if (!stored) return;
    setAppliedCode(stored.code);
    setAppliedLabel(stored.label);
    setCoupon(stored.code);
    setCouponMessage(`${stored.label} restored from your last visit.`);
    // Only on hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  const handleUpdate = (item: CartItem, quantity: number) => {
    updateQty(itemSelector(item), quantity);
  };

  const removeCoupon = () => {
    setAppliedCode(null);
    setAppliedLabel(null);
    setCouponDiscountCents(0);
    setCoupon('');
    setCouponMessage('Coupon removed. Your cart is unchanged.');
    clearStoredCoupon();
  };

  const handleCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = coupon.trim();
    if (!code) {
      setCouponMessage('Enter a coupon code.');
      return;
    }
    setCouponPending(true);
    try {
      const result = await validateCartCoupon(code, subtotalCents);
      if (!result.ok) {
        setAppliedCode(null);
        setAppliedLabel(null);
        setCouponDiscountCents(0);
        setCouponMessage(result.message);
        clearStoredCoupon();
        return;
      }
      setAppliedCode(code);
      setAppliedLabel(result.label);
      setCouponDiscountCents(result.discountCents);
      setCouponMessage(
        `${result.label} applied — you save ${formatCents(result.discountCents)}.`,
      );
      writeStoredCoupon({ code, label: result.label });
    } catch {
      setCouponMessage('Coupons are temporarily unavailable. Try again.');
    } finally {
      setCouponPending(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.container}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/shop">Home</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Cart</span>
          </nav>
          <div className={styles.titleRow}>
            <div>
              <p className={styles.eyebrow}>Your selection</p>
              <h1 className={styles.title}>Shopping cart</h1>
              <p className={styles.subtitle}>
                Review quantities and variants before continuing to checkout.
              </p>
            </div>
            {!isHydrating && cart.length > 0 ? (
              <span className={styles.countPill} aria-label={`${totalItems} items in cart`}>
                {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <section className={styles.content} aria-label="Shopping cart contents">
        <div className={styles.container}>
          <div className={styles.statusBar} data-state={visibleError ? 'error' : 'ready'}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span>
              {cartStatusLabel({ syncStatus, isServerSynced, isLocalOnly, hasLocalDraft, scope: storageScope, serverOwner })}
              {visibleError ? '' : isServerSynced && !hasLocalDraft ? ' · server quantities and prices are authoritative' : ' · this browser is the source of truth until sync succeeds'}
            </span>
            {isPending && !isHydrating ? <span className={styles.statusBusy}>{syncStatus === 'syncing' ? 'Syncing…' : 'Saving…'}</span> : null}
          </div>

          {visibleError ? (
            <div className={styles.alert} data-tone="error" role="alert">
              <div>
                <strong className={styles.alertTitle}>We could not complete that cart change</strong>
                <p className={styles.alertText}>{visibleError}</p>
              </div>
              <button type="button" className={styles.buttonSecondary} onClick={handleRetry} disabled={isPending}>
                Try again
              </button>
            </div>
          ) : null}

          {isHydrating || !isHydrated ? (
            <LoadingState />
          ) : cart.length === 0 ? (
            <section className={styles.emptyState} aria-labelledby="empty-cart-title">
              <div className={styles.emptyIcon} aria-hidden="true">
                <ShoppingBag size={28} strokeWidth={1.5} />
              </div>
              <h2 id="empty-cart-title" className={styles.emptyTitle}>Your cart is empty</h2>
              <p className={styles.emptyText}>
                Save a book or product here and it will stay available while you keep shopping.
              </p>
              <Link href="/shop/products" className={styles.buttonPrimary}>
                Continue shopping
              </Link>
            </section>
          ) : (
            <div className={styles.cartLayout}>
              <div className={styles.cartMain}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <caption className={styles.tableCaption}>
                      Items currently in your cart
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Product</th>
                        <th scope="col">Price</th>
                        <th scope="col">Quantity</th>
                        <th scope="col">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item, index) => (
                        <tr key={`${itemKey(item)}-${item.quantity}`}>
                          <td data-label="Product">
                            <div className={styles.productCell}>
                              <Link href={`/shop/products/${encodeURIComponent(String(item.productId))}`} className={styles.productImageLink}>
                                {canRenderImage(item.imageUrl) ? (
                                  <Image
                                    src={item.imageUrl}
                                    alt=""
                                    width={72}
                                    height={86}
                                    unoptimized
                                    className={styles.productImage}
                                  />
                                ) : (
                                  <span className={styles.imageFallback} aria-hidden="true" />
                                )}
                              </Link>
                              <div className={styles.productDetails}>
                                <Link href={`/shop/products/${encodeURIComponent(String(item.productId))}`} className={styles.productName}>
                                  {item.name}
                                </Link>
                                {item.variantId !== null ? (
                                  <span className={styles.variantLabel}>Variant {String(item.variantId)}</span>
                                ) : null}
                                {item.available === false ? (
                                  <span className={styles.stockMuted}>Currently unavailable</span>
                                ) : null}
                                <button
                                  type="button"
                                  className={styles.removeButton}
                                  onClick={() => removeFromCart(itemSelector(item))}
                                  disabled={isPending}
                                  aria-label={`Remove ${item.name} from cart`}
                                >
                                  <Trash2 size={14} aria-hidden="true" />
                                  <span>Remove</span>
                                </button>
                              </div>
                            </div>
                          </td>
                          <td data-label="Price" className={styles.priceCell}>
                            <span className={styles.priceStack}>
                              <strong>{formatCents(priceCentsFor(index))}</strong>
                              {originalPriceFor(index) !== null ? (
                                <span className={styles.oldPrice}>
                                  {formatCents(originalPriceFor(index)!)}
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td data-label="Quantity">
                            <QuantityControl
                              item={item}
                              maxQuantity={maxQuantity}
                              disabled={isPending || item.available === false}
                              onUpdate={handleUpdate}
                            />
                          </td>
                          <td data-label="Subtotal" className={styles.subtotalCell}>
                            {formatCents(priceCentsFor(index) * item.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.cartFooter}>
                  <form className={styles.couponForm} onSubmit={handleCoupon}>
                    <label htmlFor="cart-coupon">Coupon code</label>
                    <div className={styles.couponControls}>
                      <input
                        id="cart-coupon"
                        className={styles.couponInput}
                        value={coupon}
                        onChange={(event) => setCoupon(event.target.value)}
                        placeholder="Enter code"
                        autoComplete="off"
                        maxLength={64}
                      />
                      <button
                        type="submit"
                        className={styles.buttonSecondary}
                        disabled={couponPending}
                      >
                        {couponPending ? 'Checking…' : 'Apply'}
                      </button>
                      {appliedCode ? (
                        <button
                          type="button"
                          className={styles.buttonQuiet}
                          onClick={removeCoupon}
                          disabled={couponPending}
                        >
                          <X size={14} aria-hidden="true" />
                          <span>Remove coupon</span>
                        </button>
                      ) : null}
                    </div>
                    <p className={styles.couponMessage} aria-live="polite">{couponMessage}</p>
                  </form>
                  <button type="button" className={styles.buttonQuiet} onClick={clearCart} disabled={isPending}>
                    Clear cart
                  </button>
                </div>
              </div>

              <aside className={styles.summary} aria-labelledby="cart-summary-title">
                <h2 id="cart-summary-title" className={styles.summaryTitle}>Order summary</h2>
                <div className={styles.summaryRow}>
                  <span>Subtotal</span>
                  <strong>{formatCents(subtotalCents)}</strong>
                </div>
                {appliedCode && discountCents > 0 ? (
                  <div className={styles.summaryRow}>
                    <span>{appliedLabel ?? 'Coupon'}</span>
                    <strong>-{formatCents(discountCents)}</strong>
                  </div>
                ) : null}
                <div className={styles.summaryRow}>
                  <span>Shipping</span>
                  <span>Calculated at checkout</span>
                </div>
                <div className={styles.summaryDivider} />
                <div className={styles.summaryRow + ' ' + styles.summaryTotal}>
                  <span>Total</span>
                  <strong>{formatCents(totalCents)}</strong>
                </div>
                <Link href="/shop/checkout" className={styles.checkoutButton}>
                  Proceed to checkout
                </Link>
                <p className={styles.finePrint}>
                  {isServerSynced
                    ? 'Taxes and shipping are confirmed at checkout. Server cart totals are authoritative.'
                    : 'Taxes and shipping are confirmed at checkout. Local changes remain recoverable if sync fails.'}
                </p>
              </aside>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
