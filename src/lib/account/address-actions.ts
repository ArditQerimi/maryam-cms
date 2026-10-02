'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { getTenantDb } from '@/db/index';
import * as tenantSchema from '@/db/schema-tenant';
import { requireAccountPrincipal } from './data';

export type AddressKind = 'billing' | 'shipping';

export type AddressActionState = {
  status: 'idle' | 'error' | 'success';
  message?: string;
};

const FIELD_LIMITS: Record<string, number> = {
  firstName: 80,
  lastName: 80,
  company: 120,
  country: 2,
  address1: 200,
  address2: 200,
  city: 120,
  region: 120,
  postalCode: 20,
  phone: 32,
  email: 254,
};

const REQUIRED: Record<AddressKind, string[]> = {
  billing: ['firstName', 'lastName', 'country', 'address1', 'city', 'region', 'postalCode', 'phone', 'email'],
  shipping: ['firstName', 'lastName', 'country', 'address1', 'city', 'region', 'postalCode'],
};

const COUNTRY_CODES = new Set(['AL', 'AT', 'BE', 'FR', 'DE', 'IT', 'XK', 'NL', 'ES', 'GB', 'US']);

export async function saveAccountAddress(
  kind: AddressKind,
  _previousState: AddressActionState,
  formData: FormData,
): Promise<AddressActionState> {
  if (kind !== 'billing' && kind !== 'shipping') {
    return { status: 'error', message: 'Unknown address type.' };
  }

  const principal = await requireAccountPrincipal(`/home/account/edit-address/${kind}`);

  const allowed = kind === 'billing'
    ? Object.keys(FIELD_LIMITS)
    : Object.keys(FIELD_LIMITS).filter((key) => key !== 'phone' && key !== 'email');
  const address: Record<string, string> = {};
  for (const key of allowed) {
    const raw = formData.get(key);
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (value.length > FIELD_LIMITS[key]) {
      return { status: 'error', message: 'One of the fields is too long.' };
    }
    address[key] = value;
  }

  if (REQUIRED[kind].some((key) => !address[key])) {
    return { status: 'error', message: 'Please fill in all required fields.' };
  }
  if (!COUNTRY_CODES.has(address.country)) {
    return { status: 'error', message: 'Please choose a valid country.' };
  }
  if (kind === 'billing' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(address.email)) {
    return { status: 'error', message: 'Please enter a valid email address.' };
  }

  try {
    const db = getTenantDb(principal.company.dbConnectionString, principal.company.dbSchema);
    await db
      .insert(tenantSchema.customerAddresses)
      .values({ userId: principal.userId, kind, address })
      .onConflictDoUpdate({
        target: [tenantSchema.customerAddresses.userId, tenantSchema.customerAddresses.kind],
        set: { address, updatedAt: sql`now()` },
      });
  } catch {
    return { status: 'error', message: 'Your address could not be saved. Please try again later.' };
  }

  revalidatePath('/home/account/addresses');
  revalidatePath(`/home/account/edit-address/${kind}`);
  return { status: 'success', message: 'Address changed successfully.' };
}
