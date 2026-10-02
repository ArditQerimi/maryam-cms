'use client';

import { useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Heart, Layers3 } from 'lucide-react';
import styles from '../bookstore.module.css';
import { useCart } from '@/context/CartContext';
import { useCompare } from '@/context/CompareContext';
import { useWishlist } from '@/context/WishlistContext';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import QuickViewModal, {
  canAddQvProduct,
  resolveQvVariant,
  type QvProduct,
} from './QuickViewModal';

export function ProductAddToCartButton({ product }: { product: QvProduct }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const variant = resolveQvVariant(product);
  const variantId = variant?.id ?? product.variantId ?? null;
  const price = variant?.price ?? product.price;
  const hasConcreteVariant = Number.isSafeInteger(variantId) && Number(variantId) > 0;
  const inStock = product.stockQuantity > 0;
  const canAdd = hasConcreteVariant && inStock && canAddQvProduct(product, variant);
  const needsVariantSelection = !hasConcreteVariant && inStock;

  return (
    <button
      type="button"
      className={styles.productAddBtn}
      onClick={() => {
        if (needsVariantSelection) {
          router.push(`/home/products/${product.id}`);
          return;
        }
        if (!canAdd || !hasConcreteVariant) return;
        addToCart({
          productId: product.id,
          variantId,
          quantity: 1,
          name: product.name,
          price,
          imageUrl: product.imageUrl,
        });
      }}
      disabled={!canAdd && !needsVariantSelection}
    >
      {needsVariantSelection ? 'Select options' : canAdd ? 'Add to cart' : 'Out of stock'}
    </button>
  );
}

export default function ProductActionBar({
  product,
  products,
  initialIndex,
}: {
  product: QvProduct;
  products?: QvProduct[];
  initialIndex?: number;
}) {
  const { t } = useLocale();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { addToCompare, removeFromCompare, isInCompare } = useCompare();
  const [quickView, setQuickView] = useState(false);
  const variant = resolveQvVariant(product);
  const variantId = variant?.id ?? product.variantId ?? null;
  const selector = { productId: product.id, variantId };
  const inWishlist = isInWishlist(selector);
  const inCompare = isInCompare(selector);
  const price = variant?.price ?? product.price;
  const commerceDisabled = !Number.isFinite(price) || price < 0;

  const stop = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    action();
  };

  const resolvedInitialIndex = initialIndex !== undefined
    ? initialIndex
    : products
      ? Math.max(0, products.findIndex((item) => item.id === product.id))
      : 0;

  return (
    <>
      <div className={styles.productQuick}>
        <button
          type="button"
          aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={inWishlist}
          data-active={inWishlist}
          disabled={commerceDisabled}
          onClick={(event) => stop(event, () => {
            if (inWishlist) {
              removeFromWishlist(selector);
            } else {
              addToWishlist({
                productId: product.id,
                variantId,
                name: product.name,
                price,
                imageUrl: product.imageUrl,
                stockQuantity: variant?.stockQuantity ?? product.stockQuantity,
              });
            }
          })}
        >
          <Heart
            size={21}
            strokeWidth={1.7}
            fill={inWishlist ? 'currentColor' : 'none'}
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          aria-label={inCompare ? 'Remove from comparison' : 'Add to comparison'}
          aria-pressed={inCompare}
          data-active={inCompare}
          disabled={commerceDisabled}
          onClick={(event) => stop(event, () => {
            if (inCompare) {
              removeFromCompare(selector);
            } else {
              addToCompare({
                productId: product.id,
                variantId,
                name: product.name,
                price,
                imageUrl: product.imageUrl,
                stockQuantity: variant?.stockQuantity ?? product.stockQuantity,
                description: product.description,
                categoryName: product.categoryName ?? null,
              });
            }
          })}
        >
          <Layers3 size={21} strokeWidth={1.7} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={t('catalog.quick_view_aria')}
          onClick={(event) => stop(event, () => setQuickView(true))}
        >
          <Eye size={21} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>

      {quickView ? (
        <QuickViewModal
          product={product}
          products={products}
          initialIndex={resolvedInitialIndex}
          onClose={() => setQuickView(false)}
        />
      ) : null}
    </>
  );
}
