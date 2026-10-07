'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Lock,
  PackageCheck,
  ShoppingBag,
} from 'lucide-react';
import { useCart, type CartItem } from '@/context/CartContext';
import { useLocale, type Translator } from '@/lib/i18n/LocaleProvider';
import { recordCheckoutShippingNote } from '@/app/cms/actions/shipping';
import {
  getCartPricing,
  getCheckoutTaxQuote,
  validateCartCoupon,
} from '@/app/home/cart/actions';
import type { CartPricedLine, TaxQuote } from '@/app/home/cart/pricing-types';
import {
  clearStoredCoupon,
  readStoredCoupon,
  writeStoredCoupon,
} from '@/lib/cart-coupon';
import AddressFields, {
  addressInputId,
  type AddressErrors,
  type AddressPrefix,
} from './AddressFields';
import { TextAreaField, TextField } from '../components/FormField';
import ShopPageHeader from '../components/ShopPageHeader';
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DELIVERY_OPTIONS: ReadonlyArray<{
  id: CheckoutDeliveryMethodId;
  label: Parameters<Translator>[0];
  detail: Parameters<Translator>[0];
}> = [
  {
    id: 'standard',
    label: 'checkout.delivery.standard.label',
    detail: 'checkout.delivery.standard.detail',
  },
];

const PAYMENT_OPTIONS: ReadonlyArray<{
  id: CheckoutPaymentMethodId;
  label: Parameters<Translator>[0];
  detail: Parameters<Translator>[0];
}> = [
  {
    id: 'cash_on_delivery',
    label: 'checkout.payment.cashOnDelivery.label',
    detail: 'checkout.payment.cashOnDelivery.detail',
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
  orderNotes: string;
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
  orderNotes: '',
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
  t: Translator,
): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  const requiredFields: Array<[keyof CheckoutAddress, Parameters<Translator>[0]]> = [
    ['firstName', 'checkout.validation.firstName'],
    ['lastName', 'checkout.validation.lastName'],
    ['address1', 'checkout.validation.address1'],
    ['country', 'checkout.validation.country'],
    ['city', 'checkout.validation.city'],
    ['postalCode', 'checkout.validation.postalCode'],
  ];

  for (const [key, messageKey] of requiredFields) {
    if (!address[key].trim()) {
      errors[`${prefix}.${key}`] = t(messageKey);
    }
  }
  return errors;
}

function validateCheckoutForm(form: CheckoutFormState, t: Translator): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};

  if (!form.contact.email.trim()) {
    errors['contact.email'] = t('checkout.validation.emailRequired');
  } else if (!EMAIL_PATTERN.test(form.contact.email.trim())) {
    errors['contact.email'] = t('checkout.validation.emailFormat');
  }

  Object.assign(errors, requiredAddressErrors(form.shippingAddress, 'shippingAddress', t));

  if (!form.billingSameAsShipping) {
    Object.assign(errors, requiredAddressErrors(form.billingAddress, 'billingAddress', t));
  }

  if (!form.deliveryMethod) errors['delivery.methodId'] = t('checkout.validation.delivery');
  if (!form.paymentMethod) errors['payment.methodId'] = t('checkout.validation.payment');
  if (!form.termsAccepted) errors['terms.accepted'] = t('checkout.validation.terms');

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
    ...(form.orderNotes.trim() ? { orderNotes: form.orderNotes.trim() } : {}),
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

function deliveryOptionLabel(id: CheckoutDeliveryMethodId, t: Translator): string {
  const option = DELIVERY_OPTIONS.find((entry) => entry.id === id);
  return t(option ? option.label : 'checkout.delivery.fallbackLabel');
}

const SHIPPING_TYPE_LABELS: Record<string, Parameters<Translator>[0]> = {
  flat_rate: 'checkout.shippingType.flat_rate',
  free_shipping: 'checkout.shippingType.free_shipping',
  local_pickup: 'checkout.shippingType.local_pickup',
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

function LoadingState() {
  const { t } = useLocale();

  return (
    <div className={styles.loadingState} role="status" aria-live="polite" aria-busy="true">
      <LoaderCircle className={styles.spinner} size={24} aria-hidden="true" />
      <strong>{t('checkout.loading.title')}</strong>
      <span>{t('checkout.loading.text')}</span>
    </div>
  );
}

function EmptyCartState() {
  const { t } = useLocale();

  return (
    <section className={styles.emptyState} aria-labelledby="empty-checkout-title">
      <span className={styles.emptyIcon} aria-hidden="true">
        <ShoppingBag size={28} strokeWidth={1.6} />
      </span>
      <p className={styles.emptyEyebrow}>{t('checkout.empty.eyebrow')}</p>
      <h2 id="empty-checkout-title">{t('checkout.empty.title')}</h2>
      <p>{t('checkout.empty.copy')}</p>
      <div className={styles.emptyActions}>
        <Link className={styles.primaryLink} href="/home/products">
          {t('checkout.empty.browse')}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link className={styles.secondaryLink} href="/home/cart">
          {t('checkout.empty.viewCart')}
        </Link>
      </div>
    </section>
  );
}

function SuccessState({
  confirmation,
}: {
  confirmation: CheckoutConfirmation;
}) {
  const { t } = useLocale();
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
      <p className={styles.successEyebrow}>{t('checkout.success.eyebrow')}</p>
      <h2 id="checkout-success-title">{t('checkout.success.title')}</h2>
      <p className={styles.successLead}>
        {t('checkout.success.leadPrefix')}
        <strong>{confirmation.orderNumber}</strong>
        {t('checkout.success.leadSuffix')}
      </p>
      <dl className={styles.confirmationDetails}>
        <div>
          <dt>{t('checkout.success.email')}</dt>
          <dd>{confirmation.contactEmail}</dd>
        </div>
        <div>
          <dt>{t('checkout.success.reference')}</dt>
          <dd>{confirmation.orderNumber}</dd>
        </div>
      </dl>
      <div className={styles.successActions}>
        {confirmationPath ? (
          <Link className={styles.primaryLink} href={confirmationPath}>
            {t('checkout.success.viewOrder')}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : null}
        <Link className={styles.secondaryLink} href="/home/account/orders">
          {t('checkout.success.history')}
        </Link>
      </div>
    </section>
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
  const { t } = useLocale();
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

  /* Inline "Have a coupon?" prompt inside the order card. */
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);

  const applyCoupon = async () => {
    const code = couponInput.trim();
    try {
      const result = await validateCartCoupon(code, subtotalCents);
      if (!result.ok) {
        setCouponError(result.message);
        return;
      }
      writeStoredCoupon({ code, label: result.label });
      setAppliedCode(code);
      setAppliedLabel(result.label);
      setCouponDiscountCents(result.discountCents);
      setCouponOpen(false);
      setCouponInput('');
      setCouponError(null);
    } catch {
      setCouponError('Coupons are temporarily unavailable. Try again.');
    }
  };

  const removeCoupon = () => {
    clearStoredCoupon();
    setAppliedCode(null);
    setAppliedLabel(null);
    setCouponDiscountCents(0);
    setCouponOpen(false);
    setCouponInput('');
    setCouponError(null);
  };

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

    const errors = validateCheckoutForm(form, t);
    if (Object.keys(errors).length > 0) {
      showFailure(
        {
          code: 'validation_failed',
          message: t('checkout.failure.validation'),
          retryable: true,
        },
        errors,
      );
      return;
    }

    if (!submitCheckout) {
      showFailure({
        code: 'checkout_unavailable',
        message: t('checkout.failure.unavailable'),
        retryable: false,
      });
      return;
    }

    if (!hasServerCheckoutIdentity(cart)) {
      showFailure({
        code: 'cart_not_synchronized',
        message: t('checkout.failure.cartNotSynced'),
        retryable: false,
      });
      return;
    }

    const idempotencyKey = createIdempotencyKey();
    if (!idempotencyKey) {
      showFailure({
        code: 'secure_random_unavailable',
        message: t('checkout.failure.noRandom'),
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
        message: t('checkout.failure.requestFailed'),
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
    : deliveryOptionLabel(form.deliveryMethod, t);

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
            || t(SHIPPING_TYPE_LABELS[option.type])
            || option.type,
          price: formatShippingMoney(Number(option.cost)),
        }))
      : DELIVERY_OPTIONS.map((option) => ({
          key: option.id,
          label: t(option.label),
          detail: t(option.detail),
          price: shippingLoading ? t('checkout.delivery.loading') : t('checkout.delivery.serverQuote'),
        }));
  const selectedDeliveryKey = shippingOptions.length > 0 ? selectedShippingId : form.deliveryMethod;

  const shippingErrors = addressErrorFields('shippingAddress', fieldErrors);
  const showLoading = isHydrating || !isHydrated;

  return (
    <div className={styles.page}>
      <ShopPageHeader
        title={t('checkout.header.title')}
        crumbs={[{ label: t('checkout.crumb.checkout') }]}
      />

      <main className={styles.main}>
        <div className={styles.container}>
          {submission.status === 'success' ? (
            <SuccessState confirmation={submission.confirmation} />
          ) : showLoading ? (
            <LoadingState />
          ) : cart.length === 0 ? (
            <EmptyCartState />
          ) : (
            <form
              aria-busy={isPending}
              aria-labelledby="checkout-form-title"
              className={styles.checkoutForm}
              noValidate
              onSubmit={handleSubmit}
            >
              <h2 className={styles.visuallyHidden} id="checkout-form-title">{t('checkout.form.title')}</h2>

              <fieldset className={styles.formFields} disabled={isPending}>
                <legend className={styles.visuallyHidden}>{t('checkout.form.legend')}</legend>

                {!submitCheckout ? (
                  <div className={styles.endpointNotice} id="checkout-availability-note">
                    <span className={styles.noticeIcon} aria-hidden="true">
                      <Lock size={18} />
                    </span>
                    <div>
                      <strong>{t('checkout.preview.noticeTitle')}</strong>
                      <p>{t('checkout.preview.noticeCopy')}</p>
                    </div>
                  </div>
                ) : null}

                {isPending ? (
                  <div className={styles.pendingStatus} role="status" aria-live="polite">
                    <LoaderCircle className={styles.spinner} size={17} aria-hidden="true" />
                    {t('checkout.pending')}
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
                      <strong>{t('checkout.failure.title')}</strong>
                      <p>{submission.error.message}</p>
                      {!submission.error.retryable ? (
                        <small>{t('checkout.failure.noOrder')}</small>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {errorEntries.length > 0 ? (
                  <section className={styles.errorSummary} aria-labelledby="checkout-errors-title">
                    <h2 id="checkout-errors-title">
                      {errorEntries.length === 1
                        ? t('checkout.errors.one')
                        : t('checkout.errors.many', { count: errorEntries.length })}
                    </h2>
                    <ul>
                      {errorEntries.map(([field, message]) => (
                        <li key={field}>
                          <a href={`#${fieldDomId(field)}`}>{message}</a>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <div className={styles.checkoutLayout}>
                  <div className={styles.checkoutMain}>
                    {cartError ? (
                      <div className={styles.cartWarning} role="alert">
                        <AlertCircle size={18} aria-hidden="true" />
                        <div>
                          <strong>{t('checkout.cartWarning.title')}</strong>
                          <p>{cartError}</p>
                        </div>
                      </div>
                    ) : null}

                    <section className={styles.billingCard} aria-labelledby="checkout-billing-title">
                      <header className={styles.billingCardHeader}>
                        <h2 id="checkout-billing-title">{t('checkout.billing.cardTitle')}</h2>
                      </header>
                      <div className={styles.billingCardBody}>
                        <AddressFields
                          disabled={isPending}
                          errors={shippingErrors}
                          onFieldChange={(key, value) => updateAddress('shippingAddress', key, value)}
                          prefix="shippingAddress"
                          value={form.shippingAddress}
                        />

                        <div className={styles.fieldGrid}>
                          <TextField
                            id="checkout-contact-phone"
                            name="contact.phone"
                            label={t('checkout.contact.phone')}
                            className={styles.fieldWide}
                            error={fieldErrors['contact.phone']}
                            autoComplete="tel"
                            inputMode="tel"
                            type="tel"
                            value={form.contact.phone}
                            onChange={(event) => updateContact('phone', event.target.value)}
                          />
                          <TextField
                            id="checkout-contact-email"
                            name="contact.email"
                            label={t('checkout.contact.email')}
                            required
                            className={styles.fieldWide}
                            error={fieldErrors['contact.email']}
                            autoCapitalize="none"
                            autoComplete="email"
                            inputMode="email"
                            placeholder="you@example.com"
                            spellCheck={false}
                            type="email"
                            value={form.contact.email}
                            onChange={(event) => updateContact('email', event.target.value)}
                          />
                        </div>

                        {/* Billing = delivery address: no separate billing form. */}

                        <TextAreaField
                          id="checkout-order-notes"
                          name="orderNotes"
                          label={t('checkout.notes.label')}
                          suffix={t('checkout.address.optional')}
                          placeholder={t('checkout.notes.placeholder')}
                          maxLength={1000}
                          rows={1}
                          value={form.orderNotes}
                          onChange={(event) => {
                            setForm((current) => ({ ...current, orderNotes: event.target.value }));
                            markFormChanged();
                          }}
                        />
                      </div>
                    </section>

                  </div>

                  <aside className={styles.desktopSummary} aria-label={t('checkout.summary.aria')}>
                    <section className={styles.orderCard}>
                      <OrderSummary
                        headingId="desktop-order-summary-title"
                        cart={cart}
                        itemCount={totalItems}
                        pricing={pricing}
                      />

                      <div className={styles.couponRow}>
                        {appliedCode ? (
                          <div className={styles.couponApplied}>
                            <span className={styles.couponAppliedCode}>{appliedLabel ?? appliedCode}</span>
                            <button type="button" className={styles.couponRemove} onClick={removeCoupon}>
                              {t('checkout.coupon.remove')}
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={styles.couponPrompt}
                              aria-expanded={couponOpen}
                              onClick={() => setCouponOpen((current) => !current)}
                            >
                              {t('checkout.coupon.prompt')} <span>{t('checkout.coupon.enter')}</span>
                            </button>
                            {couponOpen ? (
                              <div className={styles.promoControls}>
                                <input
                                  aria-label={t('checkout.coupon.codeLabel')}
                                  autoComplete="off"
                                  className={styles.control}
                                  id="checkout-coupon-code"
                                  placeholder={t('checkout.coupon.codeLabel')}
                                  spellCheck={false}
                                  value={couponInput}
                                  onChange={(event) => {
                                    setCouponInput(event.target.value);
                                    setCouponError(null);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault();
                                      void applyCoupon();
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  className={styles.promoButton}
                                  onClick={() => void applyCoupon()}
                                >
                                  {t('checkout.coupon.apply')}
                                </button>
                              </div>
                            ) : null}
                            {couponError ? (
                              <p className={styles.fieldError} role="alert">{couponError}</p>
                            ) : null}
                          </>
                        )}
                      </div>

                      <dl className={styles.orderTotals}>
                        <div className={styles.orderTotalRow}>
                          <dt>{t('checkout.order.subtotal')}</dt>
                          <dd>{formatShippingMoney(subtotalCents / 100)}</dd>
                        </div>
                        {promotion ? (
                          <div className={styles.orderTotalRow}>
                            <dt>{t('checkout.summary.promotion')}</dt>
                            <dd>{`${promotion.label} - ${formatShippingMoney(promotion.discountCents / 100)}`}</dd>
                          </div>
                        ) : null}
                        <div className={styles.orderTotalRow}>
                          <dt>{t('checkout.totals.shipping')}</dt>
                          <dd>
                            {deliveryChoices.length > 0 ? (
                              <span className={styles.shippingChoices} role="radiogroup" aria-label={t('checkout.delivery.choose')}>
                                {deliveryChoices.map((option) => (
                                  <label className={styles.shippingChoice} key={option.key}>
                                    <input
                                      checked={selectedDeliveryKey === option.key}
                                      className={deliveryChoices.length === 1 ? styles.visuallyHidden : styles.radio}
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
                                    <span>{option.label}{option.price ? `: ${option.price}` : ''}</span>
                                  </label>
                                ))}
                              </span>
                            ) : (
                              formatShippingMoney(shippingCents / 100)
                            )}
                            {fieldErrors['delivery.methodId'] ? (
                              <span className={styles.fieldError}>{fieldErrors['delivery.methodId']}</span>
                            ) : null}
                          </dd>
                        </div>
                        {taxQuote ? (
                          <div className={styles.orderTotalRow}>
                            <dt>{taxQuote.label}</dt>
                            <dd>{formatShippingMoney(taxCents / 100)}</dd>
                          </div>
                        ) : null}
                        <div className={`${styles.orderTotalRow} ${styles.orderTotalGrand}`}>
                          <dt>{t('checkout.order.total')}</dt>
                          <dd>{formatShippingMoney(Math.max(0, subtotalCents - discountCents + shippingCents + taxCents) / 100)}</dd>
                        </div>
                      </dl>
                    </section>

                    <section className={styles.paymentBox} aria-labelledby="checkout-payment-title">
                      <h2 className={styles.visuallyHidden} id="checkout-payment-title">
                        {t('checkout.payment.heading')}
                      </h2>

                      <div className={styles.paymentOptions} role="radiogroup" aria-labelledby="payment-method-label">
                        <span className={styles.visuallyHidden} id="payment-method-label">{t('checkout.payment.choose')}</span>
                        {PAYMENT_OPTIONS.map((option) => (
                          <label className={styles.paymentOption} key={option.id}>
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
                            <span className={styles.paymentOptionLabel}>{t(option.label)}</span>
                          </label>
                        ))}
                      </div>
                      {PAYMENT_OPTIONS.filter((option) => option.id === form.paymentMethod).map((option) => (
                        <p className={styles.paymentDetail} key={option.id}>{t(option.detail)}</p>
                      ))}
                      {fieldErrors['payment.methodId'] ? (
                        <p className={styles.fieldError}>{fieldErrors['payment.methodId']}</p>
                      ) : null}

                      <p className={styles.privacyNote}>
                        {t('checkout.payment.privacy')}{' '}
                        <Link href="/home/privacy-policy" target="_blank" rel="noreferrer">
                          {t('checkout.payment.privacyLink')}
                        </Link>
                      </p>

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
                            {t('checkout.terms.agree')}
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
                          aria-describedby={submitCheckout ? undefined : 'checkout-submit-help'}
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
                              ? t('checkout.submit.pending')
                              : submitCheckout && submission.status === 'failure' && submission.error.retryable
                                ? t('checkout.submit.retry')
                                : t('checkout.submit.place')}
                          </span>
                        </button>
                        {submitCheckout ? null : (
                          <p id="checkout-submit-help">{t('checkout.submit.helpDisabled')}</p>
                        )}
                      </div>
                    </section>
                  </aside>
                </div>
              </fieldset>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
