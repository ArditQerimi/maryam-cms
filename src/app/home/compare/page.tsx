'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Check, Info, Layers3, ShoppingBag, Trash2, X } from 'lucide-react';
import styles from '../commerce-pages.module.css';
import { useCart } from '@/context/CartContext';
import { useCompare, type CompareItem, type CompareItemSelector } from '@/context/CompareContext';

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
  return `/shop/products/${encodeURIComponent(String(item.productId))}`;
}

function storageLabel(scope: string): string {
  if (scope === 'session') return 'Saved for this browser session only';
  if (scope === 'legacy-local') return 'Loaded from an older local save; changes are session-scoped when available';
  if (scope === 'memory') return 'Available for this tab only';
  if (scope === 'unavailable') return 'Browser storage unavailable';
  return 'Session comparison';
}

function canRenderImage(value: string): boolean {
  return value.startsWith('/') || value.startsWith('data:image/') || /^https?:\/\//i.test(value);
}

function LoadingState() {
  return (
    <div className={styles.loadingState} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.spinner} aria-hidden="true" />
      <strong>Loading your comparison…</strong>
      <span>Checking the current browser session.</span>
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
    maxItems,
    isAtLimit,
    isOverLimit,
    limitMessage,
    retryHydration,
  } = useCompare();
  const { cart, addToCart } = useCart();
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
            <span aria-current="page">Compare</span>
          </nav>
          <div className={styles.titleRow}>
            <div>
              <p className={styles.eyebrow}>Make a considered choice</p>
              <h1 className={styles.title}>Compare products</h1>
              <p className={styles.subtitle}>Compare up to {maxItems} products side by side.</p>
            </div>
            {!isHydrating && compareItems.length > 0 ? (
              <span className={styles.countPill} aria-label={`${compareItems.length} products in comparison`}>
                {compareItems.length} / {maxItems}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <section className={styles.content} aria-label="Product comparison">
        <div className={styles.container}>
          <div className={styles.statusBar} data-state={error ? 'error' : 'ready'}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span>
              {error ? 'Comparison needs attention' : storageLabel(storageScope)}
              {error ? '' : ' · no account or server sync is connected yet'}
            </span>
            {isPending && !isHydrating ? <span className={styles.statusBusy}>Saving…</span> : null}
          </div>

          {error ? (
            <div className={styles.alert} data-tone="error" role="alert">
              <div>
                <strong className={styles.alertTitle}>Comparison update needs attention</strong>
                <p className={styles.alertText}>{error}</p>
              </div>
              <button type="button" className={styles.buttonSecondary} onClick={retryHydration} disabled={isPending}>
                Try again
              </button>
            </div>
          ) : null}

          {isHydrating || !isHydrated ? (
            <LoadingState />
          ) : compareItems.length === 0 ? (
            <section className={styles.emptyState} aria-labelledby="empty-compare-title">
              <div className={styles.emptyIcon} aria-hidden="true"><Layers3 size={28} strokeWidth={1.5} /></div>
              <h2 id="empty-compare-title" className={styles.emptyTitle}>Nothing to compare yet</h2>
              <p className={styles.emptyText}>Add products with the compare action on a product card. You can compare up to {maxItems} at a time.</p>
              <Link href="/shop/products" className={styles.buttonPrimary}>Browse products</Link>
            </section>
          ) : (
            <>
              <div className={styles.compareToolbar}>
                <div>
                  <strong>{compareItems.length} of {maxItems} products selected</strong>
                  <span className={styles.toolbarHint}>The first {maxItems} slots stay yours until you remove an item.</span>
                </div>
                <div className={styles.toolbarActions}>
                  {isAtLimit ? (
                    <span className={styles.limitBadge}><Info size={14} aria-hidden="true" /> Limit reached</span>
                  ) : null}
                  <button type="button" className={styles.buttonQuiet} onClick={clearCompare} disabled={isPending}>
                    <Trash2 size={15} aria-hidden="true" />
                    <span>Clear all</span>
                  </button>
                </div>
              </div>

              {isAtLimit ? (
                <div className={styles.alert} data-tone={isOverLimit ? 'error' : 'warning'} role="status">
                  <Info size={18} aria-hidden="true" />
                  <div>
                    <strong className={styles.alertTitle}>{isOverLimit ? 'Saved comparison is over the limit' : 'Comparison limit reached'}</strong>
                    <p className={styles.alertText}>{limitMessage}</p>
                  </div>
                </div>
              ) : null}

              <div className={styles.tableWrap}>
                <table className={styles.compareTable}>
                  <caption className={styles.tableCaption}>Product details for this browser session</caption>
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      {compareItems.map((item) => (
                        <th scope="col" key={itemKey(item)} className={styles.compareProductHeader}>
                          <div className={styles.compareProductHeaderTop}>
                            <Link href={productHref(item)} className={styles.productName}>{item.name}</Link>
                            <button
                              type="button"
                              className={styles.iconButton}
                              onClick={() => removeFromCompare(itemSelector(item))}
                              disabled={isPending}
                              aria-label={`Remove ${item.name} from comparison`}
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
                          {item.variantId !== null ? <span className={styles.variantLabel}>Variant {String(item.variantId)}</span> : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">SKU</th>
                      {compareItems.map((item) => <td key={itemKey(item)}>{item.sku || '—'}</td>)}
                    </tr>
                    <tr>
                      <th scope="row">Price</th>
                      {compareItems.map((item) => (
                        <td key={itemKey(item)}>
                          <div className={styles.priceStack}>
                            <strong>{formatMoney(item.price)}</strong>
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row">Stock</th>
                      {compareItems.map((item) => (
                        <td key={itemKey(item)}>
                          <span className={item.stockQuantity > 0 ? styles.stockGood : styles.stockMuted}>
                            {item.stockQuantity > 0 ? `${item.stockQuantity} in stock` : 'Out of stock'}
                          </span>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row">Add to cart</th>
                      {compareItems.map((item) => {
                        const inCart = cart.some(
                          (cartItem) => cartItem.productId === item.productId && cartItem.variantId === item.variantId,
                        );
                        return (
                          <td key={itemKey(item)} className={styles.compareActionCell}>
                            {item.stockQuantity <= 0 ? (
                              <Link href={productHref(item)} className={styles.buttonSecondary}>View product</Link>
                            ) : item.variantId === null ? (
                              <Link href={productHref(item)} className={styles.buttonSecondary}>Select options</Link>
                            ) : (
                              <button
                                type="button"
                                className={styles.buttonSecondary}
                                onClick={() => handleAddToCart(item)}
                                disabled={isPending}
                              >
                                {inCart ? <Check size={15} aria-hidden="true" /> : <ShoppingBag size={15} aria-hidden="true" />}
                                <span>{inCart ? 'Add another' : 'Add to cart'}</span>
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <th scope="row">Description</th>
                      {compareItems.map((item) => (
                        <td key={itemKey(item)} className={styles.descriptionCell}>{item.description || 'No description provided.'}</td>
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
