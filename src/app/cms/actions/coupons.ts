'use server';

import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import { coupons } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';

export type CouponActionResult = { ok: boolean; id?: number; error?: string };

const COUPON_STATUSES = ['Active', 'Inactive', 'Archived', 'Pending', 'Suspended'] as const;
const DISCOUNT_TYPES = ['Percentage', 'Fixed'] as const;
type DiscountType = (typeof DISCOUNT_TYPES)[number];
/** Matches the `status` pgEnum — never widen a plain `string` into the insert. */
type CouponStatus = (typeof COUPON_STATUSES)[number];

function readString(formData: FormData, key: string, max = 4000) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.slice(0, max) : '';
}

type CouponPayload =
  | { error: string }
  | {
      code: string;
      discountType: DiscountType;
      discountValue: string;
      startDate: Date | null;
      endDate: Date | null;
      usageLimit: number;
      status: CouponStatus;
    };

function readCouponPayload(formData: FormData): CouponPayload {
  const code = readString(formData, 'code', 100).trim().toUpperCase();
  if (!code) return { error: 'A coupon code is required.' };

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

  const usageRaw = readString(formData, 'usageLimit', 20).trim();
  const usageLimit = usageRaw ? Math.floor(Number(usageRaw)) : 0;
  if (!Number.isFinite(usageLimit) || usageLimit < 0) {
    return { error: 'The usage limit must be 0 (unlimited) or more.' };
  }

  const rawStatus = readString(formData, 'status', 30);
  const status: CouponStatus = (COUPON_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as CouponStatus)
    : 'Active';

  return {
    code,
    discountType,
    discountValue: value.toFixed(2),
    startDate,
    endDate,
    usageLimit,
    status,
  };
}

async function codeClash(
  db: Awaited<ReturnType<typeof getContextDb>>,
  code: string,
  excludeId: number | null,
) {
  const rows = await db
    .select({ id: coupons.id })
    .from(coupons)
    .where(sql`lower(${coupons.code}) = ${code.toLowerCase()}`)
    .limit(2);
  return rows.some((row) => row.id !== excludeId);
}

export async function createCoupon(formData: FormData): Promise<CouponActionResult> {
  await requireCmsSession();
  const payload = readCouponPayload(formData);
  if ('error' in payload) return { ok: false, error: payload.error };

  const db = await getContextDb();
  if (await codeClash(db, payload.code, null)) {
    return { ok: false, error: `The code "${payload.code}" already exists.` };
  }

  const [row] = await db
    .insert(coupons)
    .values({
      code: payload.code,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      startDate: payload.startDate,
      endDate: payload.endDate,
      usageLimit: payload.usageLimit,
      status: payload.status,
    })
    .returning({ id: coupons.id });

  revalidatePath('/cms/coupons');
  return { ok: true, id: row.id };
}

export async function updateCoupon(id: number, formData: FormData): Promise<CouponActionResult> {
  await requireCmsSession();
  const payload = readCouponPayload(formData);
  if ('error' in payload) return { ok: false, error: payload.error };

  const db = await getContextDb();
  const [existing] = await db
    .select({ id: coupons.id })
    .from(coupons)
    .where(eq(coupons.id, id))
    .limit(1);
  if (!existing) return { ok: false, error: 'Coupon not found.' };

  if (await codeClash(db, payload.code, id)) {
    return { ok: false, error: `The code "${payload.code}" already exists.` };
  }

  await db
    .update(coupons)
    .set({
      code: payload.code,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      startDate: payload.startDate,
      endDate: payload.endDate,
      usageLimit: payload.usageLimit,
      status: payload.status,
    })
    .where(eq(coupons.id, id));

  revalidatePath('/cms/coupons');
  return { ok: true, id };
}

export async function deleteCoupon(id: number): Promise<CouponActionResult> {
  await requireCmsSession();
  const db = await getContextDb();
  const [existing] = await db
    .select({ id: coupons.id })
    .from(coupons)
    .where(eq(coupons.id, id))
    .limit(1);
  if (!existing) return { ok: false, error: 'Coupon not found.' };

  await db.delete(coupons).where(eq(coupons.id, id));
  revalidatePath('/cms/coupons');
  return { ok: true, id };
}
