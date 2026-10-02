/* CMS covers may be tenant-hosted URLs, so these responsive images intentionally do not depend on a shared remotePatterns list. */
/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Clock3, MessageCircle, UserRound } from 'lucide-react';
import { notFound } from 'next/navigation';
import ArticleContent from '../ArticleContent';
import BlogFilters from '../BlogFilters';
import { formatBlogDate, getFilterOptions, getStorefrontBlogPost, getStorefrontBlogPosts, slugify } from '../blog-data';
import { getT } from '@/lib/i18n/server';
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
      canonical: `/home/blogs/${post.slug}`,
    },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      url: `/home/blogs/${post.slug}`,
      publishedTime: post.publishedAt,
      authors: [post.authorName],
      images: post.image ? [{ url: post.image, alt: post.title }] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostParams) {
  const { slug } = await params;
  const posts = await getStorefrontBlogPosts();
  const t = await getT();
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
            <Link href="/home">{t('blog.crumb.home')}</Link>
            <span className={styles.breadcrumbSeparator} aria-hidden="true">
              /
            </span>
            <Link href="/home/blogs">{t('blog.title')}</Link>
            <span className={styles.breadcrumbSeparator} aria-hidden="true">
              /
            </span>
            <span className={styles.breadcrumbCurrent}>{post.title}</span>
          </nav>

          <Link
            className={styles.articleCategory}
            href={`/home/blogs?category=${encodeURIComponent(slugify(post.category))}`}
          >
            {post.category}
          </Link>
          <h1 className={styles.articleTitle}>{post.title}</h1>
          <div className={styles.articleMeta} aria-label={t('blog.article.metaAria')}>
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
              {t('blog.article.minRead', { count: post.readingMinutes })}
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
            <span className={styles.articleTagsLabel}>{t('blog.article.tags')}</span>
            <div className={styles.tagList}>
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  className={styles.tag}
                  href={`/home/blogs?tag=${encodeURIComponent(slugify(tag))}`}
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>

          {previousPost || nextPost ? (
            <nav className={styles.postNavigation} aria-label={t('blog.article.navAria')}>
              {previousPost ? (
                <Link className={`${styles.postNavLink} ${styles.postNavPrevious}`} href={`/home/blogs/${previousPost.slug}`}>
                  <ArrowLeft size={16} strokeWidth={1.7} aria-hidden="true" />
                  <span>
                    <small>{t('blog.article.previous')}</small>
                    <strong>{previousPost.title}</strong>
                  </span>
                </Link>
              ) : <span />}
              {nextPost ? (
                <Link className={`${styles.postNavLink} ${styles.postNavNext}`} href={`/home/blogs/${nextPost.slug}`}>
                  <span>
                    <small>{t('blog.article.next')}</small>
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
                {t('blog.article.replyTitle')}
              </h2>
              <span className={styles.commentsStatus}>{t('blog.article.commentsUnavailable')}</span>
            </div>
            <p className={styles.commentsNotice} role="status">
              {t('blog.article.commentsNotice')}
            </p>
          </section>

          <Link className={styles.backToBlog} href="/home/blogs">
            <ArrowLeft size={15} strokeWidth={1.7} aria-hidden="true" /> {t('blog.article.back')}
          </Link>
        </article>
      </div>
    </div>
  );
}
