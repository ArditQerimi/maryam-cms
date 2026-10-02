'use client';

import { LOCALES, type Locale } from '@/lib/i18n/config';
import { useLocale } from '@/lib/i18n/LocaleProvider';

const LABELS: Record<Locale, string> = { sq: 'SQ', en: 'EN' };

/**
 * SQ/EN toggle. `storefront` (default) relies on `.site-lang-switch` from
 * base-globals.css; `admin` is self-styled with Tailwind for the CMS topbar.
 * On the storefront keep it the LAST child of `site-actions` — the mobile
 * `nth-child` rules hide the icon buttons by position.
 */
export default function LanguageSwitcher({
  variant = 'storefront',
}: {
  variant?: 'storefront' | 'admin';
}) {
  const { locale, t, setLocale } = useLocale();
  const admin = variant === 'admin';

  return (
    <div
      role="group"
      aria-label={t('header.lang.label')}
      className={
        admin
          ? 'inline-flex items-center gap-0.5 rounded-lg border border-zinc-200 p-0.5'
          : 'site-lang-switch'
      }
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
          className={
            admin
              ? `rounded-md px-1.5 py-1 text-[11px] font-bold tracking-wide transition ${
                  locale === code
                    ? 'bg-[#6d6be8] text-white'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`
              : undefined
          }
        >
          {LABELS[code]}
        </button>
      ))}
    </div>
  );
}
