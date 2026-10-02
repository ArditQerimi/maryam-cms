'use client';

import { useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import styles from '../bookstore.module.css';
import ProductCard from './ProductCard';
import type { QvProduct } from './QuickViewModal';

export type CarouselProduct = QvProduct;

type Props = {
  products: CarouselProduct[];
  /** `carousel` scrolls sideways; `grid` wraps into rows — same card either way. */
  layout?: 'carousel' | 'grid';
};

export default function ProductCarousel({ products, layout = 'carousel' }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const { t } = useLocale();

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

  /* Same shared card as /home/products — only the wrapper changes. */
  const cardFor = (product: CarouselProduct, index: number) => (
    <ProductCard
      key={product.id}
      product={product}
      quickViewProducts={products}
      quickViewIndex={index}
      headingLevel="h3"
      className={layout === 'grid' ? undefined : styles.carouselCard}
    />
  );

  /* Grid layout: the same card, wrapped into responsive rows. */
  if (layout === 'grid') {
    return <div className={styles.productsGrid}>{products.map(cardFor)}</div>;
  }

  return (
    <div className={styles.carouselContainer}>
      {products.length > 1 ? (
        <>
          <button
            type="button"
            className={`${styles.carouselNavBtn} ${styles.carouselNavPrev}`}
            onClick={() => scrollOneCard('prev')}
            aria-label={t('catalog.prev_products_aria')}
          >
            <ChevronLeft size={27} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${styles.carouselNavBtn} ${styles.carouselNavNext}`}
            onClick={() => scrollOneCard('next')}
            aria-label={t('catalog.next_products_aria')}
          >
            <ChevronRight size={27} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </>
      ) : null}

      <div className={styles.carouselTrack} ref={trackRef}>
        {products.map(cardFor)}
      </div>
    </div>
  );
}
