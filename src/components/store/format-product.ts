/**
 * Product field codecs shared by the CMS product editor and its server actions.
 *
 * Conventions (kept compatible with the storefront + products-admin lib):
 *  - `products.description` stores a JSON envelope `{ text, short, manufacturer }`
 *    when a short description/manufacturer exists, otherwise plain HTML or null.
 *    The storefront only reads `.text`.
 *  - `products.imageUrl` stores a JSON array of `{ src, … }` image objects
 *    (first = featured). Plain single URLs are still tolerated on read.
 *  - Per-product CMS settings (sale window, backorder policy) live in
 *    `settings_store` under `products_config_{productId}` because the `products`
 *    table has no sale-price / sale-date / backorder columns.
 */

import {
  EMPTY_PRODUCT_CONFIG,
  type BackorderPolicy,
  type ProductConfig,
} from './types';

/* -------------------------------------------------------------------------- */
/* Description envelope                                                        */
/* -------------------------------------------------------------------------- */

export type ParsedDescription = {
  full: string;
  short: string;
  manufacturer: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseProductDescription(raw: string | null | undefined): ParsedDescription {
  if (!raw) return { full: '', short: '', manufacturer: '' };
  const trimmed = raw.trim();
  if (!trimmed) return { full: '', short: '', manufacturer: '' };

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!isRecord(parsed)) return { full: trimmed, short: '', manufacturer: '' };
    const text = typeof parsed.text === 'string' ? parsed.text : '';
    const short = typeof parsed.short === 'string' ? parsed.short : '';
    const manufacturer = typeof parsed.manufacturer === 'string' ? parsed.manufacturer : '';
    if (!text && !short && !manufacturer) return { full: trimmed, short: '', manufacturer: '' };
    return { full: text, short, manufacturer };
  } catch {
    return { full: trimmed, short: '', manufacturer: '' };
  }
}

export function serializeProductDescription(
  full: string,
  short: string,
  manufacturer = '',
): string | null {
  const text = full.trim() || short.trim();
  if (!text && !short.trim() && !manufacturer.trim()) return null;
  // Always emit the envelope so the short description round-trips; the
  // storefront reads `.text` and legacy plain-HTML rows keep working.
  return JSON.stringify({
    text,
    short: short.trim(),
    manufacturer: manufacturer.trim(),
  });
}

/* -------------------------------------------------------------------------- */
/* Images / gallery                                                            */
/* -------------------------------------------------------------------------- */

function safeImageCandidate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.username && !parsed.password) {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

/** Read `products.imageUrl` back into a plain URL list (featured first). */
export function parseProductImages(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  let parsed: unknown = trimmed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const direct = safeImageCandidate(trimmed);
    return direct ? [direct] : [];
  }

  const values = Array.isArray(parsed) ? parsed : [parsed];
  const images: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value === 'string') {
      const candidate = safeImageCandidate(value);
      if (candidate && !seen.has(candidate)) {
        seen.add(candidate);
        images.push(candidate);
      }
      continue;
    }
    if (!isRecord(value)) continue;
    for (const key of ['src', 'url', 'secure_url']) {
      const candidate = safeImageCandidate(value[key]);
      if (candidate && !seen.has(candidate)) {
        seen.add(candidate);
        images.push(candidate);
      }
      if (candidate) break;
    }
  }
  return images;
}

/** Write the URL list back into `products.imageUrl` (products-admin format). */
export function serializeProductImages(urls: string[]): string | null {
  const cleaned = urls.map((url) => url.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;
  return JSON.stringify(cleaned.map((src) => ({ src })));
}

/** First image URL for table thumbnails. */
export function primaryImage(raw: string | null | undefined): string | null {
  return parseProductImages(raw)[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Per-product CMS config (settings_store)                                     */
/* -------------------------------------------------------------------------- */

export function productConfigKey(productId: number): string {
  return `products_config_${productId}`;
}

function toBackorder(value: unknown): BackorderPolicy {
  return value === 'notify' || value === 'allow' ? value : 'deny';
}

function toDateString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

export function parseProductConfig(raw: string | null | undefined): ProductConfig {
  if (!raw) return { ...EMPTY_PRODUCT_CONFIG };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { ...EMPTY_PRODUCT_CONFIG };
    return {
      salePrice: typeof parsed.salePrice === 'string' ? parsed.salePrice : '',
      saleFrom: toDateString(parsed.saleFrom),
      saleTo: toDateString(parsed.saleTo),
      backorder: toBackorder(parsed.backorder),
    };
  } catch {
    return { ...EMPTY_PRODUCT_CONFIG };
  }
}

/** null when the config holds nothing worth persisting. */
export function serializeProductConfig(config: ProductConfig): string | null {
  const hasSale = config.salePrice.trim() !== '';
  const hasWindow = config.saleFrom || config.saleTo;
  const hasBackorder = config.backorder !== 'deny';
  if (!hasSale && !hasWindow && !hasBackorder) return null;
  return JSON.stringify({
    salePrice: hasSale ? config.salePrice.trim() : '',
    saleFrom: config.saleFrom,
    saleTo: config.saleTo,
    backorder: config.backorder,
  });
}
