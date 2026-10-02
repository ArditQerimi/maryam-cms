import 'server-only';
import { and, asc, count, desc, eq, type SQL } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import * as schema from '@/db/schema-tenant';
import { getAccountAccess } from '@/lib/account/data';
import type {
  ApprovedProductReview,
  ProductReviewQuery,
  ProductReviewsData,
  ReviewDistributionRow,
  ReviewRating,
} from '@/app/home/products/[id]/ProductReviews';

/** Approved reviews per page on the product page. */
export const REVIEW_PAGE_SIZE = 10;

/**
 * Notice forwarded from the review POST redirect (`reviewStatus` query param).
 * `created` confirms publication; the rest are honest failure notices shown
 * in the submission status slot.
 */
export type ReviewNotice = 'created' | 'rate-limited' | 'invalid' | 'denied' | null;

function clampRating(value: unknown): ReviewRating | null {
  const rating = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : Number.NaN;
  return Number.isInteger(rating) && rating >= 1 && rating <= 5
    ? (rating as ReviewRating)
    : null;
}

function approvedWhere(productId: number): SQL | undefined {
  return and(
    eq(schema.productReviews.productId, productId),
    eq(schema.productReviews.status, 'approved'),
  );
}

function sortToOrderBy(sort: ProductReviewQuery['sort']): SQL[] {
  switch (sort) {
    case 'oldest':
      return [asc(schema.productReviews.createdAt), asc(schema.productReviews.id)];
    case 'highest':
      return [desc(schema.productReviews.rating), desc(schema.productReviews.createdAt)];
    case 'lowest':
      return [asc(schema.productReviews.rating), desc(schema.productReviews.createdAt)];
    case 'newest':
    default:
      return [desc(schema.productReviews.createdAt), desc(schema.productReviews.id)];
  }
}

function noticeToSubmission(notice: ReviewNotice) {
  switch (notice) {
    case 'created':
      return {
        status: 'approved' as const,
        message: 'Thank you — your review is published and visible to everyone.',
      };
    case 'rate-limited':
      return {
        status: 'rejected' as const,
        message: 'You have submitted several reviews recently. Please try again a little later.',
      };
    case 'invalid':
      return {
        status: 'rejected' as const,
        message: 'Your review could not be accepted. Use a rating from 1 to 5 and at least 10 characters of text.',
      };
    case 'denied':
      return {
        status: 'rejected' as const,
        message: 'Your session has expired. Sign in again to publish your review.',
      };
    default:
      return null;
  }
}

/**
 * Build the complete data contract for the reviews tab: approved summary and
 * list (server-rendered — no client fetch), the viewer's identity state, and
 * the submission form endpoint. Everything reads real `product_reviews` rows
 * (migration 006); there is no seeded or placeholder rating anywhere.
 */
export async function loadProductReviews(
  productId: number,
  query: ProductReviewQuery = {},
  notice: ReviewNotice = null,
): Promise<ProductReviewsData> {
  const db = await getContextDb();

  const ratingGroups = await db
    .select({
      count: count(),
      rating: schema.productReviews.rating,
    })
    .from(schema.productReviews)
    .where(approvedWhere(productId))
    .groupBy(schema.productReviews.rating);

  // Weighted average across the per-rating group rows (avoids a second scan).
  const approvedCount = ratingGroups.reduce((total, row) => total + row.count, 0);
  const weightedSum = ratingGroups.reduce(
    (total, row) => total + row.count * row.rating,
    0,
  );
  const averageRating = approvedCount > 0 ? weightedSum / approvedCount : null;

  const distribution: ReviewDistributionRow[] = [5, 4, 3, 2, 1].map((rating) => ({
    rating: rating as ReviewRating,
    count: ratingGroups.find((row) => row.rating === rating)?.count ?? 0,
  }));

  const filters: (SQL | undefined)[] = [approvedWhere(productId)];
  if (query.rating) {
    const rating = clampRating(query.rating);
    if (rating) filters.push(eq(schema.productReviews.rating, rating));
  }
  if (query.verifiedOnly) {
    filters.push(eq(schema.productReviews.verifiedPurchase, true));
  }

  const requestedPage = Number.isInteger(query.page) && (query.page ?? 0) > 0 ? query.page! : 1;
  const [totalRows, reviewRows, verifiedRows] = await Promise.all([
    db
      .select({ total: count() })
      .from(schema.productReviews)
      .where(and(...filters)),
    db
      .select({
        id: schema.productReviews.id,
        authorName: schema.productReviews.authorName,
        body: schema.productReviews.body,
        rating: schema.productReviews.rating,
        verifiedPurchase: schema.productReviews.verifiedPurchase,
        createdAt: schema.productReviews.createdAt,
      })
      .from(schema.productReviews)
      .where(and(...filters))
      .orderBy(...sortToOrderBy(query.sort))
      .limit(REVIEW_PAGE_SIZE)
      .offset((requestedPage - 1) * REVIEW_PAGE_SIZE),
    db
      .select({ total: count() })
      .from(schema.productReviews)
      .where(
        and(
          approvedWhere(productId),
          eq(schema.productReviews.verifiedPurchase, true),
        ),
      ),
  ]);

  const totalItems = totalRows[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / REVIEW_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const reviews: ApprovedProductReview[] = reviewRows.map((row) => ({
    id: row.id,
    status: 'approved',
    authorName: row.authorName,
    body: row.body,
    rating: clampRating(row.rating) ?? 5,
    createdAt: row.createdAt.toISOString(),
    verifiedPurchase: row.verifiedPurchase,
  }));

  // Viewer identity comes from the same session guard the account pages use.
  const access = await getAccountAccess();
  const productPath = `/home/products/${productId}`;
  const noticeSubmission = noticeToSubmission(notice);

  let viewer: ProductReviewsData['viewer'];
  if (access.status !== 'authenticated') {
    viewer = {
      isAuthenticated: false,
      signInHref: `/home/login?returnTo=${encodeURIComponent(productPath)}`,
      submission: noticeSubmission,
    };
  } else {
    const [ownRow] = await db
      .select({
        status: schema.productReviews.status,
        name: schema.users.name,
      })
      .from(schema.productReviews)
      .leftJoin(schema.users, eq(schema.users.id, schema.productReviews.userId))
      .where(
        and(
          eq(schema.productReviews.productId, productId),
          eq(schema.productReviews.userId, access.userId),
        ),
      )
      .limit(1);

    viewer = {
      isAuthenticated: true,
      displayName: ownRow?.name ?? null,
      submission: noticeSubmission
        ?? (ownRow
          ? {
              status: ownRow.status,
              message: ownRow.status === 'approved'
                ? 'Your review is published and visible to everyone.'
                : undefined,
            }
          : null),
    };
  }

  return {
    summary: {
      approvedCount,
      averageRating,
      distribution,
      verifiedPurchaseCount: verifiedRows[0]?.total ?? 0,
    },
    reviews,
    pagination: {
      page,
      pageSize: REVIEW_PAGE_SIZE,
      totalItems,
      totalPages,
    },
    query: {
      page,
      rating: clampRating(query.rating),
      verifiedOnly: Boolean(query.verifiedOnly),
      sort: query.sort ?? 'newest',
    },
    viewer,
    form: {
      endpoint: `/api/products/${productId}/reviews`,
      enabled: true,
      submitLabel: 'Submit review',
    },
  };
}
