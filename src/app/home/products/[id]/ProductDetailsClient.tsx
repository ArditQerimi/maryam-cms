'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Heart, ImageOff, Layers3, Minus, Plus, Search, X } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useCompare } from '@/context/CompareContext';
import { useWishlist } from '@/context/WishlistContext';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import ProductStars from '../../components/ProductStars';
import ShopPageHeader from '../../components/ShopPageHeader';
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
  /** Admin store rating (1–5), the same source the catalogue cards use; 0 = unrated. */
  rating: number;
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

/**
 * Optional merchandising banner shown between the tabs and the related grid.
 * Sourced from tenant settings (`pdp_banner_*`); hidden until configured so
 * the page never shows placeholder marketing copy.
 */
export type DetailPromo = {
  image: string;
  title: string;
  text?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
};

const priceFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPrice(value: number | null, unavailableLabel: string): string {
  return value === null ? unavailableLabel : priceFormatter.format(value);
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
  const { t } = useLocale();
  const showCompareAt =
    price !== null && compareAtPrice !== null && compareAtPrice > price;

  return (
    <span className={className}>
      <span>{formatPrice(price, t('catalog.price_unavailable'))}</span>
      {showCompareAt ? (
        <s className={styles.oldPrice} aria-label={t('catalog.original_price')}>
          {formatPrice(compareAtPrice, t('catalog.price_unavailable'))}
        </s>
      ) : null}
    </span>
  );
}

/** Solid shield with a knocked-out check, as in the reference trust list. */
function ShieldCheckIcon() {
  return (
    <svg className={styles.trustIcon} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M12 2 4 5.2v6.1c0 4.9 3.4 9.1 8 10.7 4.6-1.6 8-5.8 8-10.7V5.2L12 2Z" fill="currentColor" />
      <path
        d="m8.4 12.1 2.4 2.4 4.8-4.9"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Generic card-network marks for the checkout reassurance box. */
function PaymentMarks() {
  const { t } = useLocale();
  return (
    <div
      className={styles.paymentCards}
      role="img"
      aria-label={t('catalog.payments_aria')}
    >
      <svg viewBox="0 0 48 30" aria-hidden="true">
        <rect width="48" height="30" rx="3" fill="#fff" />
        <text x="24" y="20.5" textAnchor="middle" fill="#1a1f71" fontSize="13" fontWeight="800" fontStyle="italic" fontFamily="Arial, sans-serif">VISA</text>
      </svg>
      <svg viewBox="0 0 48 30" aria-hidden="true">
        <rect width="48" height="30" rx="3" fill="#fff" />
        <circle cx="19.5" cy="13.5" r="8" fill="#eb001b" />
        <circle cx="28.5" cy="13.5" r="8" fill="#f79e1b" />
        <path d="M24 6.9a8 8 0 0 1 0 13.2 8 8 0 0 1 0-13.2Z" fill="#ff5f00" />
        <text x="24" y="27" textAnchor="middle" fill="#231f20" fontSize="3.6" fontFamily="Arial, sans-serif">mastercard</text>
      </svg>
      <svg viewBox="0 0 48 30" aria-hidden="true">
        <rect width="48" height="30" rx="3" fill="#2e77bc" />
        <text x="24" y="13.5" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="800" fontFamily="Arial, sans-serif">AMERICAN</text>
        <text x="24" y="22" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="800" fontFamily="Arial, sans-serif">EXPRESS</text>
      </svg>
      <svg viewBox="0 0 48 30" aria-hidden="true">
        <rect width="48" height="30" rx="3" fill="#fff" />
        <text x="5" y="18" fill="#231f20" fontSize="7" fontWeight="700" fontFamily="Arial, sans-serif">DISC</text>
        <circle cx="27.6" cy="15.6" r="3.7" fill="#f58220" />
        <text x="31.6" y="18" fill="#231f20" fontSize="7" fontWeight="700" fontFamily="Arial, sans-serif">VER</text>
      </svg>
      <svg viewBox="0 0 48 30" aria-hidden="true">
        <rect width="48" height="30" rx="3" fill="#fff" />
        <text x="24" y="19" textAnchor="middle" fontSize="10" fontWeight="800" fontStyle="italic" fontFamily="Arial, sans-serif">
          <tspan fill="#003087">Pay</tspan>
          <tspan fill="#009cde">Pal</tspan>
        </text>
      </svg>
    </div>
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
  const { t } = useLocale();
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
        aria-label={
          inWishlist ? t('catalog.remove_from_wishlist') : t('catalog.add_to_wishlist')
        }
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
        aria-label={
          inCompare ? t('catalog.remove_from_comparison') : t('catalog.add_to_comparison')
        }
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
  promo,
  initialTab = 'description',
}: {
  product: DetailProduct;
  related: RelatedProduct[];
  reviews?: ProductReviewsData;
  promo?: DetailPromo | null;
  initialTab?: ProductDetailTab;
}) {
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { addToCompare, removeFromCompare, isInCompare } = useCompare();
  const { t } = useLocale();
  const unavailablePriceLabel = t('catalog.price_unavailable');
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
    setActionMessage(
      result.ok
        ? t('catalog.added_to_cart', { name: product.name })
        : result.message || t('catalog.add_error'),
    );
  };

  const toggleWishlist = () => {
    if (selectedPrice === null) return;
    if (inWishlist) {
      const result = removeFromWishlist(commerceSelector);
      setActionMessage(result.message || t('catalog.wishlist_removed'));
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
    setActionMessage(result.message || t('catalog.wishlist_saved'));
  };

  const toggleCompare = () => {
    if (selectedPrice === null) return;
    if (inCompare) {
      const result = removeFromCompare(commerceSelector);
      setActionMessage(result.message || t('catalog.compare_removed'));
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
    setActionMessage(result.message || t('catalog.compare_added'));
  };

  const reviewCount = reviews?.summary?.approvedCount
    ?? reviews?.pagination?.totalItems
    ?? reviews?.reviews?.length
    ?? 0;
  const reviewTabLabel = reviewCount > 0
    ? t('catalog.reviews_tab_count', { count: reviewCount })
    : t('catalog.reviews_tab');
  const selectedOptions = selectedVariant?.options ?? [];
  const canUseCommerce = selectedPrice !== null;

  return (
    <div className={styles.page}>
      <ShopPageHeader
        crumbs={[
          { label: t('catalog.shop'), href: '/home/products' },
          ...(product.categoryId && product.categoryName
            ? [{
                label: product.categoryName,
                href: `/home/products?category=${product.categoryId}`,
              }]
            : []),
          { label: product.name },
        ]}
      />

      <section className={styles.productHero} aria-labelledby="product-title">
        <div className={styles.productGallery}>
          <div className={styles.mainImageFrame}>
            {availableImage ? (
              <Image
                key={availableImage}
                src={availableImage}
                alt={`${product.name}${resolvedImageIndex >= 0 && product.galleryImages.length > 1 ? t('catalog.image_alt_suffix', { n: resolvedImageIndex + 1 }) : ''}`}
                fill
                unoptimized
                priority
                sizes="(max-width: 820px) 94vw, 52vw"
                className={styles.mainImage}
                onError={() => markImageFailed(availableImage)}
              />
            ) : (
              <div className={styles.imageFallback} role="img" aria-label={t('catalog.image_unavailable_aria')}>
                <ImageOff size={42} strokeWidth={1.25} aria-hidden="true" />
                <span>{t('catalog.image_unavailable')}</span>
              </div>
            )}
            {availableImage ? (
              <button
                type="button"
                className={styles.zoomButton}
                aria-label={t('catalog.enlarge_image_aria')}
                onClick={() => setZoomOpen(true)}
              >
                <Search size={20} strokeWidth={2.25} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {product.galleryImages.length > 1 ? (
            <div className={styles.thumbnailList} aria-label={t('catalog.gallery_aria')}>
              <div className={styles.thumbnailTrack}>
                {product.galleryImages.map((image, index) => (
                  <button
                    type="button"
                    className={styles.thumbnail}
                    data-active={index === resolvedImageIndex}
                    data-broken={failedImages.has(image)}
                    key={image}
                    aria-label={t('catalog.show_product_image_aria', { n: index + 1 })}
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
            </div>
          ) : null}
        </div>

        <div className={styles.productInfo}>
          {product.categoryName ? (
            <p className={styles.productEyebrow}>{product.categoryName}</p>
          ) : null}
          <h1 id="product-title">{product.name}</h1>
          <div className={styles.heroStars}>
            {/* Same store rating as the catalogue card, so both agree. */}
            <ProductStars
              rating={product.rating || Math.round(reviews?.summary?.averageRating ?? 0)}
            />
          </div>
          <p className={styles.price}>
            <PriceWithCompareAt
              price={selectedPrice}
              compareAtPrice={selectedCompareAtPrice}
            />
          </p>
          <p className={styles.description}>
            {product.description || t('catalog.no_description')}
          </p>

          {optionGroups.length > 0 ? (
            <div className={styles.optionSelects}>
              {optionGroups.map((group) => {
                const selectedValueId = optionSelections[group.attributeId];
                const clearSelection = () => {
                  setOptionSelections((current) => {
                    const next = { ...current };
                    delete next[group.attributeId];
                    return next;
                  });
                  setQuantity(1);
                  setActionMessage('');
                };
                return (
                  <div className={styles.optionSelectRow} key={group.attributeId}>
                    <label
                      className={styles.optionSelect}
                      htmlFor={`option-select-${group.attributeId}`}
                    >
                      <span>{group.name}</span>
                      <select
                        id={`option-select-${group.attributeId}`}
                        value={selectedValueId ?? ''}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (value > 0) chooseOption(group.attributeId, value);
                          else clearSelection();
                        }}
                      >
                        <option value="">
                          {t('catalog.choose_attribute', { name: group.name.toLowerCase() })}
                        </option>
                        {group.values.map((option) => {
                          const available = isOptionAvailable(
                            group.attributeId,
                            option.valueId,
                          );
                          return (
                            <option
                              key={option.valueId}
                              value={option.valueId}
                              disabled={!available}
                            >
                              {option.value}
                              {!available ? t('catalog.option_unavailable') : ''}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    {selectedValueId !== undefined ? (
                      <button
                        type="button"
                        className={styles.optionClear}
                        onClick={clearSelection}
                      >
                        {t('catalog.clear')}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : product.variants.length > 1 ? (
            <label className={styles.variantSelect}>
              <span>{t('catalog.variant')}</span>
              <select
                value={explicitVariantId ?? ''}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setExplicitVariantId(value || null);
                  setQuantity(1);
                  setActionMessage('');
                }}
              >
                <option value="">{t('catalog.choose_variant')}</option>
                {product.variants.map((variant) => (
                  <option value={variant.id} key={variant.id} disabled={variant.stockQuantity === 0}>
                    {variant.name} — {formatPrice(variant.price, unavailablePriceLabel)}
                    {variant.compareAtPrice !== null && variant.compareAtPrice > variant.price
                      ? t('catalog.was_price', {
                          price: formatPrice(variant.compareAtPrice, unavailablePriceLabel),
                        })
                      : ''}{' '}
                    —{' '}
                    {variant.stockQuantity > 0
                      ? t('catalog.available_count', { count: variant.stockQuantity })
                      : t('catalog.out_of_stock')}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {!selectedVariant ? (
            <div className={styles.variantUnavailable} role="status">
              <strong>{t('catalog.no_variant_title')}</strong>
              <span>{t('catalog.no_variant_text')}</span>
            </div>
          ) : null}

          <div
            className={styles.stockLine}
            data-in-stock={product.variants.length > 0 && product.stockQuantity > 0}
          >
            <strong>
              {product.variants.length === 0
                ? t('catalog.no_active_variant')
                : product.stockQuantity > 0
                  ? t('catalog.in_stock_count', { count: product.stockQuantity })
                  : t('catalog.out_of_stock')}
            </strong>
            {selectedVariant && selectedAvailability > 0 && selectedAvailability !== product.stockQuantity ? (
              <span>{t('catalog.selected_variant_stock', { count: selectedAvailability })}</span>
            ) : null}
          </div>

          <div className={styles.purchaseRow}>
            <div className={styles.quantityStepper}>
              <button
                type="button"
                aria-label={t('catalog.decrease_quantity_aria')}
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
                aria-label={t('catalog.quantity_aria')}
                onChange={(event) => updateQuantity(Number(event.target.value))}
              />
              <button
                type="button"
                aria-label={t('catalog.increase_quantity_aria')}
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
                ? t('catalog.out_of_stock')
                : hasSelectedVariant
                  ? t('catalog.add_to_cart')
                  : t('catalog.unavailable')}
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={
                inWishlist ? t('catalog.remove_from_wishlist') : t('catalog.add_to_wishlist')
              }
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
              aria-label={
                inCompare ? t('catalog.remove_from_comparison') : t('catalog.add_to_comparison')
              }
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

          <div className={styles.trustBlock}>
            <p className={styles.trustShipping}>{t('catalog.free_shipping')}</p>
            <ul className={styles.trustList}>
              <li>
                <ShieldCheckIcon />
                {t('catalog.trust_satisfaction')}
              </li>
              <li>
                <ShieldCheckIcon />
                {t('catalog.trust_refunds')}
              </li>
              <li>
                <ShieldCheckIcon />
                {t('catalog.trust_payments')}
              </li>
            </ul>
            <div className={styles.paymentBox}>
              <PaymentMarks />
              <strong>{t('catalog.safe_checkout')}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.productTabs}>
        <div className={styles.tabList} role="tablist" aria-label={t('catalog.product_info_aria')}>
          <button
            type="button"
            role="tab"
            id="description-tab"
            aria-controls="description-panel"
            aria-selected={tab === 'description'}
            data-active={tab === 'description'}
            onClick={() => setTab('description')}
          >
            {t('catalog.tab_description')}
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
            {t('catalog.tab_details')}
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
            <span className={styles.sectionEyebrow}>{t('catalog.about_item')}</span>
            <h2>{t('catalog.tab_description')}</h2>
            <p className={styles.longDescription}>
              {product.description || t('catalog.no_description')}
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
            <span className={styles.sectionEyebrow}>{t('catalog.catalog_info')}</span>
            <h2>{t('catalog.tab_details')}</h2>
            <dl className={styles.detailsList}>
              <div><dt>{t('catalog.sku_label')}</dt><dd>{product.sku || t('catalog.not_provided')}</dd></div>
              <div><dt>{t('catalog.category')}</dt><dd>{product.categoryName || t('catalog.not_assigned')}</dd></div>
              <div><dt>{t('catalog.brand')}</dt><dd>{product.brandName || t('catalog.not_assigned')}</dd></div>
              <div>
                <dt>{t('catalog.base_price')}</dt>
                <dd>
                  <PriceWithCompareAt
                    price={product.price}
                    compareAtPrice={product.compareAtPrice}
                  />
                </dd>
              </div>
              <div><dt>{t('catalog.active_variants')}</dt><dd>{product.variants.length}</dd></div>
              <div>
                <dt>{t('catalog.stock_source')}</dt>
                <dd>
                  {product.stockSource === 'variant'
                    ? t('catalog.stock_source_variant')
                    : t('catalog.stock_source_parent')}
                </dd>
              </div>
              <div><dt>{t('catalog.total_availability')}</dt><dd>{product.stockQuantity}</dd></div>
              {selectedOptions.length > 0 ? (
                <div>
                  <dt>{t('catalog.selected_options')}</dt>
                  <dd>{selectedOptions.map((option) => `${option.attributeName}: ${option.value}`).join(', ')}</dd>
                </div>
              ) : null}
              {selectedVariant ? (
                <div>
                  <dt>{t('catalog.selected_variant')}</dt>
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

      {promo && promo.image && promo.title ? (
        <section className={styles.promoSection} aria-label={promo.title}>
          <div className={styles.promoBanner}>
            <Image
              src={promo.image}
              alt=""
              fill
              unoptimized
              objectFit="cover"
              sizes="(max-width: 900px) 100vw, 1100px"
            />
            <div className={styles.promoCard}>
              <h2>{promo.title}</h2>
              {promo.text ? <p>{promo.text}</p> : null}
              {promo.ctaHref && promo.ctaLabel ? (
                <Link href={promo.ctaHref}>{promo.ctaLabel}</Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section className={styles.relatedSection} aria-labelledby="related-products-title">
          <div className={styles.relatedHeading}>
            <h2 id="related-products-title">{t('catalog.related_products')}</h2>
            <Link href="/home/products">{t('catalog.view_all_products')}</Link>
          </div>
          <div className={styles.relatedGrid}>
            {related.map((item) => (
              <article className={styles.relatedCard} key={item.id}>
                <div className={styles.relatedMedia}>
                  <Link href={`/home/products/${item.id}`} aria-label={t('catalog.view_product', { name: item.name })}>
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
                  {item.stockQuantity === 0 ? <span className={styles.relatedStockBadge}>{t('catalog.out_of_stock')}</span> : null}
                  <RelatedActions product={item} />
                </div>
                <div className={styles.relatedBody}>
                  {item.categoryName || item.brandName ? (
                    <span>{item.categoryName || item.brandName}</span>
                  ) : null}
                  <h3><Link href={`/home/products/${item.id}`}>{item.name}</Link></h3>
                  <div>
                    <strong>
                      <PriceWithCompareAt
                        price={item.price}
                        compareAtPrice={item.compareAtPrice}
                      />
                    </strong>
                    {item.sku ? <small>{t('catalog.sku', { sku: item.sku })}</small> : null}
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
          aria-label={t('catalog.zoom_aria', { name: product.name })}
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
            aria-label={t('catalog.close_zoom_aria')}
            onClick={() => setZoomOpen(false)}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
