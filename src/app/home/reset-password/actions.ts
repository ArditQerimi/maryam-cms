'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getContextCompany, getContextDb } from '@/lib/tenant';
import { users } from '@/db/schema-tenant';
import { hashPassword } from '@/lib/auth';
import { isValidPassword } from '@/lib/auth-validation';
import { consumeAuthToken } from '@/lib/auth-tokens';
import { getRequestOrigin } from '@/lib/email/origin';
import { sendEmail } from '@/lib/email/send';
import { passwordChangedMessage } from '@/lib/email/auth-templates';

/**
 * Consumes the one-time reset token and stores the new password. Validation
 * happens before the token is touched, so a typo keeps the emailed link
 * usable. After a successful change the customer receives a security
 * notice; a notice failure never fails the reset itself.
 */
export async function resetPasswordWithToken(formData: FormData): Promise<void> {
  const token = String(formData.get('token') || '');
  const password = String(formData.get('password') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');
  const tokenQuery = `token=${encodeURIComponent(token)}`;

  if (!isValidPassword(password)) {
    redirect(`/home/reset-password?error=weak&${tokenQuery}`);
  }
  if (password !== confirmPassword) {
    redirect(`/home/reset-password?error=mismatch&${tokenQuery}`);
  }

  let userId: number | null = null;
  try {
    userId = await consumeAuthToken(token, 'password_reset');
  } catch (error) {
    console.error('[reset-password] token consume failed', error);
  }
  if (!userId) {
    redirect('/home/reset-password?error=invalid');
  }

  let updateFailed = false;
  try {
    const db = await getContextDb();
    const hashedPassword = await hashPassword(password);
    await db
      .update(users)
      .set({ passwordHash: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error('[reset-password] password update failed', error);
    updateFailed = true;
  }
  if (updateFailed) {
    redirect('/home/reset-password?error=failed');
  }

  // Security notice — informational only; the reset already succeeded.
  try {
    const db = await getContextDb();
    const [user] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user) {
      const [origin, company] = await Promise.all([
        getRequestOrigin(),
        getContextCompany().catch(() => null),
      ]);
      const storeName = company?.name?.trim() || 'the store';
      const recipientName = user.name.split(' ')[0] || user.name;

      await sendEmail({
        to: user.email,
        subject: storeName
          ? `Your password was changed — ${storeName}`
          : 'Your password was changed',
        text: `The password for ${user.email} was just changed. If this wasn't you, reset it right away at ${origin}/home/forgot-password.`,
        react: passwordChangedMessage({
          name: recipientName,
          email: user.email,
          forgotUrl: `${origin}/home/forgot-password`,
        }),
      });
    }
  } catch (error) {
    console.error('[reset-password] changed notice failed', error);
  }

  redirect('/home/login?notice=password-reset');
}
