import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getAccountAccess, getAccountLoginUrl } from '@/lib/account/data';
import { getSafeAccountReturnTo } from '@/lib/account/validation';
import { getT } from '@/lib/i18n/server';
import ShopPageHeader from '../components/ShopPageHeader';
import AccountNavigation from './AccountNavigation';
import styles from './account.module.css';

export const metadata: Metadata = {
  title: {
    default: 'My Account',
    template: '%s | My Account',
  },
  description: 'Manage your customer profile, security, orders, wishlist, and store account.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

async function getCurrentAccountReturnTo() {
  const headerList = await headers();
  const candidates = [
    headerList.get('x-next-url'),
    headerList.get('next-url'),
    headerList.get('x-invoke-path'),
    headerList.get('x-forwarded-uri'),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const direct = getSafeAccountReturnTo(candidate);
    if (direct !== '/home/account') return direct;
  }

  const referer = headerList.get('referer');
  if (referer) {
    try {
      return getSafeAccountReturnTo(new URL(referer).pathname);
    } catch {
      return '/home/account';
    }
  }

  return '/home/account';
}

export default async function CustomerAccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection();

  const access = await getAccountAccess();
  if (access.status === 'unauthenticated') {
    redirect(getAccountLoginUrl(await getCurrentAccountReturnTo()));
  }
  // Signed in, but not as this store's customer (e.g. a staff account): send
  // them to the customer sign-in instead of a bare 404.
  if (access.status === 'denied') {
    redirect(getAccountLoginUrl(await getCurrentAccountReturnTo()));
  }

  const t = await getT();

  return (
    <div className={styles.accountPage}>
      <ShopPageHeader
        title={t('account.layout.title')}
        crumbs={[{ label: t('account.layout.title') }]}
      />

      <div className={styles.shell}>
        <div className={styles.accountGrid}>
          <aside className={styles.sidebar}>
            <AccountNavigation />
          </aside>
          <section className={styles.accountContent} id="account-content" aria-label={t('account.layout.contentAria')}>
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}
