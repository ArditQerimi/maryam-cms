'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import {
  HERO_HEIGHTS,
  HERO_LAYOUTS,
  HERO_TEXT_ALIGNS,
  type HeroHeight,
  type HeroLayout,
  type HeroTextAlign,
} from '@/lib/theme/types';
import styles from '../bookstore.module.css';

export type BookstoreHeroSlide = {
  category: string;
  title: string;
  price: string;
  img: string;
  href: string;
  ctaLabel?: string;
};

export type BookstoreHeroDesign = {
  layout: HeroLayout;
  height: HeroHeight;
  textAlign: HeroTextAlign;
  background: string;
  textColor: string;
  overlayColor: string;
  overlayOpacity: number;
  autoplay: boolean;
  intervalSeconds: number;
};

const DESIGN_FALLBACK: BookstoreHeroDesign = {
  layout: 'image-right',
  height: 'standard',
  textAlign: 'left',
  background: '',
  textColor: '',
  overlayColor: '#000000',
  overlayOpacity: 35,
  autoplay: true,
  intervalSeconds: 5,
};

type PreviewHero = {
  slides: BookstoreHeroSlide[];
  secondaryLabel: string;
  secondaryUrl: string;
  design: BookstoreHeroDesign;
};

/** Coerce one untrusted field of a postMessage payload into a trimmed string. */
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
}

/** `#rrggbb` + 0–100 → an rgba() string, or transparent when unset. */
function overlayFrom(color: string, opacity: number): string {
  const hex = /^#([0-9a-fA-F]{6})$/.exec(color.trim());
  if (!hex || opacity <= 0) return 'transparent';
  const int = parseInt(hex[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
}

export default function BookstoreHero({
  slides,
  secondaryLabel = 'Të gjitha librat',
  secondaryUrl = '/shop/products',
  design,
}: {
  slides: BookstoreHeroSlide[];
  secondaryLabel?: string;
  secondaryUrl?: string;
  design?: Partial<BookstoreHeroDesign>;
}) {
  const [preview, setPreview] = useState<PreviewHero | null>(null);

  // Inside the CMS customizer iframe (`?preview=1`) the hero re-renders from
  // postMessage, so edits show up before they are published.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('preview') !== '1') return;

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; homepage?: unknown } | null;
      if (!data || data.type !== 'cms:theme') return;
      const homepage = data.homepage as Record<string, unknown> | undefined;
      if (!homepage) return;

      const raw = Array.isArray(homepage.heroSlides) ? homepage.heroSlides : [];
      setPreview({
        slides: raw
          .map((entry) => {
            const row = (entry ?? {}) as Record<string, unknown>;
            return {
              category: text(row.category),
              title: text(row.title),
              price: text(row.price),
              img: text(row.image),
              href: text(row.url) || '/shop/products',
              ctaLabel: text(row.ctaLabel),
            };
          })
          .filter((slide) => slide.title && slide.img),
        secondaryLabel: text(homepage.heroSecondaryLabel),
        secondaryUrl: text(homepage.heroSecondaryUrl),
        design: {
          layout: pick(homepage.heroLayout, HERO_LAYOUTS, DESIGN_FALLBACK.layout),
          height: pick(homepage.heroHeight, HERO_HEIGHTS, DESIGN_FALLBACK.height),
          textAlign: pick(homepage.heroTextAlign, HERO_TEXT_ALIGNS, DESIGN_FALLBACK.textAlign),
          background: text(homepage.heroBackground),
          textColor: text(homepage.heroTextColor),
          overlayColor: text(homepage.heroOverlayColor) || DESIGN_FALLBACK.overlayColor,
          overlayOpacity: clampNumber(homepage.heroOverlayOpacity, 0, 100, DESIGN_FALLBACK.overlayOpacity),
          autoplay: typeof homepage.heroAutoplay === 'boolean' ? homepage.heroAutoplay : DESIGN_FALLBACK.autoplay,
          intervalSeconds: clampNumber(homepage.heroIntervalSeconds, 3, 15, DESIGN_FALLBACK.intervalSeconds),
        },
      });
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const sourceSlides = preview ? preview.slides : slides;
  const ctaSecondaryLabel = preview?.secondaryLabel || secondaryLabel;
  const ctaSecondaryUrl = preview?.secondaryUrl || secondaryUrl;
  const look = preview?.design ?? { ...DESIGN_FALLBACK, ...design };

  const safeSlides = sourceSlides.filter(
    (slide) => slide.title.trim() && slide.img.trim() && slide.href.trim(),
  );
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const activeIndex = safeSlides.length > 0 ? Math.min(idx, safeSlides.length - 1) : 0;

  const prev = useCallback(() => {
    setIdx((i) => (safeSlides.length > 1 ? (i - 1 + safeSlides.length) % safeSlides.length : 0));
  }, [safeSlides.length]);

  const next = useCallback(() => {
    setIdx((i) => (safeSlides.length > 1 ? (i + 1) % safeSlides.length : 0));
  }, [safeSlides.length]);

  useEffect(() => {
    if (paused || !look.autoplay || safeSlides.length < 2) return;
    const timer = window.setInterval(next, look.intervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [next, paused, safeSlides.length, look.autoplay, look.intervalSeconds]);

  if (safeSlides.length === 0) return null;
  const slide = safeSlides[activeIndex];
  const price = parseFloat(slide.price);

  return (
    <section
      className={styles.hero}
      data-layout={look.layout}
      data-height={look.height}
      data-align={look.textAlign}
      style={
        {
          '--hero-bg': look.background || undefined,
          '--hero-text': look.textColor || undefined,
          '--hero-overlay':
            look.layout === 'image-full'
              ? overlayFrom(look.overlayColor, look.overlayOpacity)
              : undefined,
        } as CSSProperties
      }
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={styles.heroInner}>
        {/* Left — text */}
        <div className={styles.heroContent}>
          {slide.category ? (
            <span className={styles.heroCategory}>{slide.category}</span>
          ) : null}
          <h1 className={styles.heroTitle}>{slide.title}</h1>
          {price > 0 ? (
            <p className={styles.heroPrice}>€{price.toFixed(2)}</p>
          ) : null}
          <div className={styles.heroActions}>
            <Link href={slide.href} className={styles.heroCta}>
              <ShoppingBag size={17} aria-hidden="true" />
              {slide.ctaLabel?.trim() || 'Shiko produktin'}
            </Link>
            <Link href={ctaSecondaryUrl} className={styles.heroCtaSecondary}>
              {ctaSecondaryLabel}
            </Link>
          </div>
        </div>

        {/* Right — image */}
        <div className={styles.heroImageWrap}>
          {safeSlides.map((item, index) => (
            <Link key={`${item.href}-${index}`} href={item.href} tabIndex={index === activeIndex ? 0 : -1}>
              <img
                src={item.img}
                alt={item.title}
                className={styles.heroImg}
                data-active={index === activeIndex ? 'true' : 'false'}
              />
            </Link>
          ))}
        </div>
      </div>

      {safeSlides.length > 1 ? (
        <>
          <button type="button" className={styles.heroArrowBtn} data-dir="prev" aria-label="Slide paraardhës" onClick={prev}>
            <ChevronLeft size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button type="button" className={styles.heroArrowBtn} data-dir="next" aria-label="Slide pasardhës" onClick={next}>
            <ChevronRight size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <div className={styles.heroDots} role="group" aria-label="Navigim">
            {safeSlides.map((item, index) => (
              <button
                key={`${item.href}-dot-${index}`}
                type="button"
                className={styles.heroDot}
                data-active={index === activeIndex ? 'true' : 'false'}
                aria-label={`Slajdi ${index + 1}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                onClick={() => setIdx(index)}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
