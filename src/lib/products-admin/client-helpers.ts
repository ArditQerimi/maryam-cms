export const PRODUCT_FIELD_LIMITS = {
  name: 255,
  slug: 180,
  sku: 100,
  barcode: 100,
  itemCode: 100,
  description: 10_000,
  manufacturer: 255,
  variantName: 255,
  attributeValue: 2_000,
  imageName: 255,
  imageSize: 40,
  publicId: 512,
  images: 10,
  attributes: 100,
  variants: 50,
  optionValuesPerVariant: 12,
} as const;

function takeCodePoints(value: string, max: number) {
  return Array.from(value).slice(0, max).join('');
}

export function slugifyProductText(value: string) {
  const slug = value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return takeCodePoints(slug, PRODUCT_FIELD_LIMITS.slug).replace(/-+$/g, '');
}

export function toSafeMediaSegment(value: string, fallback: string) {
  const normalized = value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/g, '');
  return normalized || fallback;
}
