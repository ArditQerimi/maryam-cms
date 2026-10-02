'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getContextCompany, getContextDb } from '@/lib/tenant';
import { users } from '@/db/schema-tenant';
import { isValidEmail } from '@/lib/auth-validation';
import { issueAuthToken, PASSWORD_RESET_TTL_MS } from '@/lib/auth-tokens';
import { allowRequest } from '@/lib/in-memory-rate-limit';
import { getRequestOrigin } from '@/lib/email/origin';
import { sendEmail } from '@/lib/email/send';
import { passwordResetMessage } from '@/lib/email/auth-templates';

const SENT_PATH = '/home/forgot-password?sent=1';

/**
 * Requests a password reset link. The outcome and response are deliberately
 * identical for every address (existing or not) so the form cannot be used
 * to probe which emails hold accounts here. Throttled per address.
 */
export async function requestPasswordReset(formData: FormData): Promise<void> {
  const email = String(formData.get('email') || '').trim().toLowerCase();

  if (!isValidEmail(email) || !allowRequest(`password-reset:${email}`, 3, 60 * 60 * 1000)) {
    redirect(SENT_PATH);
  }

  try {
    const db = await getContextDb();
    const [user] = await db
      .select({ id: users.id, name: users.name, status: users.status })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user && user.status === 'Active') {
      const token = await issueAuthToken(user.id, 'password_reset', PASSWORD_RESET_TTL_MS);
      const [origin, company] = await Promise.all([
        getRequestOrigin(),
        getContextCompany().catch(() => null),
      ]);
      const storeName = company?.name?.trim() || 'the store';
      const recipientName = user.name.split(' ')[0] || user.name;
      const resetUrl = `${origin}/home/reset-password?token=${token}`;

      await sendEmail({
        to: email,
        subject: storeName ? `Reset your password — ${storeName}` : 'Reset your password',
        text: `We received a request to reset your password. Open ${resetUrl} to choose a new one. The link expires in 1 hour. If you didn't request this, ignore this email.`,
        react: passwordResetMessage({ name: recipientName, email, resetUrl }),
      });
    }
  } catch (error) {
    console.error('[forgot-password] reset email failed', error);
  }

  redirect(SENT_PATH);
}
