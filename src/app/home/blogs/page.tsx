import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Search } from 'lucide-react';
import BlogCard from './BlogCard';
import BlogFilters from './BlogFilters';
import BlogPagination from './BlogPagination';
import {
  getFilterOptions,
  getStorefrontBlogPosts,
  slugify,
  type BlogPost,
} from './blog-data';
import ShopPageHeader from '../components/ShopPageHeader';
import { getT } from '@/lib/i18n/server';
import styles from './blog.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Read the latest stories, recommendations, and ideas from the Elif bookstore.',
  alternates: {
    canonical: '/home/blogs',
  },
  openGraph: {
    type: 'website',
    title: 'Blog | Elif',
    description: 'Read the latest stories, recommendations, and ideas from the Elif bookstore.',
    url: '/home/blogs',
  },
};

const PAGE_SIZE = 6;

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function positivePage(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function matchesQuery(post: BlogPost, query: string): boolean {
  if (!query) return true;
  const searchable = [post.title, post.excerpt, post.content, post.category, post.authorName, ...post.tags]
    .join(' ')
    .toLocaleLowerCase();
  return searchable.includes(query.toLocaleLowerCase());
}

function postMatchesCategory(post: BlogPost, category: string): boolean {
  return !category || slugify(post.category) === category;
}

function postMatchesTag(post: BlogPost, tag: string): boolean {
  return !tag || post.tags.some((postTag) => slugify(postTag) === tag);
}

export default async function ShopBlogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const posts = await getStorefrontBlogPosts();
  const t = await getT();
  const query = firstParam(params.q ?? params.query ?? params.search).trim().slice(0, 120);
  const category = slugify(firstParam(params.category));
  const tag = slugify(firstParam(params.tag));
  const hasFilters = Boolean(query || category || tag);

  const categories = getFilterOptions(posts, 'category');
  const tags = getFilterOptions(posts, 'tag');
  const filteredPosts = posts.filter(
    (post) => matchesQuery(post, query) && postMatchesCategory(post, category) && postMatchesTag(post, tag),
  );

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const currentPage = Math.min(positivePage(firstParam(params.page)), totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagePosts = filteredPosts.slice(pageStart, pageStart + PAGE_SIZE);
  const resultStart = filteredPosts.length > 0 ? pageStart + 1 : 0;
  const resultEnd = Math.min(pageStart + PAGE_SIZE, filteredPosts.length);
  const resultLabel = t(
    filteredPosts.length === 1 ? 'blog.results.labelOne' : 'blog.results.labelOther',
  );

  return (
    <div className={styles.page}>
      <ShopPageHeader title={t('blog.title')} crumbs={[{ label: t('blog.title') }]} />

      <div className={`${styles.container} ${styles.blogLayout}`}>
        <BlogFilters
          query={query}
          category={category}
          tag={tag}
          categories={categories}
          tags={tags}
          recentPosts={posts.slice(0, 3)}
        />

        <section className={styles.results} aria-labelledby="blog-results-title">
          <div className={styles.resultsHeader}>
            <div>
              <p className={styles.resultsKicker}>
                {hasFilters ? t('blog.results.filteredKicker') : t('blog.results.defaultKicker')}
              </p>
              <h2 id="blog-results-title" className={styles.resultsTitle}>
                {hasFilters ? t('blog.results.filteredTitle') : t('blog.results.defaultTitle')}
              </h2>
            </div>
            <span className={styles.resultsCount} aria-live="polite">
              {resultStart > 0
                ? t('blog.results.showing', {
                    start: resultStart,
                    end: resultEnd,
                    total: filteredPosts.length,
                    label: resultLabel,
                  })
                : t('blog.results.none', { label: resultLabel })}
            </span>
          </div>

          {pagePosts.length > 0 ? (
            <div className={styles.cardGrid}>
              {pagePosts.map((post, index) => (
                <BlogCard key={post.slug} post={post} priority={index === 0} />
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon} aria-hidden="true">
                {hasFilters ? <Search size={22} strokeWidth={1.5} /> : <BookOpen size={22} strokeWidth={1.5} />}
              </span>
              <h3 className={styles.emptyTitle}>
                {hasFilters ? t('blog.empty.filteredTitle') : t('blog.empty.title')}
              </h3>
              <p className={styles.emptyText}>
                {hasFilters ? t('blog.empty.filteredText') : t('blog.empty.text')}
              </p>
              {hasFilters ? (
                <Link className={styles.emptyAction} href="/home/blogs">
                  {t('blog.empty.clear')} <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          )}

          <BlogPagination
            currentPage={currentPage}
            totalPages={totalPages}
            query={query}
            category={category}
            tag={tag}
          />
        </section>
      </div>
    </div>
  );
}
