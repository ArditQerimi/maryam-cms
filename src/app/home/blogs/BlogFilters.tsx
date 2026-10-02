/* Recent-post thumbnails can be tenant-hosted URLs. */
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import type { BlogFilterOption, BlogPost } from './blog-data';
import { formatBlogDate } from './blog-data';
import { getT } from '@/lib/i18n/server';
import styles from './blog.module.css';

type BlogFiltersProps = {
  query: string;
  category: string;
  tag: string;
  categories: BlogFilterOption[];
  tags: BlogFilterOption[];
  recentPosts: BlogPost[];
};

function buildFilterHref({
  query,
  category,
  tag,
}: {
  query: string;
  category: string;
  tag: string;
}) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (category) params.set('category', category);
  if (tag) params.set('tag', tag);
  const search = params.toString();
  return search ? `/home/blogs?${search}` : '/home/blogs';
}

export default async function BlogFilters({
  query,
  category,
  tag,
  categories,
  tags,
  recentPosts,
}: BlogFiltersProps) {
  const t = await getT();
  const hasFilters = Boolean(query || category || tag);
  const popularTags = [...tags].sort((left, right) => right.count - left.count).slice(0, 10);

  return (
    <aside className={styles.blogSidebar} aria-label={t('blog.sidebar.aria')}>
      <div className={styles.sidebarSearchSection}>
        <h2 className={styles.srOnly}>{t('blog.sidebar.searchHeading')}</h2>
        <form className={styles.sidebarSearchForm} method="get" action="/home/blogs" role="search">
          {category ? <input type="hidden" name="category" value={category} /> : null}
          {tag ? <input type="hidden" name="tag" value={tag} /> : null}
          <label className={styles.srOnly} htmlFor="blog-search">
            {t('blog.sidebar.searchLabel')}
          </label>
          <input
            id="blog-search"
            className={styles.sidebarSearchInput}
            type="search"
            name="q"
            defaultValue={query}
            placeholder={t('blog.sidebar.searchPlaceholder')}
            autoComplete="off"
          />
          <button className={styles.sidebarSearchButton} type="submit" aria-label={t('blog.sidebar.searchButton')}>
            <Search size={17} strokeWidth={1.8} aria-hidden="true" />
            <span>{t('blog.sidebar.searchButton')}</span>
          </button>
        </form>
        {hasFilters ? (
          <Link className={styles.sidebarClear} href="/home/blogs">
            <X size={13} strokeWidth={1.8} aria-hidden="true" /> {t('blog.sidebar.clear')}
          </Link>
        ) : null}
      </div>

      <div className={styles.sidebarSections}>
        <nav className={styles.sidebarSection} aria-labelledby="blog-categories-heading">
          <h2 id="blog-categories-heading" className={styles.sidebarHeading}>
            {t('blog.categories.heading')}
          </h2>
          {categories.length > 0 ? (
            <ul className={styles.sideList}>
              {category ? (
                <li>
                  <Link className={styles.sideLink} href={buildFilterHref({ query, category: '', tag })}>
                    <span>{t('blog.categories.all')}</span>
                  </Link>
                </li>
              ) : null}
              {categories.map((option) => {
                const active = category === option.value;
                return (
                  <li key={option.value}>
                    <Link
                      className={`${styles.sideLink} ${active ? styles.sideLinkActive : ''}`}
                      href={buildFilterHref({ query, category: option.value, tag })}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span>{option.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.sidebarEmpty}>{t('blog.categories.empty')}</p>
          )}
        </nav>

        <section className={styles.sidebarSection} aria-labelledby="recent-posts-heading">
          <h2 id="recent-posts-heading" className={styles.sidebarHeading}>
            {t('blog.recent.heading')}
          </h2>
          {recentPosts.length > 0 ? (
            <ul className={styles.recentList}>
              {recentPosts.slice(0, 3).map((post) => (
                <li key={post.slug}>
                  <Link className={styles.recentLink} href={`/home/blogs/${post.slug}`}>
                    <span className={styles.recentThumb}>
                      {post.image ? (
                        <img src={post.image} alt="" loading="lazy" decoding="async" />
                      ) : null}
                    </span>
                    <span className={styles.recentCopy}>
                      <span className={styles.recentTitle}>{post.title}</span>
                      <time className={styles.recentDate} dateTime={post.publishedAt}>
                        {formatBlogDate(post.publishedAt)}
                      </time>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.sidebarEmpty}>{t('blog.recent.empty')}</p>
          )}
        </section>

        <section className={styles.sidebarSection} aria-labelledby="popular-tags-heading">
          <h2 id="popular-tags-heading" className={styles.sidebarHeading}>
            {t('blog.tags.heading')}
          </h2>
          {popularTags.length > 0 ? (
            <div className={styles.tagCloud}>
              {popularTags.map((option) => {
                const active = tag === option.value;
                return (
                  <Link
                    key={option.value}
                    className={`${styles.sidebarTag} ${active ? styles.sidebarTagActive : ''}`}
                    href={buildFilterHref({ query, category, tag: option.value })}
                    aria-current={active ? 'page' : undefined}
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className={styles.sidebarEmpty}>{t('blog.tags.empty')}</p>
          )}
        </section>
      </div>
    </aside>
  );
}
