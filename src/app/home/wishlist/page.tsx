'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Heart, LockKeyhole, ShoppingBag, Trash2 } from 'lucide-react';
import styles from '../commerce-pages.module.css';
import { useCart } from '@/context/CartContext';
import { useWishlist, type WishlistItem, type WishlistItemSelector } from '@/context/WishlistContext';

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number.isFinite(value) ? value : 0);
}

function formatAddedAt(value: string): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function itemSelector(item: WishlistItem): WishlistItemSelector {
  return { productId: item.productId, variantId: item.variantId };
}

function itemKey(item: WishlistItem): string {
  return `${typeof item.productId}:${String(item.productId)}|${typeof item.variantId}:${String(item.variantId)}`;
}

function storageLabel(scope: string): string {
  if (scope === 'local') return 'Saved in this browser';
  if (scope === 'memory') return 'Available for this tab only';
  if (scope === 'unavailable') return 'Browser storage unavailable';
  return 'Local wishlist';
}

function wishlistStatusLabel({
  syncStatus,
  isServerSynced,
  isLocalOnly,
  hasLocalDraft,
  scope,
}: {
  syncStatus: string;
  isServerSynced: boolean;
  isLocalOnly: boolean;
  hasLocalDraft: boolean;
  scope: string;
}): string {
  if (syncStatus === 'syncing') return 'Checking your account wishlist…';
  if (isServerSynced && !hasLocalDraft) return 'Synced to your account';
  if (hasLocalDraft) {
    return syncStatus === 'error' ? 'Local draft — sync needs attention' : 'Local draft — waiting to sync';
  }
  if (isLocalOnly) return 'Local-only wishlist';
  return storageLabel(scope);
}

function canRenderImage(value: string): boolean {
  return value.startsWith('/') || value.startsWith('data:image/') || /^https?:\/\//i.test(value);
}

function LoadingState() {
  return (
    <div className={styles.loadingState} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.spinner} aria-hidden="true" />
      <strong>Loading your wishlist…</strong>
      <span>Checking local and account wishlist state.</span>
    </div>
  );
}

export default function WishlistPage() {
  const {
    wishlist,
    removeFromWishlist,
    isHydrated,
    isHydrating,
    isPending,
    error,
    serverError,
    storageScope,
    syncStatus,
    isServerSynced,
    isLocalOnly,
    serverAuthenticated,
    hasLocalDraft,
    retryHydration,
    retrySync,
  } = useWishlist();
  const { addToCart } = useCart();
  const [cartMessage, setCartMessage] = useState('');
  const visibleError = serverError ?? error;
  const handleRetry = () => {
    if (serverError || syncStatus === 'error') retrySync();
    else retryHydration();
  };

  const handleAddToCart = (item: WishlistItem) => {
    const result = addToCart({
      productId: item.productId,
      variantId: item.variantId,
      name: item.name,
      price: item.price,
      quantity: 1,
      imageUrl: item.imageUrl,
    });
    setCartMessage(
      result.ok && result.changed
        ? `${item.name} was added to your cart.`
        : result.reason === 'limit'
          ? `${item.name} reached the cart quantity limit.`
          : 'That item could not be added. Please review the cart message.',
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.container}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/shop">Home</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Wishlist</span>
          </nav>
          <div className={styles.titleRow}>
            <div>
              <p className={styles.eyebrow}>Saved for later</p>
              <h1 className={styles.title}>Your wishlist</h1>
              <p className={styles.subtitle}>
                {serverAuthenticated
                  ? 'Keep your account wishlist synchronized when you are signed in.'
                  : 'Keep a private list of products to revisit on this device.'}
              </p>
            </div>
            {!isHydrating && wishlist.length > 0 ? (
              <span className={styles.countPill} aria-label={`${wishlist.length} saved items`}>
                {wishlist.length} saved
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <section className={styles.content} aria-label="Wishlist contents">
        <div className={styles.container}>
          <div className={styles.statusBar} data-state={visibleError ? 'error' : 'ready'}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span>
              {wishlistStatusLabel({ syncStatus, isServerSynced, isLocalOnly, hasLocalDraft, scope: storageScope })}
              {visibleError ? '' : isServerSynced && !hasLocalDraft ? ' · server product rows are authoritative' : hasLocalDraft ? ' · local changes are waiting to sync' : ' · guests keep this list in this browser'}
            </span>
            {isPending && !isHydrating ? <span className={styles.statusBusy}>{syncStatus === 'syncing' ? 'Syncing…' : 'Saving…'}</span> : null}
          </div>

          {visibleError ? (
            <div className={styles.alert} data-tone="error" role="alert">
              <div>
                <strong className={styles.alertTitle}>We could not complete that wishlist change</strong>
                <p className={styles.alertText}>{visibleError}</p>
              </div>
              <button type="button" className={styles.buttonSecondary} onClick={handleRetry} disabled={isPending}>
                Try again
              </button>
            </div>
          ) : null}

          {isHydrating || !isHydrated ? (
            <LoadingState />
          ) : wishlist.length === 0 ? (
            <section className={styles.emptyState} aria-labelledby="empty-wishlist-title">
              <div className={styles.emptyIcon} aria-hidden="true">
                <Heart size={28} strokeWidth={1.5} />
              </div>
              <h2 id="empty-wishlist-title" className={styles.emptyTitle}>Your wishlist is empty</h2>
              <p className={styles.emptyText}>Use the heart on a product to save it here for later.</p>
              <Link href="/shop/products" className={styles.buttonPrimary}>Browse products</Link>
            </section>
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <caption className={styles.tableCaption}>Products saved in this wishlist</caption>
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      <th scope="col">Price</th>
                      <th scope="col">Added</th>
                      <th scope="col">Availability</th>
                      <th scope="col"><span className={styles.srOnly}>Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {wishlist.map((item) => {
                      const productHref = `/shop/products/${encodeURIComponent(String(item.productId))}`;
                      const inStock = item.available !== false && item.stockQuantity > 0;
                      const needsVariant = item.variantId === null;
                      const hasPrice = item.priceAvailable !== false;
                      return (
                        <tr key={itemKey(item)}>
                          <td data-label="Product">
                            <div className={styles.productCell}>
                              <Link href={productHref} className={styles.productImageLink}>
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
                                <Link href={productHref} className={styles.productName}>{item.name}</Link>
                                {item.variantId !== null ? (
                                  <span className={styles.variantLabel}>Variant {String(item.variantId)}</span>
                                ) : null}
                                <button
                                  type="button"
                                  className={styles.removeButton}
                                  onClick={() => removeFromWishlist(itemSelector(item))}
                                  disabled={isPending}
                                  aria-label={`Remove ${item.name} from wishlist`}
                                >
                                  <Trash2 size={14} aria-hidden="true" />
                                  <span>Remove</span>
                                </button>
                              </div>
                            </div>
                          </td>
                          <td data-label="Price" className={styles.priceCell}>
                            {hasPrice ? formatMoney(item.price) : 'Price unavailable'}
                          </td>
                          <td data-label="Added" className={styles.mutedCell}>{formatAddedAt(item.addedAt)}</td>
                          <td data-label="Availability">
                            <span className={inStock ? styles.stockGood : styles.stockMuted}>
                              {inStock ? 'In stock' : 'Out of stock'}
                            </span>
                          </td>
                          <td data-label="Action" className={styles.actionCell}>
                            {inStock && !needsVariant ? (
                              <button
                                type="button"
                                className={styles.buttonSecondary}
                                onClick={() => handleAddToCart(item)}
                                disabled={isPending}
                              >
                                <ShoppingBag size={15} aria-hidden="true" />
                                <span>Add to cart</span>
                              </button>
                            ) : (
                              <Link href={productHref} className={styles.buttonSecondary}>
                                {needsVariant ? 'Select options' : 'View product'}
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className={styles.privacyNote} role="note">
                <LockKeyhole size={18} aria-hidden="true" />
                <div>
                  {serverAuthenticated && isServerSynced ? (
                    <>
                      <strong>This wishlist is synced to your customer account.</strong>
                      <p>Sign out switches this view back to the local browser copy; account rows are not shared through the URL.</p>
                    </>
                  ) : (
                    <>
                      <strong>This wishlist is private to this browser.</strong>
                      <p>Copying the current page URL does not share these items. A real share token and account sync are not connected yet.</p>
                    </>
                  )}
                </div>
              </div>
              {cartMessage ? <p className={styles.inlineMessage} aria-live="polite">{cartMessage}</p> : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
