'use server';

import { getContextCompany, getContextDb } from '@/lib/tenant';
import * as tenantSchema from '@/db/schema-tenant';
import { eq } from 'drizzle-orm';
import { hashPassword } from '@/lib/auth';
import { createCustomerSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { isValidEmail, isValidName, isValidPassword } from '@/lib/auth-validation';
import { getSafeReturnTo } from '../login/safe-return-to';
import { EMAIL_VERIFICATION_TTL_MS, issueAuthToken } from '@/lib/auth-tokens';
import { getRequestOrigin } from '@/lib/email/origin';
import { sendEmail } from '@/lib/email/send';
import { emailVerificationMessage, welcomeEmailMessage } from '@/lib/email/auth-templates';

export type RegisterField =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'terms';

export type RegisterActionState = {
  error?: string;
  field?: RegisterField;
};

async function ensureCustomerRole() {
  const db = await getContextDb();
  const existingRole = await db.query.tenantRoles.findFirst({
    where: eq(tenantSchema.tenantRoles.name, 'Customer'),
  });

  if (existingRole) return existingRole;

  const [createdRole] = await db.insert(tenantSchema.tenantRoles).values({
    name: 'Customer',
  }).returning();
  return createdRole;
}

export async function registerCustomer(
  _previousState: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const firstName = String(formData.get('firstName') || '').trim();
  const lastName = String(formData.get('lastName') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');
  const termsAccepted = formData.get('terms') === 'on';
  const returnTo = getSafeReturnTo(formData.get('returnTo'));

  if (!firstName) {
    return { error: 'missing-first-name', field: 'firstName' };
  }
  if (!isValidName(firstName)) {
    return { error: 'name-too-short', field: 'firstName' };
  }
  if (lastName && !isValidName(lastName)) {
    return { error: 'name-too-short', field: 'lastName' };
  }
  if (!email) {
    return { error: 'missing-email', field: 'email' };
  }
  if (!isValidEmail(email)) {
    return { error: 'invalid-email', field: 'email' };
  }
  if (!password) {
    return { error: 'missing-password', field: 'password' };
  }
  if (!isValidPassword(password)) {
    return { error: 'password-too-short', field: 'password' };
  }
  if (!confirmPassword) {
    return { error: 'missing-confirm-password', field: 'confirmPassword' };
  }
  if (password !== confirmPassword) {
    return { error: 'password-mismatch', field: 'confirmPassword' };
  }
  if (!termsAccepted) {
    return { error: 'terms-required', field: 'terms' };
  }

  let customerId: number;

  try {
    const db = await getContextDb();
    const company = await getContextCompany();

    if (company.status === 'Suspended') {
      return { error: 'account-suspended' };
    }

    const existingCustomer = await db.query.users.findFirst({
      where: eq(tenantSchema.users.email, email),
    });

    if (existingCustomer) {
      return { error: 'email-taken', field: 'email' };
    }

    const customerRole = await ensureCustomerRole();
    const hashedPassword = await hashPassword(password);
    const fullName = `${firstName}${lastName ? ` ${lastName}` : ''}`;

    const [customer] = await db.insert(tenantSchema.users).values({
      name: fullName,
      email,
      passwordHash: hashedPassword,
      tenantRoleId: customerRole.id,
      status: 'Active',
      // Explicit e-commerce account marker (migration 008): this row belongs
      // to the storefront, not to the ERP staff roster.
      userType: 'storefront',
    }).returning();

    customerId = customer.id;
  } catch (error) {
    console.error('[Customer Registration Error]', error);
    return { error: 'registration-unavailable' };
  }

  try {
    const sessionToken = await createCustomerSession(customerId);
    if (!sessionToken) {
      return { error: 'session-unavailable' };
    }
  } catch (error) {
    console.error('[Customer Session Error]', error);
    return { error: 'session-unavailable' };
  }

  // Welcome + confirmation emails fire after the session exists. Delivery
  // problems are logged but must never undo a successful registration.
  try {
    const verifyToken = await issueAuthToken(
      customerId,
      'email_verification',
      EMAIL_VERIFICATION_TTL_MS,
    );
    const [origin, company] = await Promise.all([
      getRequestOrigin(),
      getContextCompany().catch(() => null),
    ]);
    const storeName = company?.name?.trim() || 'the store';
    const recipientName = firstName.split(' ')[0] || firstName;
    const verifyUrl = `${origin}/home/verify-email?token=${verifyToken}`;

    await Promise.all([
      sendEmail({
        to: email,
        subject: `Welcome to ${storeName}!`,
        text: `Your customer account has been created. View your account at ${origin}/home/account. If you didn't create this account, you can ignore this email.`,
        react: welcomeEmailMessage({
          name: recipientName,
          email,
          accountUrl: `${origin}/home/account`,
        }),
      }),
      sendEmail({
        to: email,
        subject: 'Confirm your email address',
        text: `Confirm your email address by opening ${verifyUrl}. The link expires in 24 hours. If you didn't create an account with this address, ignore this email.`,
        react: emailVerificationMessage({ name: recipientName, verifyUrl }),
      }),
    ]);
  } catch (error) {
    console.error('[register] welcome/verification emails failed', error);
  }

  const successParams = new URLSearchParams({
    success: 'account-created',
    returnTo,
  });
  redirect(`/home/register?${successParams.toString()}`);
}
