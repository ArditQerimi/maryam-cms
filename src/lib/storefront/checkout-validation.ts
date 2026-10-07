import type {
  CheckoutAddress,
  CheckoutDeliveryMethodId,
  CheckoutFieldErrors,
  CheckoutFieldName,
  CheckoutPaymentMethodId,
  CheckoutRequest,
} from '@/app/home/checkout/checkout-contract';

const ORDER_NOTES_MAX_LENGTH = 1000;
const CONTACT_KEYS = ['email', 'phone', 'marketingOptIn'] as const;
const BILLING_KEYS = ['sameAsShipping', 'address'] as const;
const DELIVERY_KEYS = ['methodId'] as const;
const PAYMENT_KEYS = ['methodId'] as const;
const TERMS_KEYS = ['accepted'] as const;
const REQUEST_KEYS = [
  'contact',
  'shippingAddress',
  'billing',
  'delivery',
  'payment',
  'promotionCode',
  'terms',
] as const;
const ADDRESS_KEYS = [
  'firstName',
  'lastName',
  'company',
  'address1',
  'address2',
  'country',
  'city',
  'region',
  'postalCode',
] as const satisfies readonly (keyof CheckoutAddress)[];

const DELIVERY_IDS = new Set<CheckoutDeliveryMethodId>(['standard', 'express']);
const PAYMENT_IDS = new Set<CheckoutPaymentMethodId>(['card', 'cash_on_delivery']);
const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const PHONE_PATTERN = /^\+?[0-9().\-\s]+$/;
const COUNTRY_PATTERN = /^[A-Za-z]{2}$/;
const POSTAL_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} .()-]*$/u;
const PROMOTION_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/;

export class CheckoutValidationError extends Error {
  readonly fieldErrors: CheckoutFieldErrors;

  constructor(message: string, fieldErrors: CheckoutFieldErrors = {}) {
    super(message);
    this.name = 'CheckoutValidationError';
    this.fieldErrors = fieldErrors;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  errors: CheckoutFieldErrors,
  field: CheckoutFieldName,
) {
  const allowedSet = new Set(allowed);
  if (Object.keys(value).some((key) => !allowedSet.has(key))) {
    errors[field] = 'This field contains unsupported data.';
    return false;
  }
  return true;
}

function readText(
  record: Record<string, unknown>,
  property: string,
  field: CheckoutFieldName,
  errors: CheckoutFieldErrors,
  options: { required: boolean; maximum: number; message: string },
) {
  const value = record[property];
  if (typeof value !== 'string') {
    if (options.required || value !== undefined) errors[field] = options.message;
    return options.required ? '' : '';
  }

  const normalized = value.trim();
  if (options.required && !normalized) {
    errors[field] = options.message;
    return '';
  }
  if (!options.required && !normalized) return '';
  if (normalized.length > options.maximum || UNSAFE_TEXT.test(normalized)) {
    errors[field] = options.message;
    return '';
  }
  return normalized;
}

function parseAddress(
  value: unknown,
  prefix: 'shippingAddress' | 'billingAddress',
  errors: CheckoutFieldErrors,
): CheckoutAddress {
  const result: CheckoutAddress = {
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
  if (!isRecord(value)) {
    errors[`${prefix}.address1`] = 'Enter a valid address.';
    return result;
  }

  hasExactKeys(value, ADDRESS_KEYS, errors, `${prefix}.address1`);
  const field = (key: keyof CheckoutAddress) => `${prefix}.${key}` as CheckoutFieldName;

  result.firstName = readText(value, 'firstName', field('firstName'), errors, {
    required: true,
    maximum: 100,
    message: 'Enter a valid first name.',
  });
  result.lastName = readText(value, 'lastName', field('lastName'), errors, {
    required: true,
    maximum: 100,
    message: 'Enter a valid last name.',
  });
  result.company = readText(value, 'company', field('company'), errors, {
    required: false,
    maximum: 100,
    message: 'Enter a valid company name.',
  });
  result.address1 = readText(value, 'address1', field('address1'), errors, {
    required: true,
    maximum: 200,
    message: 'Enter a valid street address.',
  });
  result.address2 = readText(value, 'address2', field('address2'), errors, {
    required: false,
    maximum: 200,
    message: 'Enter a valid address line.',
  });

  const country = readText(value, 'country', field('country'), errors, {
    required: true,
    maximum: 2,
    message: 'Select a valid country or region.',
  });
  if (country && !COUNTRY_PATTERN.test(country)) {
    errors[field('country')] = 'Select a valid country or region.';
  }
  result.country = country.toUpperCase();

  result.city = readText(value, 'city', field('city'), errors, {
    required: true,
    maximum: 100,
    message: 'Enter a valid city.',
  });
  // State / province is not asked at checkout (Kosovo, Albania and North Macedonia ship by postal code).
  result.region = readText(value, 'region', field('region'), errors, {
    required: false,
    maximum: 100,
    message: 'Enter a valid state or province.',
  });

  const postalCode = readText(value, 'postalCode', field('postalCode'), errors, {
    required: true,
    maximum: 24,
    message: 'Enter a valid postal code.',
  });
  if (postalCode && !POSTAL_PATTERN.test(postalCode)) {
    errors[field('postalCode')] = 'Enter a valid postal code.';
  }
  result.postalCode = postalCode;

  return result;
}

function addressesEqual(left: CheckoutAddress, right: CheckoutAddress) {
  return ADDRESS_KEYS.every((key) => left[key] === right[key]);
}

function parseContact(value: unknown, errors: CheckoutFieldErrors) {
  if (!isRecord(value)) {
    errors['contact.email'] = 'Enter a valid email address.';
    errors['contact.phone'] = 'Enter a valid phone number.';
    throw new CheckoutValidationError('Contact details are required.', errors);
  }

  hasExactKeys(value, CONTACT_KEYS, errors, 'contact.email');
  const email = readText(value, 'email', 'contact.email', errors, {
    required: true,
    maximum: 254,
    message: 'Enter a valid email address.',
  });
  let normalizedEmail = email;
  if (email) {
    const at = email.lastIndexOf('@');
    if (
      email.length > 254
      || !EMAIL_PATTERN.test(email)
      || email.includes('..')
      || email.slice(0, at).length > 64
    ) {
      errors['contact.email'] = 'Enter a valid email address.';
      normalizedEmail = '';
    } else {
      normalizedEmail = `${email.slice(0, at)}@${email.slice(at + 1).toLowerCase()}`;
    }
  }

  const phone = readText(value, 'phone', 'contact.phone', errors, {
    required: false,
    maximum: 32,
    message: 'Enter a valid phone number.',
  });
  if (phone) {
    const digitCount = phone.replace(/\D/g, '').length;
    if (!PHONE_PATTERN.test(phone) || digitCount < 5 || digitCount > 15) {
      errors['contact.phone'] = 'Enter a valid phone number.';
    }
  }

  if (value.marketingOptIn !== true && value.marketingOptIn !== false) {
    throw new CheckoutValidationError('Choose a valid marketing preference.', errors);
  }

  return {
    email: normalizedEmail,
    phone,
    marketingOptIn: value.marketingOptIn === true,
  };
}

function parseMethodId<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  field: CheckoutFieldName,
  errors: CheckoutFieldErrors,
) {
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    errors[field] = 'Choose an available option.';
    return null;
  }
  return value as T;
}

/**
 * Parse only the exact checkout request contract. Unknown properties are
 * rejected rather than ignored so browser totals, catalog data, purchaser IDs,
 * role/company IDs, and raw payment-instrument fields can never be submitted.
 */
export function parseCheckoutRequest(value: unknown): CheckoutRequest {
  if (!isRecord(value)) {
    throw new CheckoutValidationError('Request body must be a checkout object.');
  }

  const errors: CheckoutFieldErrors = {};
  if (Object.keys(value).some((key) => key !== 'orderNotes' && !(REQUEST_KEYS as readonly string[]).includes(key))) {
    throw new CheckoutValidationError('Request body contains unsupported fields.');
  }
  for (const key of REQUEST_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new CheckoutValidationError('Request body is missing required checkout fields.');
    }
  }

  const contact = parseContact(value.contact, errors);
  const shippingAddress = parseAddress(value.shippingAddress, 'shippingAddress', errors);

  let sameAsShipping = false;
  let billingAddress: CheckoutAddress = {
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
  if (!isRecord(value.billing)) {
    errors['billingAddress.address1'] = 'Enter a valid billing address.';
  } else {
    hasExactKeys(value.billing, BILLING_KEYS, errors, 'billingAddress.address1');
    if (typeof value.billing.sameAsShipping !== 'boolean') {
      errors['billingAddress.address1'] = 'Choose a valid billing address option.';
    } else {
      sameAsShipping = value.billing.sameAsShipping;
    }
    billingAddress = parseAddress(value.billing.address, 'billingAddress', errors);
    if (sameAsShipping && !errors['billingAddress.address1'] && !addressesEqual(
      shippingAddress,
      billingAddress,
    )) {
      errors['billingAddress.address1'] = 'Billing address must match the shipping address.';
    }
  }

  let deliveryMethodId: CheckoutDeliveryMethodId | null = null;
  if (!isRecord(value.delivery)) {
    errors['delivery.methodId'] = 'Choose an available delivery method.';
  } else {
    hasExactKeys(value.delivery, DELIVERY_KEYS, errors, 'delivery.methodId');
    deliveryMethodId = parseMethodId(
      value.delivery.methodId,
      DELIVERY_IDS,
      'delivery.methodId',
      errors,
    );
  }

  let paymentMethodId: CheckoutPaymentMethodId | null = null;
  if (!isRecord(value.payment)) {
    errors['payment.methodId'] = 'Choose an available payment method.';
  } else {
    hasExactKeys(value.payment, PAYMENT_KEYS, errors, 'payment.methodId');
    paymentMethodId = parseMethodId(
      value.payment.methodId,
      PAYMENT_IDS,
      'payment.methodId',
      errors,
    );
  }

  let promotionCode: string | null = null;
  if (value.promotionCode !== null) {
    if (typeof value.promotionCode !== 'string') {
      throw new CheckoutValidationError('Promotion code must be null or a valid code.');
    }
    promotionCode = value.promotionCode.trim().toUpperCase();
    if (!PROMOTION_PATTERN.test(promotionCode)) {
      throw new CheckoutValidationError('Promotion code must be null or a valid code.');
    }
  }

  let orderNotes = '';
  if (Object.prototype.hasOwnProperty.call(value, 'orderNotes')) {
    if (typeof value.orderNotes !== 'string' || value.orderNotes.length > ORDER_NOTES_MAX_LENGTH) {
      throw new CheckoutValidationError('Order notes must be text of at most 1000 characters.');
    }
    orderNotes = value.orderNotes.trim();
  }

  if (!isRecord(value.terms)) {
    errors['terms.accepted'] = 'Accept the terms before placing your order.';
  } else {
    hasExactKeys(value.terms, TERMS_KEYS, errors, 'terms.accepted');
    if (value.terms.accepted !== true) {
      errors['terms.accepted'] = 'Accept the terms before placing your order.';
    }
  }

  if (Object.keys(errors).length > 0 || !deliveryMethodId || !paymentMethodId) {
    throw new CheckoutValidationError('Check the highlighted checkout fields.', errors);
  }

  return {
    contact,
    shippingAddress,
    billing: { sameAsShipping, address: billingAddress },
    delivery: { methodId: deliveryMethodId },
    payment: { methodId: paymentMethodId },
    promotionCode,
    ...(orderNotes ? { orderNotes } : {}),
    terms: { accepted: true },
  };
}
