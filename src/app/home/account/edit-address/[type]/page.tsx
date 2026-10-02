import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { requireAccountPrincipal } from '@/lib/account/data';
import { getAccountAddresses } from '@/lib/account/addresses';
import { getT } from '@/lib/i18n/server';
import EditAddressForm from './EditAddressForm';
import styles from '../../account.module.css';

export const metadata: Metadata = {
  title: 'Edit address',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function EditAddressPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  await connection();
  const { type } = await params;
  if (type !== 'billing' && type !== 'shipping') notFound();

  const principal = await requireAccountPrincipal(`/home/account/edit-address/${type}`);
  const t = await getT();
  const saved = await getAccountAddresses(principal);
  const initial = saved[type] ?? {};

  return (
    <div className={styles.pageStack}>
      <h2 className={styles.addressTitle}>
        {type === 'billing' ? t('account.addresses.billing') : t('account.addresses.shipping')}
      </h2>
      <EditAddressForm kind={type} initial={initial} />
    </div>
  );
}
