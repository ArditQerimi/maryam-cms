import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import styles from '../home.module.css';

export default async function ShopFaqsPage() {
  const t = await getT();

  return (
    <div className={styles.shopPageWrap}>
      <div className={styles.container}>
        <nav className={styles.shopPageBreadcrumb} aria-label={t('pages.faqs.breadcrumbAria')}>
          <Link href="/home">{t('pages.common.home')}</Link>
          <span>/</span>
          <span>{t('pages.faqs.title')}</span>
        </nav>

        <section className={styles.wishlistEmptyState}>
          <h2>{t('pages.faqs.title')}</h2>
          <p>{t('pages.faqs.lead')}</p>
        </section>
      </div>
    </div>
  );
}
