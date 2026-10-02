'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { authenticateLogin } from '@/lib/login-handler';
import { safeCmsReturnTo } from '@/lib/cms/session';

export type LoginFormState = {
  error: string | null;
};

const ERROR_LABELS: Record<string, string> = {
  'missing-fields': 'Email and password are required.',
  'invalid-email': 'That email address is not valid.',
  'password-too-short': 'Password must be at least 6 characters.',
  'account-suspended': 'This account is suspended.',
  'company-not-found': 'No store is configured for this host.',
  'tenant-domain-required': 'Store login is not available on this host.',
  'database-error': 'Could not reach the database. Try again.',
  'invalid-credentials': 'Incorrect email or password.',
  'wrong-audience':
    'This is a customer account and cannot open the admin panel. Sign in through the shop login instead.',
};

export async function cmsLogin(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const headerList = await headers();
  const host =
    headerList.get('x-forwarded-host') ||
    headerList.get('x-forwarded-server') ||
    headerList.get('host') ||
    undefined;

  const result = await authenticateLogin(formData, host);

  if (result.redirectTo.includes('error=')) {
    const code = new URL(result.redirectTo, 'http://localhost').searchParams.get('error');
    return { error: ERROR_LABELS[code || ''] || ERROR_LABELS['invalid-credentials'] };
  }

  redirect(safeCmsReturnTo(formData.get('returnTo')));
}

export async function cmsLogout() {
  const { clearSession } = await import('@/lib/session');
  await clearSession();
  redirect('/login');
}
