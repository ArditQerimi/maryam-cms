'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { LOCALE_COOKIE, type Locale } from './config';
import type { Dictionary } from './dictionaries/en';

export type Translator = (
  key: keyof Dictionary,
  params?: Record<string, string | number>,
) => string;

type LocaleContextValue = {
  locale: Locale;
  dict: Dictionary;
  t: Translator;
  /** Writes the locale cookie and re-renders the server tree. */
  setLocale: (next: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function interpolate(raw: string, params?: Record<string, string | number>): string {
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (token, name) =>
    name in params ? String(params[name]) : token,
  );
}

/**
 * Provided once by the `/home` layout with the cookie-resolved locale and its
 * dictionary. Client components read copy via `useLocale()`; the switcher
 * persists the choice and asks the server for a fresh render.
 */
export function LocaleProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: ReactNode;
}) {
  const router = useRouter();

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return;
      document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
      document.documentElement.lang = next;
      router.refresh();
    },
    [locale, router],
  );

  // Keep <html lang> truthful even on the first client render after a
  // server-side locale switch (the root layout hardcodes `lang="sq"`).
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback<Translator>(
    (key, params) => interpolate(dict[key], params),
    [dict],
  );

  const value = useMemo(
    () => ({ locale, dict, t, setLocale }),
    [locale, dict, t, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within <LocaleProvider> (see /home layout)');
  }
  return ctx;
}
