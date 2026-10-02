'use client';

import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { Dictionary } from '@/lib/i18n/dictionaries/en';
import { labelKey } from './labels';

/**
 * Localized-text islands.
 *
 * `BlockRenderer` is shared by the builder canvas and the storefront and must
 * stay a hook-free (server-renderable) component, so its copy is rendered
 * through these tiny client components instead of a `t()` call.
 */

/** A raw dictionary key, rendered in the active locale. */
export function T({
  k,
  params,
}: {
  k: string;
  params?: Record<string, string | number>;
}) {
  const { t } = useLocale();
  return <>{t(k as keyof Dictionary, params)}</>;
}

/** A registry/UI label (block names, descriptions, empty states). */
export function L({ text }: { text: string }) {
  const { t } = useLocale();
  const key = labelKey(text);
  return <>{key ? t(key) : text}</>;
}

/** Dictionary key for `product-sources.ts`' `sourceEmptyCopy()` copy. */
export function sourceEmptyKey(source: unknown): keyof Dictionary {
  switch (String(source ?? 'latest')) {
    case 'manual':
      return 'cmscontent.builder.sourceManual';
    case 'category':
      return 'cmscontent.builder.sourceCategory';
    case 'discounted':
      return 'cmscontent.builder.sourceDiscounted';
    case 'best_sellers':
      return 'cmscontent.builder.sourceBestSellers';
    case 'featured':
      return 'cmscontent.builder.sourceFeatured';
    default:
      return 'cmscontent.builder.sourceDefault';
  }
}

/** Why the product section is empty, in the active locale. */
export function SourceCopy({ source }: { source: unknown }) {
  const { t } = useLocale();
  return <>{t(sourceEmptyKey(source))}</>;
}
