import type { Metadata } from 'next';
import Link from 'next/link';
import { logoutCustomer } from '@/lib/account/actions';
import { requireAccountCustomer } from '@/lib/account/data';
import { getT } from '@/lib/i18n/server';
import styles from './account.module.css';

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AccountDashboardPage() {
  const customer = await requireAccountCustomer('/home/account');
  const t = await getT();
  const name = customer.name.trim();

  return (
    <div className={styles.pageStack}>
      <div className={styles.dashboardGreeting}>
        {t('account.dashboard.hello')} <strong>{name}</strong> ({t('account.dashboard.notPrefix')}{' '}
        <strong>{name}</strong>?{' '}
        <form action={logoutCustomer} className={styles.inlineForm}>
          <button type="submit" className={styles.inlineLogoutLink}>
            {t('account.nav.logOut')}
          </button>
        </form>
        )
      </div>

      <p className={styles.dashboardCopy}>
        {t('account.dashboard.copy1')}{' '}
        <Link href="/home/account/orders">{t('account.dashboard.link1')}</Link>,{' '}
        {t('account.dashboard.copy2')}{' '}
        <Link href="/home/account/addresses">{t('account.dashboard.link2')}</Link>,{' '}
        {t('account.dashboard.copy3')}{' '}
        <Link href="/home/account/profile">{t('account.dashboard.link3')}</Link>.
      </p>
    </div>
  );
}
