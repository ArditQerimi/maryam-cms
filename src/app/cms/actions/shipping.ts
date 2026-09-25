'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { getContextCompany, getContextDb } from '@/lib/tenant';
import {
  orderNotes,
  sales,
  settingsStore,
  shippingMethods,
  shippingZoneLocations,
  shippingZones,
} from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { SHIPPING_CLASSES_KEY, type ShippingClass } from '@/app/cms/shipping/settings-key';

export type ShippingActionResult = {
  ok: boolean;
  id?: number;
  error?: string;
};

const ZONES_PATH = '/cms/shipping/zones';
const CLASSES_PATH = '/cms/shipping/classes';

const METHOD_TYPES = new Set(['flat_rate', 'free_shipping', 'local_pickup']);
const LOCATION_TYPES = new Set(['country', 'state']);

const MAX_METHODS_PER_ZONE = 50;
const MAX_CLASSES = 50;

/* -------------------------------------------------------------------------- */
/* Field helpers                                                               */
/* -------------------------------------------------------------------------- */

function readString(formData: FormData, key: string, max = 255) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function readInteger(formData: FormData, key: string, fallback: number) {
  const raw = readString(formData, key, 20).trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function readMoney(formData: FormData, key: string) {
  const raw = readString(formData, key, 20).trim().replace(',', '.');
  if (!raw) return '0.00';
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 9_999_999.99) return null;
  return parsed.toFixed(2);
}

/** Parse the `locations` form field: `[{ type: 'country' | 'state', code }]`. */
function readLocations(formData: FormData): Array<{ type: 'country' | 'state'; code: string }> {
  const raw = readString(formData, 'locations', 40_000);
  if (!raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const result: Array<{ type: 'country' | 'state'; code: string }> = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      const type = typeof record.type === 'string' ? record.type : '';
      const code = typeof record.code === 'string' ? record.code.trim().slice(0, 10) : '';
      if (!code || !LOCATION_TYPES.has(type)) continue;
      if (result.some((existing) => existing.type === type && existing.code === code)) continue;
      result.push({ type: type as 'country' | 'state', code });
      if (result.length >= 100) break;
    }
    return result;
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Zone ownership guards                                                       */
/* -------------------------------------------------------------------------- */

async function findCompanyZone(companyId: number, zoneId: number) {
  const db = await getContextDb();
  const [zone] = await db
    .select({ id: shippingZones.id })
    .from(shippingZones)
    .where(and(eq(shippingZones.id, zoneId), eq(shippingZones.companyId, companyId)))
    .limit(1);
  return zone ?? null;
}

async function findCompanyMethod(companyId: number, methodId: number) {
  const db = await getContextDb();
  const [row] = await db
    .select({ id: shippingMethods.id, zoneId: shippingMethods.zoneId })
    .from(shippingMethods)
    .innerJoin(shippingZones, eq(shippingZones.id, shippingMethods.zoneId))
    .where(and(eq(shippingMethods.id, methodId), eq(shippingZones.companyId, companyId)))
    .limit(1);
  return row ?? null;
}

/* -------------------------------------------------------------------------- */
/* Zones                                                                       */
/* -------------------------------------------------------------------------- */

export async function createZone(formData: FormData): Promise<ShippingActionResult> {
  await requireCmsSession();

  const name = readString(formData, 'name', 255).trim();
  if (!name) return { ok: false, error: 'Enter a zone name.' };

  const company = await getContextCompany();
  const db = await getContextDb();

  const [zone] = await db
    .insert(shippingZones)
    .values({
      companyId: company.id,
      name,
      priority: readInteger(formData, 'priority', 0),
    })
    .returning({ id: shippingZones.id });

  const locations = readLocations(formData);
  if (locations.length > 0) {
    await db
      .insert(shippingZoneLocations)
      .values(locations.map((location) => ({ zoneId: zone.id, ...location })));
  }

  revalidatePath(ZONES_PATH);
  return { ok: true, id: zone.id };
}

export async function updateZone(
  zoneId: number,
  formData: FormData,
): Promise<ShippingActionResult> {
  await requireCmsSession();

  const name = readString(formData, 'name', 255).trim();
  if (!name) return { ok: false, error: 'Enter a zone name.' };

  const company = await getContextCompany();
  const zone = await findCompanyZone(company.id, zoneId);
  if (!zone) return { ok: false, error: 'Shipping zone not found.' };

  const db = await getContextDb();
  await db
    .update(shippingZones)
    .set({ name, updatedAt: new Date() })
    .where(eq(shippingZones.id, zoneId));

  revalidatePath(ZONES_PATH);
  return { ok: true, id: zoneId };
}

export async function deleteZone(zoneId: number): Promise<ShippingActionResult> {
  await requireCmsSession();

  const company = await getContextCompany();
  const zone = await findCompanyZone(company.id, zoneId);
  if (!zone) return { ok: false, error: 'Shipping zone not found.' };

  const db = await getContextDb();
  await db.delete(shippingZones).where(eq(shippingZones.id, zoneId));

  revalidatePath(ZONES_PATH);
  return { ok: true, id: zoneId };
}

/* -------------------------------------------------------------------------- */
/* Zone locations                                                              */
/* -------------------------------------------------------------------------- */

export async function addZoneLocation(
  zoneId: number,
  type: string,
  code: string,
): Promise<ShippingActionResult> {
  await requireCmsSession();

  const normalizedType = type.trim().toLowerCase();
  const normalizedCode = code.trim().slice(0, 10);
  if (!normalizedCode || !LOCATION_TYPES.has(normalizedType)) {
    return { ok: false, error: 'Choose a valid country or state.' };
  }

  const company = await getContextCompany();
  const zone = await findCompanyZone(company.id, zoneId);
  if (!zone) return { ok: false, error: 'Shipping zone not found.' };

  const db = await getContextDb();
  const [existing] = await db
    .select({ id: shippingZoneLocations.id })
    .from(shippingZoneLocations)
    .where(and(
      eq(shippingZoneLocations.zoneId, zoneId),
      eq(shippingZoneLocations.type, normalizedType),
      eq(shippingZoneLocations.code, normalizedCode),
    ))
    .limit(1);
  if (existing) return { ok: true, id: existing.id };

  const [row] = await db
    .insert(shippingZoneLocations)
    .values({
      zoneId,
      type: normalizedType,
      code: normalizedCode,
    })
    .returning({ id: shippingZoneLocations.id });

  revalidatePath(ZONES_PATH);
  return { ok: true, id: row.id };
}

export async function removeZoneLocation(locationId: number): Promise<ShippingActionResult> {
  await requireCmsSession();

  const db = await getContextDb();
  const [row] = await db
    .select({ id: shippingZoneLocations.id, zoneId: shippingZoneLocations.zoneId })
    .from(shippingZoneLocations)
    .innerJoin(shippingZones, eq(shippingZones.id, shippingZoneLocations.zoneId))
    .where(eq(shippingZoneLocations.id, locationId))
    .limit(1);
  if (!row) return { ok: false, error: 'Zone location not found.' };

  const company = await getContextCompany();
  const zone = await findCompanyZone(company.id, row.zoneId);
  if (!zone) return { ok: false, error: 'Shipping zone not found.' };

  await db.delete(shippingZoneLocations).where(eq(shippingZoneLocations.id, locationId));

  revalidatePath(ZONES_PATH);
  return { ok: true, id: locationId };
}

/* -------------------------------------------------------------------------- */
/* Shipping methods                                                            */
/* -------------------------------------------------------------------------- */

function readMethodValues(formData: FormData) {
  const type = readString(formData, 'type', 30).trim().toLowerCase();
  if (!METHOD_TYPES.has(type)) return null;

  const title = readString(formData, 'title', 255).trim();
  if (!title) return null;

  const cost = readMoney(formData, 'cost');
  if (cost === null) return null;
  const minOrderAmount = readMoney(formData, 'minOrderAmount');
  if (minOrderAmount === null) return null;

  return {
    type,
    title,
    cost,
    minOrderAmount,
    instructions: readString(formData, 'instructions', 2000).trim() || null,
    sortOrder: readInteger(formData, 'sortOrder', 0),
    enabled: formData.get('enabled') === 'on' || formData.get('enabled') === 'true',
  };
}

export async function createShippingMethod(
  zoneId: number,
  formData: FormData,
): Promise<ShippingActionResult> {
  await requireCmsSession();

  const values = readMethodValues(formData);
  if (!values) return { ok: false, error: 'Check the method details — a title and valid costs are required.' };

  const company = await getContextCompany();
  const zone = await findCompanyZone(company.id, zoneId);
  if (!zone) return { ok: false, error: 'Shipping zone not found.' };

  const db = await getContextDb();
  const [countRow] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(shippingMethods)
    .where(eq(shippingMethods.zoneId, zoneId));
  if ((countRow?.value ?? 0) >= MAX_METHODS_PER_ZONE) {
    return { ok: false, error: `A zone can hold at most ${MAX_METHODS_PER_ZONE} methods.` };
  }

  const [row] = await db
    .insert(shippingMethods)
    .values({ zoneId, ...values })
    .returning({ id: shippingMethods.id });

  revalidatePath(ZONES_PATH);
  return { ok: true, id: row.id };
}

export async function updateShippingMethod(
  methodId: number,
  formData: FormData,
): Promise<ShippingActionResult> {
  await requireCmsSession();

  const values = readMethodValues(formData);
  if (!values) return { ok: false, error: 'Check the method details — a title and valid costs are required.' };

  const company = await getContextCompany();
  const method = await findCompanyMethod(company.id, methodId);
  if (!method) return { ok: false, error: 'Shipping method not found.' };

  const db = await getContextDb();
  await db.update(shippingMethods).set(values).where(eq(shippingMethods.id, methodId));

  revalidatePath(ZONES_PATH);
  return { ok: true, id: methodId };
}

export async function deleteShippingMethod(methodId: number): Promise<ShippingActionResult> {
  await requireCmsSession();

  const company = await getContextCompany();
  const method = await findCompanyMethod(company.id, methodId);
  if (!method) return { ok: false, error: 'Shipping method not found.' };

  const db = await getContextDb();
  await db.delete(shippingMethods).where(eq(shippingMethods.id, methodId));

  revalidatePath(ZONES_PATH);
  return { ok: true, id: methodId };
}

/* -------------------------------------------------------------------------- */
/* Shipping classes (settings_store)                                           */
/* -------------------------------------------------------------------------- */

function sanitizeClasses(input: unknown): { ok: true; classes: ShippingClass[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: 'Shipping classes must be a list.' };
  if (input.length > MAX_CLASSES) return { ok: false, error: `Keep it to ${MAX_CLASSES} classes or fewer.` };

  const classes: ShippingClass[] = [];
  const seenSlugs = new Set<string>();

  for (const entry of input) {
    if (!entry || typeof entry !== 'object') return { ok: false, error: 'A shipping class is invalid.' };
    const record = entry as Record<string, unknown>;

    const name = typeof record.name === 'string' ? record.name.trim().slice(0, 80) : '';
    if (!name) return { ok: false, error: 'Every shipping class needs a name.' };

    const description = typeof record.description === 'string' ? record.description.trim().slice(0, 240) : '';
    const rawSlug = typeof record.slug === 'string' ? record.slug.trim() : '';
    const slug = rawSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!slug || seenSlugs.has(slug)) return { ok: false, error: `Duplicate or empty slug "${slug}".` };
    seenSlugs.add(slug);

    const rawId = typeof record.id === 'string' ? record.id.trim().slice(0, 40) : '';
    classes.push({ id: rawId || slug, name, description, slug });
  }

  return { ok: true, classes };
}

export async function saveShippingClasses(input: unknown): Promise<ShippingActionResult> {
  await requireCmsSession();

  const result = sanitizeClasses(input);
  if (!result.ok) return { ok: false, error: result.error };

  const db = await getContextDb();
  const payload = JSON.stringify(result.classes);
  await db
    .insert(settingsStore)
    .values({ key: SHIPPING_CLASSES_KEY, value: payload, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settingsStore.key,
      set: { value: payload, updatedAt: new Date() },
    });

  revalidatePath(CLASSES_PATH);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Checkout order note (public — called after an order is confirmed)           */
/* -------------------------------------------------------------------------- */

const NOTE_TITLE_PATTERN = /^[\p{L}\p{N} .,'&/()+-]{1,60}$/u;
const NOTE_COST_PATTERN = /^\d{1,6}(\.\d{1,2})?$/;

/**
 * Persist the customer's chosen shipping method as an order note.
 *
 * The storefront checkout request contract is intentionally fixed (it accepts
 * no extra keys), so the confirmed selection is recorded here after the server
 * creates the order. The body is composed server-side from two validated
 * scalars, the target must be an existing online sale, and identical notes are
 * written only once — a replay can never grow the note list.
 */
export async function recordCheckoutShippingNote(
  orderId: string,
  methodTitle: string,
  methodCost: string,
): Promise<ShippingActionResult> {
  if (!/^\d{1,10}$/.test(orderId)) return { ok: false, error: 'Invalid order.' };

  const title = typeof methodTitle === 'string' ? methodTitle.trim() : '';
  const cost = typeof methodCost === 'string' ? methodCost.trim() : '';
  if (!NOTE_TITLE_PATTERN.test(title) || !NOTE_COST_PATTERN.test(cost)) {
    return { ok: false, error: 'Invalid shipping method details.' };
  }

  try {
    const db = await getContextDb();
    const saleId = Number.parseInt(orderId, 10);

    const [sale] = await db
      .select({ id: sales.id })
      .from(sales)
      .where(and(eq(sales.id, saleId), eq(sales.isOnline, true)))
      .limit(1);
    if (!sale) return { ok: false, error: 'Order not found.' };

    const body = `Shipping method: ${title} (${cost} EUR)`;
    const [existing] = await db
      .select({ id: orderNotes.id })
      .from(orderNotes)
      .where(and(eq(orderNotes.orderId, saleId), eq(orderNotes.body, body)))
      .limit(1);
    if (existing) return { ok: true, id: existing.id };

    const [note] = await db
      .insert(orderNotes)
      .values({ orderId: saleId, body, isCustomerNote: false })
      .returning({ id: orderNotes.id });

    return { ok: true, id: note.id };
  } catch (error) {
    console.error('recordCheckoutShippingNote failed', error);
    return { ok: false, error: 'Could not record the shipping note.' };
  }
}


