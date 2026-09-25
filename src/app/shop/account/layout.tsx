import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getAccountAccess, getAccountLoginUrl } from '@/lib/account/data';
import { getSafeAccountReturnTo } from '@/lib/account/validation';
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
    if (direct !== '/shop/account') return direct;
  }

  const referer = headerList.get('referer');
  if (referer) {
    try {
      return getSafeAccountReturnTo(new URL(referer).pathname);
    } catch {
      return '/shop/account';
    }
  }

  return '/shop/account';
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

  const storeName = access.company.name?.trim() || 'the store';

  return (
    <div className={styles.accountPage}>
      <header className={styles.accountMasthead}>
        <div className={styles.shell}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <ol>
              <li><Link href="/shop">Store</Link></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">Account</li>
            </ol>
          </nav>
          <div className={styles.mastheadCopy}>
            <p>Private customer area</p>
            <h1>My account</h1>
            <span>Account details and services for {storeName}.</span>
          </div>
        </div>
      </header>

      <div className={styles.shell}>
        <div className={styles.accountGrid}>
          <aside className={styles.sidebar}>
            <AccountNavigation storeName={storeName} />
          </aside>
          <section className={styles.accountContent} id="account-content" aria-label="Account page content">
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}
