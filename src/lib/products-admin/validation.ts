import { parseImageUrl } from '@/lib/image-url';
import {
  PRODUCT_FIELD_LIMITS,
  slugifyProductText,
} from './client-helpers';
import type {
  ProductActionState,
  ProductAttributeDataType,
  ProductCatalogStatus,
  ProductDiscountType,
  ProductField,
  ProductImageDTO,
  ProductKind,
} from './types';

export { PRODUCT_FIELD_LIMITS, slugifyProductText, toSafeMediaSegment } from './client-helpers';

const SAFE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;
const FORBIDDEN_TEXT = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const MAX_INTEGER = 1_000_000;
const CONCURRENCY_TOKEN_PATTERN = /^sha256:[a-f0-9]{64}$/;

export type ValidatedProductAttribute = {
  attributeId: number;
  value: string;
};

export type ValidatedProductVariant = {
  existingVariantId: number | null;
  attributeValueIds: number[];
  sku: string;
  barcode: string | null;
  price: string;
  costPrice: string;
  status: ProductCatalogStatus;
  quantity: number;
  minStockLevel: number;
};

export type ValidatedProductInput = {
  name: string;
  slug: string;
  sku: string;
  barcode: string | null;
  itemCode: string | null;
  productType: ProductKind;
  categoryId: number;
  subCategoryId: number | null;
  brandId: number;
  unitId: number;
  warrantyId: number | null;
  warehouseId: number;
  price: string;
  costPrice: string;
  taxRate: string;
  discountType: ProductDiscountType;
  discountValue: string;
  status: ProductCatalogStatus;
  stockQuantity: number;
  minStockLevel: number;
  description: string;
  manufacturer: string;
  manufacturedDate: Date | null;
  expiryDate: Date | null;
  images: ProductImageDTO[];
  attributes: ValidatedProductAttribute[];
  variants: ValidatedProductVariant[];
  concurrencyToken: string | null;
};

export class ProductValidationError extends Error {
  readonly fieldErrors: ProductActionState['fieldErrors'];

  constructor(fieldErrors: ProductActionState['fieldErrors'], message?: string) {
    super(message || Object.values(fieldErrors).find(Boolean) || 'The product data is invalid.');
    this.name = 'ProductValidationError';
    this.fieldErrors = fieldErrors;
  }
}

function fail(field: ProductField, message: string): never {
  throw new ProductValidationError({ [field]: message }, message);
}

function codePointLength(value: string) {
  return Array.from(value).length;
}

function formEntry(formData: FormData, name: string) {
  const value = formData.get(name);
  if (value !== null && typeof value !== 'string') fail(name as ProductField, `${name} must be text.`);
  return typeof value === 'string' ? value : '';
}

function optionalFormEntry(formData: FormData, name: string) {
  return formEntry(formData, name).trim() || null;
}

export function parsePositiveInteger(value: unknown): number | null {
  const candidate = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d{1,10}$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  return Number.isSafeInteger(candidate) && candidate > 0 ? candidate : null;
}

function requiredId(formData: FormData, name: ProductField, label: string) {
  const id = parsePositiveInteger(formEntry(formData, name));
  if (!id) fail(name, `Select a valid ${label}.`);
  return id;
}

function optionalId(formData: FormData, name: ProductField, label: string) {
  const raw = optionalFormEntry(formData, name);
  if (raw === null) return null;
  const id = parsePositiveInteger(raw);
  if (!id) fail(name, `Select a valid ${label}.`);
  return id;
}

function boundedText(
  raw: string,
  field: ProductField,
  label: string,
  max: number,
  options: { required?: boolean; multiline?: boolean } = {},
) {
  const normalized = raw.normalize('NFKC').trim();
  const forbidden = options.multiline
    ? /[\u0000\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u
    : FORBIDDEN_TEXT;
  if (forbidden.test(normalized)) fail(field, `${label} contains unsupported control characters.`);
  if (options.required && !normalized) fail(field, `${label} is required.`);
  if (codePointLength(normalized) > max) fail(field, `${label} must be ${max.toLocaleString('en-US')} characters or fewer.`);
  return normalized;
}

function optionalBoundedText(raw: string, field: ProductField, label: string, max: number) {
  const normalized = boundedText(raw, field, label, max);
  return normalized || null;
}

function parseSlug(raw: string, name: string) {
  const requested = raw.trim() || name;
  const slug = slugifyProductText(requested);
  if (!slug || codePointLength(slug) > PRODUCT_FIELD_LIMITS.slug || !SLUG_PATTERN.test(slug)) {
    fail('slug', 'Enter a valid product slug using letters, numbers, and single hyphens.');
  }
  return slug;
}

function parseSku(raw: string, field: ProductField, label: string) {
  const sku = raw.normalize('NFKC').trim();
  if (!sku) fail(field, `${label} is required.`);
  if (codePointLength(sku) > PRODUCT_FIELD_LIMITS.sku || CONTROL_CHARACTERS.test(sku) || !SKU_PATTERN.test(sku)) {
    fail(field, `${label} may contain ASCII letters, numbers, dots, underscores, and hyphens only.`);
  }
  return sku;
}

export function normalizeMoney(
  raw: string,
  field: ProductField,
  label: string,
  options: { required?: boolean; maxIntegerDigits?: number } = {},
) {
  const value = raw.normalize('NFKC').trim();
  if (!value && !options.required) return '0.00';
  const maxIntegerDigits = options.maxIntegerDigits ?? 10;
  const pattern = new RegExp(`^\\d{1,${maxIntegerDigits}}(?:\\.\\d{1,2})?$`);
  if (!pattern.test(value)) fail(field, `${label} must be a non-negative amount with no more than two decimal places.`);
  const [whole, fraction = ''] = value.split('.');
  return `${BigInt(whole)}.${fraction.padEnd(2, '0')}`;
}

function parseInteger(
  raw: string,
  field: ProductField,
  label: string,
  options: { required?: boolean; fallback?: number } = {},
) {
  const value = raw.trim();
  if (!value && !options.required) return options.fallback ?? 0;
  if (!/^\d{1,7}$/.test(value)) fail(field, `${label} must be a whole number from 0 to ${MAX_INTEGER.toLocaleString('en-US')}.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > MAX_INTEGER) {
    fail(field, `${label} must be between 0 and ${MAX_INTEGER.toLocaleString('en-US')}.`);
  }
  return parsed;
}

function parseDate(raw: string, field: ProductField, label: string) {
  const value = raw.trim();
  if (!value) return null;
  if (!SAFE_DATE_PATTERN.test(value)) fail(field, `${label} is invalid.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail(field, `${label} is invalid.`);
  const year = date.getUTCFullYear();
  if (year < 1900 || year > 2200) fail(field, `${label} must be between 1900 and 2200.`);
  return date;
}

function parseJsonField(raw: string, field: ProductField, label: string, maxBytes: number): unknown {
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) fail(field, `${label} is too large.`);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    fail(field, `${label} is malformed. Refresh the page and try again.`);
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseAttributeValue(value: unknown) {
  if (typeof value === 'string') return value.normalize('NFKC').trim();
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

export function parseProductAttributes(raw: string): ValidatedProductAttribute[] {
  if (!raw.trim()) return [];
  const parsed = parseJsonField(raw, 'attributes', 'Category attributes', 100_000);
  if (!Array.isArray(parsed)) fail('attributes', 'Category attributes are malformed.');
  if (parsed.length > PRODUCT_FIELD_LIMITS.attributes) fail('attributes', 'Too many category attributes were submitted.');

  const seen = new Set<number>();
  return parsed.map((entry) => {
    if (!isPlainRecord(entry)) fail('attributes', 'A category attribute is malformed.');
    const attributeId = parsePositiveInteger(entry.attributeId);
    if (!attributeId) fail('attributes', 'A category attribute ID is invalid.');
    if (seen.has(attributeId)) fail('attributes', 'A category attribute was submitted more than once.');
    seen.add(attributeId);

    const value = parseAttributeValue(entry.value);
    if (value === null) fail('attributes', 'A category attribute value is invalid.');
    if (CONTROL_CHARACTERS.test(value) || codePointLength(value) > PRODUCT_FIELD_LIMITS.attributeValue) {
      fail('attributes', 'A category attribute value is too long or contains control characters.');
    }
    return { attributeId, value };
  });
}

function hasSensitiveImageQuery(src: string) {
  try {
    const parsed = new URL(src, 'https://image-metadata.invalid');
    return Array.from(parsed.searchParams.keys()).some((key) => /(?:api[_-]?key|api[_-]?secret|signature|secret|token|password)/i.test(key));
  } catch {
    return true;
  }
}

function safePublicId(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') fail('imageUrl', 'Image metadata is invalid.');
  const publicId = value.normalize('NFKC').trim();
  if (
    !publicId
    || publicId.length > PRODUCT_FIELD_LIMITS.publicId
    || publicId.startsWith('/')
    || publicId.includes('\\')
    || CONTROL_CHARACTERS.test(publicId)
    || publicId.split('/').some((segment) => !segment || segment === '.' || segment === '..' || !/^[A-Za-z0-9._-]+$/.test(segment))
  ) {
    fail('imageUrl', 'Image public ID metadata is invalid.');
  }
  return publicId;
}

export function parseProductImages(raw: string): ProductImageDTO[] {
  if (!raw.trim()) return [];
  const parsed = parseJsonField(raw, 'imageUrl', 'Image metadata', 64_000);
  if (!Array.isArray(parsed)) fail('imageUrl', 'Image metadata must be a JSON array.');
  if (parsed.length > PRODUCT_FIELD_LIMITS.images) fail('imageUrl', `Upload no more than ${PRODUCT_FIELD_LIMITS.images} product images.`);

  const seen = new Set<string>();
  return parsed.map((entry) => {
    if (!isPlainRecord(entry)) fail('imageUrl', 'An image metadata entry is malformed.');
    const src = typeof entry.src === 'string' ? parseImageUrl(entry.src) : '';
    if (!src || src.length > 2_048 || CONTROL_CHARACTERS.test(src) || hasSensitiveImageQuery(src)) {
      fail('imageUrl', 'An image URL is unsafe or invalid.');
    }
    if (seen.has(src)) fail('imageUrl', 'Duplicate product images are not allowed.');
    seen.add(src);

    const name = boundedText(
      typeof entry.name === 'string' ? entry.name : '',
      'imageUrl',
      'Image name',
      PRODUCT_FIELD_LIMITS.imageName,
      { required: true },
    );
    if (name === '.' || name === '..' || /[\\/]/.test(name)) fail('imageUrl', 'Image name metadata is invalid.');
    const size = boundedText(
      typeof entry.size === 'string' ? entry.size : '',
      'imageUrl',
      'Image size',
      PRODUCT_FIELD_LIMITS.imageSize,
      { required: true },
    );
    const publicId = safePublicId(entry.publicId);
    return { src, name, size, ...(publicId ? { publicId } : {}) };
  });
}

export function parseStoredProductImages(raw: string | null): ProductImageDTO[] {
  if (!raw) return [];
  try {
    return parseProductImages(raw);
  } catch {
    // Preserve a legacy plain URL until the next successful save. It is
    // normalized into the current JSON shape before it reaches the client.
    const src = parseImageUrl(raw);
    return src && !hasSensitiveImageQuery(src) ? [{ src, name: 'Product image', size: 'Legacy image' }] : [];
  }
}

function parseVariants(
  raw: string,
  productType: ProductKind,
  defaults: { sku: string; price: string; costPrice: string; stockQuantity: number; minStockLevel: number },
) {
  if (productType === 'simple') {
    let existingVariantId: number | null = null;
    if (raw.trim()) {
      const parsed = parseJsonField(raw, 'variants', 'Default variant', 10_000);
      if (!Array.isArray(parsed) || parsed.length !== 1 || !isPlainRecord(parsed[0])) {
        fail('variants', 'Simple products require exactly one Default variant.');
      }
      const rawId = parsed[0].existingVariantId;
      if (rawId !== null && rawId !== undefined && rawId !== '') {
        existingVariantId = parsePositiveInteger(rawId);
        if (!existingVariantId) fail('variants', 'The existing Default variant ID is invalid.');
      }
    }
    return [{
      existingVariantId,
      attributeValueIds: [],
      sku: defaults.sku,
      barcode: null,
      price: defaults.price,
      costPrice: defaults.costPrice,
      status: 'Active' as const,
      quantity: defaults.stockQuantity,
      minStockLevel: defaults.minStockLevel,
    } satisfies ValidatedProductVariant];
  }

  const parsed = parseJsonField(raw, 'variants', 'Variants', 200_000);
  if (!Array.isArray(parsed) || parsed.length === 0) fail('variants', 'Add at least one option variant.');
  if (parsed.length > PRODUCT_FIELD_LIMITS.variants) {
    fail('variants', `A product can contain at most ${PRODUCT_FIELD_LIMITS.variants} variants.`);
  }

  const seenIds = new Set<number>();
  const seenSkus = new Set<string>();
  const seenCombinations = new Set<string>();
  const variants = parsed.map((entry): ValidatedProductVariant => {
    if (!isPlainRecord(entry)) fail('variants', 'A variant is malformed.');

    const rawId = entry.existingVariantId;
    const existingVariantId = rawId === null || rawId === undefined || rawId === ''
      ? null
      : parsePositiveInteger(rawId);
    if (rawId !== null && rawId !== undefined && rawId !== '' && !existingVariantId) {
      fail('variants', 'A variant ID is invalid.');
    }
    if (existingVariantId) {
      if (seenIds.has(existingVariantId)) fail('variants', 'A variant was submitted more than once.');
      seenIds.add(existingVariantId);
    }

    if (!Array.isArray(entry.attributeValueIds) || entry.attributeValueIds.length === 0) {
      fail('variants', 'Every option variant must select option values.');
    }
    if (entry.attributeValueIds.length > PRODUCT_FIELD_LIMITS.optionValuesPerVariant) {
      fail('variants', 'A variant has too many option values.');
    }
    const attributeValueIds = entry.attributeValueIds.map((value) => {
      const id = parsePositiveInteger(value);
      if (!id) fail('variants', 'An option value ID is invalid.');
      return id;
    });
    if (new Set(attributeValueIds).size !== attributeValueIds.length) {
      fail('variants', 'A variant contains a duplicate option value.');
    }
    const combination = [...attributeValueIds].sort((left, right) => left - right).join(':');
    if (seenCombinations.has(combination)) fail('variants', 'Variant option combinations must be unique.');
    seenCombinations.add(combination);

    const sku = parseSku(typeof entry.sku === 'string' ? entry.sku : '', 'variants', 'Variant SKU');
    const normalizedSku = sku.toLocaleLowerCase('en-US');
    if (seenSkus.has(normalizedSku)) fail('variants', 'Variant SKUs must be unique, ignoring letter case.');
    seenSkus.add(normalizedSku);

    const status = entry.status === 'Active' || entry.status === 'Inactive' ? entry.status : null;
    if (!status) fail('variants', 'Every variant must have an Active or Inactive status.');

    return {
      existingVariantId,
      attributeValueIds,
      sku,
      barcode: optionalBoundedText(
        typeof entry.barcode === 'string' ? entry.barcode : '',
        'variants',
        'Variant barcode',
        PRODUCT_FIELD_LIMITS.barcode,
      ),
      price: normalizeMoney(typeof entry.price === 'string' ? entry.price : '', 'variants', 'Variant price', { required: true }),
      costPrice: normalizeMoney(typeof entry.costPrice === 'string' ? entry.costPrice : '', 'variants', 'Variant cost'),
      status,
      quantity: parseInteger(
        typeof entry.quantity === 'string' || typeof entry.quantity === 'number' ? String(entry.quantity) : '',
        'variants',
        'Variant stock',
        { required: true },
      ),
      minStockLevel: parseInteger(
        typeof entry.minStockLevel === 'string' || typeof entry.minStockLevel === 'number' ? String(entry.minStockLevel) : '',
        'variants',
        'Variant minimum stock',
      ),
    };
  });

  if (!variants.some((variant) => variant.status === 'Active')) {
    fail('variants', 'At least one variant must be Active.');
  }
  return variants;
}

export function assertCaseInsensitiveUnique(values: readonly string[], field: ProductField, label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = value.trim().toLocaleLowerCase('en-US');
    if (seen.has(normalized)) fail(field, `${label} must be unique, ignoring letter case.`);
    seen.add(normalized);
  }
}

export function validateProductForm(
  formData: FormData,
  options: { mode: 'create' | 'edit' },
): ValidatedProductInput {
  const serverOwnedFields = ['companyId', 'tenantId', 'dbSchema', 'userId', 'roleId', 'tenantRoleId', 'storeId', 'permissions', 'platformRole', 'isPlatformUser'];
  if (serverOwnedFields.some((field) => formData.has(field))) {
    fail('form', 'Server-owned identity and tenant fields cannot be submitted by the form.');
  }

  const name = boundedText(formEntry(formData, 'name'), 'name', 'Product name', PRODUCT_FIELD_LIMITS.name, { required: true });
  const slug = parseSlug(formEntry(formData, 'slug'), name);
  const sku = parseSku(formEntry(formData, 'sku'), 'sku', 'Product SKU');
  const productType = formEntry(formData, 'productType') === 'options' ? 'options' : formEntry(formData, 'productType') === 'simple' ? 'simple' : null;
  if (!productType) fail('productType', 'Choose a valid product type.');

  const status = formEntry(formData, 'status');
  if (status !== 'Active' && status !== 'Inactive') fail('status', 'Choose Active or Inactive status.');

  const price = productType === 'simple'
    ? normalizeMoney(formEntry(formData, 'price'), 'price', 'Price', { required: true })
    : '0.00';
  const costPrice = productType === 'simple'
    ? normalizeMoney(formEntry(formData, 'costPrice'), 'costPrice', 'Cost price')
    : '0.00';
  const stockQuantity = productType === 'simple'
    ? parseInteger(formEntry(formData, 'stockQuantity'), 'stockQuantity', 'Stock quantity', { required: true })
    : 0;
  const minStockLevel = productType === 'simple'
    ? parseInteger(formEntry(formData, 'minStockLevel'), 'minStockLevel', 'Minimum stock level')
    : 0;

  const rawDiscountType = formEntry(formData, 'discountType');
  const discountType: ProductDiscountType = rawDiscountType === 'Percentage' || rawDiscountType === 'Flat'
    ? rawDiscountType
    : null;
  const discountValue = normalizeMoney(formEntry(formData, 'discountValue'), 'discountValue', 'Discount value');
  if (rawDiscountType && rawDiscountType !== 'Percentage' && rawDiscountType !== 'Flat') {
    fail('discountType', 'Choose a valid discount type.');
  }
  if (!discountType && discountValue !== '0.00') fail('discountValue', 'Choose a discount type or set the discount to zero.');
  if (discountType === 'Percentage' && Number(discountValue) > 100) fail('discountValue', 'A percentage discount cannot exceed 100.');

  const manufacturedDate = parseDate(formEntry(formData, 'manufacturedDate'), 'manufacturedDate', 'Manufactured date');
  const expiryDate = parseDate(formEntry(formData, 'expiryDate'), 'expiryDate', 'Expiry date');
  if (manufacturedDate && expiryDate && expiryDate < manufacturedDate) {
    fail('expiryDate', 'Expiry date cannot be before the manufactured date.');
  }

  const concurrencyToken = optionalFormEntry(formData, 'concurrencyToken');
  if (options.mode === 'edit') {
    if (!concurrencyToken || !CONCURRENCY_TOKEN_PATTERN.test(concurrencyToken)) {
      fail('concurrencyToken', 'This editor is stale. Reload the product before saving.');
    }
  } else if (concurrencyToken) {
    fail('concurrencyToken', 'A new product cannot include an edit token.');
  }

  const variants = parseVariants(
    formEntry(formData, 'variants'),
    productType,
    { sku, price, costPrice, stockQuantity, minStockLevel },
  );
  if (options.mode === 'create' && variants.some((variant) => variant.existingVariantId !== null)) {
    fail('variants', 'A new product cannot include an existing variant ID.');
  }

  return {
    name,
    slug,
    sku,
    barcode: optionalBoundedText(formEntry(formData, 'barcode'), 'barcode', 'Barcode', PRODUCT_FIELD_LIMITS.barcode),
    itemCode: optionalBoundedText(formEntry(formData, 'itemCode'), 'itemCode', 'Item code', PRODUCT_FIELD_LIMITS.itemCode),
    productType,
    categoryId: requiredId(formData, 'categoryId', 'category'),
    subCategoryId: optionalId(formData, 'subCategoryId', 'sub-category'),
    brandId: requiredId(formData, 'brandId', 'brand'),
    unitId: requiredId(formData, 'unitId', 'unit'),
    warrantyId: optionalId(formData, 'warrantyId', 'warranty'),
    warehouseId: requiredId(formData, 'warehouseId', 'warehouse'),
    price,
    costPrice,
    taxRate: normalizeMoney(formEntry(formData, 'taxRate'), 'taxRate', 'Tax rate', { maxIntegerDigits: 3 }),
    discountType,
    discountValue,
    status,
    stockQuantity,
    minStockLevel,
    description: boundedText(
      formEntry(formData, 'description'),
      'description',
      'Description',
      PRODUCT_FIELD_LIMITS.description,
      { multiline: true },
    ),
    manufacturer: boundedText(
      formEntry(formData, 'manufacturer'),
      'manufacturer',
      'Manufacturer',
      PRODUCT_FIELD_LIMITS.manufacturer,
    ),
    manufacturedDate,
    expiryDate,
    images: parseProductImages(formEntry(formData, 'imageUrl')),
    attributes: parseProductAttributes(formEntry(formData, 'attributes')),
    variants,
    concurrencyToken,
  };
}

export function serializeProductDescription(text: string, manufacturer: string) {
  if (!text && !manufacturer) return null;
  return JSON.stringify({ text, manufacturer });
}

export function parseProductDescription(raw: string | null | undefined) {
  if (!raw) return { text: '', manufacturer: '' };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainRecord(parsed)) return { text: raw, manufacturer: '' };
    return {
      text: typeof parsed.text === 'string' ? parsed.text : '',
      manufacturer: typeof parsed.manufacturer === 'string' ? parsed.manufacturer : '',
    };
  } catch {
    return { text: raw, manufacturer: '' };
  }
}

export function isProductAttributeValueValid(dataType: ProductAttributeDataType, value: string) {
  if (dataType === 'boolean') return value === 'true' || value === 'false';
  if (dataType === 'number') return /^-?(?:0|[1-9]\d{0,7})(?:\.\d{1,4})?$/.test(value);
  if (dataType === 'date') return SAFE_DATE_PATTERN.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
  return value.length <= PRODUCT_FIELD_LIMITS.attributeValue;
}

export type ProductOptionValueRecord = {
  id: number;
  attributeId: number;
  value: string;
  attributeName: string;
};

export function resolveVariantOptionDefinitions(
  productType: ProductKind,
  variants: readonly ValidatedProductVariant[],
  optionRows: readonly ProductOptionValueRecord[],
): Array<ValidatedProductVariant & { name: string; attributeValueIds: number[] }> {
  if (productType === 'simple') {
    return variants.map((variant) => ({ ...variant, name: 'Default', attributeValueIds: [] }));
  }

  const byId = new Map(optionRows.map((option) => [option.id, option]));
  const selectedAttributeIds = new Set(optionRows.map((option) => option.attributeId));
  if (selectedAttributeIds.size === 0) throw new ProductValidationError({ variants: 'Select at least one product option.' });

  return variants.map((variant) => {
    const options = variant.attributeValueIds.map((id) => byId.get(id));
    if (options.some((option) => !option)) {
      throw new ProductValidationError({ variants: 'One or more option values no longer exist in this company.' });
    }
    const resolvedOptions = options as ProductOptionValueRecord[];
    const attributes = new Set(resolvedOptions.map((option) => option.attributeId));
    if (
      attributes.size !== selectedAttributeIds.size
      || Array.from(attributes).some((attributeId) => !selectedAttributeIds.has(attributeId))
      || resolvedOptions.length !== attributes.size
    ) {
      throw new ProductValidationError(
        { variants: 'Every variant must select exactly one value for every selected option.' },
        'Every variant must form one complete option combination.',
      );
    }

    const name = resolvedOptions
      .slice()
      .sort((left, right) => left.attributeId - right.attributeId || left.value.localeCompare(right.value))
      .map((option) => `${option.attributeName}: ${option.value}`)
      .join(' / ');
    if (codePointLength(name) > PRODUCT_FIELD_LIMITS.variantName) {
      throw new ProductValidationError({ variants: 'A generated variant name is too long. Shorten its option names.' });
    }
    return {
      ...variant,
      name,
      attributeValueIds: resolvedOptions.map((option) => option.id).sort((left, right) => left - right),
    };
  });
}
