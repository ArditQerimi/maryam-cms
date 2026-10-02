/* CMS covers may be tenant-hosted URLs, so these responsive images intentionally do not depend on a shared remotePatterns list. */
/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Clock3, MessageCircle, UserRound } from 'lucide-react';
import { notFound } from 'next/navigation';
import ArticleContent from '../ArticleContent';
import BlogFilters from '../BlogFilters';
import { formatBlogDate, getFilterOptions, getStorefrontBlogPost, getStorefrontBlogPosts, slugify } from '../blog-data';
import styles from '../blog.module.css';

export const dynamic = 'force-dynamic';

type BlogPostParams = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: BlogPostParams): Promise<Metadata> {
  const { slug } = await params;
  const post = await getStorefrontBlogPost(slug);

  if (!post) {
    return {
      title: 'Post not found',
      description: 'The requested blog post could not be found.',
    };
  }

  return {
    title: post.title,
    description: post.excerpt,
    authors: [{ name: post.authorName }],
    alternates: {
      canonical: `/shop/blogs/${post.slug}`,
    },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      url: `/shop/blogs/${post.slug}`,
      publishedTime: post.publishedAt,
      authors: [post.authorName],
      images: post.image ? [{ url: post.image, alt: post.title }] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostParams) {
  const { slug } = await params;
  const posts = await getStorefrontBlogPosts();
  const post = posts.find((candidate) => candidate.slug === slug);
  if (!post) notFound();

  const postIndex = posts.findIndex((candidate) => candidate.slug === post.slug);
  const previousPost = postIndex >= 0 ? posts[postIndex + 1] : undefined;
  const nextPost = postIndex > 0 ? posts[postIndex - 1] : undefined;
  const categories = getFilterOptions(posts, 'category');
  const tags = getFilterOptions(posts, 'tag');
  const recentPosts = posts.filter((candidate) => candidate.slug !== post.slug).slice(0, 3);

  return (
    <div className={`${styles.page} ${styles.articlePage}`}>
      <header className={`${styles.pageBanner} ${styles.articleBanner}`}>
        <div className={styles.container}>
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link href="/shop">Home</Link>
            <span className={styles.breadcrumbSeparator} aria-hidden="true">
              /
            </span>
            <Link href="/shop/blogs">Blog</Link>
            <span className={styles.breadcrumbSeparator} aria-hidden="true">
              /
            </span>
            <span className={styles.breadcrumbCurrent}>{post.title}</span>
          </nav>

          <Link
            className={styles.articleCategory}
            href={`/shop/blogs?category=${encodeURIComponent(slugify(post.category))}`}
          >
            {post.category}
          </Link>
          <h1 className={styles.articleTitle}>{post.title}</h1>
          <div className={styles.articleMeta} aria-label="Article information">
            <span className={styles.metaItem}>
              <UserRound size={15} strokeWidth={1.7} aria-hidden="true" />
              {post.authorName}
            </span>
            <span className={styles.metaDivider} aria-hidden="true" />
            <time className={styles.metaItem} dateTime={post.publishedAt}>
              <CalendarDays size={15} strokeWidth={1.7} aria-hidden="true" />
              {formatBlogDate(post.publishedAt)}
            </time>
            <span className={styles.metaDivider} aria-hidden="true" />
            <span className={styles.metaItem}>
              <Clock3 size={15} strokeWidth={1.7} aria-hidden="true" />
              {post.readingMinutes} min read
            </span>
          </div>
        </div>
      </header>

      <div className={`${styles.container} ${styles.blogLayout} ${styles.detailLayout}`}>
        <BlogFilters
          query=""
          category=""
          tag=""
          categories={categories}
          tags={tags}
          recentPosts={recentPosts}
        />

        <article className={styles.detailContent}>
          <figure className={styles.leadFigure}>
            {post.image ? (
              <img className={styles.leadImage} src={post.image} alt={post.title} decoding="async" />
            ) : (
              <span className={styles.leadPlaceholder} aria-hidden="true">
                <BookOpen size={34} strokeWidth={1.3} />
              </span>
            )}
          </figure>

          <ArticleContent content={post.content} fallbackQuote={post.excerpt} />

          <div className={styles.articleTags}>
            <span className={styles.articleTagsLabel}>Tags</span>
            <div className={styles.tagList}>
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  className={styles.tag}
                  href={`/shop/blogs?tag=${encodeURIComponent(slugify(tag))}`}
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>

          {previousPost || nextPost ? (
            <nav className={styles.postNavigation} aria-label="Post navigation">
              {previousPost ? (
                <Link className={`${styles.postNavLink} ${styles.postNavPrevious}`} href={`/shop/blogs/${previousPost.slug}`}>
                  <ArrowLeft size={16} strokeWidth={1.7} aria-hidden="true" />
                  <span>
                    <small>Previous post</small>
                    <strong>{previousPost.title}</strong>
                  </span>
                </Link>
              ) : <span />}
              {nextPost ? (
                <Link className={`${styles.postNavLink} ${styles.postNavNext}`} href={`/shop/blogs/${nextPost.slug}`}>
                  <span>
                    <small>Next post</small>
                    <strong>{nextPost.title}</strong>
                  </span>
                  <ArrowRight size={16} strokeWidth={1.7} aria-hidden="true" />
                </Link>
              ) : <span />}
            </nav>
          ) : null}

          <section className={styles.commentsSection} aria-labelledby="reply-title">
            <div className={styles.commentsHeadingRow}>
              <MessageCircle size={20} strokeWidth={1.6} aria-hidden="true" />
              <h2 id="reply-title" className={styles.commentsTitle}>
                Leave a reply
              </h2>
              <span className={styles.commentsStatus}>Unavailable</span>
            </div>
            <p className={styles.commentsNotice} role="status">
              Comments are not available yet. A moderated commenting connection is required before replies can be submitted or published.
            </p>
          </section>

          <Link className={styles.backToBlog} href="/shop/blogs">
            <ArrowLeft size={15} strokeWidth={1.7} aria-hidden="true" /> Back to all posts
          </Link>
        </article>
      </div>
    </div>
  );
}
