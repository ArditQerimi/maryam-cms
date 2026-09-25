/**
 * The coupon chosen in the cart is remembered in `localStorage` so the checkout
 * summary can re-validate it against the server before the order is placed.
 *
 * This is transport only: the value is NEVER trusted. Both the cart and the
 * checkout re-run the coupon through the server action in
 * `src/app/shop/cart/actions.ts`, and the checkout POST re-validates it again
 * inside the order transaction.
 */

export const CART_COUPON_STORAGE_KEY = 'maryam-cart-coupon';

export type StoredCoupon = {
  /** Code exactly as the shopper typed it (comparison is case-insensitive). */
  code: string;
  /** Server-provided human label, e.g. `TEST10 · 10% off`. */
  label: string;
};

function storageAvailable(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    const probe = '__maryam_coupon_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

function sanitize(value: unknown): StoredCoupon | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { code?: unknown; label?: unknown };
  if (typeof candidate.code !== 'string') return null;
  const code = candidate.code.trim();
  if (!code) return null;
  return {
    code,
    label: typeof candidate.label === 'string' && candidate.label.trim()
      ? candidate.label.trim()
      : code,
  };
}

export function readStoredCoupon(): StoredCoupon | null {
  const storage = storageAvailable();
  if (!storage) return null;
  try {
    return sanitize(JSON.parse(storage.getItem(CART_COUPON_STORAGE_KEY) ?? 'null'));
  } catch {
    return null;
  }
}

export function writeStoredCoupon(coupon: StoredCoupon): void {
  const storage = storageAvailable();
  if (!storage) return;
  try {
    storage.setItem(CART_COUPON_STORAGE_KEY, JSON.stringify(coupon));
  } catch {
    // Storage may be full or blocked; the cart simply keeps the code in memory.
  }
}

export function clearStoredCoupon(): void {
  const storage = storageAvailable();
  if (!storage) return;
  try {
    storage.removeItem(CART_COUPON_STORAGE_KEY);
  } catch {
    // Nothing to recover from — the coupon is re-validated on every read anyway.
  }
}
