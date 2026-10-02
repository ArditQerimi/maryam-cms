import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { requireAccountPrincipal } from '@/lib/account/data';
import { addressLines, getAccountAddresses } from '@/lib/account/addresses';
import { getT } from '@/lib/i18n/server';
import styles from '../account.module.css';

export const metadata: Metadata = {
  title: 'Addresses',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AccountAddressesPage() {
  await connection();
  const principal = await requireAccountPrincipal('/home/account/addresses');
  const t = await getT();
  const saved = await getAccountAddresses(principal);

  const columns = [
    {
      kind: 'billing',
      title: t('account.addresses.billing'),
      edit: t('account.addresses.editBilling'),
      lines: addressLines(saved.billing),
    },
    {
      kind: 'shipping',
      title: t('account.addresses.shipping'),
      edit: t('account.addresses.editShipping'),
      lines: addressLines(saved.shipping),
    },
  ];

  return (
    <div className={styles.pageStack}>
      <p className={styles.plainNote}>{t('account.addresses.intro')}</p>
      <div className={styles.addressColumns}>
        {columns.map((column) => (
          <section key={column.kind}>
            <h2 className={styles.addressTitle}>{column.title}</h2>
            <Link className={styles.addressEdit} href={`/home/account/edit-address/${column.kind}`}>
              {column.edit}
            </Link>
            {column.lines.length > 0 ? (
              <address className={styles.addressBox}>
                {column.lines.map((line, index) => (
                  <span key={`${index}-${line}`}>{line}</span>
                ))}
              </address>
            ) : (
              <p className={styles.mutedItalic}>{t('account.addresses.none')}</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
