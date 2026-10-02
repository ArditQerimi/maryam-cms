import Link from 'next/link';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { getT } from '@/lib/i18n/server';
import styles from './account.module.css';

export default async function CustomerAccountNotFound() {
  const t = await getT();

  return (
    <section className={styles.errorState} aria-labelledby="account-not-found-title">
      <span className={styles.errorIcon} aria-hidden="true"><LockKeyhole size={27} /></span>
      <p className={styles.eyebrow}>{t('account.notFound.eyebrow')}</p>
      <h2 id="account-not-found-title">{t('account.notFound.title')}</h2>
      <p>
        {t('account.notFound.body')}
      </p>
      <Link href="/home" className={styles.secondaryButton}>
        <ArrowLeft size={16} aria-hidden="true" /> {t('account.notFound.return')}
      </Link>
    </section>
  );
}
