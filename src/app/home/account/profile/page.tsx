import type { Metadata } from 'next';
import { Info, LockKeyhole, UserRound } from 'lucide-react';
import { requireAccountCustomer } from '@/lib/account/data';
import ProfileForm from './ProfileForm';
import styles from '../account.module.css';

export const metadata: Metadata = {
  title: 'Profile',
  robots: {
    index: false,
    follow: false,
  },
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export default async function AccountProfilePage() {
  const customer = await requireAccountCustomer('/shop/account/profile');

  return (
    <div className={styles.pageStack}>
      <header className={styles.pageHeader}>
        <span className={styles.pageIcon} aria-hidden="true"><UserRound size={23} /></span>
        <div>
          <p className={styles.eyebrow}>Personal information</p>
          <h2>Your profile</h2>
          <p>Keep the contact details associated with this store account current.</p>
        </div>
      </header>

      <section className={styles.card} aria-labelledby="profile-details-title">
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.cardKicker}>Read-only account data</p>
            <h3 id="profile-details-title">Profile details</h3>
          </div>
          <LockKeyhole size={20} aria-hidden="true" />
        </div>

        <dl className={styles.profileSummary}>
          <div>
            <dt>Sign-in email</dt>
            <dd>{customer.email}</dd>
          </div>
          <div>
            <dt>Member since</dt>
            <dd>{formatDate(customer.memberSince)}</dd>
          </div>
        </dl>

        <div className={styles.infoNote} role="note">
          <Info size={18} aria-hidden="true" />
          <p>
            This sign-in flow has no verified-email token or verified-email field. The address is
            shown as your sign-in email and cannot be changed here.
          </p>
        </div>
      </section>

      <ProfileForm
        initialName={customer.name}
        initialPhone={customer.phone}
      />
    </div>
  );
}
