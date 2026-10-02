/* Recent-post thumbnails can be tenant-hosted URLs. */
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import type { BlogFilterOption, BlogPost } from './blog-data';
import { formatBlogDate } from './blog-data';
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
  return search ? `/shop/blogs?${search}` : '/shop/blogs';
}

export default function BlogFilters({
  query,
  category,
  tag,
  categories,
  tags,
  recentPosts,
}: BlogFiltersProps) {
  const hasFilters = Boolean(query || category || tag);
  const popularTags = [...tags].sort((left, right) => right.count - left.count).slice(0, 10);

  return (
    <aside className={styles.blogSidebar} aria-label="Blog sidebar">
      <div className={styles.sidebarSearchSection}>
        <h2 className={styles.sidebarHeading}>Search</h2>
        <form className={styles.sidebarSearchForm} method="get" action="/shop/blogs" role="search">
          {category ? <input type="hidden" name="category" value={category} /> : null}
          {tag ? <input type="hidden" name="tag" value={tag} /> : null}
          <label className={styles.srOnly} htmlFor="blog-search">
            Search blog posts
          </label>
          <input
            id="blog-search"
            className={styles.sidebarSearchInput}
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search blog"
            autoComplete="off"
          />
          <button className={styles.sidebarSearchButton} type="submit" aria-label="Search blog">
            <Search size={17} strokeWidth={1.8} aria-hidden="true" />
            <span>Search</span>
          </button>
        </form>
        {hasFilters ? (
          <Link className={styles.sidebarClear} href="/shop/blogs">
            <X size={13} strokeWidth={1.8} aria-hidden="true" /> Clear filters
          </Link>
        ) : null}
      </div>

      <div className={styles.sidebarSections}>
        <nav className={styles.sidebarSection} aria-labelledby="blog-categories-heading">
          <h2 id="blog-categories-heading" className={styles.sidebarHeading}>
            Categories
          </h2>
          {categories.length > 0 ? (
            <ul className={styles.sideList}>
              <li>
                <Link
                  className={`${styles.sideLink} ${!category ? styles.sideLinkActive : ''}`}
                  href={buildFilterHref({ query, category: '', tag })}
                  aria-current={!category ? 'page' : undefined}
                >
                  <span>All categories</span>
                </Link>
              </li>
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
                      <span className={styles.sideCount}>{option.count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.sidebarEmpty}>No categories yet.</p>
          )}
        </nav>

        <section className={styles.sidebarSection} aria-labelledby="recent-posts-heading">
          <h2 id="recent-posts-heading" className={styles.sidebarHeading}>
            Recent Posts
          </h2>
          {recentPosts.length > 0 ? (
            <ul className={styles.recentList}>
              {recentPosts.slice(0, 3).map((post) => (
                <li key={post.slug}>
                  <Link className={styles.recentLink} href={`/shop/blogs/${post.slug}`}>
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
            <p className={styles.sidebarEmpty}>No recent posts yet.</p>
          )}
        </section>

        <section className={styles.sidebarSection} aria-labelledby="popular-tags-heading">
          <h2 id="popular-tags-heading" className={styles.sidebarHeading}>
            Popular Tags
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
            <p className={styles.sidebarEmpty}>No topics yet.</p>
          )}
        </section>
      </div>
    </aside>
  );
}
