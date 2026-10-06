import type { MouseEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './CarouselArrow.module.css';

/** Put this class on the (position: relative) wrapper of a carousel so its arrows reveal on hover. */
export const CAROUSEL_HOVER_CLASS = 'ui-carousel';

type CarouselArrowProps = {
  direction: 'prev' | 'next';
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Accessible name, e.g. "Previous slide". */
  label: string;
  /** Positioning only (left / right offsets) — see CarouselArrow.module.css. */
  className?: string;
};

/** Shared previous / next arrow for every carousel. */
export default function CarouselArrow({ direction, onClick, label, className }: CarouselArrowProps) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`${styles.arrow} ${direction === 'prev' ? styles.prev : styles.next}${className ? ` ${className}` : ''}`}
    >
      <Icon aria-hidden="true" />
    </button>
  );
}
