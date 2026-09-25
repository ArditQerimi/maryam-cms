import Link from 'next/link';
import { ArrowLeft, BookOpen } from 'lucide-react';
import styles from '../blog.module.css';

export default function BlogPostNotFound() {
  return (
    <div className={styles.page}>
      <header className={styles.pageBanner}>
        <div className={styles.container}>
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link href="/shop">Home</Link>
            <span className={styles.breadcrumbSeparator} aria-hidden="true">
              /
            </span>
            <Link href="/shop/blogs">Blog</Link>
          </nav>
          <h1 className={styles.pageTitle}>Blog</h1>
        </div>
      </header>
      <section className={styles.notFound} aria-labelledby="story-not-found-title">
        <div className={`${styles.container} ${styles.notFoundInner}`}>
          <span className={styles.notFoundIcon} aria-hidden="true">
            <BookOpen size={25} strokeWidth={1.4} />
          </span>
          <h2 id="story-not-found-title" className={styles.notFoundTitle}>
            This post could not be found.
          </h2>
          <p className={styles.notFoundText}>
            The address may be incomplete, or the post may have been moved. Return to the blog to browse the latest stories.
          </p>
          <Link className={styles.emptyAction} href="/shop/blogs">
            <ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" /> Return to the blog
          </Link>
        </div>
      </section>
    </div>
  );
}
