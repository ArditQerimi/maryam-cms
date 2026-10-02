'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import legacyStyles from '../bookstore.module.css';
import catalogStyles from '../products/home-products.module.css';
import ProductActionBar, { ProductAddToCartButton } from './ProductActionBar';
import ProductStars from './ProductStars';
import type { QvProduct } from './QuickViewModal';

/**
 * What the shared product card needs to render. Both storefront surfaces
 * satisfy it: the catalog listing's `CatalogProduct` and the homepage
 * sections' `QvProduct` (which just omits the catalog-only extras).
 */
export type ProductCardData = {
  id: number;
  name: string;
  /** Effective (possibly discounted) price the shopper pays. */
  price: number;
  /** Original list price when a discount applies, otherwise null/undefined. */
  originalPrice?: number | null;
  imageUrl: string;
  stockQuantity: number;
  description: string;
  /** Admin store rating 1–5; null/0 = no stars. */
  rating?: number | null;
  variantId?: number | null;
  categoryId?: number | null;
  categoryName?: string;
  sku?: string;
};

const priceFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatProductPrice(value: number, fallbackLabel = 'Price unavailable'): string {
  return Number.isFinite(value) ? priceFormatter.format(value) : fallbackLabel;
}

/** Card data → the quick-view shape the action bar and modal consume. */
export function toCardQuickView(product: ProductCardData): QvProduct {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
    stockQuantity: product.stockQuantity,
    variantId: product.variantId ?? null,
    description: product.description,
    categoryName: product.categoryName,
    categoryId: product.categoryId ?? null,
    rating: product.rating ?? null,
  };
}

/** Sale price with the struck-through original next to it when discounted. */
export function ProductPricePair({
  price,
  originalPrice,
}: {
  price: number;
  originalPrice?: number | null;
}) {
  const { t } = useLocale();
  return (
    <span className={catalogStyles.pricePair}>
      <span className={catalogStyles.productPrice}>
        {formatProductPrice(price, t('catalog.price_unavailable'))}
      </span>
      {originalPrice != null ? (
        <s className={catalogStyles.oldPrice} aria-label={t('catalog.original_price')}>
          {formatProductPrice(originalPrice, t('catalog.price_unavailable'))}
        </s>
      ) : null}
    </span>
  );
}

/**
 * Lazy image with a skeleton while loading and a labelled fallback on error.
 * Intrinsic sizing (not `fill`): the artwork keeps its own proportions
 * and brings its own background, so the card adds no panel around it.
 */
export function ProductCardImage({
  src,
  alt,
  sizes,
  preload = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  preload?: boolean;
}) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>(src ? 'loading' : 'error');
  const { t } = useLocale();

  return (
    <div className={catalogStyles.productImage} data-loaded={state === 'loaded'}>
      {state === 'loading' ? <span className={catalogStyles.imageSkeleton} aria-hidden="true" /> : null}
      {state === 'error' ? (
        <span
          className={catalogStyles.imageFallback}
          role="img"
          aria-label={t('catalog.no_image_for', { name: alt })}
        >
          <ImageOff size={34} strokeWidth={1.35} aria-hidden="true" />
          <span>{t('catalog.image_unavailable')}</span>
        </span>
      ) : (
        <Image
          src={src}
          alt={alt}
          width={0}
          height={0}
          unoptimized
          sizes={sizes}
          preload={preload}
          loading={preload ? 'eager' : 'lazy'}
          fetchPriority={preload ? 'high' : 'auto'}
          className={catalogStyles.productImageImg}
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
        />
      )}
    </div>
  );
}

type ProductCardProps = {
  product: ProductCardData;
  /** Quick-view carousel list — prev/next navigation inside the modal. */
  quickViewProducts: QvProduct[];
  quickViewIndex: number;
  /** Extra layout class from the surrounding grid/carousel (sizing only). */
  className?: string;
  /** Catalog cards sit under the page h1 (h2); homepage section cards use h3. */
  headingLevel?: 'h2' | 'h3';
  /** Image `sizes` hint matched to the card's rendered width. */
  sizes?: string;
  preloadImage?: boolean;
};

/**
 * THE storefront product card — one component for the catalog listing
 * (`/home/products`) and the homepage sections (product showcase, best
 * sellers, new arrivals, categories), so both always render the same markup:
 * image with skeleton, hover/focus quick actions, title, stars, price pair
 * and the always-visible add-to-cart button.
 */
export default function ProductCard({
  product,
  quickViewProducts,
  quickViewIndex,
  className,
  headingLevel = 'h2',
  sizes = '(max-width: 380px) 92vw, (max-width: 720px) 46vw, (max-width: 1280px) 30vw, 360px',
  preloadImage = false,
}: ProductCardProps) {
  const { t } = useLocale();
  const quickViewProduct = quickViewProducts[quickViewIndex] ?? toCardQuickView(product);
  const inStock = product.stockQuantity > 0;
  const Heading = headingLevel;

  return (
    <article
      className={[catalogStyles.productCard, legacyStyles.productCard, className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={catalogStyles.mediaWrap}>
        <Link
          href={`/home/products/${product.id}`}
          className={catalogStyles.mediaLink}
          aria-label={t('catalog.view_product', { name: product.name })}
        >
          <ProductCardImage
            src={product.imageUrl}
            alt={product.name}
            sizes={sizes}
            preload={preloadImage}
          />
        </Link>
        {product.originalPrice != null && (
          <span className={catalogStyles.saleBadge} aria-label="Sale">
            SALE
          </span>
        )}
        {inStock ? null : (
          <span className={catalogStyles.stockBadge}>{t('catalog.out_of_stock')}</span>
        )}
        <ProductActionBar
          product={quickViewProduct}
          products={quickViewProducts}
          initialIndex={quickViewIndex}
        />
      </div>

      <div className={catalogStyles.cardBody}>
        <Link href={`/home/products/${product.id}`} className={catalogStyles.productTitleLink}>
          <Heading className={catalogStyles.productTitle}>{product.name}</Heading>
        </Link>
        <ProductStars rating={product.rating} />

        <div className={catalogStyles.priceRow}>
          <ProductPricePair price={product.price} originalPrice={product.originalPrice} />
        </div>

        {inStock ? (
          <div className={catalogStyles.addToCartSlot}>
            <ProductAddToCartButton product={quickViewProduct} />
          </div>
        ) : (
          <span className={catalogStyles.outOfStock}>{t('catalog.currently_unavailable')}</span>
        )}
      </div>
    </article>
  );
}
