import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './blog.module.css';

type BlogPaginationProps = {
  currentPage: number;
  totalPages: number;
  query: string;
  category: string;
  tag: string;
};

function buildPageHref(page: number, query: string, category: string, tag: string): string {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (category) params.set('category', category);
  if (tag) params.set('tag', tag);
  if (page > 1) params.set('page', String(page));

  const search = params.toString();
  return search ? `/shop/blogs?${search}` : '/shop/blogs';
}

export default function BlogPagination({
  currentPage,
  totalPages,
  query,
  category,
  tag,
}: BlogPaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav className={styles.pagination} aria-label="Journal pagination">
      <div className={styles.paginationList}>
        {currentPage > 1 ? (
          <Link
            className={styles.paginationArrow}
            href={buildPageHref(currentPage - 1, query, category, tag)}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        ) : (
          <span className={`${styles.paginationArrow} ${styles.paginationDisabled}`} aria-hidden="true">
            <ChevronLeft size={16} strokeWidth={1.8} />
          </span>
        )}

        {pages.map((page) =>
          page === currentPage ? (
            <span key={page} className={`${styles.paginationItem} ${styles.paginationCurrent}`} aria-current="page">
              {page}
            </span>
          ) : (
            <Link
              key={page}
              className={styles.paginationItem}
              href={buildPageHref(page, query, category, tag)}
              aria-label={`Page ${page}`}
            >
              {page}
            </Link>
          ),
        )}

        {currentPage < totalPages ? (
          <Link
            className={styles.paginationArrow}
            href={buildPageHref(currentPage + 1, query, category, tag)}
            aria-label="Next page"
          >
            <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        ) : (
          <span className={`${styles.paginationArrow} ${styles.paginationDisabled}`} aria-hidden="true">
            <ChevronRight size={16} strokeWidth={1.8} />
          </span>
        )}
      </div>
    </nav>
  );
}
