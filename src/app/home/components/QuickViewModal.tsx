'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  ImageOff,
  Layers3,
  Minus,
  Plus,
  X,
} from 'lucide-react';
import styles from '../bookstore.module.css';
import { useCart } from '@/context/CartContext';
import { useCompare } from '@/context/CompareContext';
import { useWishlist } from '@/context/WishlistContext';

export type QvVariantOption = {
  attributeId: number;
  attributeName: string;
  valueId: number;
  value: string;
};

export type QvVariant = {
  id: number;
  name: string;
  sku: string;
  price: number;
  stockQuantity: number;
  options: QvVariantOption[];
};

export type QvProduct = {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
  galleryImages?: string[];
  images?: string[];
  stockQuantity: number;
  description: string;
  categoryName?: string;
  categoryId?: number | null;
  variantId?: number | null;
  defaultVariantId?: number | null;
  variants?: QvVariant[];
};

const priceFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPrice(value: number): string {
  return Number.isFinite(value) ? priceFormatter.format(value) : 'Price unavailable';
}

function imageCandidate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.username || parsed.password) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function uniqueImages(values: readonly unknown[]): string[] {
  const images: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const candidate = imageCandidate(value);
    if (candidate && !seen.has(candidate)) {
      seen.add(candidate);
      images.push(candidate);
    }
  }
  return images;
}

function productImages(product: QvProduct): string[] {
  const direct = uniqueImages([
    ...(product.galleryImages ?? []),
    ...(product.images ?? []),
  ]);
  if (direct.length > 0) return direct;

  const raw = product.imageUrl?.trim();
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const values = Array.isArray(parsed) ? parsed : [parsed];
    const parsedImages = uniqueImages(values.map((value) => {
      if (typeof value === 'string') return value;
      if (!value || typeof value !== 'object') return null;
      const item = value as { src?: unknown; url?: unknown; secure_url?: unknown };
      return item.src ?? item.url ?? item.secure_url;
    }));
    return parsedImages;
  } catch {
    const image = imageCandidate(raw);
    return image ? [image] : [];
  }
}

export function resolveQvVariant(
  product: QvProduct,
  preferredVariantId?: number | null,
): QvVariant | null {
  const variants = product.variants ?? [];
  const requestedId = preferredVariantId ?? product.variantId ?? product.defaultVariantId;
  if (requestedId != null) {
    const requested = variants.find((variant) => variant.id === requestedId);
    if (requested) return requested;
  }
  return variants.length === 1 ? variants[0] : null;
}

export function canAddQvProduct(product: QvProduct, variant: QvVariant | null): boolean {
  const unitPrice = variant?.price ?? product.price;
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return false;
  if ((product.variants?.length ?? 0) > 0) {
    return variant !== null && variant.stockQuantity > 0;
  }
  return product.stockQuantity > 0;
}

function variantLabel(variant: QvVariant): string {
  const options = variant.options
    .map((option) => `${option.attributeName}: ${option.value}`)
    .join(', ');
  const details = options || variant.sku;
  return details
    ? `${variant.name} — ${details} — ${formatPrice(variant.price)}`
    : `${variant.name} — ${formatPrice(variant.price)}`;
}

function Modal({
  product,
  products,
  initialIndex,
  onClose,
}: {
  product: QvProduct;
  products: QvProduct[];
  initialIndex: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { addToCompare, removeFromCompare, isInCompare } = useCompare();
  const carouselProducts = useMemo(
    () => products.length > 0 ? products : [product],
    [product, products],
  );
  const boundedInitialIndex = Math.min(Math.max(initialIndex, 0), carouselProducts.length - 1);
  const [activeIndex, setActiveIndex] = useState(boundedInitialIndex);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(() =>
    resolveQvVariant(product)?.id ?? null,
  );
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');

  const activeProduct = carouselProducts[activeIndex] ?? product;
  const images = productImages(activeProduct);
  const activeVariant = resolveQvVariant(activeProduct, selectedVariantId);
  const hasVariants = (activeProduct.variants?.length ?? 0) > 0;
  const availability = activeVariant?.stockQuantity ?? (hasVariants ? 0 : activeProduct.stockQuantity);
  const maximumQuantity = Math.max(1, availability);
  const boundedQuantity = Math.min(quantity, maximumQuantity);
  const selectedPrice = activeVariant?.price ?? activeProduct.price;
  const explicitVariantId = activeVariant?.id
    ?? activeProduct.variantId
    ?? activeProduct.defaultVariantId
    ?? null;
  const variantId = Number.isSafeInteger(explicitVariantId) && Number(explicitVariantId) > 0
    ? explicitVariantId
    : null;
  const canAdd = variantId !== null && canAddQvProduct(activeProduct, activeVariant);
  const needsVariantSelection = variantId === null && availability > 0;
  const selector = { productId: activeProduct.id, variantId };
  const inWishlist = isInWishlist(selector);
  const inCompare = isInCompare(selector);
  const canUseCommerce = Number.isFinite(selectedPrice) && selectedPrice >= 0;
  const canCarousel = carouselProducts.length > 1;
  const canCarouselImages = images.length > 1;
  const boundedImageIndex = Math.min(activeImageIndex, Math.max(0, images.length - 1));
  const activeImage = images[boundedImageIndex]
    ?? images[0]
    ?? imageCandidate(activeProduct.imageUrl)
    ?? '';

  const showProduct = useCallback((requestedIndex: number) => {
    const nextIndex = Math.min(
      Math.max(requestedIndex, 0),
      carouselProducts.length - 1,
    );
    const nextProduct = carouselProducts[nextIndex] ?? product;
    setActiveIndex(nextIndex);
    setSelectedVariantId(resolveQvVariant(nextProduct)?.id ?? null);
    setActiveImageIndex(0);
    setQuantity(1);
    setMessage('');
  }, [carouselProducts, product]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && canCarousel) {
        showProduct((activeIndex - 1 + carouselProducts.length) % carouselProducts.length);
      }
      if (event.key === 'ArrowRight' && canCarousel) {
        showProduct((activeIndex + 1) % carouselProducts.length);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.addEventListener('keydown', closeOnEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeIndex, canCarousel, carouselProducts.length, onClose, showProduct]);

  const addToCartFromModal = () => {
    if (!canAdd || !canUseCommerce) return;
    const result = addToCart({
      productId: activeProduct.id,
      variantId,
      quantity: boundedQuantity,
      name: activeProduct.name,
      price: selectedPrice,
      imageUrl: activeProduct.imageUrl,
    });
    if (result.ok) {
      onClose();
      return;
    }
    setMessage(result.message || 'The item could not be added to your cart.');
  };

  return (
    <div className={styles.qvOverlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={`Quick view: ${activeProduct.name}`}>
      {canCarousel ? (
        <>
          <button
            type="button"
            className={`${styles.qvProductNav} ${styles.qvProductNavPrev}`}
            aria-label="Previous product"
            onClick={(event) => {
              event.stopPropagation();
              showProduct((activeIndex - 1 + carouselProducts.length) % carouselProducts.length);
            }}
          >
            <ArrowLeft size={28} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${styles.qvProductNav} ${styles.qvProductNavNext}`}
            aria-label="Next product"
            onClick={(event) => {
              event.stopPropagation();
              showProduct((activeIndex + 1) % carouselProducts.length);
            }}
          >
            <ArrowRight size={28} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </>
      ) : null}

      <div className={styles.qvModal} onClick={(event) => event.stopPropagation()}>
        <button type="button" className={styles.qvClose} aria-label="Close quick view" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>

        <div className={styles.qvImageWrap}>
          {canCarouselImages ? (
            <button
              type="button"
              className={`${styles.qvImageNav} ${styles.qvImageNavPrev}`}
              aria-label="Previous image"
              onClick={() => setActiveImageIndex((boundedImageIndex - 1 + images.length) % images.length)}
            >
              <ChevronLeft size={30} aria-hidden="true" />
            </button>
          ) : null}

          {activeImage ? (
            <Image
              key={activeImage}
              src={activeImage}
              alt={activeProduct.name}
              fill
              unoptimized
              sizes="(max-width: 760px) 94vw, 46vw"
              className={styles.qvImage}
            />
          ) : (
            <div
              role="img"
              aria-label="Product image unavailable"
              style={{
                display: 'flex',
                width: '100%',
                height: '100%',
                flexDirection: 'column',
                gap: '0.75rem',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--muted)',
                fontSize: '0.8rem',
              }}
            >
              <ImageOff size={36} aria-hidden="true" />
              <span>Image unavailable</span>
            </div>
          )}

          {canCarouselImages ? (
            <button
              type="button"
              className={`${styles.qvImageNav} ${styles.qvImageNavNext}`}
              aria-label="Next image"
              onClick={() => setActiveImageIndex((boundedImageIndex + 1) % images.length)}
            >
              <ChevronRight size={30} aria-hidden="true" />
            </button>
          ) : null}

          {canCarouselImages ? (
            <div className={styles.qvDots} aria-label="Choose product image">
              {images.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  className={styles.qvDot}
                  data-active={index === boundedImageIndex}
                  aria-label={`Show image ${index + 1}`}
                  aria-pressed={index === boundedImageIndex}
                  onClick={() => setActiveImageIndex(index)}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className={styles.qvInfo}>
          {activeProduct.categoryName ? <span className={styles.pdCategoryLabel}>{activeProduct.categoryName}</span> : null}
          <h2 className={styles.qvTitle}>{activeProduct.name}</h2>
          <div className={styles.qvCurrentPrice}>{formatPrice(selectedPrice)}</div>
          {activeProduct.description ? <p className={styles.qvDescription}>{activeProduct.description}</p> : null}

          {hasVariants ? (
            <label className={styles.pdOptionRow}>
              <span className={styles.pdOptionLabel}>Variant</span>
              <select
                className={styles.pdSelect}
                value={selectedVariantId ?? ''}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setSelectedVariantId(value || null);
                  setQuantity(1);
                  setMessage('');
                }}
              >
                {activeVariant == null ? (
                  <option value="">Choose an option</option>
                ) : null}
                {activeProduct.variants?.map((variant) => (
                  <option value={variant.id} key={variant.id} disabled={variant.stockQuantity === 0}>
                    {variantLabel(variant)} — {variant.stockQuantity > 0 ? `${variant.stockQuantity} available` : 'Out of stock'}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {activeVariant?.sku ? <p className={styles.pdStock}>SKU {activeVariant.sku}</p> : null}
          <p className={styles.pdStock} data-in={availability > 0}>
            {availability > 0 ? `${availability} in stock` : 'Out of stock'}
          </p>

          <div className={styles.qvActions}>
            <div className={styles.pdQtyStepper}>
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={!canAdd || boundedQuantity <= 1}
                onClick={() => setQuantity(Math.max(1, boundedQuantity - 1))}
              >
                <Minus size={14} aria-hidden="true" />
              </button>
              <input
                type="number"
                min={1}
                max={Math.max(1, availability)}
                value={boundedQuantity}
                disabled={!canAdd}
                aria-label="Quantity"
                onChange={(event) => {
                  const requested = Number(event.target.value);
                  const normalized = Number.isFinite(requested) ? Math.trunc(requested) : 1;
                  setQuantity(Math.min(Math.max(1, normalized), Math.max(1, availability)));
                }}
              />
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={!canAdd || boundedQuantity >= availability}
                onClick={() => setQuantity(Math.min(availability, boundedQuantity + 1))}
              >
                <Plus size={14} aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              className={styles.qvAddBtn}
              disabled={!canAdd && !needsVariantSelection}
              onClick={() => {
                if (needsVariantSelection) {
                  router.push(`/shop/products/${activeProduct.id}`);
                  return;
                }
                addToCartFromModal();
              }}
            >
              {needsVariantSelection ? 'Select options' : canAdd ? 'Add to cart' : 'Out of stock'}
            </button>
            <button
              type="button"
              className={styles.qvIconBtn}
              data-active={inWishlist}
              aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
              aria-pressed={inWishlist}
              disabled={!canUseCommerce}
              onClick={() => {
                if (!canUseCommerce) return;
                if (inWishlist) {
                  removeFromWishlist(selector);
                } else {
                  addToWishlist({
                    productId: activeProduct.id,
                    variantId,
                    name: activeProduct.name,
                    price: selectedPrice,
                    imageUrl: activeProduct.imageUrl,
                    stockQuantity: availability,
                  });
                }
              }}
            >
              <Heart size={25} fill={inWishlist ? 'currentColor' : 'none'} strokeWidth={1.7} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.qvIconBtn}
              data-active={inCompare}
              aria-label={inCompare ? 'Remove from comparison' : 'Add to comparison'}
              aria-pressed={inCompare}
              disabled={!canUseCommerce}
              onClick={() => {
                if (!canUseCommerce) return;
                if (inCompare) {
                  removeFromCompare(selector);
                } else {
                  addToCompare({
                    productId: activeProduct.id,
                    variantId,
                    name: activeProduct.name,
                    price: selectedPrice,
                    imageUrl: activeProduct.imageUrl,
                    stockQuantity: availability,
                    description: activeProduct.description,
                    categoryName: activeProduct.categoryName ?? null,
                  });
                }
              }}
            >
              <Layers3 size={25} strokeWidth={1.7} aria-hidden="true" />
            </button>
          </div>
          <p className={styles.pdStock} role="status" aria-live="polite">{message}</p>

          {activeProduct.categoryId && activeProduct.categoryName ? (
            <p className={styles.qvCategories}>
              Category:{' '}
              <Link href={`/shop/products?category=${activeProduct.categoryId}`}>
                {activeProduct.categoryName}
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const subscribeToClient = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function QuickViewModal({
  product,
  products = [product],
  initialIndex = 0,
  onClose,
}: {
  product: QvProduct;
  products?: QvProduct[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const mounted = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot,
  );

  if (!mounted) return null;
  return createPortal(
    <Modal product={product} products={products} initialIndex={initialIndex} onClose={onClose} />,
    document.body,
  );
}
