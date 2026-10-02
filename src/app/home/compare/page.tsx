'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Check, Info, Layers3, ShoppingBag, Trash2, X } from 'lucide-react';
import ShopPageHeader from '../components/ShopPageHeader';
import styles from '../commerce-pages.module.css';
import { useCart } from '@/context/CartContext';
import { useCompare, type CompareItem, type CompareItemSelector } from '@/context/CompareContext';
import { useLocale, type Translator } from '@/lib/i18n/LocaleProvider';

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number.isFinite(value) ? value : 0);
}

function itemSelector(item: CompareItem): CompareItemSelector {
  return { productId: item.productId, variantId: item.variantId };
}

function itemKey(item: CompareItem): string {
  return `${typeof item.productId}:${String(item.productId)}|${typeof item.variantId}:${String(item.variantId)}`;
}

function productHref(item: CompareItem): string {
  return `/home/products/${encodeURIComponent(String(item.productId))}`;
}

function storageLabel(scope: string, t: Translator): string {
  if (scope === 'session') return t('tools.compare.storage_session');
  if (scope === 'legacy-local') return t('tools.compare.storage_legacy');
  if (scope === 'memory') return t('tools.storage_memory');
  if (scope === 'unavailable') return t('tools.storage_unavailable');
  return t('tools.compare.storage_fallback');
}

function syncStatusLabel(syncStatus: string, scope: string, t: Translator): string {
  if (syncStatus === 'synced') return t('tools.compare.status_synced');
  if (syncStatus === 'syncing') return t('tools.compare.status_syncing');
  if (syncStatus === 'error') {
    return `${storageLabel(scope, t)}${t('tools.compare.suffix_sync_paused')}`;
  }
  return `${storageLabel(scope, t)}${t('tools.compare.suffix_signin')}`;
}

function canRenderImage(value: string): boolean {
  return value.startsWith('/') || value.startsWith('data:image/') || /^https?:\/\//i.test(value);
}

function LoadingState() {
  const { t } = useLocale();
  return (
    <div className={styles.loadingState} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.spinner} aria-hidden="true" />
      <strong>{t('tools.compare.loading_title')}</strong>
      <span>{t('tools.compare.loading_text')}</span>
    </div>
  );
}

export default function ComparePage() {
  const {
    compareItems,
    removeFromCompare,
    clearCompare,
    isHydrated,
    isHydrating,
    isPending,
    error,
    storageScope,
    syncStatus,
    serverError,
    maxItems,
    isAtLimit,
    isOverLimit,
    limitMessage,
    retryHydration,
    retrySync,
  } = useCompare();
  const { cart, addToCart } = useCart();
  const { t } = useLocale();
  const [actionMessage, setActionMessage] = useState('');

  const handleAddToCart = (item: CompareItem) => {
    const result = addToCart({
      productId: item.productId,
      variantId: item.variantId,
      name: item.name,
      price: item.price,
      quantity: 1,
      imageUrl: item.imageUrl,
    });
    setActionMessage(
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
        title={t('tools.compare.title')}
        crumbs={[{ label: t('tools.compare.crumb') }]}
        eyebrow={t('tools.compare.eyebrow')}
        lead={t('tools.compare.lead', { max: maxItems })}
      >
        {!isHydrating && compareItems.length > 0 ? (
          <span
            className={styles.countPill}
            aria-label={t('tools.compare.count_aria', { count: compareItems.length })}
          >
            {compareItems.length} / {maxItems}
          </span>
        ) : null}
      </ShopPageHeader>

      <section className={styles.content} aria-label={t('tools.compare.contents_aria')}>
        <div className={styles.container}>
          <div className={styles.statusBar} data-state={error || serverError ? 'error' : 'ready'}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span>
              {error ? t('tools.compare.status_error') : syncStatusLabel(syncStatus, storageScope, t)}
            </span>
            {isPending && !isHydrating ? (
              <span className={styles.statusBusy}>{t('tools.busy_saving')}</span>
            ) : null}
          </div>

          {error ? (
            <div className={styles.alert} data-tone="error" role="alert">
              <div>
                <strong className={styles.alertTitle}>{t('tools.compare.error_title')}</strong>
                <p className={styles.alertText}>{error}</p>
              </div>
              <button type="button" className={styles.buttonSecondary} onClick={retryHydration} disabled={isPending}>
                {t('tools.try_again')}
              </button>
            </div>
          ) : null}

          {!error && serverError ? (
            <div className={styles.alert} data-tone="error" role="alert">
              <div>
                <strong className={styles.alertTitle}>{t('tools.compare.sync_paused_title')}</strong>
                <p className={styles.alertText}>{serverError}</p>
              </div>
              <button type="button" className={styles.buttonSecondary} onClick={retrySync} disabled={isPending}>
                {t('tools.try_again')}
              </button>
            </div>
          ) : null}

          {isHydrating || !isHydrated ? (
            <LoadingState />
          ) : compareItems.length === 0 ? (
            <section className={styles.emptyState} aria-labelledby="empty-compare-title">
              <div className={styles.emptyIcon} aria-hidden="true"><Layers3 size={28} strokeWidth={1.5} /></div>
              <h2 id="empty-compare-title" className={styles.emptyTitle}>{t('tools.compare.empty_title')}</h2>
              <p className={styles.emptyText}>
                {t('tools.compare.empty_text', { max: maxItems })}
              </p>
              <Link href="/home/products" className={styles.buttonPrimary}>{t('tools.browse')}</Link>
            </section>
          ) : (
            <>
              <div className={styles.compareToolbar}>
                <div>
                  <strong>
                    {t('tools.compare.selected', { count: compareItems.length, max: maxItems })}
                  </strong>
                  <span className={styles.toolbarHint}>
                    {t('tools.compare.slots_hint', { max: maxItems })}
                  </span>
                </div>
                <div className={styles.toolbarActions}>
                  {isAtLimit ? (
                    <span className={styles.limitBadge}>
                      <Info size={14} aria-hidden="true" /> {t('tools.compare.limit_reached')}
                    </span>
                  ) : null}
                  <button type="button" className={styles.buttonQuiet} onClick={clearCompare} disabled={isPending}>
                    <Trash2 size={15} aria-hidden="true" />
                    <span>{t('tools.compare.clear_all')}</span>
                  </button>
                </div>
              </div>

              {isAtLimit ? (
                <div className={styles.alert} data-tone={isOverLimit ? 'error' : 'warning'} role="status">
                  <Info size={18} aria-hidden="true" />
                  <div>
                    <strong className={styles.alertTitle}>
                      {isOverLimit ? t('tools.compare.limit_over_title') : t('tools.compare.limit_title')}
                    </strong>
                    <p className={styles.alertText}>{limitMessage}</p>
                  </div>
                </div>
              ) : null}

              <div className={styles.tableWrap}>
                <table className={styles.compareTable}>
                  <caption className={styles.tableCaption}>{t('tools.compare.caption')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('tools.th_product')}</th>
                      {compareItems.map((item) => (
                        <th scope="col" key={itemKey(item)} className={styles.compareProductHeader}>
                          <div className={styles.compareProductHeaderTop}>
                            <Link href={productHref(item)} className={styles.productName}>{item.name}</Link>
                            <button
                              type="button"
                              className={styles.iconButton}
                              onClick={() => removeFromCompare(itemSelector(item))}
                              disabled={isPending}
                              aria-label={t('tools.compare.remove_aria', { name: item.name })}
                            >
                              <X size={16} aria-hidden="true" />
                            </button>
                          </div>
                          <Link href={productHref(item)} className={styles.compareImageLink}>
                            {canRenderImage(item.imageUrl) ? (
                              <Image
                                src={item.imageUrl}
                                alt=""
                                width={160}
                                height={176}
                                unoptimized
                                className={styles.compareImage}
                              />
                            ) : (
                              <span className={styles.imageFallback} aria-hidden="true" />
                            )}
                          </Link>
                          {item.variantId !== null ? (
                            <span className={styles.variantLabel}>
                              {t('tools.variant', { id: String(item.variantId) })}
                            </span>
                          ) : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">{t('tools.compare.th_sku')}</th>
                      {compareItems.map((item) => <td key={itemKey(item)}>{item.sku || '—'}</td>)}
                    </tr>
                    <tr>
                      <th scope="row">{t('tools.th_price')}</th>
                      {compareItems.map((item) => (
                        <td key={itemKey(item)}>
                          <div className={styles.priceStack}>
                            <strong>{formatMoney(item.price)}</strong>
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row">{t('tools.compare.th_stock')}</th>
                      {compareItems.map((item) => (
                        <td key={itemKey(item)}>
                          <span className={item.stockQuantity > 0 ? styles.stockGood : styles.stockMuted}>
                            {item.stockQuantity > 0
                              ? t('catalog.in_stock_count', { count: item.stockQuantity })
                              : t('catalog.out_of_stock')}
                          </span>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row">{t('catalog.add_to_cart')}</th>
                      {compareItems.map((item) => {
                        const inCart = cart.some(
                          (cartItem) => cartItem.productId === item.productId && cartItem.variantId === item.variantId,
                        );
                        return (
                          <td key={itemKey(item)} className={styles.compareActionCell}>
                            {item.stockQuantity <= 0 ? (
                              <Link href={productHref(item)} className={styles.buttonSecondary}>{t('tools.view_product')}</Link>
                            ) : item.variantId === null ? (
                              <Link href={productHref(item)} className={styles.buttonSecondary}>{t('tools.select_options')}</Link>
                            ) : (
                              <button
                                type="button"
                                className={styles.buttonSecondary}
                                onClick={() => handleAddToCart(item)}
                                disabled={isPending}
                              >
                                {inCart ? <Check size={15} aria-hidden="true" /> : <ShoppingBag size={15} aria-hidden="true" />}
                                <span>{inCart ? t('tools.add_another') : t('catalog.add_to_cart')}</span>
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <th scope="row">{t('tools.compare.th_description')}</th>
                      {compareItems.map((item) => (
                        <td key={itemKey(item)} className={styles.descriptionCell}>
                          {item.description || t('tools.compare.no_description')}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              {actionMessage ? <p className={styles.inlineMessage} aria-live="polite">{actionMessage}</p> : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
