/* CMS covers may be tenant-hosted URLs, so these responsive images intentionally do not depend on a shared remotePatterns list. */
/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import { and, asc, eq } from 'drizzle-orm';
import { blogComments, users } from '@/db/schema-tenant';
import { getContextDb } from '@/lib/tenant';
import { getSession } from '@/lib/session';
import CommentForm from '../CommentForm';
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

/** Comments approved in the CMS (status Active), oldest first. */
async function loadApprovedComments(postId: string) {
  if (!/^\d+$/.test(postId)) return [];
  try {
    const db = await getContextDb();
    return await db
      .select({
        id: blogComments.id,
        commenterName: blogComments.commenterName,
        comment: blogComments.comment,
        createdAt: blogComments.createdAt,
      })
      .from(blogComments)
      .where(and(eq(blogComments.postId, Number(postId)), eq(blogComments.status, 'Active')))
      .orderBy(asc(blogComments.createdAt));
  } catch {
    return [];
  }
}

/** Name of the signed-in shopper (customer or staff), for "Logged in as …". */
async function loadViewerName(): Promise<string | null> {
  try {
    const session = await getSession();
    const userId = Number((session as Record<string, unknown> | null)?.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0) return null;
    const db = await getContextDb();
    const [user] = await db
      .select({ name: users.name })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.status, 'Active')))
      .limit(1);
    return user?.name || null;
  } catch {
    return null;
  }
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
  const recentPosts = posts.filter((candidate) => candidate.slug !== post.slug).slice(0, 5);
  const [comments, viewerName] = await Promise.all([
    loadApprovedComments(post.id),
    loadViewerName(),
  ]);

  return (
    <div className={`${styles.page} ${styles.articlePage}`}>
      <header className={`${styles.pageBanner} ${styles.articleBanner}`}>
        <div className={styles.container}>
          <Link
            className={styles.articleCategory}
            href={`/home/blogs?category=${encodeURIComponent(slugify(post.category))}`}
          >
            {post.category}
          </Link>
          <h1 className={styles.articleTitle}>{post.title}</h1>
          <div className={styles.articleMeta} aria-label={t('blog.article.metaAria')}>
            <span>{t('blog.card.by', { name: post.authorName })}</span>
            <span className={styles.metaDivider} aria-hidden="true" />
            <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
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

          {/* Quotes come only from the content itself (editor quote button). */}
          <ArticleContent content={post.content} />

          <div className={styles.articleTags}>
            <span className={styles.srOnly}>{t('blog.article.tags')}</span>
            <div className={styles.tagList}>
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  className={styles.tag}
                  href={`/home/blogs?tag=${encodeURIComponent(slugify(tag))}`}
                >
                  #{tag.toLocaleLowerCase()}
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

          {comments.length > 0 ? (
            <section className={styles.commentList} aria-labelledby="comments-title">
              <h2 id="comments-title" className={styles.replyTitle}>
                {t('blog.reply.count', { count: comments.length })}
              </h2>
              <ol>
                {comments.map((comment) => (
                  <li key={comment.id}>
                    <p className={styles.commentAuthor}>
                      <strong>{comment.commenterName}</strong>
                      <time dateTime={comment.createdAt.toISOString()}>
                        {formatBlogDate(comment.createdAt.toISOString())}
                      </time>
                    </p>
                    <p className={styles.commentText}>{comment.comment}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className={styles.commentsSection} aria-labelledby="reply-title">
            <h2 id="reply-title" className={styles.replyTitle}>
              {t('blog.article.replyTitle')}
            </h2>
            {/^\d+$/.test(post.id) ? (
              <CommentForm postSlug={post.slug} viewerName={viewerName} />
            ) : (
              <p className={styles.commentsNotice} role="status">
                {t('blog.article.commentsNotice')}
              </p>
            )}
          </section>
        </article>
      </div>
    </div>
  );
}
