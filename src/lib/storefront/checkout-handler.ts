import { after, type NextRequest } from 'next/server';
import type {
  CheckoutFieldErrors,
  CheckoutSubmitResult,
} from '@/app/home/checkout/checkout-contract';
import { getCartCookie } from './cookies';
import {
  getStorefrontContext,
  assertMutationOrigin,
} from './context';
import { isStorefrontError } from './errors';
import { noStoreJson } from './http';
import { loadCheckoutRuntimeConfig, CheckoutConfigurationError } from './checkout-config';
import { setOrderAccessCookie } from './checkout-access';
import {
  CheckoutIdempotencyInputError,
  parseIdempotencyKey,
} from './checkout-idempotency';
import { CheckoutServiceError, placeStorefrontCheckout } from './checkout-service';
import { notifyNewOrder } from './order-notify';
import {
  CheckoutValidationError,
  parseCheckoutRequest,
} from './checkout-validation';

const MAX_CHECKOUT_BODY_BYTES = 32 * 1024;

class CheckoutHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'CheckoutHttpError';
    this.status = status;
    this.code = code;
  }
}

export async function readBoundedCheckoutJson(request: NextRequest) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new CheckoutHttpError(415, 'unsupported-media-type', 'Content-Type must be application/json.');
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      throw new CheckoutHttpError(400, 'invalid-request', 'Content-Length is invalid.');
    }
    if (Number(contentLength) > MAX_CHECKOUT_BODY_BYTES) {
      throw new CheckoutHttpError(413, 'request-body-too-large', 'Request body is too large.');
    }
  }
  if (!request.body) {
    throw new CheckoutHttpError(400, 'invalid-request', 'Request body is required.');
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_CHECKOUT_BODY_BYTES) {
      await reader.cancel();
      throw new CheckoutHttpError(413, 'request-body-too-large', 'Request body is too large.');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let bodyText: string;
  try {
    bodyText = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new CheckoutHttpError(400, 'invalid-request', 'Request body must be valid UTF-8 JSON.');
  }
  if (!bodyText.trim()) {
    throw new CheckoutHttpError(400, 'invalid-request', 'Request body is required.');
  }

  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    throw new CheckoutHttpError(400, 'invalid-request', 'Request body must be valid JSON.');
  }
}

function failure(
  code: string,
  message: string,
  retryable: boolean,
  fieldErrors?: CheckoutFieldErrors,
) {
  return {
    ok: false as const,
    error: {
      code,
      message,
      retryable,
      ...(fieldErrors ? { fieldErrors } : {}),
    },
  };
}

const CONTEXT_MESSAGES: Record<string, string> = {
  'authentication-required': 'Sign in as a Customer to continue.',
  'active-customer-required': 'An active Customer account is required.',
  'invalid-session': 'Your session has expired.',
  'same-origin-required': 'Checkout requires a same-origin request.',
  'storefront-tenant-inactive': 'This storefront is not available.',
};

export function checkoutErrorResponse(error: unknown) {
  if (error instanceof CheckoutValidationError) {
    return noStoreJson(
      failure(
        'validation-failed',
        error.message,
        true,
        error.fieldErrors,
      ),
      400,
    );
  }
  if (error instanceof CheckoutServiceError) {
    return noStoreJson(
      failure(
        error.code,
        error.message,
        error.retryable,
        error.fieldErrors,
      ),
      error.status,
    );
  }
  if (error instanceof CheckoutConfigurationError) {
    return noStoreJson(
      failure(
        'checkout-unavailable',
        'Checkout is not available because secure server configuration is incomplete.',
        false,
      ),
      503,
    );
  }
  if (error instanceof CheckoutIdempotencyInputError) {
    return noStoreJson(
      failure('invalid-idempotency-key', error.message, false),
      400,
    );
  }
  if (error instanceof CheckoutHttpError) {
    return noStoreJson(failure(error.code, error.message, false), error.status);
  }
  if (isStorefrontError(error)) {
    const status = error.status >= 400 && error.status < 500 ? error.status : 503;
    return noStoreJson(
      failure(
        error.code,
        CONTEXT_MESSAGES[error.code] || 'Checkout is temporarily unavailable.',
        status >= 500,
      ),
      status,
    );
  }

  const diagnosticCode = (error as { code?: unknown } | null)?.code;
  const cause = (error as { cause?: unknown } | null)?.cause;
  console.error('[Storefront checkout] Unexpected failure', {
    name: error instanceof Error ? error.name : 'UnknownError',
    code: typeof diagnosticCode === 'string' ? diagnosticCode : undefined,
    message: error instanceof Error ? error.message : String(error),
    cause: cause instanceof Error
      ? { name: cause.name, message: cause.message, code: (cause as { code?: unknown }).code }
      : cause !== undefined
        ? String(cause)
        : undefined,
    stack: error instanceof Error ? error.stack?.split('\n').slice(0, 6).join('\n') : undefined,
  });
  return noStoreJson(
    failure(
      'checkout-temporarily-unavailable',
      'Secure checkout is temporarily unavailable. Retry the request.',
      true,
    ),
    503,
  );
}

export async function handleStorefrontCheckout(request: NextRequest) {
  try {
    // Orders are for registered customers only: guests get a 401 before any
    // cart mutation or order row exists (visitors can browse, not order).
    const context = await getStorefrontContext(request, { allowGuest: false });
    assertMutationOrigin(request, context);
    const config = loadCheckoutRuntimeConfig(process.env, context.company.subdomain);
    const idempotencyKey = parseIdempotencyKey(request.headers.get('idempotency-key'));
    const body = await readBoundedCheckoutJson(request);
    const checkoutRequest = parseCheckoutRequest(body);
    const result = await placeStorefrontCheckout({
      context,
      guestCartId: getCartCookie(request),
      request: checkoutRequest,
      idempotencyKey,
      config,
    });

    // Tell the shop (WhatsApp, server to server) about a NEW order only —
    // an idempotent replay of the same request must not notify twice.
    if (!result.replayed) {
      const saleId = Number(result.confirmation.orderId);
      after(() => notifyNewOrder(context.db, saleId));
    }

    const response = noStoreJson(
      {
        ok: true,
        confirmation: result.confirmation,
      } satisfies CheckoutSubmitResult,
      result.replayed ? 200 : 201,
    );
    if (result.guestAccessToken) {
      setOrderAccessCookie(
        response,
        result.guestAccessToken,
        context.requestProtocol === 'https:',
      );
    }
    return response;
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
