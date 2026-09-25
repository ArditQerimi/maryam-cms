'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  Lock,
  PackageCheck,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { useCart, type CartItem } from '@/context/CartContext';
import { recordCheckoutShippingNote } from '@/app/cms/actions/shipping';
import {
  getCartPricing,
  getCheckoutTaxQuote,
  validateCartCoupon,
} from '@/app/shop/cart/actions';
import type { CartPricedLine, TaxQuote } from '@/app/shop/cart/pricing-types';
import {
  clearStoredCoupon,
  readStoredCoupon,
} from '@/lib/cart-coupon';
import AddressFields, {
  addressInputId,
  type AddressErrors,
  type AddressPrefix,
} from './AddressFields';
import OrderSummary from './OrderSummary';
import { SHIPPING_AVAILABLE_ENDPOINT } from './checkout-contract';
import type {
  CheckoutAddress,
  CheckoutConfirmation,
  CheckoutDeliveryMethodId,
  CheckoutFailure,
  CheckoutFieldErrors,
  CheckoutFieldName,
  CheckoutPaymentMethodId,
  CheckoutRequest,
  CheckoutShippingSelection,
  CheckoutSubmitResult,
  CheckoutSubmitter,
  ShippingMethodOption,
} from './checkout-contract';
import styles from './checkout.module.css';

const CHECKOUT_RETURN_TO = '/shop/checkout';
const LOGIN_HREF = `/shop/login?returnTo=${encodeURIComponent(CHECKOUT_RETURN_TO)}`;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DELIVERY_OPTIONS: ReadonlyArray<{
  id: CheckoutDeliveryMethodId;
  label: string;
  detail: string;
}> = [
  { id: 'standard', label: 'Standard delivery', detail: 'Availability is confirmed by the store server' },
];

const PAYMENT_OPTIONS: ReadonlyArray<{
  id: CheckoutPaymentMethodId;
  label: string;
  detail: string;
}> = [
  {
    id: 'cash_on_delivery',
    label: 'Cash on delivery',
    detail: 'Pay when the order is delivered',
  },
];

const EMPTY_ADDRESS: CheckoutAddress = {
  firstName: '',
  lastName: '',
  company: '',
  address1: '',
  address2: '',
  country: '',
  city: '',
  region: '',
  postalCode: '',
};

type CheckoutFormState = {
  contact: {
    email: string;
    phone: string;
    marketingOptIn: boolean;
  };
  shippingAddress: CheckoutAddress;
  billingSameAsShipping: boolean;
  billingAddress: CheckoutAddress;
  deliveryMethod: CheckoutDeliveryMethodId;
  paymentMethod: CheckoutPaymentMethodId;
  termsAccepted: boolean;
};

type SubmissionState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success'; confirmation: CheckoutConfirmation }
  | { status: 'failure'; error: CheckoutFailure };

export type CheckoutClientProps = {
  /**
   * Intentionally omitted by the current page. When the server endpoint exists,
   * pass an adapter that follows CheckoutSubmitter and returns only real results.
   */
  submitCheckout?: CheckoutSubmitter;
  /** Called only after the submit adapter confirms that the server created an order. */
  onCheckoutSuccess?: (confirmation: CheckoutConfirmation) => void;
};

const INITIAL_FORM: CheckoutFormState = {
  contact: {
    email: '',
    phone: '',
    marketingOptIn: false,
  },
  shippingAddress: { ...EMPTY_ADDRESS },
  billingSameAsShipping: true,
  billingAddress: { ...EMPTY_ADDRESS },
  deliveryMethod: 'standard',
  paymentMethod: 'cash_on_delivery',
  termsAccepted: false,
};

function controlClassName(hasError: boolean): string {
  return `${styles.control}${hasError ? ` ${styles.controlInvalid}` : ''}`;
}

function addressErrorFields(prefix: AddressPrefix, errors: CheckoutFieldErrors): AddressErrors {
  const result: AddressErrors = {};
  for (const key of Object.keys(EMPTY_ADDRESS) as Array<keyof CheckoutAddress>) {
    const message = errors[`${prefix}.${key}`];
    if (message) result[key] = message;
  }
  return result;
}

function fieldDomId(field: CheckoutFieldName): string {
  if (field === 'contact.email') return 'checkout-contact-email';
  if (field === 'contact.phone') return 'checkout-contact-phone';
  if (field === 'delivery.methodId') return 'checkout-delivery-standard';
  if (field === 'payment.methodId') return 'checkout-payment-cash_on_delivery';
  if (field === 'terms.accepted') return 'checkout-terms';

  if (field.startsWith('shippingAddress.')) {
    const key = field.slice('shippingAddress.'.length) as keyof CheckoutAddress;
    return addressInputId('shippingAddress', key);
  }

  const key = field.slice('billingAddress.'.length) as keyof CheckoutAddress;
  return addressInputId('billingAddress', key);
}

function focusCheckoutField(field: CheckoutFieldName): void {
  window.requestAnimationFrame(() => {
    document.getElementById(fieldDomId(field))?.focus();
  });
}

function focusSubmissionStatus(): void {
  window.requestAnimationFrame(() => {
    document.getElementById('checkout-submission-status')?.focus();
  });
}

function createIdempotencyKey(): string | null {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues !== 'function') return null;

  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getSafeConfirmationPath(value: string): string | null {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  try {
    const internalOrigin = 'https://store.invalid';
    const url = new URL(value, internalOrigin);
    if (url.origin !== internalOrigin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function requiredAddressErrors(
  address: CheckoutAddress,
  prefix: AddressPrefix,
): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  const requiredFields: Array<[keyof CheckoutAddress, string]> = [
    ['firstName', 'Enter a first name.'],
    ['lastName', 'Enter a last name.'],
    ['address1', 'Enter a street address.'],
    ['country', 'Select a country or region.'],
    ['city', 'Enter a city.'],
    ['region', 'Enter a state or province.'],
    ['postalCode', 'Enter a postal code.'],
  ];

  for (const [key, message] of requiredFields) {
    if (!address[key].trim()) {
      errors[`${prefix}.${key}`] = message;
    }
  }
  return errors;
}

function validateCheckoutForm(form: CheckoutFormState): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};

  if (!form.contact.email.trim()) {
    errors['contact.email'] = 'Enter an email address.';
  } else if (!EMAIL_PATTERN.test(form.contact.email.trim())) {
    errors['contact.email'] = 'Enter an email address in the format name@example.com.';
  }

  Object.assign(errors, requiredAddressErrors(form.shippingAddress, 'shippingAddress'));

  if (!form.billingSameAsShipping) {
    Object.assign(errors, requiredAddressErrors(form.billingAddress, 'billingAddress'));
  }

  if (!form.deliveryMethod) errors['delivery.methodId'] = 'Choose a delivery method.';
  if (!form.paymentMethod) errors['payment.methodId'] = 'Choose a payment method.';
  if (!form.termsAccepted) errors['terms.accepted'] = 'Accept the terms before placing your order.';

  return errors;
}

function checkoutRequestFrom(
  form: CheckoutFormState,
  promotionCode: string | null,
): CheckoutRequest {
  return {
    contact: {
      email: form.contact.email.trim(),
      phone: form.contact.phone.trim(),
      marketingOptIn: form.contact.marketingOptIn,
    },
    shippingAddress: { ...form.shippingAddress },
    billing: {
      sameAsShipping: form.billingSameAsShipping,
      address: form.billingSameAsShipping
        ? { ...form.shippingAddress }
        : { ...form.billingAddress },
    },
    delivery: { methodId: form.deliveryMethod },
    payment: { methodId: form.paymentMethod },
    promotionCode,
    terms: { accepted: true },
  };
}

function hasServerCheckoutIdentity(cart: readonly CartItem[]): boolean {
  return cart.length > 0 && cart.every((item) => (
    Number.isSafeInteger(item.productId)
    && Number(item.productId) > 0
    && Number.isSafeInteger(item.variantId)
    && Number(item.variantId) > 0
    && Number.isSafeInteger(item.quantity)
    && item.quantity >= 1
    && item.quantity <= 99
  ));
}

function deliveryOptionLabel(id: CheckoutDeliveryMethodId): string {
  return DELIVERY_OPTIONS.find((option) => option.id === id)?.label ?? 'Delivery';
}

const SHIPPING_TYPE_LABELS: Record<string, string> = {
  flat_rate: 'Flat Rate',
  free_shipping: 'Free Shipping',
  local_pickup: 'Local Pickup',
};

function formatShippingMoney(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function isShippingMethodOption(value: unknown): value is ShippingMethodOption {
  if (!value || typeof value !== 'object') return false;
  const option = value as ShippingMethodOption;
  return (
    typeof option.id === 'number'
    && typeof option.type === 'string'
    && typeof option.title === 'string'
    && typeof option.cost === 'string'
    && typeof option.minOrderAmount === 'string'
    && (option.instructions === null || typeof option.instructions === 'string')
  );
}

/** Validate the shipping quote payload; anything unexpected falls back safely. */
function readShippingMethods(payload: unknown): ShippingMethodOption[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const methods = (payload as { methods?: unknown }).methods;
  if (!Array.isArray(methods) || !methods.every(isShippingMethodOption)) return null;
  return methods;
}

function CheckoutSteps() {
  return (
    <ol className={styles.steps} aria-label="Checkout progress">
      <li className={styles.step}>
        <span className={styles.stepNumber}>1</span>
        <span className={styles.stepText}>
          <strong>Contact</strong>
          <small>Email details</small>
        </span>
      </li>
      <li className={styles.step}>
        <span className={styles.stepNumber}>2</span>
        <span className={styles.stepText}>
          <strong>Delivery</strong>
          <small>Address &amp; method</small>
        </span>
      </li>
      <li className={styles.step}>
        <span className={styles.stepNumber}>3</span>
        <span className={styles.stepText}>
          <strong>Payment</strong>
          <small>Review &amp; place</small>
        </span>
      </li>
    </ol>
  );
}

function LoadingState() {
  return (
    <div className={styles.loadingState} role="status" aria-live="polite" aria-busy="true">
      <LoaderCircle className={styles.spinner} size={24} aria-hidden="true" />
      <strong>Loading your checkout…</strong>
      <span>Reading the canonical cart saved in this browser.</span>
    </div>
  );
}

function EmptyCartState() {
  return (
    <section className={styles.emptyState} aria-labelledby="empty-checkout-title">
      <span className={styles.emptyIcon} aria-hidden="true">
        <ShoppingBag size={28} strokeWidth={1.6} />
      </span>
      <p className={styles.emptyEyebrow}>Nothing to check out</p>
      <h2 id="empty-checkout-title">Your cart is empty</h2>
      <p>
        Add a product before starting checkout. Your current cart has not been changed.
      </p>
      <div className={styles.emptyActions}>
        <Link className={styles.primaryLink} href="/shop/products">
          Browse products
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link className={styles.secondaryLink} href="/shop/cart">View cart</Link>
      </div>
    </section>
  );
}

function SuccessState({
  confirmation,
}: {
  confirmation: CheckoutConfirmation;
}) {
  const confirmationPath = getSafeConfirmationPath(confirmation.confirmationPath);

  return (
    <section
      className={styles.successState}
      aria-labelledby="checkout-success-title"
      aria-live="polite"
      role="status"
    >
      <span className={styles.successIcon} aria-hidden="true">
        <CheckCircle2 size={34} strokeWidth={1.7} />
      </span>
      <p className={styles.successEyebrow}>Server confirmed</p>
      <h2 id="checkout-success-title">Order placed</h2>
      <p className={styles.successLead}>
        A confirmation was recorded for order <strong>{confirmation.orderNumber}</strong>.
      </p>
      <dl className={styles.confirmationDetails}>
        <div>
          <dt>Confirmation email</dt>
          <dd>{confirmation.contactEmail}</dd>
        </div>
        <div>
          <dt>Order reference</dt>
          <dd>{confirmation.orderNumber}</dd>
        </div>
      </dl>
      <div className={styles.successActions}>
        {confirmationPath ? (
          <Link className={styles.primaryLink} href={confirmationPath}>
            View order
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : null}
        <Link className={styles.secondaryLink} href="/customer/orders">Order history</Link>
      </div>
    </section>
  );
}

/**
 * Shipping-aware totals continuation rendered directly below OrderSummary.
 * It reuses the checkout's existing summary CSS-module classes; OrderSummary
 * itself keeps its "display-only" server-quote wording untouched.
 *
 * All amounts arrive as integer cents computed from the same pricing rules the
 * server re-applies inside the order transaction.
 */
function ShippingTotalsBlock({
  subtotalCents,
  discountCents,
  shippingCents,
  taxCents,
  label,
}: {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  label: string;
}) {
  const safeShipping = Number.isFinite(shippingCents) && shippingCents > 0
    ? Math.round(shippingCents)
    : 0;
  const totalCents = Math.max(
    0,
    subtotalCents - discountCents + safeShipping + taxCents,
  );

  return (
    <div className={styles.summaryCard}>
      <dl className={styles.summaryTotals}>
        <div className={styles.summaryTotalRow}>
          <dt>Shipping{label ? ` · ${label}` : ''}</dt>
          <dd>{formatShippingMoney(safeShipping / 100)}</dd>
        </div>
        <div className={styles.summaryGrandTotal}>
          <dt>Order total</dt>
          <dd>{formatShippingMoney(totalCents / 100)}</dd>
        </div>
      </dl>
      <div className={styles.estimateNotice}>
        <span className={styles.estimateDot} aria-hidden="true" />
        <p>
          Subtotal after discounts, minus any promotion, plus shipping and tax.
          The server verifies the final amount, stock, and availability before
          the order is created.
        </p>
      </div>
    </div>
  );
}

export default function CheckoutClient({
  submitCheckout,
  onCheckoutSuccess,
}: CheckoutClientProps) {
  const {
    cart,
    subtotal,
    totalItems,
    isHydrated,
    isHydrating,
    error: cartError,
  } = useCart();
  const [form, setForm] = useState<CheckoutFormState>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [submission, setSubmission] = useState<SubmissionState>({ status: 'idle' });
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    abortControllerRef.current?.abort();
  }, []);

  /* Shipping methods quoted by the tenant's shipping zones for this address. */
  const [shippingOptions, setShippingOptions] = useState<ShippingMethodOption[]>([]);
  const [selectedShippingId, setSelectedShippingId] = useState<string>('');
  const [shippingLoading, setShippingLoading] = useState(false);

  /* Cart lines repriced by the server (product/category discounts applied). */
  const [pricing, setPricing] = useState<CartPricedLine[] | null>(null);
  const pricingSignature = cart
    .map((item) => `${String(item.productId)}:${String(item.variantId)}:${item.price}`)
    .join('|');

  useEffect(() => {
    if (!isHydrated || cart.length === 0) {
      setPricing(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const priced = await getCartPricing(
          cart.map((item) => ({
            productId: Number(item.productId),
            variantId: item.variantId === null ? null : Number(item.variantId),
            price: item.price,
          })),
        );
        if (cancelled) return;
        setPricing(priced.length === cart.length ? priced : null);
      } catch {
        if (!cancelled) setPricing(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `pricingSignature` captures every cart field that affects pricing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, pricingSignature]);

  const subtotalCents = pricing && pricing.length === cart.length
    ? cart.reduce(
        (total, item, index) =>
          total + Math.round(pricing[index].salePrice * 100) * item.quantity,
        0,
      )
    : Math.round((Number.isFinite(subtotal) ? subtotal : 0) * 100);

  /* The promotion code chosen in the cart, always re-checked server-side. */
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [appliedLabel, setAppliedLabel] = useState<string | null>(null);
  const [couponDiscountCents, setCouponDiscountCents] = useState(0);

  useEffect(() => {
    if (!isHydrated) return;
    const stored = readStoredCoupon();
    if (!stored) return;
    setAppliedCode(stored.code);
    setAppliedLabel(stored.label);
    // Only on hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  useEffect(() => {
    if (!isHydrated || !appliedCode) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await validateCartCoupon(appliedCode, subtotalCents);
        if (cancelled) return;
        if (!result.ok) {
          setAppliedCode(null);
          setAppliedLabel(null);
          setCouponDiscountCents(0);
          clearStoredCoupon();
          return;
        }
        setAppliedLabel(result.label);
        setCouponDiscountCents(result.discountCents);
      } catch {
        if (!cancelled) setCouponDiscountCents(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, appliedCode, subtotalCents]);

  const discountCents = Math.min(couponDiscountCents, subtotalCents);

  const destinationCountry = form.shippingAddress.country.trim();
  const destinationRegion = form.shippingAddress.region.trim();

  useEffect(() => {
    if (!destinationCountry) {
      setShippingOptions([]);
      setSelectedShippingId('');
      setShippingLoading(false);
      return;
    }

    const controller = new AbortController();
    setShippingLoading(true);
    // Debounced so typing a state/region does not spam the quote endpoint.
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({
        country: destinationCountry,
        state: destinationRegion,
        orderTotal: ((subtotalCents - discountCents) / 100).toFixed(2),
      });
      void (async () => {
        try {
          const response = await fetch(
            `${SHIPPING_AVAILABLE_ENDPOINT}?${query.toString()}`,
            { headers: { accept: 'application/json' }, signal: controller.signal },
          );
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const methods = readShippingMethods(await response.json());
          if (!methods) throw new Error('Unexpected shipping quote payload');
          setShippingOptions(methods);
          setSelectedShippingId((current) => {
            if (current && methods.some((option) => String(option.id) === current)) return current;
            return methods.length > 0 ? String(methods[0].id) : '';
          });
          setShippingLoading(false);
        } catch (error) {
          if (controller.signal.aborted) return;
          // Never break checkout: fall back to the built-in delivery option.
          setShippingOptions([]);
          setSelectedShippingId('');
          setShippingLoading(false);
        }
      })();
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [destinationCountry, destinationRegion, subtotalCents, discountCents]);

  const clearFieldError = (field: CheckoutFieldName) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const markFormChanged = () => {
    setSubmission((current) => current.status === 'pending' ? current : { status: 'idle' });
  };

  const updateContact = (field: 'email' | 'phone', value: string) => {
    setForm((current) => ({
      ...current,
      contact: { ...current.contact, [field]: value },
    }));
    clearFieldError(`contact.${field}`);
    markFormChanged();
  };

  const updateAddress = (prefix: AddressPrefix, key: keyof CheckoutAddress, value: string) => {
    setForm((current) => {
      const nextShippingAddress = prefix === 'shippingAddress'
        ? { ...current.shippingAddress, [key]: value }
        : current.shippingAddress;
      return {
        ...current,
        shippingAddress: nextShippingAddress,
        billingAddress: prefix === 'billingAddress'
          ? { ...current.billingAddress, [key]: value }
          : current.billingSameAsShipping
            ? { ...nextShippingAddress }
            : current.billingAddress,
      };
    });
    clearFieldError(`${prefix}.${key}`);
    markFormChanged();
  };

  const setBillingSameAsShipping = (checked: boolean) => {
    setForm((current) => ({
      ...current,
      billingSameAsShipping: checked,
      billingAddress: checked ? { ...current.shippingAddress } : current.billingAddress,
    }));
    if (checked) {
      setFieldErrors((current) => {
        const next = { ...current };
        for (const key of Object.keys(EMPTY_ADDRESS) as Array<keyof CheckoutAddress>) {
          delete next[`billingAddress.${key}`];
        }
        return next;
      });
    }
    markFormChanged();
  };

  const showFailure = (error: CheckoutFailure, errors: CheckoutFieldErrors = {}) => {
    setFieldErrors(errors);
    setSubmission({ status: 'failure', error });
    const firstError = Object.keys(errors)[0] as CheckoutFieldName | undefined;
    if (firstError) {
      focusCheckoutField(firstError);
    } else {
      focusSubmissionStatus();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submission.status === 'pending') return;

    const errors = validateCheckoutForm(form);
    if (Object.keys(errors).length > 0) {
      showFailure(
        {
          code: 'validation_failed',
          message: 'Check the highlighted fields before placing your order.',
          retryable: true,
        },
        errors,
      );
      return;
    }

    if (!submitCheckout) {
      showFailure({
        code: 'checkout_unavailable',
        message: 'Order placement is unavailable until secure server checkout is connected. No order or payment was created.',
        retryable: false,
      });
      return;
    }

    if (!hasServerCheckoutIdentity(cart)) {
      showFailure({
        code: 'cart_not_synchronized',
        message: 'This local cart must be synchronized with a variant-aware server cart before it can be checked out. No order was created.',
        retryable: false,
      });
      return;
    }

    const idempotencyKey = createIdempotencyKey();
    if (!idempotencyKey) {
      showFailure({
        code: 'secure_random_unavailable',
        message: 'This browser could not create a secure checkout request key. No order was created.',
        retryable: false,
      });
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setFieldErrors({});
    setSubmission({ status: 'pending' });

    const shippingSelection: CheckoutShippingSelection | null = selectedShippingOption
      ? {
          methodId: String(selectedShippingOption.id),
          title: selectedShippingOption.title,
          cost: shippingCostValue.toFixed(2),
        }
      : null;

    const submissionInput = {
      request: checkoutRequestFrom(form, appliedCode),
      cart: {
        lines: cart.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          ...(item.serverItemId === undefined ? {} : { serverItemId: item.serverItemId }),
        })),
      },
      ...(shippingSelection ? { shipping: shippingSelection } : {}),
      idempotencyKey,
      signal: controller.signal,
    };

    try {
      const result: CheckoutSubmitResult = await submitCheckout(submissionInput);
      if (controller.signal.aborted) return;

      if (result.ok) {
        // The CheckoutRequest contract is closed (no extra keys), so the chosen
        // shipping method is recorded as an order note once the server confirms
        // the order. Best effort — a note failure never fails the checkout.
        if (shippingSelection) {
          void recordCheckoutShippingNote(
            result.confirmation.orderId,
            shippingSelection.title,
            shippingSelection.cost,
          ).catch(() => undefined);
        }
        setSubmission({ status: 'success', confirmation: result.confirmation });
        onCheckoutSuccess?.(result.confirmation);
        return;
      }

      const serverErrors = result.error.fieldErrors ?? {};
      if (
        !form.billingSameAsShipping
        && Object.keys(serverErrors).some((field) => field.startsWith('billingAddress.'))
      ) {
        // A server-side billing correction must not point focus into disabled fields.
        setForm((current) => ({ ...current, billingSameAsShipping: false }));
      }
      showFailure(result.error, serverErrors);
    } catch (caughtError) {
      if (controller.signal.aborted || (caughtError instanceof DOMException && caughtError.name === 'AbortError')) {
        return;
      }
      showFailure({
        code: 'checkout_request_failed',
        message: 'We could not reach secure checkout. No order was created. Check your connection and try again.',
        retryable: true,
      });
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  };

  const errorEntries = Object.entries(fieldErrors) as Array<[CheckoutFieldName, string]>;
  const isPending = submission.status === 'pending';

  /* Shipping quote → radio options, totals, and the payload selection. */
  const selectedShippingOption =
    shippingOptions.find((option) => String(option.id) === selectedShippingId) ?? null;
  const rawShippingCost = selectedShippingOption ? Number(selectedShippingOption.cost) : 0;
  const shippingCostValue = Number.isFinite(rawShippingCost) && rawShippingCost > 0
    ? rawShippingCost
    : 0;
  const currentDeliveryLabel = selectedShippingOption
    ? selectedShippingOption.title
    : deliveryOptionLabel(form.deliveryMethod);

  const shippingCents = Math.round(shippingCostValue * 100);
  const destinationPostcode = form.shippingAddress.postalCode.trim();

  /* Tax for the address being typed, quoted with the server's own rules. */
  const [taxQuote, setTaxQuote] = useState<TaxQuote | null>(null);

  useEffect(() => {
    if (!isHydrated || !destinationCountry || cart.length === 0) {
      setTaxQuote(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const quote = await getCheckoutTaxQuote({
            country: destinationCountry,
            state: destinationRegion,
            postcode: destinationPostcode,
            subtotalCents,
            couponCents: discountCents,
            shippingCents,
          });
          if (controller.signal.aborted) return;
          setTaxQuote(quote);
        } catch {
          if (!controller.signal.aborted) setTaxQuote(null);
        }
      })();
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    isHydrated,
    cart.length,
    destinationCountry,
    destinationRegion,
    destinationPostcode,
    subtotalCents,
    discountCents,
    shippingCents,
  ]);

  const taxCents = taxQuote ? Math.max(0, taxQuote.amountCents) : 0;
  const promotion = appliedCode !== null
    ? { label: appliedLabel ?? appliedCode, discountCents }
    : null;

  const deliveryChoices: Array<{ key: string; label: string; detail: string; price: string }> =
    shippingOptions.length > 0
      ? shippingOptions.map((option) => ({
          key: String(option.id),
          label: option.title,
          detail:
            (option.instructions || '').trim()
            || SHIPPING_TYPE_LABELS[option.type]
            || option.type,
          price: formatShippingMoney(Number(option.cost)),
        }))
      : DELIVERY_OPTIONS.map((option) => ({
          key: option.id,
          label: option.label,
          detail: option.detail,
          price: shippingLoading ? 'Loading…' : 'Server quote',
        }));
  const selectedDeliveryKey = shippingOptions.length > 0 ? selectedShippingId : form.deliveryMethod;

  const billingErrors = addressErrorFields('billingAddress', fieldErrors);
  const shippingErrors = addressErrorFields('shippingAddress', fieldErrors);
  const showLoading = isHydrating || !isHydrated;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.container}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/shop">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/shop/cart">Cart</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Checkout</span>
          </nav>
          <div className={styles.titleRow}>
            <div>
              <p className={styles.eyebrow}>Storefront checkout</p>
              <h1 className={styles.title}>Checkout</h1>
              <p className={styles.subtitle}>
                Complete the details in one secure, reviewable flow.
              </p>
            </div>
            <span className={styles.serverPriceBadge}>
              <Lock size={14} aria-hidden="true" />
              Final price confirmed by server
            </span>
          </div>
          {submission.status !== 'success' ? <CheckoutSteps /> : null}
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          {submission.status === 'success' ? (
            <SuccessState confirmation={submission.confirmation} />
          ) : showLoading ? (
            <LoadingState />
          ) : cart.length === 0 ? (
            <EmptyCartState />
          ) : (
            <div className={styles.checkoutLayout}>
              <div className={styles.checkoutMain}>
                <details className={styles.mobileSummary}>
                  <summary className={styles.mobileSummarySummary}>
                    <span>
                      <small>Order summary</small>
                      <strong>{totalItems} {totalItems === 1 ? 'item' : 'items'}</strong>
                    </span>
                    <span className={styles.mobileSummaryAction}>
                      View
                      <ChevronDown size={16} aria-hidden="true" />
                    </span>
                  </summary>
                  <div className={styles.mobileSummaryBody}>
                    <OrderSummary
                      cart={cart}
                      deliveryLabel={currentDeliveryLabel}
                      headingId="mobile-order-summary-title"
                      itemCount={totalItems}
                      pricing={pricing}
                      promotion={promotion}
                      subtotalCents={subtotalCents}
                      taxQuote={taxQuote}
                    />
                    <ShippingTotalsBlock
                      label={currentDeliveryLabel}
                      discountCents={discountCents}
                      shippingCents={shippingCents}
                      subtotalCents={subtotalCents}
                      taxCents={taxCents}
                    />
                  </div>
                </details>

                {cartError ? (
                  <div className={styles.cartWarning} role="alert">
                    <AlertCircle size={18} aria-hidden="true" />
                    <div>
                      <strong>Your local cart needs attention</strong>
                      <p>{cartError}</p>
                    </div>
                  </div>
                ) : null}

                <form
                  aria-busy={isPending}
                  aria-labelledby="checkout-form-title"
                  className={styles.checkoutForm}
                  noValidate
                  onSubmit={handleSubmit}
                >
                  <h2 className={styles.visuallyHidden} id="checkout-form-title">Checkout details</h2>

                  {!submitCheckout ? (
                    <div className={styles.endpointNotice} id="checkout-availability-note">
                      <span className={styles.noticeIcon} aria-hidden="true">
                        <Lock size={18} />
                      </span>
                      <div>
                        <strong>Checkout preview — order placement is disabled</strong>
                        <p>
                          Secure checkout is not connected yet. No payment will be taken and
                          no order will be created from this page.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {isPending ? (
                    <div className={styles.pendingStatus} role="status" aria-live="polite">
                      <LoaderCircle className={styles.spinner} size={17} aria-hidden="true" />
                      Contacting secure checkout. Do not close this page…
                    </div>
                  ) : null}

                  {submission.status === 'failure' ? (
                    <div
                      className={styles.submissionError}
                      id="checkout-submission-status"
                      role="alert"
                      tabIndex={-1}
                    >
                      <AlertCircle size={20} aria-hidden="true" />
                      <div>
                        <strong>Checkout could not continue</strong>
                        <p>{submission.error.message}</p>
                        {!submission.error.retryable ? (
                          <small>No order or payment was created.</small>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {errorEntries.length > 0 ? (
                    <section className={styles.errorSummary} aria-labelledby="checkout-errors-title">
                      <h2 id="checkout-errors-title">Check {errorEntries.length === 1 ? 'this field' : `these ${errorEntries.length} fields`}</h2>
                      <ul>
                        {errorEntries.map(([field, message]) => (
                          <li key={field}>
                            <a href={`#${fieldDomId(field)}`}>{message}</a>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  <fieldset className={styles.formFields} disabled={isPending}>
                    <legend className={styles.visuallyHidden}>Contact, delivery, payment, and terms</legend>

                    <section className={styles.stepCard} aria-labelledby="checkout-contact-title">
                      <header className={styles.stepCardHeader}>
                        <span className={styles.cardStepNumber} aria-hidden="true">01</span>
                        <div>
                          <p>Contact</p>
                          <h2 id="checkout-contact-title">Where should we send your receipt?</h2>
                        </div>
                      </header>
                      <div className={styles.stepCardBody}>
                        <div className={styles.loginPrompt}>
                          <span>
                            <strong>Already have an account?</strong>
                            <small>Sign in to keep your checkout details with you.</small>
                          </span>
                          <Link href={LOGIN_HREF}>
                            Log in
                            <ArrowRight size={14} aria-hidden="true" />
                          </Link>
                        </div>

                        <div className={styles.fieldGrid}>
                          <div className={styles.field}>
                            <label className={styles.label} htmlFor="checkout-contact-email">
                              Email address
                              <span className={styles.requiredMark} aria-hidden="true">*</span>
                            </label>
                            <input
                              aria-describedby={fieldErrors['contact.email'] ? 'checkout-contact-email-error' : undefined}
                              aria-invalid={fieldErrors['contact.email'] ? true : undefined}
                              autoCapitalize="none"
                              autoComplete="email"
                              className={controlClassName(Boolean(fieldErrors['contact.email']))}
                              id="checkout-contact-email"
                              inputMode="email"
                              name="contact.email"
                              onChange={(event) => updateContact('email', event.target.value)}
                              placeholder="you@example.com"
                              required
                              spellCheck={false}
                              type="email"
                              value={form.contact.email}
                            />
                            {fieldErrors['contact.email'] ? (
                              <p className={styles.fieldError} id="checkout-contact-email-error">
                                {fieldErrors['contact.email']}
                              </p>
                            ) : null}
                          </div>

                          <div className={styles.field}>
                            <label className={styles.label} htmlFor="checkout-contact-phone">
                              Phone number
                              <span className={styles.optional}>For delivery questions</span>
                            </label>
                            <input
                              aria-describedby={fieldErrors['contact.phone'] ? 'checkout-contact-phone-error' : undefined}
                              aria-invalid={fieldErrors['contact.phone'] ? true : undefined}
                              autoComplete="tel"
                              className={controlClassName(Boolean(fieldErrors['contact.phone']))}
                              id="checkout-contact-phone"
                              inputMode="tel"
                              name="contact.phone"
                              onChange={(event) => updateContact('phone', event.target.value)}
                              type="tel"
                              value={form.contact.phone}
                            />
                            {fieldErrors['contact.phone'] ? (
                              <p className={styles.fieldError} id="checkout-contact-phone-error">
                                {fieldErrors['contact.phone']}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <label className={styles.checkboxRow}>
                          <input
                            checked={form.contact.marketingOptIn}
                            className={styles.checkbox}
                            name="contact.marketingOptIn"
                            onChange={(event) => {
                              setForm((current) => ({
                                ...current,
                                contact: {
                                  ...current.contact,
                                  marketingOptIn: event.target.checked,
                                },
                              }));
                              markFormChanged();
                            }}
                            type="checkbox"
                          />
                          <span>Email me about news and offers. Optional; you can unsubscribe anytime.</span>
                        </label>
                      </div>
                    </section>

                    <section className={styles.stepCard} aria-labelledby="checkout-delivery-title">
                      <header className={styles.stepCardHeader}>
                        <span className={styles.cardStepNumber} aria-hidden="true">02</span>
                        <div>
                          <p>Delivery</p>
                          <h2 id="checkout-delivery-title">Where is your order going?</h2>
                        </div>
                      </header>
                      <div className={styles.stepCardBody}>
                        <h3 className={styles.subsectionTitle}>Shipping address</h3>
                        <AddressFields
                          disabled={isPending}
                          errors={shippingErrors}
                          onFieldChange={(key, value) => updateAddress('shippingAddress', key, value)}
                          prefix="shippingAddress"
                          value={form.shippingAddress}
                        />

                        <label className={`${styles.checkboxRow} ${styles.billingToggle}`}>
                          <input
                            checked={form.billingSameAsShipping}
                            className={styles.checkbox}
                            name="billing.sameAsShipping"
                            onChange={(event) => setBillingSameAsShipping(event.target.checked)}
                            type="checkbox"
                          />
                          <span>Use this address for billing</span>
                        </label>

                        <div className={styles.billingSection}>
                          <div className={styles.subsectionHeadingRow}>
                            <div>
                              <h3 className={styles.subsectionTitle}>Billing address</h3>
                              <p>
                                {form.billingSameAsShipping
                                  ? 'Currently matching your shipping address.'
                                  : 'Enter a separate address for billing.'}
                              </p>
                            </div>
                          </div>
                          <AddressFields
                            disabled={isPending || form.billingSameAsShipping}
                            errors={billingErrors}
                            onFieldChange={(key, value) => updateAddress('billingAddress', key, value)}
                            prefix="billingAddress"
                            value={form.billingSameAsShipping ? form.shippingAddress : form.billingAddress}
                          />
                        </div>

                        <div className={styles.subsectionHeadingRow}>
                          <div>
                            <h3 className={styles.subsectionTitle}>Delivery method</h3>
                            <p>
                              Shipping methods are loaded for your address from the store&apos;s
                              shipping zones.
                            </p>
                          </div>
                        </div>
                        <div className={styles.choiceList} role="radiogroup" aria-labelledby="delivery-method-label">
                          <span className={styles.visuallyHidden} id="delivery-method-label">Choose a delivery method</span>
                          {deliveryChoices.map((option) => (
                            <label className={styles.choiceCard} key={option.key}>
                              <input
                                checked={selectedDeliveryKey === option.key}
                                className={styles.radio}
                                id={`checkout-delivery-${option.key}`}
                                name="delivery.methodId"
                                onChange={() => {
                                  if (shippingOptions.length > 0) {
                                    setSelectedShippingId(option.key);
                                  } else {
                                    setForm((current) => ({
                                      ...current,
                                      deliveryMethod: option.key as CheckoutDeliveryMethodId,
                                    }));
                                  }
                                  clearFieldError('delivery.methodId');
                                  markFormChanged();
                                }}
                                type="radio"
                                value={option.key}
                              />
                              <span className={styles.choiceIcon} aria-hidden="true"><Truck size={20} /></span>
                              <span className={styles.choiceCopy}>
                                <strong>{option.label}</strong>
                                <small>{option.detail}</small>
                              </span>
                              <span className={styles.choicePrice}>{option.price}</span>
                            </label>
                          ))}
                        </div>
                        {fieldErrors['delivery.methodId'] ? (
                          <p className={styles.fieldError}>{fieldErrors['delivery.methodId']}</p>
                        ) : null}
                      </div>
                    </section>

                    <section className={styles.stepCard} aria-labelledby="checkout-payment-title">
                      <header className={styles.stepCardHeader}>
                        <span className={styles.cardStepNumber} aria-hidden="true">03</span>
                        <div>
                          <p>Payment</p>
                          <h2 id="checkout-payment-title">Choose how to pay</h2>
                        </div>
                      </header>
                      <div className={styles.stepCardBody}>
                        <div className={styles.choiceList} role="radiogroup" aria-labelledby="payment-method-label">
                          <span className={styles.visuallyHidden} id="payment-method-label">Choose a payment method</span>
                          {PAYMENT_OPTIONS.map((option) => (
                            <label className={styles.choiceCard} key={option.id}>
                              <input
                                checked={form.paymentMethod === option.id}
                                className={styles.radio}
                                id={`checkout-payment-${option.id}`}
                                name="payment.methodId"
                                onChange={() => {
                                  setForm((current) => ({ ...current, paymentMethod: option.id }));
                                  clearFieldError('payment.methodId');
                                  markFormChanged();
                                }}
                                type="radio"
                                value={option.id}
                              />
                              <span className={styles.choiceIcon} aria-hidden="true"><Banknote size={20} /></span>
                              <span className={styles.choiceCopy}>
                                <strong>{option.label}</strong>
                                <small>{option.detail}</small>
                              </span>
                              <span className={styles.serverBadge}>Server confirmed</span>
                            </label>
                          ))}
                        </div>
                        {fieldErrors['payment.methodId'] ? (
                          <p className={styles.fieldError}>{fieldErrors['payment.methodId']}</p>
                        ) : null}

                        <div className={styles.paymentSafetyNote}>
                          <Lock size={17} aria-hidden="true" />
                          <p>
                            Card payment is not enabled. This checkout never collects card
                            numbers; a future payment method must use secure provider-hosted fields.
                          </p>
                        </div>


                        <div className={styles.termsBox}>
                          <label className={styles.checkboxRow}>
                            <input
                              aria-describedby={fieldErrors['terms.accepted'] ? 'checkout-terms-error' : undefined}
                              aria-invalid={fieldErrors['terms.accepted'] ? true : undefined}
                              checked={form.termsAccepted}
                              className={styles.checkbox}
                              id="checkout-terms"
                              name="terms.accepted"
                              onChange={(event) => {
                                setForm((current) => ({
                                  ...current,
                                  termsAccepted: event.target.checked,
                                }));
                                clearFieldError('terms.accepted');
                                markFormChanged();
                              }}
                              type="checkbox"
                            />
                            <span>
                              I agree to the{' '}
                              <Link href="/shop/terms-conditions" target="_blank" rel="noreferrer">Terms of Service</Link>
                              {' '}and acknowledge the{' '}
                              <Link href="/shop/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</Link>.
                              <span className={styles.requiredMark} aria-hidden="true">*</span>
                            </span>
                          </label>
                          {fieldErrors['terms.accepted'] ? (
                            <p className={styles.fieldError} id="checkout-terms-error">
                              {fieldErrors['terms.accepted']}
                            </p>
                          ) : null}
                        </div>

                        <div className={styles.submitArea}>
                          <button
                            aria-describedby="checkout-submit-help"
                            className={styles.placeOrderButton}
                            disabled={!submitCheckout || isPending}
                            type="submit"
                          >
                            {isPending ? (
                              <LoaderCircle className={styles.spinner} size={18} aria-hidden="true" />
                            ) : submitCheckout ? (
                              <PackageCheck size={18} aria-hidden="true" />
                            ) : (
                              <Lock size={18} aria-hidden="true" />
                            )}
                            <span>
                              {isPending
                                ? 'Placing order…'
                                : submitCheckout && submission.status === 'failure' && submission.error.retryable
                                  ? 'Try place order again'
                                  : 'Place order'}
                            </span>
                          </button>
                          <p id="checkout-submit-help">
                            {submitCheckout
                              ? 'The server must confirm the complete total before an order is created.'
                              : 'Disabled until POST /api/storefront/checkout is securely implemented.'}
                          </p>
                        </div>
                      </div>
                    </section>
                  </fieldset>
                </form>
              </div>

              <aside className={styles.desktopSummary} aria-label="Order summary">
                <OrderSummary
                  cart={cart}
                  deliveryLabel={currentDeliveryLabel}
                  headingId="desktop-order-summary-title"
                  itemCount={totalItems}
                  pricing={pricing}
                  promotion={promotion}
                  subtotalCents={subtotalCents}
                  taxQuote={taxQuote}
                />
                <ShippingTotalsBlock
                  label={currentDeliveryLabel}
                  discountCents={discountCents}
                  shippingCents={shippingCents}
                  subtotalCents={subtotalCents}
                  taxCents={taxCents}
                />
              </aside>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
