'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useLocale } from '@/lib/i18n/LocaleProvider';

type Suggestion = {
  id: number;
  name: string;
  price: string | null;
  image: string | null;
  href: string;
};

const priceFormat = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });

/**
 * Header search bar: a white strip across the top of the page with live
 * product suggestions while typing (from /api/storefront/search). Enter or the
 * button opens the full results on /home/products?q=…
 */
export default function HeaderSearch({ onClose }: { onClose: () => void }) {
  const { t } = useLocale();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [searched, setSearched] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/storefront/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { items?: Suggestion[] };
        setItems(Array.isArray(data.items) ? data.items : []);
        setSearched(term);
      } catch {
        /* aborted or offline: keep the previous list */
      }
    }, 220);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const term = query.trim();
  const showResults = term.length >= 2 && searched === term;
  const fullResultsHref = `/home/products?q=${encodeURIComponent(term)}`;

  return (
    <div
      className="site-search-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('header.search.title')}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div className="site-search-panel">
        <div className="site-search-box">
          <form
            className="site-search-form"
            action="/home/products"
            method="get"
            role="search"
            onSubmit={(event) => {
              if (!term) {
                event.preventDefault();
                inputRef.current?.focus();
                return;
              }
              onClose();
            }}
          >
            <input
              ref={inputRef}
              type="search"
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('header.search.placeholder')}
              aria-label={t('header.search.title')}
              aria-controls="site-search-results"
              autoComplete="off"
              autoFocus
            />
            <button type="submit">{t('header.search.submit')}</button>
          </form>

          {showResults ? (
            <div className="site-search-results" id="site-search-results" role="listbox">
              {items.length === 0 ? (
                <p className="site-search-empty">{t('header.search.empty')}</p>
              ) : (
                <>
                  {items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="site-search-result"
                      role="option"
                      aria-selected={false}
                      onClick={onClose}
                    >
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image} alt="" loading="lazy" />
                      ) : (
                        <span className="site-search-result-thumb" aria-hidden="true" />
                      )}
                      <span className="site-search-result-name">{item.name}</span>
                      {item.price != null && Number.isFinite(Number(item.price)) ? (
                        <span className="site-search-result-price">
                          {priceFormat.format(Number(item.price))}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                  <Link href={fullResultsHref} className="site-search-all" onClick={onClose}>
                    {t('header.search.all')}
                  </Link>
                </>
              )}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="site-search-close"
          aria-label={t('header.search.close')}
          onClick={onClose}
        >
          <X size={26} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
