/**
 * Storefront locales. The `/cms` admin panel stays English (merchant tooling);
 * only the public storefront (`/home`) is bilingual.
 *
 * The locale lives in a cookie instead of the URL prefix (`/en/...`) the
 * Next.js i18n guide suggests: every route, link, form action and e2e test in
 * this app already points at `/home/...`, and re-nesting the whole tree under
 * `app/[lang]` would break all of them. Localization (dictionaries) follows
 * the guide; only routing differs.
 */
export const LOCALES = ['sq', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

/** Albanian — matches `<html lang="sq">` and the store's original copy. */
export const DEFAULT_LOCALE: Locale = 'sq';

export const LOCALE_COOKIE = 'maryam_locale';

/** Accepts `en`, `en-GB`, `sq_AL`… and rejects anything unknown. */
export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  if (lower === 'sq' || lower === 'en') return lower;
  const base = lower.split(/[-_]/)[0];
  return base === 'sq' || base === 'en' ? base : null;
}
