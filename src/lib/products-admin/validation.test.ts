import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ProductValidationError,
  parseProductAttributes,
  parseProductImages,
  parseStoredProductImages,
  resolveVariantOptionDefinitions,
  slugifyProductText,
  toSafeMediaSegment,
  validateProductForm,
} from './validation';

const EDIT_TOKEN = `sha256:${'a'.repeat(64)}`;

function validForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  const values: Record<string, string> = {
    name: 'Café Atlas — 第二版',
    slug: '',
    sku: 'ATLAS-002',
    barcode: '',
    itemCode: '',
    productType: 'simple',
    categoryId: '4',
    subCategoryId: '',
    brandId: '7',
    unitId: '2',
    warrantyId: '',
    warehouseId: '3',
    description: 'A bounded product description.',
    manufacturer: 'Atlas Press',
    manufacturedDate: '2026-01-10',
    expiryDate: '',
    price: '19.5',
    costPrice: '8.25',
    taxRate: '0',
    discountType: '',
    discountValue: '0',
    stockQuantity: '12',
    minStockLevel: '2',
    status: 'Active',
    imageUrl: '',
    attributes: '[]',
    variants: JSON.stringify([{ existingVariantId: null }]),
    ...overrides,
  };
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

test('simple products normalize Unicode text and create one explicit Active Default variant', () => {
  const result = validateProductForm(validForm(), { mode: 'create' });
  assert.equal(result.name, 'Café Atlas — 第二版');
  assert.equal(result.slug, 'café-atlas-第二版');
  assert.equal(result.price, '19.50');
  assert.equal(result.costPrice, '8.25');
  assert.deepEqual(result.variants, [{
    existingVariantId: null,
    attributeValueIds: [],
    sku: 'ATLAS-002',
    barcode: null,
    price: '19.50',
    costPrice: '8.25',
    status: 'Active',
    quantity: 12,
    minStockLevel: 2,
  }]);
});

test('IDs, money, stock, status, dates, and bounded Unicode fields are validated', () => {
  assert.throws(
    () => validateProductForm(validForm({ categoryId: '0' }), { mode: 'create' }),
    (error: unknown) => error instanceof ProductValidationError && Boolean(error.fieldErrors.categoryId),
  );
  assert.throws(
    () => validateProductForm(validForm({ companyId: '999' }), { mode: 'create' }),
    (error: unknown) => error instanceof ProductValidationError && Boolean(error.fieldErrors.form),
  );
  assert.throws(
    () => validateProductForm(validForm({ price: '-1.00' }), { mode: 'create' }),
    (error: unknown) => error instanceof ProductValidationError && Boolean(error.fieldErrors.price),
  );
  assert.throws(
    () => validateProductForm(validForm({ stockQuantity: '-1' }), { mode: 'create' }),
    (error: unknown) => error instanceof ProductValidationError && Boolean(error.fieldErrors.stockQuantity),
  );
  assert.throws(
    () => validateProductForm(validForm({
      productType: 'options',
      variants: JSON.stringify([{
        existingVariantId: 99,
        attributeValueIds: [1],
        sku: 'NEW-1',
        price: '1.00',
        costPrice: '0.50',
        status: 'Active',
        quantity: '1',
        minStockLevel: '0',
      }]),
    }), { mode: 'create' }),
    (error: unknown) => error instanceof ProductValidationError && Boolean(error.fieldErrors.variants),
  );
  assert.throws(
    () => validateProductForm(validForm({ status: 'Archived' }), { mode: 'create' }),
    (error: unknown) => error instanceof ProductValidationError && Boolean(error.fieldErrors.status),
  );
  assert.throws(
    () => validateProductForm(validForm({ manufacturedDate: '2026-02-30' }), { mode: 'create' }),
    (error: unknown) => error instanceof ProductValidationError && Boolean(error.fieldErrors.manufacturedDate),
  );
  assert.throws(
    () => validateProductForm(validForm({ name: '書'.repeat(256) }), { mode: 'create' }),
    (error: unknown) => error instanceof ProductValidationError && Boolean(error.fieldErrors.name),
  );
});

test('option products require unique complete combinations and at least one Active variant', () => {
  const variants = [
    {
      existingVariantId: null,
      attributeValueIds: [11, 21],
      sku: 'ATLAS-BLUE-S',
      barcode: '',
      price: '20.00',
      costPrice: '9.00',
      status: 'Active',
      quantity: '4',
      minStockLevel: '1',
    },
    {
      existingVariantId: 8,
      attributeValueIds: [12, 22],
      sku: 'ATLAS-RED-L',
      barcode: '',
      price: '22.00',
      costPrice: '10.00',
      status: 'Inactive',
      quantity: '0',
      minStockLevel: '1',
    },
  ];
  const result = validateProductForm(validForm({
    productType: 'options',
    concurrencyToken: EDIT_TOKEN,
    variants: JSON.stringify(variants),
  }), { mode: 'edit' });
  const optionRows = [
    { id: 11, attributeId: 1, value: 'Blue', attributeName: 'Color' },
    { id: 12, attributeId: 1, value: 'Red', attributeName: 'Color' },
    { id: 21, attributeId: 2, value: 'Small', attributeName: 'Size' },
    { id: 22, attributeId: 2, value: 'Large', attributeName: 'Size' },
  ];
  const resolved = resolveVariantOptionDefinitions('options', result.variants, optionRows);
  assert.equal(resolved[0].name, 'Color: Blue / Size: Small');
  assert.equal(resolved[1].existingVariantId, 8);

  assert.throws(
    () => resolveVariantOptionDefinitions('options', result.variants, optionRows.slice(0, 3)),
    (error: unknown) => error instanceof ProductValidationError && Boolean(error.fieldErrors.variants),
  );
  assert.throws(
    () => validateProductForm(validForm({
      productType: 'options',
      variants: JSON.stringify([{ ...variants[0], status: 'Inactive' }]),
    }), { mode: 'create' }),
    (error: unknown) => error instanceof ProductValidationError && Boolean(error.fieldErrors.variants),
  );
  assert.throws(
    () => validateProductForm(validForm({
      productType: 'options',
      concurrencyToken: EDIT_TOKEN,
      variants: JSON.stringify([variants[0], { ...variants[1], sku: 'atlas-blue-s' }]),
    }), { mode: 'edit' }),
    (error: unknown) => error instanceof ProductValidationError && Boolean(error.fieldErrors.variants),
  );
});

test('image JSON keeps only the established safe metadata fields', () => {
  const images = parseProductImages(JSON.stringify([{
    src: 'https://cdn.example.com/products/atlas.jpg?width=800',
    name: 'atlas.jpg',
    size: '42 KB',
    publicId: 'tenants/acme/products/atlas/atlas-main',
    api_key: 'must-not-be-stored',
    api_secret: 'must-not-be-stored',
  }]));
  assert.deepEqual(images, [{
    src: 'https://cdn.example.com/products/atlas.jpg?width=800',
    name: 'atlas.jpg',
    size: '42 KB',
    publicId: 'tenants/acme/products/atlas/atlas-main',
  }]);

  assert.throws(
    () => parseProductImages(JSON.stringify([{ src: 'https://user:pass@cdn.example.com/a.jpg', name: 'a', size: '1 KB' }])),
    (error: unknown) => error instanceof ProductValidationError && Boolean(error.fieldErrors.imageUrl),
  );
  assert.throws(
    () => parseProductImages(JSON.stringify([{ src: 'javascript:alert(1)', name: 'a', size: '1 KB' }])),
    (error: unknown) => error instanceof ProductValidationError && Boolean(error.fieldErrors.imageUrl),
  );
  assert.throws(
    () => parseProductImages(JSON.stringify([{ src: 'https://cdn.example.com/a.jpg?api_secret=secret', name: 'a', size: '1 KB' }])),
    (error: unknown) => error instanceof ProductValidationError && Boolean(error.fieldErrors.imageUrl),
  );
  assert.deepEqual(parseStoredProductImages('https://cdn.example.com/legacy.jpg'), [{
    src: 'https://cdn.example.com/legacy.jpg',
    name: 'Product image',
    size: 'Legacy image',
  }]);
});

test('category attributes reject duplicate IDs and edit saves require a concurrency token', () => {
  assert.throws(
    () => parseProductAttributes(JSON.stringify([
      { attributeId: 5, value: 'first' },
      { attributeId: 5, value: 'second' },
    ])),
    (error: unknown) => error instanceof ProductValidationError && Boolean(error.fieldErrors.attributes),
  );

  assert.throws(
    () => validateProductForm(validForm(), { mode: 'edit' }),
    (error: unknown) => error instanceof ProductValidationError && Boolean(error.fieldErrors.concurrencyToken),
  );
  const edit = validateProductForm(validForm({ concurrencyToken: EDIT_TOKEN }), { mode: 'edit' });
  assert.equal(edit.concurrencyToken, EDIT_TOKEN);
});

test('slug and upload folder helpers produce bounded safe segments', () => {
  assert.equal(slugifyProductText('  Hello, WORLD!  '), 'hello-world');
  assert.equal(slugifyProductText('---'), '');
  assert.equal(toSafeMediaSegment('Café / Atlas', 'product'), 'caf-atlas');
  assert.equal(toSafeMediaSegment('***', 'product'), 'product');
});
