import Link from 'next/link';
import { BadgeCheck, SlidersHorizontal } from 'lucide-react';
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
const SORT_OPTIONS: ReadonlyArray<{ value: ReviewSort; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'highest', label: 'Highest rating' },
  { value: 'lowest', label: 'Lowest rating' },
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
  return `/shop/products/${productId}${queryString ? `?${queryString}` : ''}`;
}

export function ReviewSummary({
  data,
}: {
  data?: ProductReviewsData;
}) {
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
        <span className={styles.reviewZeroLabel}>Customer reviews</span>
        <h3>No approved reviews yet</h3>
        <p>
          This product does not have an approved customer review. A rating will appear
          here only after real review data is supplied and approved.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.reviewSummary}>
      <div className={styles.reviewAverage}>
        <span className={styles.reviewAverageValue}>
          {average === null ? '—' : average.toFixed(1)}
        </span>
        <span className={styles.reviewAverageScale}>out of 5</span>
        <span className={styles.reviewApprovedCount}>
          {approvedCount} approved {approvedCount === 1 ? 'review' : 'reviews'}
        </span>
        {summary?.verifiedPurchaseCount != null ? (
          <span className={styles.reviewVerifiedSummary}>
            <BadgeCheck size={15} aria-hidden="true" />
            {safeCount(summary.verifiedPurchaseCount)} verified purchases
          </span>
        ) : null}
      </div>

      {distribution.length > 0 ? (
        <div className={styles.ratingDistribution} aria-label="Approved rating distribution">
          {distribution.map((row) => {
            const count = safeCount(row.count);
            const percentage = approvedCount > 0
              ? Math.min(100, (count / approvedCount) * 100)
              : 0;
            return (
              <div className={styles.distributionRow} key={row.rating}>
                <span>{row.rating} point{row.rating === 1 ? '' : 's'}</span>
                <div
                  className={styles.distributionTrack}
                  role="progressbar"
                  aria-label={`${row.rating} point reviews`}
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
        <p className={styles.reviewDataNote}>The detailed rating distribution is not available.</p>
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
  const reviews = data?.reviews ?? [];
  const query = data?.query ?? {};
  const hasFilters = Boolean(query.rating || query.verifiedOnly);

  if (reviews.length === 0) {
    return (
      <div className={styles.reviewListEmpty}>
        <h3>{approvedCount > 0 && hasFilters ? 'No reviews match these filters' : 'No approved reviews to display'}</h3>
        <p>
          {approvedCount > 0 && hasFilters
            ? 'Try clearing the rating or verified-purchase filter.'
            : 'Only approved customer reviews will be shown on this page.'}
        </p>
        {approvedCount > 0 && hasFilters ? (
          <Link href={reviewHref(productId, {}, 1)}>Clear review filters</Link>
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
                  <h3 id={`review-author-${review.id}`}>{review.authorName.trim() || 'Customer'}</h3>
                  {date ? <time dateTime={review.createdAt}>{date}</time> : null}
                </div>
                <div className={styles.reviewItemMeta}>
                  <span className={styles.reviewRatingValue}>{review.rating} / 5</span>
                  {review.verifiedPurchase ? (
                    <span className={styles.verifiedBadge}>
                      <BadgeCheck size={14} aria-hidden="true" />
                      Verified purchase
                    </span>
                  ) : null}
                </div>
              </header>
              <p className={styles.reviewBody}>{review.body}</p>
              {helpfulCount > 0 ? (
                <p className={styles.reviewHelpful}>{helpfulCount} found this helpful</p>
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
      action={`/shop/products/${productId}`}
      aria-label="Filter product reviews"
    >
      <input type="hidden" name="tab" value="reviews" />
      <span className={styles.reviewFilterTitle}>
        <SlidersHorizontal size={16} aria-hidden="true" />
        Filter reviews
      </span>
      <label>
        <span>Rating</span>
        <select name="reviewsRating" defaultValue={query.rating ?? ''}>
          <option value="">All ratings</option>
          {REVIEW_RATINGS.map((rating) => (
            <option value={rating} key={rating}>{rating} point{rating === 1 ? '' : 's'}</option>
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
        <span>Verified purchases only</span>
      </label>
      <label>
        <span>Sort</span>
        <select name="reviewsSort" defaultValue={currentSort}>
          {SORT_OPTIONS.map((option) => (
            <option value={option.value} key={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <button type="submit">Apply</button>
      {hasFilters ? <Link href={reviewHref(productId, {}, 1)}>Reset</Link> : null}
    </form>
  );
}

function ReviewPagination({ productId, data }: { productId: number; data?: ProductReviewsData }) {
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
    <nav className={styles.reviewPagination} aria-label="Product review pagination">
      {hasPrevious ? (
        <Link href={reviewHref(productId, query, currentPage - 1)} rel="prev">Previous</Link>
      ) : (
        <span aria-disabled="true">Previous</span>
      )}
      <span>Page {currentPage} of {pagination.totalPages}</span>
      {hasNext ? (
        <Link href={reviewHref(productId, query, currentPage + 1)} rel="next">Next</Link>
      ) : (
        <span aria-disabled="true">Next</span>
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
  const returnTo = `/shop/products/${productId}`;
  const viewer = data?.viewer;
  const form = data?.form;

  if (!viewer?.isAuthenticated) {
    const signInHref = safeInternalHref(
      viewer?.signInHref,
      `/shop/login?returnTo=${encodeURIComponent(returnTo)}`,
    );
    return (
      <aside className={styles.reviewFormCard} aria-labelledby="write-review-title">
        <span className={styles.reviewFormEyebrow}>Share your experience</span>
        <h3 id="write-review-title">Write a review</h3>
        <p>Sign in to write a review. Only genuine, approved submissions are published.</p>
        <Link className={styles.reviewPrimaryAction} href={signInHref}>
          Sign in to write a review
        </Link>
      </aside>
    );
  }

  const submission = viewer.submission;
  const isPending = submission?.status === 'pending';
  const hasEndpoint = typeof form?.endpoint === 'string' && form.endpoint.length > 0;
  const isEnabled = hasEndpoint && form?.enabled !== false && !isPending;
  const unavailableMessage = form?.unavailableMessage
    || 'Review submission is not connected yet. Please check back later.';

  return (
    <aside className={styles.reviewFormCard} aria-labelledby="write-review-title">
      <span className={styles.reviewFormEyebrow}>Share your experience</span>
      <h3 id="write-review-title">Write a review</h3>
      <p>
        Your review will be checked by a moderator before it appears publicly.
        {viewer.displayName?.trim() ? ` You are signed in as ${viewer.displayName.trim()}.` : ''}
      </p>

      {submission ? (
        <div className={styles.moderationMessage} role="status">
          <strong>
            {submission.status === 'pending' && 'Review awaiting moderation'}
            {submission.status === 'approved' && 'Review approved'}
            {submission.status === 'rejected' && 'Review not approved'}
          </strong>
          <span>
            {submission.message?.trim()
              || (submission.status === 'pending'
                ? 'Your submitted review is pending moderation and is not visible in the public list yet.'
                : 'The moderation status of your review has been updated.')}
          </span>
        </div>
      ) : null}

      <form className={styles.reviewForm} action={form?.endpoint} method="post">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <label>
          <span>Rating</span>
          <select name="rating" required defaultValue="">
            <option value="" disabled>Select a rating</option>
            <option value="5">5 — Excellent</option>
            <option value="4">4 — Good</option>
            <option value="3">3 — Average</option>
            <option value="2">2 — Poor</option>
            <option value="1">1 — Very poor</option>
          </select>
        </label>
        <label>
          <span>Your review</span>
          <textarea
            name="body"
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            placeholder="Share what you liked or what could be improved. Plain text only."
          />
        </label>
        <button type="submit" disabled={!isEnabled}>
          {form?.submitLabel || 'Submit for moderation'}
        </button>
        {!isEnabled ? <small>{isPending ? 'You already have a review awaiting moderation.' : unavailableMessage}</small> : null}
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
  const approvedCount = resolveApprovedCount(data);

  return (
    <section className={styles.reviewsSection} aria-labelledby="product-reviews-title">
      <div className={styles.reviewsHeadingRow}>
        <div>
          <span className={styles.sectionEyebrow}>Customer feedback</span>
          <h2 id="product-reviews-title">Product reviews</h2>
        </div>
        {approvedCount > 0 ? (
          <span>{approvedCount} approved</span>
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
