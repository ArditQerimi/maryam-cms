'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import styles from './account.module.css';

export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    // Keep the customer-facing boundary fail-closed without logging form data.
    void error;
  }, [error]);

  return (
    <section className={styles.errorState} role="alert" aria-labelledby="account-error-title">
      <span className={styles.errorIcon} aria-hidden="true"><AlertTriangle size={27} /></span>
      <p className={styles.eyebrow}>{t('account.error.eyebrow')}</p>
      <h2 id="account-error-title">{t('account.error.title')}</h2>
      <p>
        {t('account.error.body')}
      </p>
      <button type="button" className={styles.primaryButton} onClick={reset}>
        <RotateCcw size={17} aria-hidden="true" />
        {t('account.error.retry')}
      </button>
    </section>
  );
}
