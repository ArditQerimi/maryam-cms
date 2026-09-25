import Link from 'next/link';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import styles from './account.module.css';

export default function CustomerAccountNotFound() {
  return (
    <section className={styles.errorState} aria-labelledby="account-not-found-title">
      <span className={styles.errorIcon} aria-hidden="true"><LockKeyhole size={27} /></span>
      <p className={styles.eyebrow}>Access unavailable</p>
      <h2 id="account-not-found-title">This customer account page is not available.</h2>
      <p>
        The request did not match an active customer session for this exact store, or the page does
        not exist.
      </p>
      <Link href="/shop" className={styles.secondaryButton}>
        <ArrowLeft size={16} aria-hidden="true" /> Return to store
      </Link>
    </section>
  );
}
