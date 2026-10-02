import Link from 'next/link';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { getT } from '@/lib/i18n/server';
import styles from '../blog.module.css';

export default async function BlogPostNotFound() {
  const t = await getT();

  return (
    <div className={styles.page}>
      <header className={styles.pageBanner}>
        <div className={styles.container}>
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link href="/home">{t('blog.crumb.home')}</Link>
            <span className={styles.breadcrumbSeparator} aria-hidden="true">
              /
            </span>
            <Link href="/home/blogs">{t('blog.title')}</Link>
          </nav>
          <h1 className={styles.pageTitle}>{t('blog.title')}</h1>
        </div>
      </header>
      <section className={styles.notFound} aria-labelledby="story-not-found-title">
        <div className={`${styles.container} ${styles.notFoundInner}`}>
          <span className={styles.notFoundIcon} aria-hidden="true">
            <BookOpen size={25} strokeWidth={1.4} />
          </span>
          <h2 id="story-not-found-title" className={styles.notFoundTitle}>
            {t('blog.notFound.title')}
          </h2>
          <p className={styles.notFoundText}>
            {t('blog.notFound.body')}
          </p>
          <Link className={styles.emptyAction} href="/home/blogs">
            <ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" /> {t('blog.notFound.return')}
          </Link>
        </div>
      </section>
    </div>
  );
}
