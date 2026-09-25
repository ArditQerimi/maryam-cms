'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import { categories, categoryDiscounts, productDiscounts, products } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';

export type DiscountActionResult = { ok: boolean; id?: number; error?: string };

const STATUSES = ['Active', 'Inactive', 'Archived', 'Pending', 'Suspended'] as const;
const DISCOUNT_TYPES = ['Percentage', 'Fixed'] as const;
type DiscountType = (typeof DISCOUNT_TYPES)[number];
/** Matches the `status` pgEnum — never widen a plain `string` into the insert. */
type DiscountStatus = (typeof STATUSES)[number];

function readString(formData: FormData, key: string, max = 4000) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function readEntityId(formData: FormData, key: string): number | null {
  const value = Number(readString(formData, key));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

type DiscountPayload =
  | { error: string }
  | {
      entityId: number;
      discountType: DiscountType;
      discountValue: string;
      startDate: Date | null;
      endDate: Date | null;
      status: DiscountStatus;
    };

async function readDiscountPayload(
  formData: FormData,
  kind: 'product' | 'category',
): Promise<DiscountPayload> {
  const entityId = readEntityId(formData, kind === 'product' ? 'productId' : 'categoryId');
  if (!entityId) return { error: `Pick a ${kind} first.` };

  const db = await getContextDb();
  if (kind === 'product') {
    const [entity] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, entityId))
      .limit(1);
    if (!entity) return { error: 'The selected product no longer exists.' };
  } else {
    const [entity] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, entityId))
      .limit(1);
    if (!entity) return { error: 'The selected category no longer exists.' };
  }

  const rawType = readString(formData, 'discountType', 20);
  const discountType = (DISCOUNT_TYPES as readonly string[]).includes(rawType)
    ? (rawType as DiscountType)
    : 'Percentage';

  const rawValue = readString(formData, 'discountValue', 40).trim().replace(',', '.');
  const value = Number(rawValue);
  if (!rawValue || !Number.isFinite(value) || value <= 0) {
    return { error: 'The discount value must be greater than 0.' };
  }
  if (discountType === 'Percentage' && value > 100) {
    return { error: 'A percentage discount cannot be higher than 100%.' };
  }

  const startRaw = readString(formData, 'startDate', 40).trim();
  const endRaw = readString(formData, 'endDate', 40).trim();
  const startDate = startRaw ? new Date(startRaw) : null;
  const endDate = endRaw ? new Date(`${endRaw}T23:59:59`) : null;
  if (startDate && Number.isNaN(startDate.getTime())) return { error: 'The start date is not valid.' };
  if (endDate && Number.isNaN(endDate.getTime())) return { error: 'The end date is not valid.' };
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    return { error: 'The end date must be on or after the start date.' };
  }

  const rawStatus = readString(formData, 'status', 30);
  const status: DiscountStatus = (STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as DiscountStatus)
    : 'Active';

  return {
    entityId,
    discountType,
    discountValue: value.toFixed(2),
    startDate,
    endDate,
    status,
  };
}

export async function createProductDiscount(formData: FormData): Promise<DiscountActionResult> {
  await requireCmsSession();
  const payload = await readDiscountPayload(formData, 'product');
  if ('error' in payload) return { ok: false, error: payload.error };

  const db = await getContextDb();
  const [row] = await db
    .insert(productDiscounts)
    .values({
      productId: payload.entityId,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      startDate: payload.startDate,
      endDate: payload.endDate,
      status: payload.status,
    })
    .returning({ id: productDiscounts.id });

  revalidatePath('/cms/discounts/product');
  return { ok: true, id: row.id };
}

export async function updateProductDiscount(
  id: number,
  formData: FormData,
): Promise<DiscountActionResult> {
  await requireCmsSession();
  const payload = await readDiscountPayload(formData, 'product');
  if ('error' in payload) return { ok: false, error: payload.error };

  const db = await getContextDb();
  const [existing] = await db
    .select({ id: productDiscounts.id })
    .from(productDiscounts)
    .where(eq(productDiscounts.id, id))
    .limit(1);
  if (!existing) return { ok: false, error: 'Discount not found.' };

  await db
    .update(productDiscounts)
    .set({
      productId: payload.entityId,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      startDate: payload.startDate,
      endDate: payload.endDate,
      status: payload.status,
    })
    .where(eq(productDiscounts.id, id));

  revalidatePath('/cms/discounts/product');
  return { ok: true, id };
}

export async function deleteProductDiscount(id: number): Promise<DiscountActionResult> {
  await requireCmsSession();
  const db = await getContextDb();
  await db.delete(productDiscounts).where(eq(productDiscounts.id, id));
  revalidatePath('/cms/discounts/product');
  return { ok: true, id };
}

export async function createCategoryDiscount(formData: FormData): Promise<DiscountActionResult> {
  await requireCmsSession();
  const payload = await readDiscountPayload(formData, 'category');
  if ('error' in payload) return { ok: false, error: payload.error };

  const db = await getContextDb();
  const [row] = await db
    .insert(categoryDiscounts)
    .values({
      categoryId: payload.entityId,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      startDate: payload.startDate,
      endDate: payload.endDate,
      status: payload.status,
    })
    .returning({ id: categoryDiscounts.id });

  revalidatePath('/cms/discounts/category');
  return { ok: true, id: row.id };
}

export async function updateCategoryDiscount(
  id: number,
  formData: FormData,
): Promise<DiscountActionResult> {
  await requireCmsSession();
  const payload = await readDiscountPayload(formData, 'category');
  if ('error' in payload) return { ok: false, error: payload.error };

  const db = await getContextDb();
  const [existing] = await db
    .select({ id: categoryDiscounts.id })
    .from(categoryDiscounts)
    .where(eq(categoryDiscounts.id, id))
    .limit(1);
  if (!existing) return { ok: false, error: 'Discount not found.' };

  await db
    .update(categoryDiscounts)
    .set({
      categoryId: payload.entityId,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      startDate: payload.startDate,
      endDate: payload.endDate,
      status: payload.status,
    })
    .where(eq(categoryDiscounts.id, id));

  revalidatePath('/cms/discounts/category');
  return { ok: true, id };
}

export async function deleteCategoryDiscount(id: number): Promise<DiscountActionResult> {
  await requireCmsSession();
  const db = await getContextDb();
  await db.delete(categoryDiscounts).where(eq(categoryDiscounts.id, id));
  revalidatePath('/cms/discounts/category');
  return { ok: true, id };
}
