import type { Metadata } from 'next';
import { requireAccountCustomer } from '@/lib/account/data';
import ProfileForm from './ProfileForm';
import styles from '../account.module.css';

export const metadata: Metadata = {
  title: 'Account details',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AccountProfilePage() {
  const customer = await requireAccountCustomer('/home/account/profile');

  return (
    <div className={styles.pageStack}>
      <ProfileForm
        initialName={customer.name}
        initialPhone={customer.phone}
        initialEmail={customer.email}
      />
    </div>
  );
}
