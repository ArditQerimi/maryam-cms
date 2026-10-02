import { cookies } from 'next/headers';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  normalizeLocale,
  type Locale,
} from './config';
import { en, type Dictionary } from './dictionaries/en';
import { sq } from './dictionaries/sq';

export type { Dictionary };

/** Locale for the current request: cookie → default (Albanian). */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value) ?? DEFAULT_LOCALE;
}

const DICTIONARIES: Record<Locale, Dictionary> = { en, sq };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

export type Translator = (
  key: keyof Dictionary,
  params?: Record<string, string | number>,
) => string;

function interpolate(raw: string, params?: Record<string, string | number>): string {
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (token, name) =>
    name in params ? String(params[name]) : token,
  );
}

export function createTranslator(dict: Dictionary): Translator {
  return (key, params) => interpolate(dict[key], params);
}

/**
 * Server-component shortcut: `const t = await getT();` then `t('contact.title')`.
 * For client components use `useLocale()` from `@/lib/i18n/LocaleProvider`.
 */
export async function getT(): Promise<Translator> {
  return createTranslator(getDictionary(await getLocale()));
}
