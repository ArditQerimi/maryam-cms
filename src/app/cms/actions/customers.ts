'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, isNotNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { getContextDb } from '@/lib/tenant';
import { customerNotes, customers, sales, users } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';

export type CustomerActionResult = {
  ok: boolean;
  error?: string;
  password?: string;
  status?: string;
};

function readString(formData: FormData, key: string, max = 4000) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function parsePositiveId(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * The customers table has no user_id column; a storefront account is linked to
 * a CRM customer through `sales.customer_user_id`.
 */
async function findLinkedUserId(db: Awaited<ReturnType<typeof getContextDb>>, customerId: number) {
  const [row] = await db
    .select({ linkedUserId: sales.customerUserId })
    .from(sales)
    .where(and(eq(sales.customerId, customerId), isNotNull(sales.customerUserId)))
    .limit(1);
  return row?.linkedUserId ?? null;
}

/* -------------------------------------------------------------------------- */
/* Profile & address                                                           */
/* -------------------------------------------------------------------------- */

export async function updateCustomerProfile(
  customerId: number,
  formData: FormData,
): Promise<CustomerActionResult> {
  await requireCmsSession();
  const name = readString(formData, 'name', 255).trim();
  const email = readString(formData, 'email', 255).trim();
  const phone = readString(formData, 'phone', 50).trim();

  if (!name) return { ok: false, error: 'The customer name is required.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  const db = await getContextDb();
  const [customer] = await db
    .select({ id: customers.id, status: customers.status })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  if (!customer) return { ok: false, error: 'Customer not found.' };

  await db
    .update(customers)
    .set({ name, email: email || null, phone: phone || null })
    .where(eq(customers.id, customerId));

  const userId = await findLinkedUserId(db, customerId);
  if (userId) {
    await db
      .update(users)
      .set({ name, email: email || undefined, phone: phone || null, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  revalidatePath('/cms/customers');
  revalidatePath(`/cms/customers/${customerId}`);
  return { ok: true };
}

export async function updateCustomerAddress(
  customerId: number,
  formData: FormData,
): Promise<CustomerActionResult> {
  await requireCmsSession();
  const db = await getContextDb();
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  if (!customer) return { ok: false, error: 'Customer not found.' };

  await db
    .update(customers)
    .set({
      address: readString(formData, 'address', 1000).trim() || null,
      city: readString(formData, 'city', 100).trim() || null,
      state: readString(formData, 'state', 100).trim() || null,
      country: readString(formData, 'country', 100).trim() || null,
      postalCode: readString(formData, 'postalCode', 30).trim() || null,
    })
    .where(eq(customers.id, customerId));

  revalidatePath(`/cms/customers/${customerId}`);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Account status                                                              */
/* -------------------------------------------------------------------------- */

export async function setCustomerAccountStatus(
  customerId: number,
  status: 'Active' | 'Suspended',
): Promise<CustomerActionResult> {
  await requireCmsSession();
  const db = await getContextDb();

  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  if (!customer) return { ok: false, error: 'Customer not found.' };

  await db.update(customers).set({ status }).where(eq(customers.id, customerId));

  const userId = await findLinkedUserId(db, customerId);
  if (userId) {
    await db
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  revalidatePath('/cms/customers');
  revalidatePath(`/cms/customers/${customerId}`);
  return { ok: true, status };
}

/* -------------------------------------------------------------------------- */
/* Password reset                                                              */
/* -------------------------------------------------------------------------- */

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(14);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * alphabet.length);
  return Array.from(bytes, (byte) => alphabet[byte]).join('');
}

export async function resetCustomerPassword(
  customerId: number,
): Promise<CustomerActionResult> {
  await requireCmsSession();
  const db = await getContextDb();

  const userId = await findLinkedUserId(db, customerId);
  if (!userId) {
    return { ok: false, error: 'No storefront account is linked to this customer yet.' };
  }

  const temporary = generateTemporaryPassword();
  const hash = await bcrypt.hash(temporary, 10);

  await db
    .update(users)
    .set({ passwordHash: hash, updatedAt: new Date() })
    .where(eq(users.id, userId));

  revalidatePath(`/cms/customers/${customerId}`);
  // The temporary password is returned once so it can be shown in a toast and
  // is never stored in plain text.
  return { ok: true, password: temporary };
}

/* -------------------------------------------------------------------------- */
/* Notes                                                                       */
/* -------------------------------------------------------------------------- */

export async function addCustomerNote(formData: FormData): Promise<CustomerActionResult> {
  const session = await requireCmsSession();
  const customerId = parsePositiveId(readString(formData, 'customerId'));
  const body = readString(formData, 'body', 4000).trim();
  if (!customerId) return { ok: false, error: 'Customer not found.' };
  if (!body) return { ok: false, error: 'The note cannot be empty.' };

  const db = await getContextDb();
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  if (!customer) return { ok: false, error: 'Customer not found.' };

  await db.insert(customerNotes).values({
    customerId,
    body,
    createdByUserId: parsePositiveId(session.userId),
  });

  revalidatePath(`/cms/customers/${customerId}`);
  return { ok: true };
}
