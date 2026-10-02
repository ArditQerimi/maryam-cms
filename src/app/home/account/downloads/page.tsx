import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAccountCustomer } from '@/lib/account/data';
import { getT } from '@/lib/i18n/server';
import styles from '../account.module.css';

export const metadata: Metadata = {
  title: 'Downloads',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AccountDownloadsPage() {
  await requireAccountCustomer('/home/account/downloads');
  const t = await getT();

  return (
    <div className={styles.pageStack}>
      <div className={styles.accountNotice}>
        <p>{t('account.downloads.empty')}</p>
        <Link className={styles.noticeButton} href="/home/products">
          {t('account.orders.browse')}
        </Link>
      </div>
    </div>
  );
}
