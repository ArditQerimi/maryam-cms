import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAccountCustomer } from '@/lib/account/data';
import styles from './account.module.css';

export const metadata: Metadata = {
  title: 'Overview',
  robots: {
    index: false,
    follow: false,
  },
};

function getFirstName(name: string) {
  return name.trim().split(/\s+/u)[0] || name;
}

export default async function AccountOverviewPage() {
  const customer = await requireAccountCustomer('/home/account');
  const firstName = getFirstName(customer.name);

  return (
    <div className={styles.pageStack}>
      <div className={styles.dashboardNotice}>
        <p>
          Your account with Collethor is using a temporary password. We emailed you a link to change your password.
        </p>
      </div>

      <p className={styles.dashboardGreeting}>
        Hello {firstName}{' '}
        <span>(</span>
        <Link href="/home" className={styles.inlineLogoutLink}>Log out</Link>
        <span>)</span>
      </p>

      <p className={styles.dashboardCopy}>
        From your account dashboard you can view your recent orders, manage your shipping and billing addresses, and edit your password and account details.
      </p>
    </div>
  );
}
