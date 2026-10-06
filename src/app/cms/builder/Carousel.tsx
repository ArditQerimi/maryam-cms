'use client';

import CarouselArrow, { CAROUSEL_HOVER_CLASS } from '@/components/CarouselArrow';
import { Children, useCallback, useRef, type ReactNode } from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import styles from './carousel.module.css';

type Props = {
  /** Cards — every direct child becomes one snap slide. */
  children: ReactNode;
  /** How many slides fit in a row on desktop (2–4). Defaults to 4. */
  columns?: number;
  /** Used in the arrows' accessible names, e.g. "products". */
  name?: string;
};

/**
 * Scroll-snap carousel used by the block renderers. It is a client component
 * so `/home` (server) can simply hand it children while `BlockRenderer` itself
 * stays free of hooks.
 */
export default function Carousel({ children, columns, name = 'items' }: Props) {
  const { t } = useLocale();
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollBy = useCallback((direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    const first = track.firstElementChild as HTMLElement | null;
    const computed = window.getComputedStyle(track);
    const gap = Number.parseFloat(computed.columnGap || computed.gap || '0');
    const step = (first?.offsetWidth ?? 280) + (Number.isFinite(gap) ? gap : 0);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 12;
    const atStart = track.scrollLeft <= 12;
    // Wrap around at the edges, matching the shop's product carousels.
    const target =
      direction === 1
        ? atEnd
          ? 0
          : track.scrollLeft + step
        : atStart
          ? Math.max(track.scrollWidth - track.clientWidth, 0)
          : track.scrollLeft - step;
    track.scrollTo({ left: target, behavior });
  }, []);

  const slides = Children.count(children);
  const columnClass =
    columns === 2 ? styles.cols2 : columns === 3 ? styles.cols3 : styles.cols4;

  return (
    <div className={`${styles.container} ${columnClass} ${CAROUSEL_HOVER_CLASS}`}>
      {slides > 1 ? (
        <>
          <CarouselArrow
            direction="prev"
            className={styles.navPrev}
            onClick={() => scrollBy(-1)}
            label={t('cmscontent.builder.carouselPrev', { name })}
          />
          <CarouselArrow
            direction="next"
            className={styles.navNext}
            onClick={() => scrollBy(1)}
            label={t('cmscontent.builder.carouselNext', { name })}
          />
        </>
      ) : null}

      <div
        ref={trackRef}
        className={styles.track}
        role="group"
        aria-label={t('cmscontent.builder.carouselGroup', { name })}
        tabIndex={0}
      >
        {Children.map(children, (child, index) => (
          <div key={index} className={styles.slide}>
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
