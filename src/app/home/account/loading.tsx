import { getT } from '@/lib/i18n/server';
import styles from './account.module.css';

export default async function AccountLoading() {
  const t = await getT();

  return (
    <div className={styles.pageStack} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.srOnly}>{t('account.loading.sr')}</span>
      <div className={styles.skeletonHero} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className={styles.skeletonCard} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className={styles.skeletonGrid} aria-hidden="true">
        <span />
        <span />
      </div>
    </div>
  );
}
