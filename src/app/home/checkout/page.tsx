import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { MailCheck } from 'lucide-react';
import { getSession } from '@/lib/session';
import { hasShopperSessionAudience } from '@/lib/auth-validation';
import { getContextDb } from '@/lib/tenant';
import { users } from '@/db/schema-tenant';
import { getT } from '@/lib/i18n/server';
import { requiresVerifiedEmail } from '@/lib/storefront/email-verification';
import { resendVerificationEmail } from '../verify-email/actions';
import ShopPageHeader from '../components/ShopPageHeader';
import styles from './checkout.module.css';
import CheckoutPanel from './CheckoutPanel';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Review your storefront cart and prepare contact, delivery, and payment details.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ShopCheckoutPage() {
  // Visitors (guests) may browse and fill a cart, but orders are for
  // registered customers only — guests are sent to sign in and brought
  // straight back here after authenticating.
  const session = await getSession();
  if (!session || !hasShopperSessionAudience(session)) {
    redirect('/home/login?returnTo=/home/checkout');
  }

  // No order without a confirmed email address (the server enforces it too, see
  // checkout-handler): the customer is asked to confirm it first.
  if (requiresVerifiedEmail(session as unknown as Record<string, unknown>)) {
    const userId = Number(session.userId);
    if (Number.isSafeInteger(userId) && userId > 0) {
      const db = await getContextDb();
      const [account] = await db
        .select({ email: users.email, verifiedAt: users.emailVerifiedAt })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (account && !account.verifiedAt) {
        const t = await getT();
        return (
          <div className={styles.page}>
            <ShopPageHeader
              title={t('checkout.header.title')}
              crumbs={[{ label: t('checkout.crumb.checkout') }]}
            />
            <main className={styles.main}>
              <div className={styles.container}>
                <section className={styles.emptyState} aria-labelledby="verify-email-title">
                  <span className={styles.emptyIcon} aria-hidden="true">
                    <MailCheck size={28} strokeWidth={1.6} />
                  </span>
                  <p className={styles.emptyEyebrow}>{t('checkout.verify.eyebrow')}</p>
                  <h2 id="verify-email-title">{t('checkout.verify.title')}</h2>
                  <p>{t('checkout.verify.copy', { email: account.email })}</p>
                  <form action={resendVerificationEmail} className={styles.emptyActions}>
                    <input type="hidden" name="email" value={account.email} />
                    <button type="submit" className={styles.primaryLink}>
                      {t('checkout.verify.resend')}
                    </button>
                  </form>
                </section>
              </div>
            </main>
          </div>
        );
      }
    }
  }

  // CheckoutPanel (client) wires the submit adapter that runs the checkout
  // contract: capabilities → cart sync → quote re-check → POST /api/storefront/checkout.
  return <CheckoutPanel />;
}
