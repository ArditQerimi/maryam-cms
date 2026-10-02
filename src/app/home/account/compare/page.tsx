'use client';

import Link from 'next/link';
import { useCompare } from '@/context/CompareContext';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import styles from '../account.module.css';

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(
    Number.isFinite(value) ? value : 0,
  );
}

/** The account-area view of the comparison list; the full side-by-side lives at /home/compare. */
export default function AccountComparePage() {
  const { compareItems, removeFromCompare, isHydrating } = useCompare();
  const { t } = useLocale();

  if (isHydrating) return <div className={styles.pageStack} aria-busy="true" />;

  if (compareItems.length === 0) {
    return (
      <div className={styles.pageStack}>
        <p className={styles.plainNote}>{t('account.compare.empty')}</p>
      </div>
    );
  }

  return (
    <div className={styles.pageStack}>
      <div className={styles.tableWrap}>
        <table className={styles.ordersTable}>
          <thead>
            <tr>
              <th scope="col">{t('account.compare.product')}</th>
              <th scope="col">{t('account.compare.price')}</th>
              <th scope="col">{t('account.orders.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {compareItems.map((item) => (
              <tr key={`${String(item.productId)}-${String(item.variantId)}`}>
                <td data-label={t('account.compare.product')}>
                  <Link href={`/home/products/${encodeURIComponent(String(item.productId))}`}>
                    {item.name}
                  </Link>
                </td>
                <td data-label={t('account.compare.price')}>{formatMoney(item.price)}</td>
                <td data-label={t('account.orders.colActions')}>
                  <button
                    type="button"
                    className={styles.noticeButton}
                    onClick={() =>
                      removeFromCompare({ productId: item.productId, variantId: item.variantId })
                    }
                  >
                    {t('account.compare.remove')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <Link className={styles.inlineTextLink} href="/home/compare">
          {t('account.compare.open')}
        </Link>
      </p>
    </div>
  );
}
