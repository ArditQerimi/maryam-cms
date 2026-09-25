import type { Metadata } from 'next';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { requireAccountCustomer } from '@/lib/account/data';
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
  const customer = await requireAccountCustomer('/shop/account/security');

  return (
    <div className={styles.pageStack}>
      <header className={styles.pageHeader}>
        <span className={styles.pageIcon} aria-hidden="true"><ShieldCheck size={23} /></span>
        <div>
          <p className={styles.eyebrow}>Account protection</p>
          <h2>Security</h2>
          <p>Change your password and review the identity attached to this session.</p>
        </div>
      </header>

      <section className={styles.identityStrip} aria-label="Signed-in customer">
        <div className={styles.identityIcon} aria-hidden="true">
          {customer.name.trim().slice(0, 1).toLocaleUpperCase()}
        </div>
        <div>
          <span>Signed-in customer</span>
          <strong>{customer.name}</strong>
          <small>{customer.email}</small>
        </div>
        <span className={styles.activeBadge}>
          <span aria-hidden="true" /> Active session
        </span>
      </section>

      <SecurityForm />

      <aside className={styles.securityBanner} aria-label="Session rotation behavior">
        <KeyRound size={20} aria-hidden="true" />
        <div>
          <strong>Current-session rotation</strong>
          <p>
            A successful password change replaces the signed session cookie in this browser. The
            existing stateless session system cannot retroactively revoke a token already copied
            elsewhere.
          </p>
        </div>
      </aside>
    </div>
  );
}
