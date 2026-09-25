'use server';

import { masterDb } from '@/db/master';
import { createSession, clearSession, getSession } from './session';
import { redirect } from 'next/navigation';
import { isValidName } from './auth-validation';
import { authenticateLogin } from './login-handler';
import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import * as masterSchema from '@/db/schema-master';
import { isValidEmail, isValidPassword, normalizeReturnTo } from './auth-validation';
import { headers } from 'next/headers';

export async function hashPassword(password: string) {
  return hash(password, 10);
}

export async function login(formData: FormData) {
  const headerList = await headers();
  const rawHost = headerList.get('host') || '';
  const forwarded = headerList.get('x-forwarded-host') || headerList.get('x-forwarded-server') || '';
  const requestHost = forwarded || rawHost;
  const result = await authenticateLogin(formData, requestHost || undefined);
  redirect(result.redirectTo);
}

export async function logout() {
  const session = await getSession().catch(() => null);
  await clearSession();
  if (session?.platformRole === 'customer') {
    redirect('/shop/login');
  }
  redirect('/login');
}

export async function registerAdmin(formData: FormData) {
  const password = formData.get('password') as string;
  const email = (formData.get('email') as string || 'admin@dreamspos.com').trim().toLowerCase();
  const name = formData.get('name') as string || 'Platform Admin';
  const returnTo = normalizeReturnTo(formData.get('returnTo'), '/login');

  if (!isValidName(name)) {
    redirect(`${returnTo}?error=name-too-short`);
  }

  if (!isValidEmail(email)) {
    redirect(`${returnTo}?error=invalid-email`);
  }

  if (!isValidPassword(password)) {
    redirect(`${returnTo}?error=password-too-short`);
  }

  // 1. Check if platform user already exists in Master DB
  const adminExists = await masterDb.query.platformUsers.findFirst({
    where: eq(masterSchema.platformUsers.email, email)
  });
  if (adminExists) redirect(`${returnTo}?error=email-taken`);

  const hashedPassword = await hashPassword(password);
  
  // 2. Insert into platform_users (Master DB)
  const result = await masterDb.insert(masterSchema.platformUsers).values({
    name,
    email,
    passwordHash: hashedPassword,
    status: 'Active',
  }).returning();
  
  await createSession(result[0].id, true);
  redirect('/');
}
