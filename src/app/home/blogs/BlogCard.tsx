/* CMS covers may be tenant-hosted URLs, so these responsive images intentionally do not depend on a shared remotePatterns list. */
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import type { BlogPost } from './blog-data';
import { formatBlogDate } from './blog-data';
import styles from './blog.module.css';

type BlogCardProps = {
  post: BlogPost;
  priority?: boolean;
};

export default function BlogCard({ post, priority = false }: BlogCardProps) {
  return (
    <article className={styles.card}>
      <Link href={`/shop/blogs/${post.slug}`} className={styles.cardLink} aria-label={`Read ${post.title}`}>
        <div className={styles.cardMedia}>
          {post.image ? (
            <img
              className={styles.cardImage}
              src={post.image}
              alt={post.title}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
            />
          ) : (
            <span className={styles.cardPlaceholder} aria-hidden="true">
              <BookOpen size={30} strokeWidth={1.3} />
            </span>
          )}
        </div>

        <div className={styles.cardBody}>
          <p className={styles.cardCategory}>{post.category}</p>
          <h3 className={styles.cardTitle}>{post.title}</h3>
          {post.excerpt ? <p className={styles.cardExcerpt}>{post.excerpt}</p> : null}
          <div className={styles.cardMeta}>
            <span>{post.authorName}</span>
            <span className={styles.metaDot} aria-hidden="true" />
            <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
          </div>
        </div>
      </Link>
    </article>
  );
}
