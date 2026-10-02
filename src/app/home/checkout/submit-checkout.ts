import type {
  CheckoutCapabilities,
  CheckoutConfirmation,
  CheckoutFailure,
  CheckoutFieldErrors,
  CheckoutSubmitResult,
  CheckoutSubmission,
  CheckoutSubmitter,
} from './checkout-contract';
import {
  STOREFRONT_CHECKOUT_CAPABILITIES_ENDPOINT,
  STOREFRONT_CHECKOUT_ENDPOINT,
} from './checkout-contract';
import {
  mapCartResponse,
  storefrontCartApi,
  type StorefrontCartLine,
} from '@/lib/storefront/client/commerce-api';

/**
 * Client-side checkout submit adapter (see the CheckoutSubmitter contract).
 *
 * 1. fetch public capabilities (authoritative server quote) — fail fast on
 *    configuration problems before touching the cart;
 * 2. synchronize the canonical local lines through the server cart API
 *    (remove extra server lines, add missing lines, fix quantities);
 * 3. re-fetch capabilities and require a non-empty, stable quote;
 * 4. POST only the closed CheckoutRequest with the idempotency key;
 * 5. return success only after the server has created a real order.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildFailure(code: string, message: string, retryable: boolean): CheckoutFailure {
  return { code, message, retryable };
}

function readFailure(payload: unknown, status: number): CheckoutFailure {
  if (isRecord(payload) && isRecord(payload.error)) {
    const error = payload.error;
    const fieldErrors = isRecord(error.fieldErrors) ? error.fieldErrors : null;
    return {
      code: typeof error.code === 'string' && error.code ? error.code : 'checkout-failed',
      message: typeof error.message === 'string' && error.message
        ? error.message
        : 'The order could not be placed. No order was created.',
      retryable: typeof error.retryable === 'boolean' ? error.retryable : status >= 500,
      ...(fieldErrors ? { fieldErrors: fieldErrors as CheckoutFieldErrors } : {}),
    };
  }
  if (status === 0) {
    return buildFailure(
      'checkout_request_failed',
      'We could not reach secure checkout. No order was created. Check your connection and try again.',
      true,
    );
  }
  return buildFailure(
    'checkout-failed',
    'The order could not be placed. No order was created. Please try again.',
    status >= 500,
  );
}

function isAborted(caught: unknown, signal: AbortSignal) {
  return signal.aborted || (caught instanceof DOMException && caught.name === 'AbortError');
}

type CapabilitiesResult =
  | { ok: true; capabilities: CheckoutCapabilities }
  | { ok: false; error: CheckoutFailure };

async function fetchCapabilities(signal: AbortSignal): Promise<CapabilitiesResult> {
  let response: Response;
  let payload: unknown = null;
  try {
    response = await fetch(STOREFRONT_CHECKOUT_CAPABILITIES_ENDPOINT, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      mode: 'same-origin',
      redirect: 'error',
      headers: { Accept: 'application/json' },
      signal,
    });
    payload = await response.json().catch(() => null);
  } catch (caught) {
    if (isAborted(caught, signal)) throw caught;
    return {
      ok: false,
      error: buildFailure(
        'checkout-unavailable',
        'Secure checkout is unreachable right now. No order was created. Please try again.',
        true,
      ),
    };
  }

  if (
    response.ok
    && isRecord(payload)
    && payload.ok === true
    && isRecord(payload.capabilities)
    && isRecord((payload.capabilities as Record<string, unknown>).quote)
  ) {
    return { ok: true, capabilities: payload.capabilities as unknown as CheckoutCapabilities };
  }
  return { ok: false, error: readFailure(payload, response.status) };
}

function lineKey(productId: number, variantId: number) {
  return `${productId}:${variantId}`;
}

/**
 * Make the server cart match the canonical local lines exactly. Uses only the
 * public cart API (credentials included) so the guest cookie or the signed-in
 * customer session resolves ownership server-side.
 *
 * Returns the number of mutations performed (0 means the carts already agreed).
 */
async function syncServerCart(
  lines: CheckoutSubmission['cart']['lines'],
  signal: AbortSignal,
): Promise<number> {
  const desired = lines.map((line) => ({
    productId: Number(line.productId),
    variantId: Number(line.variantId),
    quantity: Number(line.quantity),
  }));
  const desiredByKey = new Map(desired.map((line) => [lineKey(line.productId, line.variantId), line]));

  let working: StorefrontCartLine[] = mapCartResponse(await storefrontCartApi.get(signal)).items;
  let operations = 0;
  const apply = async (payload: unknown) => {
    working = mapCartResponse(payload).items;
    operations += 1;
  };

  // Server lines the shopper no longer has locally must go.
  for (const item of [...working]) {
    if (desiredByKey.has(lineKey(item.productId, item.variantId))) continue;
    apply(await storefrontCartApi.remove(item.serverItemId, signal));
  }

  for (const line of desired) {
    const key = lineKey(line.productId, line.variantId);
    const current = working.find((item) => lineKey(item.productId, item.variantId) === key);
    if (!current) {
      apply(await storefrontCartApi.add(
        { productId: line.productId, variantId: line.variantId, quantity: line.quantity },
        signal,
      ));
    } else if (current.quantity !== line.quantity) {
      apply(await storefrontCartApi.update(current.serverItemId, line.quantity, signal));
    }
  }

  return operations;
}

function readConfirmation(payload: unknown): CheckoutConfirmation | null {
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.confirmation)) return null;
  const confirmation = payload.confirmation;
  const requiredStrings: Array<keyof CheckoutConfirmation> = [
    'orderId',
    'orderNumber',
    'contactEmail',
    'currency',
    'confirmationPath',
  ];
  if (!requiredStrings.every((key) => typeof confirmation[key] === 'string' && confirmation[key] !== '')) {
    return null;
  }
  // Root-relative only: the client refuses to navigate anywhere else.
  if (!String(confirmation.confirmationPath).startsWith('/')) return null;
  return confirmation as unknown as CheckoutConfirmation;
}

export const submitCheckout: CheckoutSubmitter = async (submission) => {
  const { request, cart, idempotencyKey, signal } = submission;

  // Step 1 — authoritative capabilities/quote before any cart mutation.
  const before = await fetchCapabilities(signal);
  if (!before.ok) return { ok: false, error: before.error };

  // Step 2 — synchronize canonical lines through the server cart API.
  let operations = 0;
  try {
    operations = await syncServerCart(cart.lines, signal);
  } catch (caught) {
    if (isAborted(caught, signal)) throw caught;
    return {
      ok: false,
      error: buildFailure(
        'cart-synchronization-failed',
        'Your server cart could not be synchronized with this order. No order was created. Please try again.',
        true,
      ),
    };
  }

  // Step 3 — re-fetch the quote that will actually be charged. When the sync
  // made no changes the cart must still fingerprint identically; when it did
  // change the cart, the fresh (non-empty) quote is the accepted one.
  const after = await fetchCapabilities(signal);
  if (!after.ok) return { ok: false, error: after.error };
  if (operations === 0 && after.capabilities.quote.fingerprint !== before.capabilities.quote.fingerprint) {
    return {
      ok: false,
      error: buildFailure(
        'cart-changed',
        'Your cart changed while the order was being prepared. Please review it and try again.',
        true,
      ),
    };
  }
  if (after.capabilities.quote.empty || after.capabilities.quote.lineCount < 1) {
    return {
      ok: false,
      error: buildFailure(
        'empty-cart',
        'Your cart is empty, so the order could not be placed. Add a product and try again.',
        false,
      ),
    };
  }

  // Step 4 — place the order. The body is the closed CheckoutRequest only.
  let response: Response;
  let payload: unknown = null;
  try {
    response = await fetch(STOREFRONT_CHECKOUT_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      mode: 'same-origin',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(request),
      signal,
    });
    payload = await response.json().catch(() => null);
  } catch (caught) {
    if (isAborted(caught, signal)) throw caught;
    return { ok: false, error: readFailure(null, 0) };
  }

  // Step 5 — success only for a server-created order with a usable path.
  const confirmation = response.ok ? readConfirmation(payload) : null;
  if (confirmation) return { ok: true, confirmation };
  return { ok: false, error: readFailure(payload, response.status) };
};
