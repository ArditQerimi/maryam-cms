import type { ProductId, VariantId } from '@/context/CartContext';

/** The checkout mutation endpoint. */
export const STOREFRONT_CHECKOUT_ENDPOINT = '/api/storefront/checkout';
/** Read-only public capabilities and authoritative server-cart quote. */
export const STOREFRONT_CHECKOUT_CAPABILITIES_ENDPOINT =
  '/api/storefront/checkout/capabilities';
/** Public shipping quote for the address the shopper is typing in. */
export const CHECKOUT_SHIPPING_AVAILABLE_ENDPOINT = '/api/shipping/available';
/**
 * sessionStorage key holding the chosen shipping method
 * (`CheckoutShippingSelection`). The request payload below is validated with an
 * exact key allowlist by the server, so the selection travels through this
 * side channel (order note / future adapter) while its cost is folded into the
 * displayed order total.
 */
export const CHECKOUT_SHIPPING_STORAGE_KEY = 'maryam-checkout-shipping';

/**
 * Public shipping-method quote: which methods (with costs) the tenant's
 * shipping zones offer for a destination country/state and order total.
 */
export const SHIPPING_AVAILABLE_ENDPOINT = '/api/shipping/available';

export type CheckoutAddress = {
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  country: string;
  city: string;
  region: string;
  postalCode: string;
};

/**
 * IDs currently available in the UI. The server must replace/allowlist these
 * with its own delivery and payment capabilities before checkout is enabled.
 */
export type CheckoutDeliveryMethodId = 'standard' | 'express';
export type CheckoutPaymentMethodId = 'card' | 'cash_on_delivery';
/** Currencies approved by the reviewed server configuration allowlist. */
export type CheckoutCurrency = 'EUR' | 'USD' | 'GBP' | 'CHF' | 'CAD' | 'AUD';

/** One method returned by GET SHIPPING_AVAILABLE_ENDPOINT for an address. */
export type ShippingMethodOption = {
  id: number;
  type: string;
  title: string;
  cost: string;
  minOrderAmount: string;
  instructions: string | null;
};

/**
 * The shipping choice confirmed in the UI. `CheckoutRequest` is intentionally
 * a closed contract — the server rejects unknown request keys — so adapters
 * receive the selection on the submission envelope instead of the request and
 * may persist it (e.g. as an order note) alongside the created order.
 */
export type CheckoutShippingSelection = {
  methodId: string;
  title: string;
  cost: string;
};

export type CheckoutRequest = {
  contact: {
    email: string;
    phone: string;
    marketingOptIn: boolean;
  };
  shippingAddress: CheckoutAddress;
  billing: {
    sameAsShipping: boolean;
    address: CheckoutAddress;
  };
  delivery: {
    methodId: CheckoutDeliveryMethodId;
  };
  payment: {
    methodId: CheckoutPaymentMethodId;
  };
  promotionCode: string | null;
  /** Optional note from the shopper to the store (trimmed, max 1000 chars). */
  orderNotes?: string;
  terms: {
    accepted: true;
  };
};

export type CheckoutFieldName =
  | 'contact.email'
  | 'contact.phone'
  | `shippingAddress.${keyof CheckoutAddress}`
  | `billingAddress.${keyof CheckoutAddress}`
  | 'delivery.methodId'
  | 'payment.methodId'
  | 'terms.accepted';

export type CheckoutFieldErrors = Partial<Record<CheckoutFieldName, string>>;

/**
 * Canonical, variant-aware local lines are supplied only to the submit adapter.
 * They are deliberately separate from CheckoutRequest: the browser must send
 * identifiers to synchronize/import its cart, while the server resolves all
 * product data and money from its own database.
 */
export type CheckoutCartLine = {
  productId: ProductId;
  variantId: VariantId;
  quantity: number;
  serverItemId?: number;
};

export type CheckoutSubmission = {
  request: CheckoutRequest;
  cart: {
    lines: readonly CheckoutCartLine[];
  };
  /** Optional shipping choice from the store's shipping zones (see above). */
  shipping?: CheckoutShippingSelection;
  idempotencyKey: string;
  signal: AbortSignal;
};

export type CheckoutConfirmation = {
  orderId: string;
  orderNumber: string;
  contactEmail: string;
  currency: CheckoutCurrency;
  /** Must be a root-relative, same-store path. The client rejects other URLs. */
  confirmationPath: string;
};

export type CheckoutFailure = {
  code: string;
  message: string;
  retryable: boolean;
  fieldErrors?: CheckoutFieldErrors;
};

export type CheckoutDeliveryCapability = {
  id: CheckoutDeliveryMethodId;
  label: string;
};

/** One row of `GET /api/shipping/available` (numeric money variant). */
export type CheckoutShippingOption = {
  id: number;
  type: string;
  title: string;
  cost: number;
  minOrderAmount: number;
  instructions: string | null;
};

export type CheckoutPaymentCapability = {
  id: Exclude<CheckoutPaymentMethodId, 'card'>;
  label: string;
};

export type CheckoutQuote = {
  currency: CheckoutCurrency;
  lineCount: number;
  totalQuantity: number;
  subtotal: string;
  shipping: string;
  tax: string;
  grandTotal: string;
  /** Opaque SHA-256 fingerprint of the public quote and canonical server cart. */
  fingerprint: string;
  empty: boolean;
};

export type CheckoutCapabilities = {
  deliveryMethods: CheckoutDeliveryCapability[];
  paymentMethods: CheckoutPaymentCapability[];
  promotions: {
    available: false;
    code: 'unavailable';
  };
  quote: CheckoutQuote;
};

export type CheckoutCapabilitiesResult =
  | {
      ok: true;
      capabilities: CheckoutCapabilities;
    }
  | {
      ok: false;
      error: CheckoutFailure;
    };

export type CheckoutSubmitResult =
  | {
      ok: true;
      confirmation: CheckoutConfirmation;
    }
  | {
      ok: false;
      error: CheckoutFailure;
    };

/**
 * Implementations should:
 * 1. fetch public capabilities and the authoritative quote from
 *    STOREFRONT_CHECKOUT_CAPABILITIES_ENDPOINT;
 * 2. synchronize canonical lines through the server cart API;
 * 3. re-fetch/reprice that server cart and require the quote fingerprint to
 *    match the accepted attempt;
 * 4. POST only CheckoutRequest to STOREFRONT_CHECKOUT_ENDPOINT with the
 *    idempotency key and the cart session cookie;
 * 5. return success only after the server has created a real order.
 */
export type CheckoutSubmitter = (
  submission: CheckoutSubmission,
) => Promise<CheckoutSubmitResult>;
