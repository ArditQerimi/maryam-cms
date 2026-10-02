import type { Metadata } from 'next';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { requireAccountCustomer } from '@/lib/account/data';
import { getT } from '@/lib/i18n/server';
import SecurityForm from './SecurityForm';
import styles from '../account.module.css';

export const metadata: Metadata = {
  title: 'Security',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AccountSecurityPage() {
  const customer = await requireAccountCustomer('/home/account/security');
  const t = await getT();

  return (
    <div className={styles.pageStack}>
      <header className={styles.pageHeader}>
        <span className={styles.pageIcon} aria-hidden="true"><ShieldCheck size={23} /></span>
        <div>
          <p className={styles.eyebrow}>{t('account.security.eyebrow')}</p>
          <h2>{t('account.security.title')}</h2>
          <p>{t('account.security.lead')}</p>
        </div>
      </header>

      <section className={styles.identityStrip} aria-label={t('account.security.identityAria')}>
        <div className={styles.identityIcon} aria-hidden="true">
          {customer.name.trim().slice(0, 1).toLocaleUpperCase()}
        </div>
        <div>
          <span>{t('account.security.identityLabel')}</span>
          <strong>{customer.name}</strong>
          <small>{customer.email}</small>
        </div>
        <span className={styles.activeBadge}>
          <span aria-hidden="true" /> {t('account.security.activeSession')}
        </span>
      </section>

      <SecurityForm />

      <aside className={styles.securityBanner} aria-label={t('account.security.bannerAria')}>
        <KeyRound size={20} aria-hidden="true" />
        <div>
          <strong>{t('account.security.bannerTitle')}</strong>
          <p>
            {t('account.security.bannerBody')}
          </p>
        </div>
      </aside>
    </div>
  );
}
