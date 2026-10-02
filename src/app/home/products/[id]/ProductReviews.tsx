'use client';

import Link from 'next/link';
import { BadgeCheck, SlidersHorizontal } from 'lucide-react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { Dictionary } from '@/lib/i18n/dictionaries/en';
import styles from './product-details.module.css';

export type ReviewRating = 1 | 2 | 3 | 4 | 5;
export type ReviewSort = 'newest' | 'oldest' | 'highest' | 'lowest';

export type ReviewDistributionRow = {
  rating: ReviewRating;
  count: number;
};

export type ProductReviewSummary = {
  approvedCount: number;
  averageRating: number | null;
  distribution: readonly ReviewDistributionRow[];
  verifiedPurchaseCount?: number;
};

export type ApprovedProductReview = {
  id: string | number;
  status: 'approved';
  authorName: string;
  body: string;
  rating: ReviewRating;
  createdAt: string;
  verifiedPurchase?: boolean;
  helpfulCount?: number;
};

export type ProductReviewPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type ProductReviewQuery = {
  page?: number;
  rating?: ReviewRating | null;
  verifiedOnly?: boolean;
  sort?: ReviewSort;
};

export type ProductReviewViewer = {
  isAuthenticated: boolean;
  displayName?: string | null;
  signInHref?: string;
  submission?: {
    status: 'pending' | 'approved' | 'rejected';
    message?: string | null;
  } | null;
};

export type ProductReviewFormContract = {
  endpoint?: string;
  enabled?: boolean;
  submitLabel?: string;
  unavailableMessage?: string;
};

export type ProductReviewsData = {
  summary?: ProductReviewSummary | null;
  reviews?: readonly ApprovedProductReview[];
  pagination?: ProductReviewPagination | null;
  query?: ProductReviewQuery;
  viewer?: ProductReviewViewer | null;
  form?: ProductReviewFormContract | null;
};

const REVIEW_RATINGS: readonly ReviewRating[] = [5, 4, 3, 2, 1];
const SORT_OPTIONS: ReadonlyArray<{ value: ReviewSort; labelKey: keyof Dictionary }> = [
  { value: 'newest', labelKey: 'catalog.sort_newest' },
  { value: 'oldest', labelKey: 'catalog.reviews_sort_oldest' },
  { value: 'highest', labelKey: 'catalog.reviews_sort_highest' },
  { value: 'lowest', labelKey: 'catalog.reviews_sort_lowest' },
];

function safeCount(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : 0;
}

function safeAverage(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 5) {
    return null;
  }
  return Math.round(value * 10) / 10;
}

function safeInternalHref(value: string | undefined, fallback: string): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : fallback;
}

function formatReviewDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function resolveApprovedCount(data: ProductReviewsData | undefined): number {
  if (!data) return 0;
  if (data.summary) return safeCount(data.summary.approvedCount);
  if (data.pagination) return safeCount(data.pagination.totalItems);
  return safeCount(data.reviews?.length);
}

function reviewHref(
  productId: number,
  query: ProductReviewQuery,
  page: number,
): string {
  const params = new URLSearchParams();
  params.set('tab', 'reviews');
  if (query.rating) params.set('reviewsRating', String(query.rating));
  if (query.verifiedOnly) params.set('reviewsVerified', '1');
  if (query.sort) params.set('reviewsSort', query.sort);
  if (page > 1) params.set('reviewsPage', String(page));

  const queryString = params.toString();
  return `/home/products/${productId}${queryString ? `?${queryString}` : ''}`;
}

export function ReviewSummary({
  data,
}: {
  data?: ProductReviewsData;
}) {
  const { t } = useLocale();
  const approvedCount = resolveApprovedCount(data);
  const summary = data?.summary;
  const average = safeAverage(summary?.averageRating);
  const distribution = (summary?.distribution ?? [])
    .filter((row) => REVIEW_RATINGS.includes(row.rating))
    .slice()
    .sort((left, right) => right.rating - left.rating);

  if (approvedCount === 0) {
    return (
      <div className={styles.reviewZeroState}>
        <span className={styles.reviewZeroLabel}>{t('catalog.reviews_zero_label')}</span>
        <h3>{t('catalog.reviews_zero_title')}</h3>
        <p>{t('catalog.reviews_zero_text')}</p>
      </div>
    );
  }

  return (
    <div className={styles.reviewSummary}>
      <div className={styles.reviewAverage}>
        <span className={styles.reviewAverageValue}>
          {average === null ? '—' : average.toFixed(1)}
        </span>
        <span className={styles.reviewAverageScale}>{t('catalog.reviews_out_of_5')}</span>
        <span className={styles.reviewApprovedCount}>
          {t(
            approvedCount === 1
              ? 'catalog.reviews_approved_one'
              : 'catalog.reviews_approved_other',
            { count: approvedCount },
          )}
        </span>
        {summary?.verifiedPurchaseCount != null ? (
          <span className={styles.reviewVerifiedSummary}>
            <BadgeCheck size={15} aria-hidden="true" />
            {t('catalog.reviews_verified_count', {
              count: safeCount(summary.verifiedPurchaseCount),
            })}
          </span>
        ) : null}
      </div>

      {distribution.length > 0 ? (
        <div className={styles.ratingDistribution} aria-label={t('catalog.reviews_distribution_aria')}>
          {distribution.map((row) => {
            const count = safeCount(row.count);
            const percentage = approvedCount > 0
              ? Math.min(100, (count / approvedCount) * 100)
              : 0;
            return (
              <div className={styles.distributionRow} key={row.rating}>
                <span>
                  {t(
                    row.rating === 1
                      ? 'catalog.reviews_points_one'
                      : 'catalog.reviews_points_other',
                    { rating: row.rating },
                  )}
                </span>
                <div
                  className={styles.distributionTrack}
                  role="progressbar"
                  aria-label={t('catalog.reviews_points_aria', { rating: row.rating })}
                  aria-valuemin={0}
                  aria-valuemax={approvedCount}
                  aria-valuenow={Math.min(count, approvedCount)}
                >
                  <span style={{ width: `${percentage}%` }} />
                </div>
                <span>{count}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className={styles.reviewDataNote}>{t('catalog.reviews_distribution_unavailable')}</p>
      )}
    </div>
  );
}

export function ReviewList({
  productId,
  data,
  approvedCount,
}: {
  productId: number;
  data?: ProductReviewsData;
  approvedCount: number;
}) {
  const { t } = useLocale();
  const reviews = data?.reviews ?? [];
  const query = data?.query ?? {};
  const hasFilters = Boolean(query.rating || query.verifiedOnly);

  if (reviews.length === 0) {
    return (
      <div className={styles.reviewListEmpty}>
        <h3>
          {approvedCount > 0 && hasFilters
            ? t('catalog.reviews_empty_filtered_title')
            : t('catalog.reviews_empty_title')}
        </h3>
        <p>
          {approvedCount > 0 && hasFilters
            ? t('catalog.reviews_empty_filtered_text')
            : t('catalog.reviews_empty_text')}
        </p>
        {approvedCount > 0 && hasFilters ? (
          <Link href={reviewHref(productId, {}, 1)}>{t('catalog.reviews_clear_filters')}</Link>
        ) : null}
      </div>
    );
  }

  return (
    <ol className={styles.reviewList}>
      {reviews.map((review) => {
        const date = formatReviewDate(review.createdAt);
        const helpfulCount = safeCount(review.helpfulCount);
        return (
          <li className={styles.reviewItem} key={review.id}>
            <article aria-labelledby={`review-author-${review.id}`}>
              <header className={styles.reviewItemHeader}>
                <div>
                  <h3 id={`review-author-${review.id}`}>{review.authorName.trim() || t('catalog.reviews_customer')}</h3>
                  {date ? <time dateTime={review.createdAt}>{date}</time> : null}
                </div>
                <div className={styles.reviewItemMeta}>
                  <span className={styles.reviewRatingValue}>{review.rating} / 5</span>
                  {review.verifiedPurchase ? (
                    <span className={styles.verifiedBadge}>
                      <BadgeCheck size={14} aria-hidden="true" />
                      {t('catalog.reviews_verified')}
                    </span>
                  ) : null}
                </div>
              </header>
              <p className={styles.reviewBody}>{review.body}</p>
              {helpfulCount > 0 ? (
                <p className={styles.reviewHelpful}>{t('catalog.reviews_helpful', { count: helpfulCount })}</p>
              ) : null}
            </article>
          </li>
        );
      })}
    </ol>
  );
}

function ReviewFilters({
  productId,
  data,
  approvedCount,
}: {
  productId: number;
  data?: ProductReviewsData;
  approvedCount: number;
}) {
  const { t } = useLocale();
  if (approvedCount === 0) return null;

  const query = data?.query ?? {};
  const currentSort: ReviewSort = query.sort ?? 'newest';
  const hasFilters = Boolean(
    query.rating
    || query.verifiedOnly
    || (query.sort && query.sort !== 'newest'),
  );

  return (
    <form
      className={styles.reviewFilters}
      method="get"
      action={`/home/products/${productId}`}
      aria-label={t('catalog.reviews_filter_aria')}
    >
      <input type="hidden" name="tab" value="reviews" />
      <span className={styles.reviewFilterTitle}>
        <SlidersHorizontal size={16} aria-hidden="true" />
        {t('catalog.reviews_filter_title')}
      </span>
      <label>
        <span>{t('catalog.rating')}</span>
        <select name="reviewsRating" defaultValue={query.rating ?? ''}>
          <option value="">{t('catalog.all_ratings')}</option>
          {REVIEW_RATINGS.map((rating) => (
            <option value={rating} key={rating}>
              {t(
                rating === 1
                  ? 'catalog.reviews_points_one'
                  : 'catalog.reviews_points_other',
                { rating },
              )}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.reviewVerifiedFilter}>
        <input
          type="checkbox"
          name="reviewsVerified"
          value="1"
          defaultChecked={Boolean(query.verifiedOnly)}
        />
        <span>{t('catalog.reviews_verified_only')}</span>
      </label>
      <label>
        <span>{t('catalog.sort_label')}</span>
        <select name="reviewsSort" defaultValue={currentSort}>
          {SORT_OPTIONS.map((option) => (
            <option value={option.value} key={option.value}>{t(option.labelKey)}</option>
          ))}
        </select>
      </label>
      <button type="submit">{t('catalog.apply')}</button>
      {hasFilters ? <Link href={reviewHref(productId, {}, 1)}>{t('catalog.reset')}</Link> : null}
    </form>
  );
}

function ReviewPagination({ productId, data }: { productId: number; data?: ProductReviewsData }) {
  const { t } = useLocale();
  const pagination = data?.pagination;
  if (!pagination || pagination.totalPages <= 1) return null;

  const query = data?.query ?? {};
  const currentPage = Math.min(
    Math.max(1, safeCount(pagination.page) || 1),
    pagination.totalPages,
  );
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < pagination.totalPages;

  return (
    <nav className={styles.reviewPagination} aria-label={t('catalog.reviews_pagination_aria')}>
      {hasPrevious ? (
        <Link href={reviewHref(productId, query, currentPage - 1)} rel="prev">{t('catalog.previous')}</Link>
      ) : (
        <span aria-disabled="true">{t('catalog.previous')}</span>
      )}
      <span>{t('catalog.page_of', { current: currentPage, total: pagination.totalPages })}</span>
      {hasNext ? (
        <Link href={reviewHref(productId, query, currentPage + 1)} rel="next">{t('catalog.next')}</Link>
      ) : (
        <span aria-disabled="true">{t('catalog.next')}</span>
      )}
    </nav>
  );
}

export function ReviewForm({
  productId,
  data,
}: {
  productId: number;
  data?: ProductReviewsData;
}) {
  const { t } = useLocale();
  const returnTo = `/home/products/${productId}`;
  const viewer = data?.viewer;
  const form = data?.form;

  if (!viewer?.isAuthenticated) {
    const signInHref = safeInternalHref(
      viewer?.signInHref,
      `/home/login?returnTo=${encodeURIComponent(returnTo)}`,
    );
    return (
      <aside className={styles.reviewFormCard} aria-labelledby="write-review-title">
        <span className={styles.reviewFormEyebrow}>{t('catalog.reviews_share')}</span>
        <h3 id="write-review-title">{t('catalog.write_review')}</h3>
        <p>{t('catalog.signin_review_text')}</p>
        <Link className={styles.reviewPrimaryAction} href={signInHref}>
          {t('catalog.signin_review_cta')}
        </Link>
      </aside>
    );
  }

  const submission = viewer.submission;
  const isPending = submission?.status === 'pending';
  const hasEndpoint = typeof form?.endpoint === 'string' && form.endpoint.length > 0;
  const isEnabled = hasEndpoint && form?.enabled !== false && !isPending;
  const unavailableMessage = form?.unavailableMessage
    || t('catalog.review_unavailable');

  return (
    <aside className={styles.reviewFormCard} aria-labelledby="write-review-title">
      <span className={styles.reviewFormEyebrow}>{t('catalog.reviews_share')}</span>
      <h3 id="write-review-title">{t('catalog.write_review')}</h3>
      <p>
        {t('catalog.reviews_published_text')}
        {viewer.displayName?.trim()
          ? ` ${t('catalog.signed_in_as', { name: viewer.displayName.trim() })}`
          : ''}
      </p>

      {submission ? (
        <div className={styles.moderationMessage} role="status">
          <strong>
            {submission.status === 'pending' && t('catalog.review_pending')}
            {submission.status === 'approved' && t('catalog.review_approved')}
            {submission.status === 'rejected' && t('catalog.review_rejected')}
          </strong>
          <span>
            {submission.message?.trim()
              || (submission.status === 'pending'
                ? t('catalog.review_pending_message')
                : t('catalog.review_status_message'))}
          </span>
        </div>
      ) : null}

      <form className={styles.reviewForm} action={form?.endpoint} method="post">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <label>
          <span>{t('catalog.rating')}</span>
          <select name="rating" required defaultValue="">
            <option value="" disabled>{t('catalog.select_rating')}</option>
            <option value="5">{t('catalog.rating_5')}</option>
            <option value="4">{t('catalog.rating_4')}</option>
            <option value="3">{t('catalog.rating_3')}</option>
            <option value="2">{t('catalog.rating_2')}</option>
            <option value="1">{t('catalog.rating_1')}</option>
          </select>
        </label>
        <label>
          <span>{t('catalog.your_review')}</span>
          <textarea
            name="body"
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            placeholder={t('catalog.review_placeholder')}
          />
        </label>
        <button type="submit" disabled={!isEnabled}>
          {form?.submitLabel || t('catalog.submit_review')}
        </button>
        {!isEnabled ? <small>{isPending ? t('catalog.review_awaiting_notice') : unavailableMessage}</small> : null}
      </form>
    </aside>
  );
}

export default function ProductReviews({
  productId,
  data,
}: {
  productId: number;
  data?: ProductReviewsData;
}) {
  const { t } = useLocale();
  const approvedCount = resolveApprovedCount(data);

  return (
    <section className={styles.reviewsSection} aria-labelledby="product-reviews-title">
      <div className={styles.reviewsHeadingRow}>
        <div>
          <span className={styles.sectionEyebrow}>{t('catalog.reviews_eyebrow')}</span>
          <h2 id="product-reviews-title">{t('catalog.reviews_title')}</h2>
        </div>
        {approvedCount > 0 ? (
          <span>{t('catalog.reviews_approved_count', { count: approvedCount })}</span>
        ) : null}
      </div>

      <div className={styles.reviewsLayout}>
        <div className={styles.reviewsMain}>
          <ReviewSummary data={data} />
          {approvedCount > 0 ? (
            <ReviewFilters productId={productId} data={data} approvedCount={approvedCount} />
          ) : null}
          <ReviewList productId={productId} data={data} approvedCount={approvedCount} />
          <ReviewPagination productId={productId} data={data} />
        </div>
        <ReviewForm productId={productId} data={data} />
      </div>
    </section>
  );
}
