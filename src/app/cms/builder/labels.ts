import type { Dictionary } from '@/lib/i18n/dictionaries/en';

export type Translate = (key: keyof Dictionary, params?: Record<string, string | number>) => string;

/**
 * Dictionary key for a registry/UI string, derived from its English text so
 * the block registry (`blocks.ts`) and the option lists stay locale-agnostic
 * data while the UI renders the active locale.
 *
 * Returns `null` for strings with nothing to translate (numbers, symbols).
 */
export function labelKey(text: string): keyof Dictionary | null {
  if (!/[a-z]/i.test(text)) return null;
  const slug = text
    .toLowerCase()
    .replace(/%/g, ' percent')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) return null;
  return `cmscontent.builder.lbl.${slug}` as keyof Dictionary;
}

/** Translate a registry/UI string, falling back to the source text. */
export function tr(t: Translate, text: string): string {
  const key = labelKey(text);
  if (!key) return text;
  const translated = t(key);
  return typeof translated === 'string' && translated ? translated : text;
}
