'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import styles from '../bookstore.module.css';
import ProductActionBar, { ProductAddToCartButton } from './ProductActionBar';
import type { QvProduct } from './QuickViewModal';

export type CarouselProduct = QvProduct;

type Props = {
  products: CarouselProduct[];
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

export default function ProductCarousel({ products }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollOneCard = useCallback((direction: 'prev' | 'next') => {
    const element = trackRef.current;
    if (!element) return;

    const firstCard = element.querySelector<HTMLElement>(`.${styles.carouselCard}`);
    const gap = firstCard
      ? Number.parseFloat(window.getComputedStyle(element).columnGap || window.getComputedStyle(element).gap || '0')
      : 0;
    const step = (firstCard?.offsetWidth ?? 280) + (Number.isFinite(gap) ? gap : 0);

    if (direction === 'next') {
      const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 12;
      element.scrollTo({ left: atEnd ? 0 : element.scrollLeft + step, behavior: 'smooth' });
      return;
    }

    const atStart = element.scrollLeft <= 12;
    element.scrollTo({
      left: atStart ? element.scrollWidth : element.scrollLeft - step,
      behavior: 'smooth',
    });
  }, []);

  if (products.length === 0) return null;

  return (
    <div className={styles.carouselContainer}>
      {products.length > 1 ? (
        <>
          <button
            type="button"
            className={`${styles.carouselNavBtn} ${styles.carouselNavPrev}`}
            onClick={() => scrollOneCard('prev')}
            aria-label="Previous products"
          >
            <ChevronLeft size={27} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${styles.carouselNavBtn} ${styles.carouselNavNext}`}
            onClick={() => scrollOneCard('next')}
            aria-label="Next products"
          >
            <ChevronRight size={27} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </>
      ) : null}

      <div className={styles.carouselTrack} ref={trackRef}>
        {products.map((product) => (
          <article className={`${styles.productCard} ${styles.carouselCard}`} key={product.id}>
            <Link href={`/shop/products/${product.id}`} className={styles.productMedia} aria-label={`View ${product.name}`}>
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  unoptimized
                  sizes="(max-width: 600px) 82vw, (max-width: 1000px) 38vw, 310px"
                />
              ) : (
                <span className={styles.productVariantBadge} role="img" aria-label="Product image unavailable">
                  <ImageOff size={28} aria-hidden="true" />
                </span>
              )}
              {product.stockQuantity === 0 ? (
                <span className={styles.productBadgeSale}>OUT OF STOCK</span>
              ) : null}
            </Link>
            <ProductActionBar
              product={product}
              products={products}
              initialIndex={products.findIndex((item) => item.id === product.id)}
            />
            <Link href={`/shop/products/${product.id}`} className={styles.productTitleLink}>
              <h3 className={styles.productTitle}>{product.name}</h3>
            </Link>
            <div className={styles.productPriceRow}>
              <span className={styles.productPrice}>{formatPrice(product.price)}</span>
            </div>
            <ProductAddToCartButton product={product} />
          </article>
        ))}
      </div>
    </div>
  );
}
