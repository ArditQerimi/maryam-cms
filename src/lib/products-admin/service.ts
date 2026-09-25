// Server-only product catalog DAL: never import this module from a client component.
import { createHash } from 'node:crypto';

import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

import { getTenantDb } from '@/db';
import * as schema from '@/db/schema-tenant';
import { getTenantCloudinaryFolderRoot } from '@/lib/api-security/cloudinary';
import { isRoleAllowedForAudience, isSessionForCompany } from '@/lib/auth-validation';
import { getCompanyRolePermissionKeys } from '@/lib/permission-store';
import { getDefaultPermissionsForRole, hasPermission } from '@/lib/permissions';
import { getSession } from '@/lib/session';
import { getTenantMediaStorageSettings } from '@/lib/tenant-media-storage';
import { getContextCompany } from '@/lib/tenant';
import type {
  ProductEditorDTO,
  ProductEditorPageData,
  ProductFormLookups,
  ProductImageDTO,
  ProductKind,
  ProductSaveResult,
} from './types';
import {
  ProductValidationError,
  isProductAttributeValueValid,
  parsePositiveInteger,
  parseProductDescription,
  parseStoredProductImages,
  resolveVariantOptionDefinitions,
  serializeProductDescription,
  type ValidatedProductInput,
} from './validation';

type TenantDatabase = ReturnType<typeof getTenantDb>;
type TenantTransaction = Parameters<Parameters<TenantDatabase['transaction']>[0]>[0];

type ProductAdminAccess = {
  company: Awaited<ReturnType<typeof getContextCompany>>;
  db: TenantDatabase;
  userId: number;
  roleId: number;
  roleName: string;
  storeId: number | null;
  storeName: string | null;
  storeStatus: string | null;
};

type ProductConcurrencySnapshot = {
  product: {
    id: number;
    name: string;
    slug: string | null;
    sku: string | null;
    categoryId: number | null;
    subCategoryId: number | null;
    brandId: number | null;
    unitId: number | null;
    storeId: number | null;
    warehouseId: number | null;
    warrantyId: number | null;
    barcode: string | null;
    itemCode: string | null;
    productType: string | null;
    price: string | null;
    costPrice: string | null;
    taxRate: string | null;
    discountType: string | null;
    discountValue: string | null;
    stockQuantity: number | null;
    minStockLevel: number | null;
    manufacturedDate: Date | null;
    expiryDate: Date | null;
    description: string | null;
    imageUrl: string | null;
    status: string;
    updatedAt: Date;
  };
  variants: Array<{
    id: number;
    name: string;
    sku: string;
    barcode: string | null;
    price: string;
    costPrice: string | null;
    status: string;
    updatedAt: Date;
  }>;
  stocks: Array<{
    id: number;
    warehouseId: number;
    variantId: number;
    quantity: number;
    minStockLevel: number | null;
    updatedAt: Date;
  }>;
  options: Array<{
    variantId: number;
    attributeValueId: number;
  }>;
  attributes: Array<{
    attributeId: number;
    value: string | null;
  }>;
};

type ResolvedVariant = ValidatedProductInput['variants'][number] & {
  name: string;
  attributeValueIds: number[];
};

export class ProductAdminNotFoundError extends Error {
  constructor(message = 'The requested product was not found in this company.') {
    super(message);
    this.name = 'ProductAdminNotFoundError';
  }
}

function positiveSessionId(value: unknown) {
  return parsePositiveInteger(value);
}

async function requireProductsAdminAccess(): Promise<ProductAdminAccess> {
  const session = await getSession();
  if (!session || typeof session !== 'object' || Array.isArray(session)) redirect('/login');

  const payload = session as Record<string, unknown>;
  const audience = payload.audience;
  const isStaff = payload.platformRole === 'admin'
    && payload.isPlatformUser !== true
    && (audience === undefined || audience === 'staff');
  if (!isStaff) notFound();

  const userId = positiveSessionId(payload.userId);
  if (!userId) redirect('/login');

  const company = await getContextCompany();
  if (!isSessionForCompany(payload, company.id)) notFound();

  const db = getTenantDb(company.dbConnectionString, company.dbSchema);
  const [staff] = await db
    .select({
      id: schema.users.id,
      status: schema.users.status,
      storeId: schema.users.storeId,
      roleId: schema.users.tenantRoleId,
      roleName: schema.tenantRoles.name,
      storeName: schema.stores.name,
      storeStatus: schema.stores.status,
    })
    .from(schema.users)
    .leftJoin(schema.tenantRoles, eq(schema.users.tenantRoleId, schema.tenantRoles.id))
    .leftJoin(schema.stores, eq(schema.users.storeId, schema.stores.id))
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (
    !staff
    || staff.status !== 'Active'
    || !staff.roleId
    || !staff.roleName
    || !isRoleAllowedForAudience(staff.roleName, 'staff')
  ) {
    redirect('/login');
  }

  let permissions = await getCompanyRolePermissionKeys(company.id, staff.roleName);
  // Match the existing admin/blog hardening pattern for legacy tenants whose
  // role map has not been materialized yet; the map is always queried first
  // and token permission claims are never trusted.
  if (permissions.length === 0) permissions = getDefaultPermissionsForRole(staff.roleName);
  if (!hasPermission(permissions, 'inventory.manage')) notFound();

  return {
    company,
    db,
    userId: staff.id,
    roleId: staff.roleId,
    roleName: staff.roleName,
    storeId: staff.storeId,
    storeName: staff.storeName,
    storeStatus: staff.storeStatus,
  };
}

export async function assertProductsAdminManageAccess() {
  await requireProductsAdminAccess();
}

async function readFormLookups(access: ProductAdminAccess): Promise<ProductFormLookups> {
  const [
    categoryRows,
    subCategoryRows,
    brandRows,
    unitRows,
    warrantyRows,
    warehouseRows,
    categoryAttributeRows,
    optionAttributeRows,
    optionValueRows,
  ] = await Promise.all([
    access.db
      .select({ id: schema.categories.id, name: schema.categories.name })
      .from(schema.categories)
      .where(eq(schema.categories.status, 'Active'))
      .orderBy(asc(schema.categories.name)),
    access.db
      .select({ id: schema.subCategories.id, categoryId: schema.subCategories.categoryId, name: schema.subCategories.name })
      .from(schema.subCategories)
      .orderBy(asc(schema.subCategories.name)),
    access.db
      .select({ id: schema.brands.id, name: schema.brands.name })
      .from(schema.brands)
      .where(eq(schema.brands.status, 'Active'))
      .orderBy(asc(schema.brands.name)),
    access.db
      .select({ id: schema.units.id, name: schema.units.name })
      .from(schema.units)
      .where(eq(schema.units.status, 'Active'))
      .orderBy(asc(schema.units.name)),
    access.db
      .select({ id: schema.warranties.id, name: schema.warranties.name })
      .from(schema.warranties)
      .where(eq(schema.warranties.status, 'Active'))
      .orderBy(asc(schema.warranties.name)),
    access.db
      .select({ id: schema.warehouses.id, name: schema.warehouses.name, code: schema.warehouses.code })
      .from(schema.warehouses)
      .where(eq(schema.warehouses.status, 'Active'))
      .orderBy(asc(schema.warehouses.name)),
    access.db
      .select({
        id: schema.categoryAttributes.id,
        categoryId: schema.categoryAttributes.categoryId,
        name: schema.categoryAttributes.name,
        dataType: schema.categoryAttributes.dataType,
        isRequired: schema.categoryAttributes.isRequired,
      })
      .from(schema.categoryAttributes)
      .orderBy(asc(schema.categoryAttributes.name)),
    access.db
      .select({ id: schema.variantAttributes.id, name: schema.variantAttributes.name })
      .from(schema.variantAttributes)
      .orderBy(asc(schema.variantAttributes.name)),
    access.db
      .select({
        id: schema.variantAttributeValues.id,
        attributeId: schema.variantAttributeValues.attributeId,
        value: schema.variantAttributeValues.value,
      })
      .from(schema.variantAttributeValues)
      .orderBy(asc(schema.variantAttributeValues.value)),
  ]);

  const subCategoriesByCategory = new Map<number, Array<{ id: number; categoryId: number; name: string }>>();
  for (const subCategory of subCategoryRows) {
    const current = subCategoriesByCategory.get(subCategory.categoryId) ?? [];
    current.push(subCategory);
    subCategoriesByCategory.set(subCategory.categoryId, current);
  }

  const valuesByAttribute = new Map<number, Array<{ id: number; attributeId: number; value: string }>>();
  for (const value of optionValueRows) {
    const current = valuesByAttribute.get(value.attributeId) ?? [];
    current.push(value);
    valuesByAttribute.set(value.attributeId, current);
  }

  return {
    storeName: access.storeStatus === 'Active' ? access.storeName : null,
    categories: categoryRows.map((category) => ({
      ...category,
      subCategories: subCategoriesByCategory.get(category.id) ?? [],
    })),
    brands: brandRows,
    units: unitRows,
    warranties: warrantyRows,
    warehouses: warehouseRows,
    categoryAttributes: categoryAttributeRows,
    optionAttributes: optionAttributeRows.map((attribute) => ({
      ...attribute,
      values: valuesByAttribute.get(attribute.id) ?? [],
    })),
  };
}

export async function getProductCreatePageData() {
  const access = await requireProductsAdminAccess();
  return { lookups: await readFormLookups(access) };
}

function toMoney(value: string | number | null | undefined) {
  const raw = String(value ?? '0').trim();
  const match = raw.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return '0.00';
  return `${BigInt(match[1])}.${(match[2] || '').padEnd(2, '0')}`;
}

function toIsoDate(value: Date | null) {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString().slice(0, 10) : null;
}

function buildConcurrencyToken(snapshot: ProductConcurrencySnapshot) {
  const canonical = {
    product: {
      ...snapshot.product,
      manufacturedDate: snapshot.product.manufacturedDate?.toISOString() ?? null,
      expiryDate: snapshot.product.expiryDate?.toISOString() ?? null,
      updatedAt: snapshot.product.updatedAt.toISOString(),
    },
    variants: snapshot.variants
      .map((variant) => ({ ...variant, updatedAt: variant.updatedAt.toISOString() }))
      .sort((left, right) => left.id - right.id),
    stocks: snapshot.stocks
      .map((stock) => ({ ...stock, updatedAt: stock.updatedAt.toISOString() }))
      .sort((left, right) => left.id - right.id),
    options: snapshot.options
      .map((option) => ({
        variantId: option.variantId,
        attributeValueId: option.attributeValueId,
      }))
      .sort((left, right) => left.variantId - right.variantId || left.attributeValueId - right.attributeValueId),
    attributes: snapshot.attributes
      .slice()
      .sort((left, right) => left.attributeId - right.attributeId),
  };
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical)).digest('hex')}`;
}

async function getProductEditorProduct(db: TenantDatabase, productId: number) {
  const [product] = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.id, productId))
    .limit(1);
  if (!product) return null;

  const variants = await db
    .select()
    .from(schema.productVariants)
    .where(eq(schema.productVariants.productId, productId))
    .orderBy(asc(schema.productVariants.id));
  const variantIds = variants.map((variant) => variant.id);
  const [stocks, options, attributes] = await Promise.all([
    variantIds.length
      ? db
          .select()
          .from(schema.productStocks)
          .where(inArray(schema.productStocks.variantId, variantIds))
          .orderBy(asc(schema.productStocks.id))
      : Promise.resolve([]),
    variantIds.length
      ? db
          .select({
            variantId: schema.variantOptions.variantId,
            attributeValueId: schema.variantOptions.attributeValueId,
            attributeId: schema.variantAttributeValues.attributeId,
            attributeName: schema.variantAttributes.name,
            value: schema.variantAttributeValues.value,
          })
          .from(schema.variantOptions)
          .innerJoin(
            schema.variantAttributeValues,
            eq(schema.variantOptions.attributeValueId, schema.variantAttributeValues.id),
          )
          .innerJoin(
            schema.variantAttributes,
            eq(schema.variantAttributeValues.attributeId, schema.variantAttributes.id),
          )
          .where(inArray(schema.variantOptions.variantId, variantIds))
          .orderBy(asc(schema.variantOptions.variantId), asc(schema.variantAttributeValues.attributeId), asc(schema.variantAttributeValues.value))
      : Promise.resolve([]),
    db
      .select({ attributeId: schema.productAttributeValues.attributeId, value: schema.productAttributeValues.value })
      .from(schema.productAttributeValues)
      .where(eq(schema.productAttributeValues.productId, productId))
      .orderBy(asc(schema.productAttributeValues.attributeId)),
  ]);

  return { product, variants, stocks, options, attributes };
}

function mapProductEditor(
  data: NonNullable<Awaited<ReturnType<typeof getProductEditorProduct>>>,
): ProductEditorDTO {
  const { product, variants, stocks, options, attributes } = data;
  const optionsByVariant = new Map<number, number[]>();
  for (const option of options) {
    const current = optionsByVariant.get(option.variantId) ?? [];
    current.push(option.attributeValueId);
    optionsByVariant.set(option.variantId, current);
  }
  const stocksByVariant = new Map<number, typeof stocks>();
  for (const stock of stocks) {
    const current = stocksByVariant.get(stock.variantId) ?? [];
    current.push(stock);
    stocksByVariant.set(stock.variantId, current);
  }

  const activeVariants = variants.filter((variant) => variant.status === 'Active');
  const hasActiveOptionMatrix = activeVariants.length > 0
    && activeVariants.every((variant) => (optionsByVariant.get(variant.id)?.length ?? 0) > 0);
  const hasOptionMatrix = variants.some((variant) => (optionsByVariant.get(variant.id)?.length ?? 0) > 0);
  const mode: ProductKind = hasActiveOptionMatrix || (!activeVariants.length && hasOptionMatrix) ? 'options' : 'simple';
  const defaultVariant = variants
    .filter((variant) => (optionsByVariant.get(variant.id)?.length ?? 0) === 0)
    .sort((left, right) => {
      const leftDefault = left.name.trim().toLocaleLowerCase('en-US') === 'default' ? 0 : 1;
      const rightDefault = right.name.trim().toLocaleLowerCase('en-US') === 'default' ? 0 : 1;
      return leftDefault - rightDefault || left.id - right.id;
    })[0] ?? null;
  const description = parseProductDescription(product.description);
  const rawProductType = product.productType?.trim().toLocaleLowerCase('en-US');

  return {
    id: product.id,
    categoryId: product.categoryId,
    subCategoryId: product.subCategoryId,
    brandId: product.brandId,
    unitId: product.unitId,
    storeId: product.storeId,
    storeName: null,
    warehouseId: product.warehouseId,
    warrantyId: product.warrantyId,
    name: product.name,
    slug: product.slug || '',
    sku: product.sku || '',
    barcode: product.barcode,
    itemCode: product.itemCode,
    productType: rawProductType === 'options' ? 'options' : 'simple',
    price: toMoney(product.price),
    costPrice: toMoney(product.costPrice),
    taxRate: toMoney(product.taxRate),
    discountType: product.discountType === 'Percentage' || product.discountType === 'Flat' ? product.discountType : null,
    discountValue: toMoney(product.discountValue),
    stockQuantity: Math.max(0, product.stockQuantity ?? 0),
    minStockLevel: Math.max(0, product.minStockLevel ?? 0),
    manufacturedDate: toIsoDate(product.manufacturedDate),
    expiryDate: toIsoDate(product.expiryDate),
    description: description.text,
    manufacturer: description.manufacturer,
    images: parseStoredProductImages(product.imageUrl),
    status: product.status === 'Active' ? 'Active' : 'Inactive',
    attributeValues: attributes.map((attribute) => ({
      attributeId: attribute.attributeId,
      value: attribute.value ?? '',
    })),
    variants: variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      barcode: variant.barcode,
      price: toMoney(variant.price),
      costPrice: toMoney(variant.costPrice),
      status: variant.status === 'Active' ? 'Active' : 'Inactive',
      optionValueIds: (optionsByVariant.get(variant.id) ?? []).slice().sort((left, right) => left - right),
      stocks: (stocksByVariant.get(variant.id) ?? []).map((stock) => ({
        warehouseId: stock.warehouseId,
        quantity: Math.max(0, stock.quantity),
        minStockLevel: Math.max(0, stock.minStockLevel ?? 0),
      })),
    })),
    defaultVariantId: defaultVariant?.id ?? null,
    mode,
    concurrencyToken: buildConcurrencyToken({ product, variants, stocks, options, attributes }),
  };
}

export async function getProductEditorPageData(rawProductId: number): Promise<ProductEditorPageData> {
  const productId = parsePositiveInteger(rawProductId);
  if (!productId) notFound();
  const access = await requireProductsAdminAccess();
  const [lookups, data] = await Promise.all([readFormLookups(access), getProductEditorProduct(access.db, productId)]);
  if (!data) notFound();

  const product = mapProductEditor(data);
  const storeName = product.storeId === access.storeId
    ? access.storeName
    : product.storeId
      ? (await access.db
          .select({ name: schema.stores.name })
          .from(schema.stores)
          .where(eq(schema.stores.id, product.storeId))
          .limit(1))[0]?.name ?? null
      : null;
  return { lookups: { ...lookups, storeName }, product: { ...product, storeName } };
}

function normalizeLocalBase(value: string | null | undefined) {
  const base = String(value || '/uploads')
    .normalize('NFKC')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  if (!base || base.length > 255 || base.split('/').some((segment) => !/^[A-Za-z0-9._-]+$/.test(segment) || segment === '.' || segment === '..')) {
    throw new ProductValidationError({ imageUrl: 'The tenant media folder configuration is invalid.' });
  }
  return base;
}

async function assertImagesBelongToTenant(images: ProductImageDTO[], access: ProductAdminAccess) {
  if (images.length === 0) return;
  const settings = await getTenantMediaStorageSettings(access.company.id);

  if (settings.provider === 'cloudinary') {
    const root = getTenantCloudinaryFolderRoot(settings.cloudinaryFolder, access.company.subdomain);
    if (!root || !settings.cloudinaryCloudName) {
      throw new ProductValidationError({ imageUrl: 'Cloudinary is not configured safely for this company.' });
    }
    for (const image of images) {
      let parsed: URL | null = null;
      try {
        parsed = new URL(image.src);
      } catch {
        parsed = null;
      }
      const isCloudinaryDelivery = parsed?.hostname === 'res.cloudinary.com'
        || parsed?.hostname === `${settings.cloudinaryCloudName.toLocaleLowerCase('en-US')}.res.cloudinary.com`;
      if (isCloudinaryDelivery && !image.publicId) {
        throw new ProductValidationError({ imageUrl: 'Cloudinary image metadata is incomplete.' });
      }
      if (image.publicId && !image.publicId.startsWith(`${root}/`)) {
        throw new ProductValidationError({ imageUrl: 'An image is outside this company media folder.' });
      }
    }
    return;
  }

  const localPrefix = `/${normalizeLocalBase(settings.localBasePath)}/${access.company.subdomain}/products/`;
  for (const image of images) {
    if (image.publicId) throw new ProductValidationError({ imageUrl: 'Local product images cannot contain Cloudinary metadata.' });
    if (image.src.startsWith('/') && !image.src.startsWith(localPrefix)) {
      throw new ProductValidationError({ imageUrl: 'A local image is outside this company media folder.' });
    }
    if (image.src.startsWith('/') && image.src.split('/').includes('..')) {
      throw new ProductValidationError({ imageUrl: 'A local image path is invalid.' });
    }
  }
}

function resolveStoreId(access: ProductAdminAccess, existingStoreId: number | null) {
  if (access.storeId && existingStoreId && access.storeId !== existingStoreId) {
    throw new ProductValidationError(
      { form: 'This product belongs to a different store. Sign in with an account authorized for that store.' },
      'This product belongs to a different store.',
    );
  }
  const storeId = access.storeId ?? existingStoreId;
  if (!storeId) {
    throw new ProductValidationError(
      { form: 'Your staff account is not assigned to a store.' },
      'Your staff account is not assigned to an active store.',
    );
  }
  return storeId;
}

async function resolveRelationships(tx: TenantTransaction, input: ValidatedProductInput, storeId: number) {
  const [category, subCategory, brand, unit, warehouse, warranty, categoryAttributes] = await Promise.all([
    tx.select({ id: schema.categories.id }).from(schema.categories).where(and(eq(schema.categories.id, input.categoryId), eq(schema.categories.status, 'Active'))).limit(1),
    input.subCategoryId
      ? tx.select({ id: schema.subCategories.id, categoryId: schema.subCategories.categoryId }).from(schema.subCategories).where(eq(schema.subCategories.id, input.subCategoryId)).limit(1)
      : Promise.resolve([]),
    tx.select({ id: schema.brands.id }).from(schema.brands).where(and(eq(schema.brands.id, input.brandId), eq(schema.brands.status, 'Active'))).limit(1),
    tx.select({ id: schema.units.id }).from(schema.units).where(and(eq(schema.units.id, input.unitId), eq(schema.units.status, 'Active'))).limit(1),
    tx.select({ id: schema.warehouses.id }).from(schema.warehouses).where(and(eq(schema.warehouses.id, input.warehouseId), eq(schema.warehouses.status, 'Active'))).limit(1),
    input.warrantyId
      ? tx.select({ id: schema.warranties.id }).from(schema.warranties).where(and(eq(schema.warranties.id, input.warrantyId), eq(schema.warranties.status, 'Active'))).limit(1)
      : Promise.resolve([]),
    tx.select().from(schema.categoryAttributes).where(eq(schema.categoryAttributes.categoryId, input.categoryId)),
  ]);

  if (!category[0]) throw new ProductValidationError({ categoryId: 'The selected category is no longer active.' });
  if (input.subCategoryId && (!subCategory[0] || subCategory[0].categoryId !== input.categoryId)) {
    throw new ProductValidationError({ subCategoryId: 'The selected sub-category does not belong to that category.' });
  }
  if (!brand[0]) throw new ProductValidationError({ brandId: 'The selected brand is no longer active.' });
  if (!unit[0]) throw new ProductValidationError({ unitId: 'The selected unit is no longer active.' });
  if (!warehouse[0]) throw new ProductValidationError({ warehouseId: 'The selected warehouse is no longer active.' });
  if (input.warrantyId && !warranty[0]) throw new ProductValidationError({ warrantyId: 'The selected warranty is no longer active.' });
  const activeStore = await tx
    .select({ id: schema.stores.id })
    .from(schema.stores)
    .where(and(eq(schema.stores.id, storeId), eq(schema.stores.status, 'Active')))
    .limit(1);
  if (!activeStore[0]) throw new ProductValidationError({ form: 'Your staff account is not assigned to an active store.' });

  const definitions = new Map(categoryAttributes.map((attribute) => [attribute.id, attribute]));
  const submitted = new Map(input.attributes.map((attribute) => [attribute.attributeId, attribute.value]));
  for (const [attributeId, value] of submitted) {
    const definition = definitions.get(attributeId);
    if (!definition) throw new ProductValidationError({ attributes: 'A submitted attribute does not belong to the selected category.' });
    if (definition.isRequired && !value.trim()) throw new ProductValidationError({ attributes: `${definition.name} is required.` });
    if (!isProductAttributeValueValid(definition.dataType, value)) {
      throw new ProductValidationError({ attributes: `${definition.name} has an invalid value.` });
    }
  }
  for (const definition of categoryAttributes) {
    if (definition.isRequired && !submitted.has(definition.id)) {
      throw new ProductValidationError({ attributes: `${definition.name} is required.` });
    }
  }

  const valueIds = Array.from(new Set(input.variants.flatMap((variant) => variant.attributeValueIds)));
  const optionRows = valueIds.length
    ? await tx
        .select({
          id: schema.variantAttributeValues.id,
          attributeId: schema.variantAttributeValues.attributeId,
          value: schema.variantAttributeValues.value,
          attributeName: schema.variantAttributes.name,
        })
        .from(schema.variantAttributeValues)
        .innerJoin(schema.variantAttributes, eq(schema.variantAttributeValues.attributeId, schema.variantAttributes.id))
        .where(inArray(schema.variantAttributeValues.id, valueIds))
    : [];
  if (optionRows.length !== valueIds.length) {
    throw new ProductValidationError({ variants: 'One or more option values no longer exist in this company.' });
  }

  return { optionValues: optionRows };
}

async function lockProductIdentifiers(tx: TenantTransaction) {
  await tx.execute(sql`lock table products, product_variants in share row exclusive mode`);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('tenant-products-admin:' || current_schema() || ':sku-slug:v1'))`);
}

async function assertUniqueIdentifiers(tx: TenantTransaction, input: ValidatedProductInput, productId: number | null) {
  const productIdentifierRows = await tx
    .select({ id: schema.products.id, sku: schema.products.sku, slug: schema.products.slug })
    .from(schema.products)
    .where(productId
      ? and(ne(schema.products.id, productId), sql`(${schema.products.sku} is not null and lower(btrim(${schema.products.sku})) = lower(${input.sku})) or lower(btrim(${schema.products.slug})) = lower(${input.slug})`)
      : sql`(${schema.products.sku} is not null and lower(btrim(${schema.products.sku})) = lower(${input.sku})) or lower(btrim(${schema.products.slug})) = lower(${input.slug})`);

  if (productIdentifierRows.some((row) => row.sku?.trim().toLocaleLowerCase('en-US') === input.sku.toLocaleLowerCase('en-US'))) {
    throw new ProductValidationError({ sku: 'Product SKU is already in use.' });
  }
  if (productIdentifierRows.some((row) => row.slug?.trim().toLocaleLowerCase('en-US') === input.slug.toLocaleLowerCase('en-US'))) {
    throw new ProductValidationError({ slug: 'Product slug is already in use.' });
  }

  const submittedVariantIds = new Set(input.variants.flatMap((variant) => variant.existingVariantId ? [variant.existingVariantId] : []));
  const lowerVariantSkus = Array.from(new Set([
    input.sku.toLocaleLowerCase('en-US'),
    ...input.variants.map((variant) => variant.sku.toLocaleLowerCase('en-US')),
  ]));
  if (lowerVariantSkus.length === 0) return;
  const variantIdentifierRows = await tx
    .select({ id: schema.productVariants.id, productId: schema.productVariants.productId })
    .from(schema.productVariants)
    .where(inArray(sql`lower(btrim(${schema.productVariants.sku}))`, lowerVariantSkus));

  if (variantIdentifierRows.some((row) => row.productId !== productId || !submittedVariantIds.has(row.id))) {
    throw new ProductValidationError({ variants: 'A variant SKU is already assigned to another catalog item.' });
  }

  const lowerProductSkus = Array.from(new Set([input.sku.toLocaleLowerCase('en-US'), ...lowerVariantSkus]));
  const productSkuRows = await tx
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(inArray(sql`lower(btrim(${schema.products.sku}))`, lowerProductSkus));
  if (productSkuRows.some((row) => row.id !== productId)) {
    throw new ProductValidationError({ variants: 'A variant SKU conflicts with another product SKU.' });
  }
}

function cents(value: string) {
  const [whole, fraction] = value.split('.');
  return Number(whole) * 100 + Number(fraction);
}

function buildProductWrite(input: ValidatedProductInput, variants: ResolvedVariant[], storeId: number) {
  const activeVariants = variants.filter((variant) => variant.status === 'Active');
  const price = activeVariants.reduce((lowest, variant) => cents(variant.price) < cents(lowest) ? variant.price : lowest, activeVariants[0].price);
  const costPrice = activeVariants.reduce((lowest, variant) => cents(variant.costPrice) < cents(lowest) ? variant.costPrice : lowest, activeVariants[0].costPrice);
  const stockQuantity = activeVariants.reduce((total, variant) => total + variant.quantity, 0);
  const minStockLevel = activeVariants.reduce((total, variant) => total + variant.minStockLevel, 0);

  return {
    categoryId: input.categoryId,
    subCategoryId: input.subCategoryId,
    brandId: input.brandId,
    unitId: input.unitId,
    storeId,
    warehouseId: input.warehouseId,
    warrantyId: input.warrantyId,
    name: input.name,
    slug: input.slug,
    sku: input.sku,
    barcode: input.barcode,
    itemCode: input.itemCode,
    productType: input.productType,
    price,
    costPrice,
    taxRate: input.taxRate,
    discountType: input.discountType,
    discountValue: input.discountValue,
    stockQuantity,
    minStockLevel,
    manufacturedDate: input.manufacturedDate,
    expiryDate: input.expiryDate,
    description: serializeProductDescription(input.description, input.manufacturer),
    imageUrl: input.images.length ? JSON.stringify(input.images) : null,
    status: input.status,
  };
}

async function replaceCategoryAttributes(tx: TenantTransaction, productId: number, attributes: ValidatedProductInput['attributes']) {
  await tx.delete(schema.productAttributeValues).where(eq(schema.productAttributeValues.productId, productId));
  if (attributes.length) {
    await tx.insert(schema.productAttributeValues).values(attributes.map((attribute) => ({
      productId,
      attributeId: attribute.attributeId,
      value: attribute.value,
    })));
  }
}

async function upsertVariantAndStock(
  tx: TenantTransaction,
  productId: number,
  warehouseId: number,
  variant: ResolvedVariant,
  now: Date,
) {
  const values = {
    productId,
    name: variant.name,
    sku: variant.sku,
    barcode: variant.barcode,
    price: variant.price,
    costPrice: variant.costPrice,
    status: variant.status,
    updatedAt: now,
  };
  const [saved] = variant.existingVariantId
    ? await tx
        .update(schema.productVariants)
        .set(values)
        .where(and(eq(schema.productVariants.id, variant.existingVariantId), eq(schema.productVariants.productId, productId)))
        .returning({ id: schema.productVariants.id })
    : await tx.insert(schema.productVariants).values(values).returning({ id: schema.productVariants.id });
  if (!saved) throw new ProductAdminNotFoundError('A submitted variant no longer belongs to this product.');

  await tx.delete(schema.variantOptions).where(eq(schema.variantOptions.variantId, saved.id));
  if (variant.attributeValueIds.length) {
    await tx.insert(schema.variantOptions).values(variant.attributeValueIds.map((attributeValueId) => ({
      variantId: saved.id,
      attributeValueId,
    })));
  }
  await tx
    .insert(schema.productStocks)
    .values({
      warehouseId,
      variantId: saved.id,
      quantity: variant.quantity,
      minStockLevel: variant.minStockLevel,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [schema.productStocks.warehouseId, schema.productStocks.variantId],
      set: {
        quantity: variant.quantity,
        minStockLevel: variant.minStockLevel,
        updatedAt: now,
      },
    });
  return saved.id;
}

export async function createProduct(input: ValidatedProductInput): Promise<ProductSaveResult> {
  const access = await requireProductsAdminAccess();
  if (input.variants.some((variant) => variant.existingVariantId !== null)) {
    throw new ProductValidationError({ variants: 'A new product cannot include an existing variant ID.' });
  }
  const storeId = resolveStoreId(access, null);
  await assertImagesBelongToTenant(input.images, access);
  const now = new Date();

  return access.db.transaction(async (tx) => {
    await lockProductIdentifiers(tx);
    const { optionValues } = await resolveRelationships(tx, input, storeId);
    const variants = resolveVariantOptionDefinitions(input.productType, input.variants, optionValues);
    if (variants.length === 0 || !variants.some((variant) => variant.status === 'Active')) {
      throw new ProductValidationError({ variants: 'At least one Active variant is required.' });
    }
    await assertUniqueIdentifiers(tx, input, null);

    const productValues = buildProductWrite(input, variants, storeId);
    const [product] = await tx.insert(schema.products).values(productValues).returning({ id: schema.products.id });
    const variantIds: number[] = [];
    for (const variant of variants) {
      variantIds.push(await upsertVariantAndStock(tx, product.id, input.warehouseId, variant, now));
    }
    await replaceCategoryAttributes(tx, product.id, input.attributes);

    const activeCount = await tx
      .select({ id: schema.productVariants.id })
      .from(schema.productVariants)
      .where(and(eq(schema.productVariants.productId, product.id), eq(schema.productVariants.status, 'Active')));
    if (activeCount.length === 0) throw new ProductValidationError({ variants: 'The product must have an Active variant.' });
    return {
      productId: product.id,
      variantIds,
      defaultVariantId: input.productType === 'simple' ? variantIds[0] : null,
    };
  });
}

async function readLockedConcurrencySnapshot(tx: TenantTransaction, productId: number) {
  const [product] = await tx.select().from(schema.products).where(eq(schema.products.id, productId)).limit(1);
  if (!product) throw new ProductAdminNotFoundError();
  const variants = await tx
    .select()
    .from(schema.productVariants)
    .where(eq(schema.productVariants.productId, productId))
    .orderBy(asc(schema.productVariants.id));
  const variantIds = variants.map((variant) => variant.id);
  const [stocks, options, attributes] = await Promise.all([
    variantIds.length
      ? tx.select().from(schema.productStocks).where(inArray(schema.productStocks.variantId, variantIds)).orderBy(asc(schema.productStocks.id))
      : Promise.resolve([]),
    variantIds.length
      ? tx
          .select({ variantId: schema.variantOptions.variantId, attributeValueId: schema.variantOptions.attributeValueId })
          .from(schema.variantOptions)
          .where(inArray(schema.variantOptions.variantId, variantIds))
      : Promise.resolve([]),
    tx
      .select({ attributeId: schema.productAttributeValues.attributeId, value: schema.productAttributeValues.value })
      .from(schema.productAttributeValues)
      .where(eq(schema.productAttributeValues.productId, productId))
      .orderBy(asc(schema.productAttributeValues.attributeId)),
  ]);
  return { product, variants, stocks, options, attributes };
}

export async function updateProduct(rawProductId: number, input: ValidatedProductInput): Promise<ProductSaveResult> {
  const productId = parsePositiveInteger(rawProductId);
  if (!productId) throw new ProductAdminNotFoundError();
  const access = await requireProductsAdminAccess();
  await assertImagesBelongToTenant(input.images, access);
  const now = new Date();

  return access.db.transaction(async (tx) => {
    await lockProductIdentifiers(tx);
    await tx.execute(sql`select id from ${schema.products} where ${schema.products.id} = ${productId} for update`);

    // Lock every existing child before taking the optimistic snapshot. This
    // closes the race with stock adjustments and variant edits that do not use
    // this editor's advisory lock.
    const lockedVariants = await tx
      .select({ id: schema.productVariants.id })
      .from(schema.productVariants)
      .where(eq(schema.productVariants.productId, productId))
      .for('update');
    const variantIds = lockedVariants.map((variant) => variant.id);
    if (variantIds.length) {
      await tx
        .select({ id: schema.productStocks.id })
        .from(schema.productStocks)
        .where(inArray(schema.productStocks.variantId, variantIds))
        .for('update');
      await tx
        .select({ variantId: schema.variantOptions.variantId })
        .from(schema.variantOptions)
        .where(inArray(schema.variantOptions.variantId, variantIds))
        .for('update');
    }
    await tx
      .select({ id: schema.productAttributeValues.id })
      .from(schema.productAttributeValues)
      .where(eq(schema.productAttributeValues.productId, productId))
      .for('update');

    const snapshot = await readLockedConcurrencySnapshot(tx, productId);
    if (!snapshot.product) throw new ProductAdminNotFoundError();
    if (buildConcurrencyToken(snapshot) !== input.concurrencyToken) {
      throw new ProductValidationError(
        { concurrencyToken: 'This product changed while the editor was open. Reload and review the latest values.' },
        'This product changed while the editor was open.',
      );
    }

    const storeId = resolveStoreId(access, snapshot.product.storeId);
    if (input.productType === 'simple' && input.variants[0]?.existingVariantId === null) {
      const existingDefault = snapshot.variants
        .filter((variant) => (snapshot.options.some((option) => option.variantId === variant.id) ? false : variant.name.trim().toLocaleLowerCase('en-US') === 'default'))
        .sort((left, right) => left.id - right.id)[0];
      if (existingDefault) input.variants[0].existingVariantId = existingDefault.id;
    }

    const { optionValues } = await resolveRelationships(tx, input, storeId);
    const variants = resolveVariantOptionDefinitions(input.productType, input.variants, optionValues);
    if (variants.length === 0 || !variants.some((variant) => variant.status === 'Active')) {
      throw new ProductValidationError({ variants: 'At least one Active variant is required.' });
    }
    const submittedExistingIds = new Set(variants.flatMap((variant) => variant.existingVariantId ? [variant.existingVariantId] : []));
    const currentVariantIds = new Set(snapshot.variants.map((variant) => variant.id));
    if (Array.from(submittedExistingIds).some((variantId) => !currentVariantIds.has(variantId))) {
      throw new ProductValidationError({ variants: 'A variant ID does not belong to this product.' });
    }
    await assertUniqueIdentifiers(tx, input, productId);

    const submittedIds = new Set(variants.flatMap((variant) => variant.existingVariantId ? [variant.existingVariantId] : []));
    const omittedActiveIds = snapshot.variants
      .filter((variant) => variant.status === 'Active' && !submittedIds.has(variant.id))
      .map((variant) => variant.id);
    if (omittedActiveIds.length) {
      await tx
        .update(schema.productVariants)
        .set({ status: 'Inactive', updatedAt: now })
        .where(and(eq(schema.productVariants.productId, productId), inArray(schema.productVariants.id, omittedActiveIds)));
    }

    const savedVariantIds: number[] = [];
    for (const variant of variants) {
      savedVariantIds.push(await upsertVariantAndStock(tx, productId, input.warehouseId, variant, now));
    }

    // Parent stock is a catalog compatibility field. Recompute it from every
    // active variant stock row (including preserved warehouses), rather than
    // exposing only the warehouse currently open in the editor.
    const activeStockRows = await tx
      .select({ quantity: schema.productStocks.quantity, minStockLevel: schema.productStocks.minStockLevel })
      .from(schema.productStocks)
      .innerJoin(
        schema.productVariants,
        and(
          eq(schema.productStocks.variantId, schema.productVariants.id),
          eq(schema.productVariants.productId, productId),
          eq(schema.productVariants.status, 'Active'),
        ),
      );
    const catalogStock = activeStockRows.reduce((total, row) => total + row.quantity, 0);
    const catalogMinStock = activeStockRows.reduce((total, row) => total + (row.minStockLevel ?? 0), 0);
    const [updatedProduct] = await tx
      .update(schema.products)
      .set({
        ...buildProductWrite(input, variants, storeId),
        stockQuantity: catalogStock,
        minStockLevel: catalogMinStock,
        updatedAt: now,
      })
      .where(eq(schema.products.id, productId))
      .returning({ id: schema.products.id });
    if (!updatedProduct) throw new ProductAdminNotFoundError();
    await replaceCategoryAttributes(tx, productId, input.attributes);

    const activeVariants = await tx
      .select({ id: schema.productVariants.id })
      .from(schema.productVariants)
      .where(and(eq(schema.productVariants.productId, productId), eq(schema.productVariants.status, 'Active')));
    if (activeVariants.length === 0) throw new ProductValidationError({ variants: 'The product must keep at least one Active variant.' });

    return {
      productId,
      variantIds: savedVariantIds,
      defaultVariantId: input.productType === 'simple' ? savedVariantIds[0] : null,
    };
  });
}
