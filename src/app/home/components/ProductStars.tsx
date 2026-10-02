import styles from '../bookstore.module.css';

/**
 * The demo card rating: five stars — the first `rating` filled amber, the
 * rest light grey. Renders nothing when no rating was set, so an unrated
 * product never shows a fabricated score. Shared by the homepage sections,
 * the shop listing and the builder canvas preview.
 */
export default function ProductStars({ rating }: { rating?: number | null }) {
  const value = Math.round(Number(rating ?? 0));
  if (!Number.isFinite(value) || value < 1) return null;
  const filled = Math.min(5, value);

  return (
    <div className={styles.productStars} role="img" aria-label={`${filled} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} data-empty={star <= filled ? undefined : ''} aria-hidden="true">
          ★
        </span>
      ))}
    </div>
  );
}
