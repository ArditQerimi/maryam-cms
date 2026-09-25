import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, DatabaseZap, MapPin, Store } from 'lucide-react';
import { requireAccountCustomer } from '@/lib/account/data';
import styles from '../account.module.css';

export const metadata: Metadata = {
  title: 'Addresses',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AccountAddressesPage() {
  await requireAccountCustomer('/shop/account/addresses');

  return (
    <div className={styles.pageStack}>
      <header className={styles.pageHeader}>
        <span className={styles.pageIcon} aria-hidden="true"><MapPin size={23} /></span>
        <div>
          <p className={styles.eyebrow}>Address book</p>
          <h2>Addresses</h2>
          <p>A clear view of what is—and is not—available for this account.</p>
        </div>
      </header>

      <section className={styles.emptyState} aria-labelledby="addresses-unavailable-title">
        <span className={styles.emptyIcon} aria-hidden="true"><DatabaseZap size={26} /></span>
        <div>
          <p className={styles.cardKicker}>Not connected yet</p>
          <h3 id="addresses-unavailable-title">No saved address data is available</h3>
          <p>
            The tenant user record does not provide an address source, and this increment does not
            add address persistence. No example or checkout address is displayed as if it belonged
            to you.
          </p>
        </div>
        <Link href="/shop" className={styles.secondaryButton}>
          Return to store <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>

      <div className={styles.infoNote} role="note">
        <Store size={18} aria-hidden="true" />
        <p>
          Checkout remains separate. Enabling saved addresses requires a company-bound address data
          model and authenticated address DAL before this page can offer create, edit, select, or
          delete actions.
        </p>
      </div>
    </div>
  );
}
