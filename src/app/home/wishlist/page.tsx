'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Heart, LockKeyhole, ShoppingBag, Trash2 } from 'lucide-react';
import ShopPageHeader from '../components/ShopPageHeader';
import styles from '../commerce-pages.module.css';
import { useCart } from '@/context/CartContext';
import { useWishlist, type WishlistItem, type WishlistItemSelector } from '@/context/WishlistContext';
import { useLocale, type Translator } from '@/lib/i18n/LocaleProvider';

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number.isFinite(value) ? value : 0);
}

function formatAddedAt(value: string, t: Translator): string {
  if (!value) return t('tools.wishlist.date_unavailable');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t('tools.wishlist.date_unavailable');
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

function storageLabel(scope: string, t: Translator): string {
  if (scope === 'local') return t('tools.wishlist.storage_local');
  if (scope === 'memory') return t('tools.storage_memory');
  if (scope === 'unavailable') return t('tools.storage_unavailable');
  return t('tools.wishlist.storage_fallback');
}

function wishlistStatusLabel({
  syncStatus,
  isServerSynced,
  isLocalOnly,
  hasLocalDraft,
  scope,
  t,
}: {
  syncStatus: string;
  isServerSynced: boolean;
  isLocalOnly: boolean;
  hasLocalDraft: boolean;
  scope: string;
  t: Translator;
}): string {
  if (syncStatus === 'syncing') return t('tools.wishlist.status_syncing');
  if (isServerSynced && !hasLocalDraft) return t('tools.wishlist.status_synced');
  if (hasLocalDraft) {
    return syncStatus === 'error'
      ? t('tools.wishlist.status_draft_error')
      : t('tools.wishlist.status_draft');
  }
  if (isLocalOnly) return t('tools.wishlist.status_local_only');
  return storageLabel(scope, t);
}

function canRenderImage(value: string): boolean {
  return value.startsWith('/') || value.startsWith('data:image/') || /^https?:\/\//i.test(value);
}

function LoadingState() {
  const { t } = useLocale();
  return (
    <div className={styles.loadingState} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.spinner} aria-hidden="true" />
      <strong>{t('tools.wishlist.loading_title')}</strong>
      <span>{t('tools.wishlist.loading_text')}</span>
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
  const { t } = useLocale();
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
        ? t('tools.cart_added', { name: item.name })
        : result.reason === 'limit'
          ? t('tools.cart_limit', { name: item.name })
          : t('tools.cart_failed'),
    );
  };

  return (
    <div className={styles.page}>
      <ShopPageHeader
        title={t('tools.wishlist.title')}
        crumbs={[{ label: t('tools.wishlist.crumb') }]}
        eyebrow={t('tools.wishlist.eyebrow')}
        lead={
          serverAuthenticated
            ? t('tools.wishlist.lead_signed_in')
            : t('tools.wishlist.lead_guest')
        }
      >
        {!isHydrating && wishlist.length > 0 ? (
          <span
            className={styles.countPill}
            aria-label={t('tools.wishlist.count_aria', { count: wishlist.length })}
          >
            {t('tools.wishlist.count_display', { count: wishlist.length })}
          </span>
        ) : null}
      </ShopPageHeader>

      <section className={styles.content} aria-label={t('tools.wishlist.contents_aria')}>
        <div className={styles.container}>
          <div className={styles.statusBar} data-state={visibleError ? 'error' : 'ready'}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span>
              {wishlistStatusLabel({
                syncStatus,
                isServerSynced,
                isLocalOnly,
                hasLocalDraft,
                scope: storageScope,
                t,
              })}
              {visibleError
                ? ''
                : isServerSynced && !hasLocalDraft
                  ? t('tools.wishlist.suffix_authoritative')
                  : hasLocalDraft
                    ? t('tools.wishlist.suffix_pending')
                    : t('tools.wishlist.suffix_guests')}
            </span>
            {isPending && !isHydrating ? (
              <span className={styles.statusBusy}>
                {syncStatus === 'syncing' ? t('tools.busy_syncing') : t('tools.busy_saving')}
              </span>
            ) : null}
          </div>

          {visibleError ? (
            <div className={styles.alert} data-tone="error" role="alert">
              <div>
                <strong className={styles.alertTitle}>{t('tools.wishlist.error_title')}</strong>
                <p className={styles.alertText}>{visibleError}</p>
              </div>
              <button type="button" className={styles.buttonSecondary} onClick={handleRetry} disabled={isPending}>
                {t('tools.try_again')}
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
              <h2 id="empty-wishlist-title" className={styles.emptyTitle}>{t('tools.wishlist.empty_title')}</h2>
              <p className={styles.emptyText}>{t('tools.wishlist.empty_text')}</p>
              <Link href="/home/products" className={styles.buttonPrimary}>{t('tools.browse')}</Link>
            </section>
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <caption className={styles.tableCaption}>{t('tools.wishlist.caption')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('tools.th_product')}</th>
                      <th scope="col">{t('tools.th_price')}</th>
                      <th scope="col">{t('tools.wishlist.th_added')}</th>
                      <th scope="col">{t('tools.wishlist.th_availability')}</th>
                      <th scope="col"><span className={styles.srOnly}>{t('tools.wishlist.th_actions')}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {wishlist.map((item) => {
                      const productHref = `/home/products/${encodeURIComponent(String(item.productId))}`;
                      const inStock = item.available !== false && item.stockQuantity > 0;
                      const needsVariant = item.variantId === null;
                      const hasPrice = item.priceAvailable !== false;
                      return (
                        <tr key={itemKey(item)}>
                          <td data-label={t('tools.th_product')}>
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
                                  <span className={styles.variantLabel}>
                                    {t('tools.variant', { id: String(item.variantId) })}
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  className={styles.removeButton}
                                  onClick={() => removeFromWishlist(itemSelector(item))}
                                  disabled={isPending}
                                  aria-label={t('tools.wishlist.remove_aria', { name: item.name })}
                                >
                                  <Trash2 size={14} aria-hidden="true" />
                                  <span>{t('tools.wishlist.remove')}</span>
                                </button>
                              </div>
                            </div>
                          </td>
                          <td data-label={t('tools.th_price')} className={styles.priceCell}>
                            {hasPrice ? formatMoney(item.price) : t('catalog.price_unavailable')}
                          </td>
                          <td data-label={t('tools.wishlist.th_added')} className={styles.mutedCell}>
                            {formatAddedAt(item.addedAt, t)}
                          </td>
                          <td data-label={t('tools.wishlist.th_availability')}>
                            <span className={inStock ? styles.stockGood : styles.stockMuted}>
                              {inStock ? t('catalog.in_stock') : t('catalog.out_of_stock')}
                            </span>
                          </td>
                          <td data-label={t('tools.wishlist.th_actions')} className={styles.actionCell}>
                            {inStock && !needsVariant ? (
                              <button
                                type="button"
                                className={styles.buttonSecondary}
                                onClick={() => handleAddToCart(item)}
                                disabled={isPending}
                              >
                                <ShoppingBag size={15} aria-hidden="true" />
                                <span>{t('catalog.add_to_cart')}</span>
                              </button>
                            ) : (
                              <Link href={productHref} className={styles.buttonSecondary}>
                                {needsVariant ? t('tools.select_options') : t('tools.view_product')}
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
                      <strong>{t('tools.wishlist.note_signed_in_title')}</strong>
                      <p>{t('tools.wishlist.note_signed_in_text')}</p>
                    </>
                  ) : (
                    <>
                      <strong>{t('tools.wishlist.note_guest_title')}</strong>
                      <p>{t('tools.wishlist.note_guest_text')}</p>
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
