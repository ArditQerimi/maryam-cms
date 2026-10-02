'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import styles from './account.module.css';

export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep the customer-facing boundary fail-closed without logging form data.
    void error;
  }, [error]);

  return (
    <section className={styles.errorState} role="alert" aria-labelledby="account-error-title">
      <span className={styles.errorIcon} aria-hidden="true"><AlertTriangle size={27} /></span>
      <p className={styles.eyebrow}>Account unavailable</p>
      <h2 id="account-error-title">We could not load this account page.</h2>
      <p>
        No account details were changed. Check the page again, or return to the store if the
        problem continues.
      </p>
      <button type="button" className={styles.primaryButton} onClick={reset}>
        <RotateCcw size={17} aria-hidden="true" />
        Try again
      </button>
    </section>
  );
}
