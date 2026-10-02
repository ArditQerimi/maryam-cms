import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getAccountAccess, getAccountLoginUrl } from '@/lib/account/data';
import { getSafeAccountReturnTo } from '@/lib/account/validation';
import { getT } from '@/lib/i18n/server';
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
  if (access.status === 'denied') notFound();

  const t = await getT();
  const storeName = access.company.name?.trim() || t('account.layout.storeFallback');

  return (
    <div className={styles.accountPage}>
      <header className={styles.accountMasthead}>
        <div className={styles.shell}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <ol>
              <li><Link href="/home">{t('account.layout.crumbStore')}</Link></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">{t('account.layout.crumbAccount')}</li>
            </ol>
          </nav>
          <div className={styles.mastheadCopy}>
            <p>{t('account.layout.eyebrow')}</p>
            <h1>{t('account.layout.title')}</h1>
            <span>{t('account.layout.subtitle', { storeName })}</span>
          </div>
        </div>
      </header>

      <div className={styles.shell}>
        <div className={styles.accountGrid}>
          <aside className={styles.sidebar}>
            <AccountNavigation storeName={storeName} />
          </aside>
          <section className={styles.accountContent} id="account-content" aria-label={t('account.layout.contentAria')}>
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}
