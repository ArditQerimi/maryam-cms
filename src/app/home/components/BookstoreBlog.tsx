import Link from 'next/link';
import styles from '../bookstore.module.css';
import { parseImageUrl } from '@/lib/image-url';
import { formatBlogDate, getStorefrontBlogPosts } from '../blogs/blog-data';

export default async function BookstoreBlog() {
  const posts = (await getStorefrontBlogPosts()).slice(0, 3);
  if (posts.length === 0) return null;

  return (
    <section className={styles.blog}>
      <div className={styles.container}>
        <p className={styles.sectionEyebrow}>Your Shopping Expo</p>
        <h2 className={styles.sectionTitle}>NGA BLOGU</h2>

        <div className={styles.blogGrid}>
          {posts.map((post) => (
            <Link key={post.slug} href={`/shop/blogs/${post.slug}`} className={styles.blogCard}>
              <div className={styles.blogMedia}>
                <img src={parseImageUrl(post.image)} alt={post.title} />
                <span className={styles.blogTag}>{post.category}</span>
              </div>
              <div className={styles.blogMeta}>{formatBlogDate(post.publishedAt)}</div>
              <h3 className={styles.blogTitle}>{post.title}</h3>
              <span className={styles.blogRead}>Lexo më shumë →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
