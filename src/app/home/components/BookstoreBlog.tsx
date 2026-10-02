import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import styles from '../bookstore.module.css';
import { parseImageUrl } from '@/lib/image-url';
import { formatBlogDate, getStorefrontBlogPosts } from '../blogs/blog-data';

export default async function BookstoreBlog() {
  const t = await getT();
  const posts = (await getStorefrontBlogPosts()).slice(0, 3);
  if (posts.length === 0) return null;

  return (
    <section className={styles.blog}>
      <div className={styles.container}>
        <p className={styles.sectionEyebrow}>{t('home.eyebrow')}</p>
        <h2 className={styles.sectionTitle}>{t('home.blog.title')}</h2>

        <div className={styles.blogGrid}>
          {posts.map((post) => (
            <Link key={post.slug} href={`/home/blogs/${post.slug}`} className={styles.blogCard}>
              <div className={styles.blogMedia}>
                <img src={parseImageUrl(post.image)} alt={post.title} />
                <span className={styles.blogTag}>{post.category}</span>
              </div>
              <div className={styles.blogMeta}>{formatBlogDate(post.publishedAt)}</div>
              <h3 className={styles.blogTitle}>{post.title}</h3>
              <span className={styles.blogRead}>{t('home.blog.readMore')}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
