import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, PackageSearch, ShieldCheck } from 'lucide-react';
import { requireAccountCustomer } from '@/lib/account/data';
import styles from '../account.module.css';

export const metadata: Metadata = {
  title: 'Orders',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AccountOrdersPage() {
  await requireAccountCustomer('/shop/account/orders');

  return (
    <div className={styles.pageStack}>
      <header className={styles.pageHeader}>
        <span className={styles.pageIcon} aria-hidden="true"><PackageSearch size={23} /></span>
        <div>
          <p className={styles.eyebrow}>Purchase history</p>
          <h2>Orders</h2>
          <p>Review purchases securely linked to this storefront account.</p>
        </div>
      </header>

      <section className={styles.featureCard} aria-labelledby="orders-link-title">
        <div className={styles.featureCardCopy}>
          <p className={styles.cardKicker}>Secure order account</p>
          <h3 id="orders-link-title">Open your orders</h3>
          <p>
            Only orders tied to your dedicated storefront purchaser account are shown. Legacy
            sales without trustworthy storefront ownership remain hidden.
          </p>
        </div>
        <Link href="/customer/orders" className={styles.primaryButton}>
          View customer orders <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>

      <div className={styles.infoNote} role="note">
        <ShieldCheck size={18} aria-hidden="true" />
        <p>
          This account page does not expose tenant-wide sales or infer ownership. The linked route
          performs its own session, tenant, and purchaser-ownership checks.
        </p>
      </div>
    </div>
  );
}
