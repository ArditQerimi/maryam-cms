import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { compare } from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { getTenantDb } from '@/db/index';
import * as tenantSchema from '@/db/schema-tenant';
import { hashPassword } from '@/lib/auth';
import {
  hasCustomerSessionAudience,
  isActiveCustomerAccount,
  isSessionForCompany,
} from '@/lib/auth-validation';
import { getSession } from '@/lib/session';
import { createCustomerSessionForCompany } from '@/lib/session';
import { decrypt } from '@/lib/session-token';
import { getContextCompany, TenantResolutionError } from '@/lib/tenant';
import {
  getSafeAccountReturnTo,
  parsePasswordChangeForm,
  parseProfileForm,
} from './validation';

type ContextCompany = Awaited<ReturnType<typeof getContextCompany>>;

export type AccountPrincipal = {
  userId: number;
  company: ContextCompany;
};

type AccountCustomerRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  tenantRoleId: number | null;
  roleName: string | null;
  createdAt: Date;
};

type ExactAccountCustomerRow = AccountCustomerRow & {
  tenantRoleId: number;
};

type AccountCredentialRow = AccountCustomerRow & {
  passwordHash: string;
};

export type AccountAccess =
  | { status: 'unauthenticated' }
  | { status: 'denied' }
  | { status: 'authenticated'; userId: number; company: ContextCompany };

export type AccountCustomerDTO = {
  name: string;
  email: string;
  phone: string | null;
  memberSince: string;
};

export type ProfileMutationResult =
  | { ok: true; unchanged: boolean }
  | {
      ok: false;
      code: 'access-denied' | 'stale-session' | 'protected-fields' | 'name-invalid' | 'phone-invalid' | 'unavailable';
      field?: 'name' | 'phone' | 'form';
      message: string;
    };

export type PasswordMutationResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'access-denied'
        | 'stale-session'
        | 'current-password-invalid'
        | 'new-password-weak'
        | 'new-password-invalid'
        | 'password-mismatch'
        | 'incorrect-current-password'
        | 'rotation-failed'
        | 'unavailable';
      field?: 'currentPassword' | 'newPassword' | 'confirmPassword' | 'form';
      message: string;
      passwordChanged?: boolean;
    };

function parsePositiveSessionId(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function isUnexpiredSignedPayload(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const expiration = (value as Record<string, unknown>).exp;
  return typeof expiration === 'number' && Number.isFinite(expiration) && expiration > Date.now();
}

function toCustomerDTO(customer: AccountCustomerRow): AccountCustomerDTO {
  return {
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    memberSince: customer.createdAt.toISOString(),
  };
}

function isExactCustomer(
  customer: AccountCustomerRow | null | undefined
): customer is ExactAccountCustomerRow {
  return Boolean(
    customer &&
    isActiveCustomerAccount({ status: customer.status, roleName: customer.roleName }) &&
    customer.tenantRoleId
  );
}

function getTenantDatabase(company: ContextCompany) {
  return getTenantDb(company.dbConnectionString, company.dbSchema);
}

async function readAccountCustomer(principal: AccountPrincipal) {
  const db = getTenantDatabase(principal.company);
  const [customer] = await db
    .select({
      id: tenantSchema.users.id,
      name: tenantSchema.users.name,
      email: tenantSchema.users.email,
      phone: tenantSchema.users.phone,
      status: tenantSchema.users.status,
      tenantRoleId: tenantSchema.users.tenantRoleId,
      roleName: tenantSchema.tenantRoles.name,
      createdAt: tenantSchema.users.createdAt,
    })
    .from(tenantSchema.users)
    .leftJoin(
      tenantSchema.tenantRoles,
      eq(tenantSchema.tenantRoles.id, tenantSchema.users.tenantRoleId)
    )
    .where(and(
      eq(tenantSchema.users.id, principal.userId),
      eq(tenantSchema.users.status, 'Active')
    ))
    .limit(1);

  return (customer as AccountCustomerRow | undefined) || null;
}

async function readAccountCredential(principal: AccountPrincipal) {
  const db = getTenantDatabase(principal.company);
  const [customer] = await db
    .select({
      id: tenantSchema.users.id,
      name: tenantSchema.users.name,
      email: tenantSchema.users.email,
      phone: tenantSchema.users.phone,
      passwordHash: tenantSchema.users.passwordHash,
      status: tenantSchema.users.status,
      tenantRoleId: tenantSchema.users.tenantRoleId,
      roleName: tenantSchema.tenantRoles.name,
      createdAt: tenantSchema.users.createdAt,
    })
    .from(tenantSchema.users)
    .leftJoin(
      tenantSchema.tenantRoles,
      eq(tenantSchema.tenantRoles.id, tenantSchema.users.tenantRoleId)
    )
    .where(and(
      eq(tenantSchema.users.id, principal.userId),
      eq(tenantSchema.users.status, 'Active')
    ))
    .limit(1);

  return (customer as AccountCredentialRow | undefined) || null;
}

/**
 * Authentication and host/company binding live here so every account action
 * repeats the same checks. getSession() validates the signed payload and the
 * active database role; the explicit company comparison below binds it to the
 * company selected by this exact request host.
 */
export async function getAccountAccess(): Promise<AccountAccess> {
  let company: ContextCompany;
  try {
    company = await getContextCompany();
  } catch (error) {
    if (error instanceof TenantResolutionError) return { status: 'denied' };
    throw error;
  }

  const [session, cookieStore] = await Promise.all([getSession(), cookies()]);
  if (!session) {
    const signedPayload = await decrypt(cookieStore.get('session')?.value);
    return isUnexpiredSignedPayload(signedPayload)
      ? { status: 'denied' }
      : { status: 'unauthenticated' };
  }

  const userId = parsePositiveSessionId(session.userId);
  if (
    !userId ||
    !hasCustomerSessionAudience(session) ||
    !isSessionForCompany(session, company.id)
  ) {
    return { status: 'denied' };
  }

  return { status: 'authenticated', userId, company };
}

export function getAccountLoginUrl(returnTo: string, notice?: 'password-changed') {
  const params = new URLSearchParams({ returnTo: getSafeAccountReturnTo(returnTo) });
  if (notice) params.set('notice', notice);
  return `/home/login?${params.toString()}`;
}

async function requireValidatedPrincipal(returnTo: string) {
  const access = await getAccountAccess();
  if (access.status === 'unauthenticated') redirect(getAccountLoginUrl(returnTo));
  if (access.status === 'denied') notFound();

  const principal: AccountPrincipal = { userId: access.userId, company: access.company };
  const customer = await readAccountCustomer(principal);
  if (!isExactCustomer(customer) || customer.id !== principal.userId) notFound();
  return { principal, customer };
}

/**
 * Authentication + exact Active-Customer validation, returning the signed-in
 * principal (user id + request-bound company). Pages that query tenant data
 * for this shopper (order history, wishlist) use it as their data guard.
 */
export async function requireAccountPrincipal(returnTo = '/home/account'): Promise<AccountPrincipal> {
  const { principal } = await requireValidatedPrincipal(returnTo);
  return principal;
}

export async function requireAccountCustomer(returnTo = '/home/account') {
  const { customer } = await requireValidatedPrincipal(returnTo);
  return toCustomerDTO(customer);
}

function getMutationPrincipal(access: AccountAccess) {
  return access.status === 'authenticated'
    ? { userId: access.userId, company: access.company }
    : null;
}

export async function updateCurrentCustomerProfile(formData: FormData): Promise<ProfileMutationResult> {
  try {
    const principal = getMutationPrincipal(await getAccountAccess());
    if (!principal) {
      return {
        ok: false,
        code: 'access-denied',
        message: 'Your session is no longer authorized for this account. Sign in again before saving.',
      };
    }

    const current = await readAccountCustomer(principal);
    if (!isExactCustomer(current) || current.id !== principal.userId) {
      return {
        ok: false,
        code: 'stale-session',
        message: 'This account changed while the page was open. Refresh and sign in again before saving.',
      };
    }

    const validation = parseProfileForm(formData);
    if (!validation.ok) {
      return {
        ok: false,
        code: validation.code,
        field: validation.field,
        message: validation.message,
      };
    }

    if (current.name === validation.values.name && current.phone === validation.values.phone) {
      return { ok: true, unchanged: true };
    }

    const db = getTenantDatabase(principal.company);
    const [updated] = await db
      .update(tenantSchema.users)
      .set({
        name: validation.values.name,
        phone: validation.values.phone,
      })
      .where(and(
        eq(tenantSchema.users.id, principal.userId),
        eq(tenantSchema.users.tenantRoleId, current.tenantRoleId),
        eq(tenantSchema.users.status, 'Active')
      ))
      .returning({
        id: tenantSchema.users.id,
        name: tenantSchema.users.name,
        email: tenantSchema.users.email,
        phone: tenantSchema.users.phone,
        status: tenantSchema.users.status,
        tenantRoleId: tenantSchema.users.tenantRoleId,
        createdAt: tenantSchema.users.createdAt,
      });

    if (!updated || !isExactCustomer({ ...updated, roleName: current.roleName })) {
      return {
        ok: false,
        code: 'stale-session',
        message: 'This account changed while the page was open. Refresh and sign in again before saving.',
      };
    }

    return { ok: true, unchanged: false };
  } catch {
    return {
      ok: false,
      code: 'unavailable',
      message: 'We could not save your profile right now. Please try again shortly.',
    };
  }
}

async function hashLegacyPassword(password: string) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeEqualHex(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'hex');
  const rightBytes = Buffer.from(right, 'hex');
  return leftBytes.length === rightBytes.length
    && leftBytes.length > 0
    && timingSafeEqual(leftBytes, rightBytes);
}

async function verifyExistingPassword(password: string, passwordHash: string) {
  // This is the same bcrypt format used by the existing login and registration
  // helpers. The narrow SHA-256 branch keeps legacy customer hashes usable;
  // any new hash is always produced by the existing bcrypt hashPassword helper.
  if (/^\$2[aby]\$/.test(passwordHash)) {
    return compare(password, passwordHash).catch(() => false);
  }
  if (/^[a-f0-9]{64}$/i.test(passwordHash)) {
    return safeEqualHex(await hashLegacyPassword(password), passwordHash.toLowerCase());
  }
  return false;
}

export async function changeCurrentCustomerPassword(formData: FormData): Promise<PasswordMutationResult> {
  let passwordChanged = false;

  try {
    const principal = getMutationPrincipal(await getAccountAccess());
    if (!principal) {
      return {
        ok: false,
        code: 'access-denied',
        message: 'Your session is no longer authorized for this account. Sign in again before changing your password.',
      };
    }

    const current = await readAccountCredential(principal);
    if (!isExactCustomer(current) || current.id !== principal.userId) {
      return {
        ok: false,
        code: 'stale-session',
        message: 'This account changed while the page was open. Refresh and sign in again before continuing.',
      };
    }

    const validation = parsePasswordChangeForm(formData);
    if (!validation.ok) {
      return {
        ok: false,
        code: validation.code,
        field: validation.field,
        message: validation.message,
      };
    }

    if (!(await verifyExistingPassword(validation.values.currentPassword, current.passwordHash))) {
      return {
        ok: false,
        code: 'incorrect-current-password',
        field: 'currentPassword',
        message: 'Your current password is not correct.',
      };
    }

    const nextPasswordHash = await hashPassword(validation.values.newPassword);
    const db = getTenantDatabase(principal.company);
    const [updated] = await db
      .update(tenantSchema.users)
      .set({ passwordHash: nextPasswordHash })
      .where(and(
        eq(tenantSchema.users.id, principal.userId),
        eq(tenantSchema.users.tenantRoleId, current.tenantRoleId),
        eq(tenantSchema.users.status, 'Active')
      ))
      .returning({ id: tenantSchema.users.id });

    if (!updated || updated.id !== principal.userId) {
      return {
        ok: false,
        code: 'stale-session',
        message: 'This account changed while the page was open. Refresh and sign in again before continuing.',
      };
    }

    passwordChanged = true;
    const rotatedToken = await createCustomerSessionForCompany(principal.userId, principal.company);
    if (!rotatedToken) {
      return {
        ok: false,
        code: 'rotation-failed',
        message: 'Your password was changed, but this browser must sign in again.',
        passwordChanged: true,
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      code: 'unavailable',
      message: passwordChanged
        ? 'Your password was changed, but this browser must sign in again.'
        : 'We could not change your password right now. Please try again shortly.',
      passwordChanged,
    };
  }
}
