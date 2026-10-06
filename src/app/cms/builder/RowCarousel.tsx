'use client';

import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import CarouselArrow, { CAROUSEL_HOVER_CLASS } from '@/components/CarouselArrow';

/**
 * A row shown as a carousel: every column is one slide, so anything that can
 * be dropped into a column (image, heading, buttons, nested rows…) can live
 * in a slide — the Elementor "nested carousel" idea on top of rows/columns.
 *
 * In the builder (`editing`) autoplay is off and the slides stay put so they
 * can be edited and dropped into; arrows and dots still page through them.
 */
export default function RowCarousel({
  children,
  perView = 1,
  gap = 0,
  autoplay = false,
  intervalSeconds = 5,
  arrows = true,
  dots = true,
  editing = false,
  valign = 'stretch',
}: {
  children: ReactNode;
  perView?: number;
  gap?: number;
  autoplay?: boolean;
  intervalSeconds?: number;
  arrows?: boolean;
  dots?: boolean;
  editing?: boolean;
  valign?: string;
}) {
  const slides = Children.toArray(children);
  const view = Math.max(1, Math.min(perView, slides.length || 1));
  const pages = Math.max(1, slides.length - view + 1);
  const [index, setIndex] = useState(0);
  const current = Math.min(index, pages - 1);

  useEffect(() => {
    if (editing || !autoplay || pages < 2) return;
    const timer = window.setInterval(
      () => setIndex((value) => (value + 1) % pages),
      Math.max(2, intervalSeconds) * 1000,
    );
    return () => window.clearInterval(timer);
  }, [editing, autoplay, intervalSeconds, pages]);

  const go = (next: number) => setIndex((next + pages) % pages);

  // Swipe / drag left-right to page (touch, pen and mouse). Vertical movement
  // still scrolls the page (touch-action: pan-y on the viewport below).
  const drag = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const onPointerDown = (event: React.PointerEvent) => {
    drag.current = { x: event.clientX, y: event.clientY };
    dragged.current = false;
  };
  const onPointerUp = (event: React.PointerEvent) => {
    const start = drag.current;
    drag.current = null;
    if (!start || pages < 2 || editing) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      dragged.current = true;
      go(current + (dx < 0 ? 1 : -1));
    }
  };
  // A swipe that started on a link must not also open it.
  const onClickCapture = (event: React.MouseEvent) => {
    if (dragged.current) {
      event.preventDefault();
      event.stopPropagation();
      dragged.current = false;
    }
  };

  return (
    <div className={`bb-carousel ${CAROUSEL_HOVER_CLASS}`} style={{ position: 'relative', width: '100%' }}>
      <div
        style={{ overflow: 'hidden', width: '100%', touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        onClickCapture={onClickCapture}
      >
        <div
          className="bb-carousel-track"
          style={{
            display: 'flex',
            gap,
            alignItems: valign,
            transform: `translateX(calc(${-current} * (100% + ${gap}px) / ${view}))`,
            transition: 'transform 0.5s ease',
          }}
        >
          {slides}
        </div>
      </div>

      {arrows && pages > 1 ? (
        <>
          <CarouselArrow
            direction="prev"
            className="bb-carousel-arrow"
            label="Previous slide"
            onClick={(event) => {
              event.stopPropagation();
              go(current - 1);
            }}
          />
          <CarouselArrow
            direction="next"
            className="bb-carousel-arrow"
            label="Next slide"
            onClick={(event) => {
              event.stopPropagation();
              go(current + 1);
            }}
          />
        </>
      ) : null}

      {dots && pages > 1 ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 10,
            marginTop: 20,
          }}
        >
          {Array.from({ length: pages }).map((_, page) => (
            <button
              key={page}
              type="button"
              aria-label={`Slide ${page + 1}`}
              aria-current={page === current ? 'true' : undefined}
              onClick={(event) => {
                event.stopPropagation();
                go(page);
              }}
              style={{
                width: 14,
                height: 14,
                padding: 0,
                border: '2px solid #6b5e2b',
                borderRadius: '50%',
                background: page === current ? '#6b5e2b' : 'transparent',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
