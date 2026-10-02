'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getContextCompany, getContextDb } from '@/lib/tenant';
import { users } from '@/db/schema-tenant';
import { isValidEmail } from '@/lib/auth-validation';
import {
  EMAIL_VERIFICATION_TTL_MS,
  consumeAuthToken,
  issueAuthToken,
} from '@/lib/auth-tokens';
import { allowRequest } from '@/lib/in-memory-rate-limit';
import { getRequestOrigin } from '@/lib/email/origin';
import { sendEmail } from '@/lib/email/send';
import { emailVerificationMessage } from '@/lib/email/auth-templates';

/**
 * Consumes the one-time confirmation token and stamps users.email_verified_at.
 * Idempotent from the customer's point of view: re-opening an already-used
 * link simply reports the invalid state, and the page offers a resend.
 */
export async function verifyEmailAddress(formData: FormData): Promise<void> {
  const token = String(formData.get('token') || '');

  let userId: number | null = null;
  try {
    userId = await consumeAuthToken(token, 'email_verification');
  } catch (error) {
    console.error('[verify-email] token consume failed', error);
  }
  if (!userId) {
    redirect('/home/verify-email?error=invalid');
  }

  let updateFailed = false;
  try {
    const db = await getContextDb();
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error('[verify-email] update failed', error);
    updateFailed = true;
  }
  if (updateFailed) {
    redirect('/home/verify-email?error=failed');
  }

  redirect('/home/verify-email?verified=1');
}

/**
 * Sends a fresh confirmation link. The response is identical whether or not
 * the address exists (no account probing) and it is throttled per address.
 */
export async function resendVerificationEmail(formData: FormData): Promise<void> {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const sentPath = '/home/verify-email?sent=1';

  if (!isValidEmail(email) || !allowRequest(`verify-resend:${email}`, 3, 60 * 60 * 1000)) {
    redirect(sentPath);
  }

  try {
    const db = await getContextDb();
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        status: users.status,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user && user.status === 'Active' && !user.emailVerifiedAt) {
      const token = await issueAuthToken(user.id, 'email_verification', EMAIL_VERIFICATION_TTL_MS);
      const [origin, company] = await Promise.all([
        getRequestOrigin(),
        getContextCompany().catch(() => null),
      ]);
      const storeName = company?.name?.trim() || 'the store';
      const recipientName = user.name.split(' ')[0] || user.name;
      const verifyUrl = `${origin}/home/verify-email?token=${token}`;

      await sendEmail({
        to: email,
        subject: storeName
          ? `Confirm your email address — ${storeName}`
          : 'Confirm your email address',
        text: `Confirm your email address by opening ${verifyUrl}. The link expires in 24 hours. If you didn't create an account with this address, ignore this email.`,
        react: emailVerificationMessage({ name: recipientName, verifyUrl }),
      });
    }
  } catch (error) {
    console.error('[verify-email] resend failed', error);
  }

  redirect(sentPath);
}
