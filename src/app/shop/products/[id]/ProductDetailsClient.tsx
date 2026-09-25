'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Heart,
  ImageOff,
  Layers3,
  Minus,
  Plus,
  X,
  ZoomIn,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useCompare } from '@/context/CompareContext';
import { useWishlist } from '@/context/WishlistContext';
import ProductReviews, { type ProductReviewsData } from './ProductReviews';
import styles from './product-details.module.css';

export type DetailVariantOption = {
  attributeId: number;
  attributeName: string;
  valueId: number;
  value: string;
};

export type DetailVariant = {
  id: number;
  name: string;
  sku: string;
  /** Effective (possibly discounted) price of this variant. */
  price: number;
  /** Original list price when a discount applies, otherwise `null`. */
  compareAtPrice: number | null;
  stockQuantity: number;
  options: DetailVariantOption[];
};

export type DetailProduct = {
  id: number;
  name: string;
  sku: string;
  description: string;
  /** Effective (possibly discounted) price, or `null` when unknown. */
  price: number | null;
  /** Original list price when a discount applies, otherwise `null`. */
  compareAtPrice: number | null;
  imageUrl: string;
  galleryImages: string[];
  stockQuantity: number;
  stockSource: 'variant' | 'parent';
  categoryId: number | null;
  categoryName: string;
  brandId: number | null;
  brandName: string;
  variants: DetailVariant[];
  defaultVariantId: number | null;
};

export type RelatedProduct = {
  id: number;
  name: string;
  sku: string;
  description: string;
  /** Effective (possibly discounted) price, or `null` when unknown. */
  price: number | null;
  /** Original list price when a discount applies, otherwise `null`. */
  compareAtPrice: number | null;
  imageUrl: string;
  stockQuantity: number;
  stockSource: 'variant' | 'parent';
  categoryId: number | null;
  categoryName: string;
  brandId: number | null;
  brandName: string;
  variantId: number | null;
  defaultVariantId: number | null;
  variants: DetailVariant[];
};

type OptionGroup = {
  attributeId: number;
  name: string;
  values: Array<{ valueId: number; value: string }>;
};

export type ProductDetailTab = 'description' | 'details' | 'reviews';

const priceFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPrice(value: number | null): string {
  return value === null ? 'Price unavailable' : priceFormatter.format(value);
}

/**
 * Sale price followed by the struck-through original whenever a product or
 * category discount lowered it.
 */
function PriceWithCompareAt({
  price,
  compareAtPrice,
  className,
}: {
  price: number | null;
  compareAtPrice: number | null;
  className?: string;
}) {
  const showCompareAt =
    price !== null && compareAtPrice !== null && compareAtPrice > price;

  return (
    <span className={className}>
      <span>{formatPrice(price)}</span>
      {showCompareAt ? (
        <s className={styles.oldPrice} aria-label="Original price">
          {formatPrice(compareAtPrice)}
        </s>
      ) : null}
    </span>
  );
}

function buildOptionGroups(variants: readonly DetailVariant[]): OptionGroup[] {
  const groups = new Map<number, { name: string; values: Map<number, string> }>();

  for (const variant of variants) {
    for (const option of variant.options) {
      const group = groups.get(option.attributeId) ?? {
        name: option.attributeName,
        values: new Map<number, string>(),
      };
      group.values.set(option.valueId, option.value);
      groups.set(option.attributeId, group);
    }
  }

  return Array.from(groups.entries())
    .map(([attributeId, group]) => ({
      attributeId,
      name: group.name,
      values: Array.from(group.values.entries())
        .map(([valueId, value]) => ({ valueId, value }))
        .sort((left, right) =>
          left.value.localeCompare(right.value, undefined, { sensitivity: 'base', numeric: true }),
        ),
    }))
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
    );
}

function selectionsForVariant(
  groups: readonly OptionGroup[],
  variant: DetailVariant,
): Record<number, number> {
  const selections: Record<number, number> = {};
  for (const group of groups) {
    const option = variant.options.find(
      (candidate) => candidate.attributeId === group.attributeId,
    );
    if (option) selections[group.attributeId] = option.valueId;
  }
  return selections;
}

function preferredVariant(
  product: DetailProduct,
  hasOptionGroups: boolean,
): DetailVariant | null {
  if (product.defaultVariantId != null) {
    const defaultVariant = product.variants.find(
      (variant) => variant.id === product.defaultVariantId,
    );
    if (defaultVariant) return defaultVariant;
  }
  if (product.variants.length === 1) return product.variants[0];
  if (!hasOptionGroups) return null;
  return product.variants.find((variant) => variant.stockQuantity > 0)
    ?? product.variants[0]
    ?? null;
}

function variantMatchesSelections(
  variant: DetailVariant,
  selections: Record<number, number>,
  groups: readonly OptionGroup[],
): boolean {
  return groups.every((group) => {
    const selectedValueId = selections[group.attributeId];
    if (selectedValueId === undefined) return true;
    return variant.options.some(
      (option) =>
        option.attributeId === group.attributeId
        && option.valueId === selectedValueId,
    );
  });
}

function RelatedActions({ product }: { product: RelatedProduct }) {
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { addToCompare, removeFromCompare, isInCompare } = useCompare();
  const variantId = product.variantId;
  const selector = { productId: product.id, variantId };
  const inWishlist = isInWishlist(selector);
  const inCompare = isInCompare(selector);
  const commerceDisabled = product.price === null;

  const wishlistPayload = {
    productId: product.id,
    variantId,
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
    stockQuantity: product.stockQuantity,
  };

  return (
    <div className={styles.relatedActions}>
      <button
        type="button"
        aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
        aria-pressed={inWishlist}
        data-active={inWishlist}
        disabled={commerceDisabled}
        onClick={() => {
          if (inWishlist) removeFromWishlist(selector);
          else if (product.price !== null) {
            addToWishlist({ ...wishlistPayload, price: product.price });
          }
        }}
      >
        <Heart size={17} fill={inWishlist ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={inCompare ? 'Remove from comparison' : 'Add to comparison'}
        aria-pressed={inCompare}
        data-active={inCompare}
        disabled={commerceDisabled}
        onClick={() => {
          if (inCompare) {
            removeFromCompare(selector);
          } else if (product.price !== null) {
            addToCompare({
              productId: product.id,
              variantId,
              name: product.name,
              price: product.price,
              imageUrl: product.imageUrl,
              stockQuantity: product.stockQuantity,
              description: product.description,
              sku: product.sku || null,
              categoryName: product.categoryName || null,
            });
          }
        }}
      >
        <Layers3 size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

export default function ProductDetailsClient({
  product,
  related,
  reviews,
  initialTab = 'description',
}: {
  product: DetailProduct;
  related: RelatedProduct[];
  reviews?: ProductReviewsData;
  initialTab?: ProductDetailTab;
}) {
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { addToCompare, removeFromCompare, isInCompare } = useCompare();
  const optionGroups = useMemo(() => buildOptionGroups(product.variants), [product.variants]);
  const initialVariant = useMemo(
    () => preferredVariant(product, optionGroups.length > 0),
    [optionGroups.length, product],
  );

  const [optionSelections, setOptionSelections] = useState<Record<number, number>>(() =>
    initialVariant ? selectionsForVariant(optionGroups, initialVariant) : {},
  );
  const [explicitVariantId, setExplicitVariantId] = useState<number | null>(
    () => initialVariant?.id ?? null,
  );
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const [zoomOpen, setZoomOpen] = useState(false);
  const [tab, setTab] = useState<ProductDetailTab>(initialTab);
  const [actionMessage, setActionMessage] = useState('');

  const selectedVariant = useMemo(() => {
    if (optionGroups.length === 0) {
      return product.variants.find((variant) => variant.id === explicitVariantId) ?? null;
    }

    const matching = product.variants.filter((variant) =>
      variantMatchesSelections(variant, optionSelections, optionGroups),
    );
    return matching.find((variant) => variant.stockQuantity > 0) ?? matching[0] ?? null;
  }, [explicitVariantId, optionGroups, optionSelections, product.variants]);

  const selectedAvailability = selectedVariant?.stockQuantity ?? 0;
  const maximumQuantity = Math.max(1, selectedAvailability);
  const boundedQuantity = Math.min(quantity, maximumQuantity);
  const selectedPrice = selectedVariant?.price ?? product.price;
  const selectedCompareAtPrice = selectedVariant
    ? selectedVariant.compareAtPrice
    : product.compareAtPrice;
  const hasSelectedVariant = selectedVariant !== null;
  const canAddToCart = hasSelectedVariant && selectedAvailability > 0 && selectedPrice !== null;
  const variantId = selectedVariant?.id ?? null;
  const commerceSelector = { productId: product.id, variantId };
  const inWishlist = isInWishlist(commerceSelector);
  const inCompare = isInCompare(commerceSelector);

  useEffect(() => {
    if (!zoomOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoomOpen(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [zoomOpen]);

  const requestedImage = product.galleryImages[activeImageIndex] ?? product.imageUrl;
  const resolvedImageIndex = requestedImage && !failedImages.has(requestedImage)
    ? activeImageIndex
    : product.galleryImages.findIndex((image) => !failedImages.has(image));
  const availableImage = resolvedImageIndex >= 0
    ? product.galleryImages[resolvedImageIndex]
    : requestedImage && !failedImages.has(requestedImage)
      ? requestedImage
      : '';

  const markImageFailed = (image: string) => {
    setFailedImages((current) => {
      if (current.has(image)) return current;
      const next = new Set(current);
      next.add(image);
      return next;
    });
  };

  const isOptionAvailable = (attributeId: number, valueId: number): boolean => {
    const hypothetical = { ...optionSelections, [attributeId]: valueId };
    return product.variants.some(
      (variant) =>
        variant.stockQuantity > 0
        && variantMatchesSelections(variant, hypothetical, optionGroups),
    );
  };

  const chooseOption = (attributeId: number, valueId: number) => {
    const hypothetical = { ...optionSelections, [attributeId]: valueId };
    const candidate = product.variants.find(
      (variant) =>
        variant.stockQuantity > 0
        && variantMatchesSelections(variant, hypothetical, optionGroups),
    );
    if (!candidate) return;
    setOptionSelections(selectionsForVariant(optionGroups, candidate));
    setQuantity(1);
    setActionMessage('');
  };

  const updateQuantity = (requested: number) => {
    const normalized = Number.isFinite(requested) ? Math.trunc(requested) : 1;
    setQuantity(Math.min(Math.max(1, normalized), Math.max(1, selectedAvailability)));
    setActionMessage('');
  };

  const addSelectedVariant = () => {
    if (!canAddToCart || !selectedVariant || selectedPrice === null) return;
    const result = addToCart({
      productId: product.id,
      variantId: selectedVariant.id,
      quantity: boundedQuantity,
      name: product.name,
      price: selectedPrice,
      imageUrl: product.imageUrl,
    });
    setActionMessage(result.ok ? `${product.name} was added to your cart.` : result.message || 'The item could not be added.');
  };

  const toggleWishlist = () => {
    if (selectedPrice === null) return;
    if (inWishlist) {
      const result = removeFromWishlist(commerceSelector);
      setActionMessage(result.message || 'Removed from your wishlist.');
      return;
    }
    const result = addToWishlist({
      productId: product.id,
      variantId,
      name: product.name,
      price: selectedPrice,
      imageUrl: product.imageUrl,
      stockQuantity: selectedAvailability,
    });
    setActionMessage(result.message || 'Saved to your wishlist.');
  };

  const toggleCompare = () => {
    if (selectedPrice === null) return;
    if (inCompare) {
      const result = removeFromCompare(commerceSelector);
      setActionMessage(result.message || 'Removed from your comparison.');
      return;
    }
    const result = addToCompare({
      productId: product.id,
      variantId,
      name: product.name,
      price: selectedPrice,
      imageUrl: product.imageUrl,
      stockQuantity: selectedAvailability,
      description: product.description,
      sku: selectedVariant?.sku || product.sku || null,
      categoryName: product.categoryName || null,
    });
    setActionMessage(result.message || 'Added to your comparison.');
  };

  const reviewCount = reviews?.summary?.approvedCount
    ?? reviews?.pagination?.totalItems
    ?? reviews?.reviews?.length
    ?? 0;
  const reviewTabLabel = reviewCount > 0 ? `Reviews (${reviewCount})` : 'Reviews';
  const selectedOptions = selectedVariant?.options ?? [];
  const canUseCommerce = selectedPrice !== null;

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/shop">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/shop/products">Shop</Link>
        {product.categoryId && product.categoryName ? (
          <>
            <span aria-hidden="true">/</span>
            <Link href={`/shop/products?category=${product.categoryId}`}>{product.categoryName}</Link>
          </>
        ) : null}
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <section className={styles.productHero} aria-labelledby="product-title">
        <div className={styles.productGallery}>
          <div className={styles.mainImageFrame}>
            {availableImage ? (
              <Image
                key={availableImage}
                src={availableImage}
                alt={`${product.name}${resolvedImageIndex >= 0 && product.galleryImages.length > 1 ? `, image ${resolvedImageIndex + 1}` : ''}`}
                fill
                unoptimized
                priority
                sizes="(max-width: 820px) 94vw, 52vw"
                className={styles.mainImage}
                onError={() => markImageFailed(availableImage)}
              />
            ) : (
              <div className={styles.imageFallback} role="img" aria-label="Product image unavailable">
                <ImageOff size={42} strokeWidth={1.25} aria-hidden="true" />
                <span>Image unavailable</span>
              </div>
            )}
            {availableImage ? (
              <button
                type="button"
                className={styles.zoomButton}
                aria-label="Enlarge product image"
                onClick={() => setZoomOpen(true)}
              >
                <ZoomIn size={18} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {product.galleryImages.length > 1 ? (
            <div className={styles.thumbnailList} aria-label="Product gallery">
              <button
                type="button"
                className={styles.galleryArrow}
                aria-label="Previous image"
                disabled={resolvedImageIndex <= 0}
                onClick={() => setActiveImageIndex((index) => Math.max(0, index - 1))}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <div className={styles.thumbnailTrack}>
                {product.galleryImages.map((image, index) => (
                  <button
                    type="button"
                    className={styles.thumbnail}
                    data-active={index === resolvedImageIndex}
                    data-broken={failedImages.has(image)}
                    key={image}
                    aria-label={`Show product image ${index + 1}`}
                    aria-pressed={index === resolvedImageIndex}
                    onClick={() => setActiveImageIndex(index)}
                  >
                    <Image
                      src={image}
                      alt=""
                      fill
                      unoptimized
                      sizes="82px"
                      onError={() => markImageFailed(image)}
                    />
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.galleryArrow}
                aria-label="Next image"
                disabled={resolvedImageIndex >= product.galleryImages.length - 1}
                onClick={() => setActiveImageIndex((index) =>
                  Math.min(product.galleryImages.length - 1, index + 1),
                )}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>

        <div className={styles.productInfo}>
          <div className={styles.productEyebrows}>
            {product.categoryName ? <span>{product.categoryName}</span> : null}
            {product.brandName ? <span>{product.brandName}</span> : null}
          </div>
          <h1 id="product-title">{product.name}</h1>
          {product.sku ? <p className={styles.sku}>SKU {product.sku}</p> : null}
          <p className={styles.price}>
            <PriceWithCompareAt
              price={selectedPrice}
              compareAtPrice={selectedCompareAtPrice}
            />
          </p>
          <p className={styles.description}>
            {product.description || 'No product description has been provided.'}
          </p>

          {optionGroups.length > 0 ? (
            <div className={styles.optionGroups}>
              {optionGroups.map((group) => (
                <fieldset className={styles.optionGroup} key={group.attributeId}>
                  <legend>{group.name}</legend>
                  <div className={styles.optionValues}>
                    {group.values.map((option) => {
                      const available = isOptionAvailable(group.attributeId, option.valueId);
                      const selected = optionSelections[group.attributeId] === option.valueId;
                      return (
                        <button
                          type="button"
                          key={option.valueId}
                          data-active={selected}
                          data-unavailable={!available}
                          aria-pressed={selected}
                          disabled={!available}
                          onClick={() => chooseOption(group.attributeId, option.valueId)}
                        >
                          <span>{option.value}</span>
                          {!available ? <small>Unavailable</small> : null}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          ) : product.variants.length > 1 ? (
            <label className={styles.variantSelect}>
              <span>Variant</span>
              <select
                value={explicitVariantId ?? ''}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setExplicitVariantId(value || null);
                  setQuantity(1);
                  setActionMessage('');
                }}
              >
                <option value="">Choose a variant</option>
                {product.variants.map((variant) => (
                  <option value={variant.id} key={variant.id} disabled={variant.stockQuantity === 0}>
                    {variant.name} — {formatPrice(variant.price)}{variant.compareAtPrice !== null && variant.compareAtPrice > variant.price ? ` (was ${formatPrice(variant.compareAtPrice)})` : ''} — {variant.stockQuantity > 0 ? `${variant.stockQuantity} available` : 'Out of stock'}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {selectedVariant ? (
            <div className={styles.selectedVariant}>
              <div>
                <span>Selected variant</span>
                <strong>{selectedVariant.name}</strong>
              </div>
              {product.defaultVariantId === selectedVariant.id ? (
                <span className={styles.defaultVariantBadge}>Default variant</span>
              ) : null}
              {selectedVariant.sku && selectedVariant.sku !== product.sku ? (
                <div>
                  <span>Variant SKU</span>
                  <strong>{selectedVariant.sku}</strong>
                </div>
              ) : null}
            </div>
          ) : (
            <div className={styles.variantUnavailable} role="status">
              <strong>No purchasable variant is currently available.</strong>
              <span>A concrete active variant is required before this product can be added to a cart.</span>
            </div>
          )}

          <div
            className={styles.stockSummary}
            data-in-stock={product.variants.length > 0 && product.stockQuantity > 0}
          >
            <CheckCircle2 size={17} aria-hidden="true" />
            <div>
              <strong>
                {product.variants.length === 0
                  ? 'Unavailable: no active variant'
                  : product.stockQuantity > 0
                    ? `${product.stockQuantity} available across active variants`
                    : 'Out of stock'}
              </strong>
              <span>
                {selectedVariant
                  ? `${selectedAvailability} available for the selected variant`
                  : 'No active variant is available for purchase'}
              </span>
            </div>
          </div>

          <div className={styles.purchaseRow}>
            <div className={styles.quantityStepper}>
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={!canAddToCart || boundedQuantity <= 1}
                onClick={() => updateQuantity(quantity - 1)}
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <input
                type="number"
                min={1}
                max={Math.max(1, selectedAvailability)}
                value={boundedQuantity}
                disabled={!canAddToCart}
                aria-label="Quantity"
                onChange={(event) => updateQuantity(Number(event.target.value))}
              />
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={!canAddToCart || boundedQuantity >= selectedAvailability}
                onClick={() => updateQuantity(quantity + 1)}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              className={styles.addToCartButton}
              disabled={!canAddToCart}
              onClick={addSelectedVariant}
            >
              {selectedVariant?.stockQuantity === 0
                ? 'Out of stock'
                : hasSelectedVariant
                  ? 'Add to cart'
                  : 'Unavailable'}
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
              aria-pressed={inWishlist}
              data-active={inWishlist}
              disabled={!canUseCommerce}
              onClick={toggleWishlist}
            >
              <Heart size={20} fill={inWishlist ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={inCompare ? 'Remove from comparison' : 'Add to comparison'}
              aria-pressed={inCompare}
              data-active={inCompare}
              disabled={!canUseCommerce}
              onClick={toggleCompare}
            >
              <Layers3 size={20} aria-hidden="true" />
            </button>
          </div>
          <p className={styles.actionMessage} role="status" aria-live="polite">
            {actionMessage}
          </p>
        </div>
      </section>

      <section className={styles.productTabs}>
        <div className={styles.tabList} role="tablist" aria-label="Product information">
          <button
            type="button"
            role="tab"
            id="description-tab"
            aria-controls="description-panel"
            aria-selected={tab === 'description'}
            data-active={tab === 'description'}
            onClick={() => setTab('description')}
          >
            Description
          </button>
          <button
            type="button"
            role="tab"
            id="details-tab"
            aria-controls="details-panel"
            aria-selected={tab === 'details'}
            data-active={tab === 'details'}
            onClick={() => setTab('details')}
          >
            Product details
          </button>
          <button
            type="button"
            role="tab"
            id="reviews-tab"
            aria-controls="reviews-panel"
            aria-selected={tab === 'reviews'}
            data-active={tab === 'reviews'}
            onClick={() => setTab('reviews')}
          >
            {reviewTabLabel}
          </button>
        </div>

        {tab === 'description' ? (
          <div
            className={styles.tabPanel}
            id="description-panel"
            role="tabpanel"
            aria-labelledby="description-tab"
          >
            <span className={styles.sectionEyebrow}>About this product</span>
            <h2>Description</h2>
            <p className={styles.longDescription}>
              {product.description || 'No product description has been provided.'}
            </p>
          </div>
        ) : null}

        {tab === 'details' ? (
          <div
            className={styles.tabPanel}
            id="details-panel"
            role="tabpanel"
            aria-labelledby="details-tab"
          >
            <span className={styles.sectionEyebrow}>Catalog information</span>
            <h2>Product details</h2>
            <dl className={styles.detailsList}>
              <div><dt>Product SKU</dt><dd>{product.sku || 'Not provided'}</dd></div>
              <div><dt>Category</dt><dd>{product.categoryName || 'Not assigned'}</dd></div>
              <div><dt>Brand</dt><dd>{product.brandName || 'Not assigned'}</dd></div>
              <div>
                <dt>Base price</dt>
                <dd>
                  <PriceWithCompareAt
                    price={product.price}
                    compareAtPrice={product.compareAtPrice}
                  />
                </dd>
              </div>
              <div><dt>Active variants</dt><dd>{product.variants.length}</dd></div>
              <div>
                <dt>Stock source</dt>
                <dd>{product.stockSource === 'variant' ? 'Variant stock rows' : 'Parent product stock'}</dd>
              </div>
              <div><dt>Total availability</dt><dd>{product.stockQuantity}</dd></div>
              {selectedOptions.length > 0 ? (
                <div>
                  <dt>Selected options</dt>
                  <dd>{selectedOptions.map((option) => `${option.attributeName}: ${option.value}`).join(', ')}</dd>
                </div>
              ) : null}
              {selectedVariant ? (
                <div>
                  <dt>Selected variant</dt>
                  <dd>
                    {selectedVariant.name}
                    {selectedVariant.sku ? ` (${selectedVariant.sku})` : ''}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}

        {tab === 'reviews' ? (
          <div
            className={styles.tabPanel}
            id="reviews-panel"
            role="tabpanel"
            aria-labelledby="reviews-tab"
          >
            <ProductReviews productId={product.id} data={reviews} />
          </div>
        ) : null}
      </section>

      {related.length > 0 ? (
        <section className={styles.relatedSection} aria-labelledby="related-products-title">
          <div className={styles.relatedHeading}>
            <div>
              <span className={styles.sectionEyebrow}>More from the catalog</span>
              <h2 id="related-products-title">Related products</h2>
            </div>
            <Link href="/shop/products">View all products</Link>
          </div>
          <div className={styles.relatedGrid}>
            {related.map((item) => (
              <article className={styles.relatedCard} key={item.id}>
                <div className={styles.relatedMedia}>
                  <Link href={`/shop/products/${item.id}`} aria-label={`View ${item.name}`}>
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        unoptimized
                        sizes="(max-width: 620px) 90vw, 25vw"
                      />
                    ) : (
                      <span className={styles.relatedImageFallback}><ImageOff size={28} aria-hidden="true" /></span>
                    )}
                  </Link>
                  {item.stockQuantity === 0 ? <span className={styles.relatedStockBadge}>Out of stock</span> : null}
                  <RelatedActions product={item} />
                </div>
                <div className={styles.relatedBody}>
                  {item.categoryName || item.brandName ? (
                    <span>{item.categoryName || item.brandName}</span>
                  ) : null}
                  <h3><Link href={`/shop/products/${item.id}`}>{item.name}</Link></h3>
                  <div>
                    <strong>
                      <PriceWithCompareAt
                        price={item.price}
                        compareAtPrice={item.compareAtPrice}
                      />
                    </strong>
                    {item.sku ? <small>SKU {item.sku}</small> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {zoomOpen && availableImage ? (
        <div
          className={styles.zoomOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={`${product.name} enlarged image`}
          onClick={() => setZoomOpen(false)}
        >
          <div className={styles.zoomImageFrame} onClick={(event) => event.stopPropagation()}>
            <Image
              src={availableImage}
              alt={product.name}
              fill
              unoptimized
              sizes="92vw"
            />
          </div>
          <button
            type="button"
            className={styles.zoomClose}
            aria-label="Close enlarged image"
            onClick={() => setZoomOpen(false)}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
