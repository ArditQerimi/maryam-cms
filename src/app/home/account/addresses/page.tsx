import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, DatabaseZap, MapPin, Store } from 'lucide-react';
import { requireAccountCustomer } from '@/lib/account/data';
import { getT } from '@/lib/i18n/server';
import styles from '../account.module.css';

export const metadata: Metadata = {
  title: 'Addresses',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AccountAddressesPage() {
  await requireAccountCustomer('/home/account/addresses');
  const t = await getT();

  return (
    <div className={styles.pageStack}>
      <header className={styles.pageHeader}>
        <span className={styles.pageIcon} aria-hidden="true"><MapPin size={23} /></span>
        <div>
          <p className={styles.eyebrow}>{t('account.addresses.eyebrow')}</p>
          <h2>{t('account.addresses.title')}</h2>
          <p>{t('account.addresses.lead')}</p>
        </div>
      </header>

      <section className={styles.emptyState} aria-labelledby="addresses-unavailable-title">
        <span className={styles.emptyIcon} aria-hidden="true"><DatabaseZap size={26} /></span>
        <div>
          <p className={styles.cardKicker}>{t('account.addresses.notConnected')}</p>
          <h3 id="addresses-unavailable-title">{t('account.addresses.emptyTitle')}</h3>
          <p>
            {t('account.addresses.emptyBody')}
          </p>
        </div>
        <Link href="/home" className={styles.secondaryButton}>
          {t('account.addresses.return')} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>

      <div className={styles.infoNote} role="note">
        <Store size={18} aria-hidden="true" />
        <p>
          {t('account.addresses.note')}
        </p>
      </div>
    </div>
  );
}
