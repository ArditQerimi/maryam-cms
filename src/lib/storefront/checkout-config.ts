import type {
  CheckoutCurrency,
  CheckoutDeliveryMethodId,
  CheckoutPaymentMethodId,
} from '@/app/shop/checkout/checkout-contract';

const SUPPORTED_DELIVERY_IDS = new Set<CheckoutDeliveryMethodId>(['standard', 'express']);
const SUPPORTED_PAYMENT_IDS = new Set<CheckoutPaymentMethodId>(['cash_on_delivery']);
// Small reviewed allowlist. Every listed currency uses two minor units, matching
// the checkout money helpers and DECIMAL(12,2) sales columns.
export const SUPPORTED_CHECKOUT_CURRENCIES = new Set<CheckoutCurrency>([
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'CAD',
  'AUD',
]);
const MAX_SHIPPING_CENTS = 999_999_999_999;
const MAX_CONFIG_BYTES = 64 * 1024;
const TENANT_CONFIG_KEYS = [
  'enabled',
  'currency',
  'deliveryMethodIds',
  'paymentMethodIds',
  'shippingCents',
  'taxBasisPoints',
] as const;

export type CheckoutRuntimeConfig = {
  tenantSubdomain: string;
  currency: CheckoutCurrency;
  deliveryMethodIds: ReadonlySet<CheckoutDeliveryMethodId>;
  paymentMethodIds: ReadonlySet<CheckoutPaymentMethodId>;
  shippingCents: number;
  taxBasisPoints: number;
  orderAccessSecret: string;
};

export class CheckoutConfigurationError extends Error {
  constructor() {
    super('Storefront checkout is not safely configured.');
    this.name = 'CheckoutConfigurationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseList<T extends string>(value: unknown, allowed: ReadonlySet<T>) {
  if (
    !Array.isArray(value)
    || value.length === 0
    || value.some((item) => typeof item !== 'string')
  ) {
    throw new CheckoutConfigurationError();
  }
  const values = value as string[];
  if (
    new Set(values).size !== values.length
    || values.some((item) => !allowed.has(item as T))
  ) {
    throw new CheckoutConfigurationError();
  }
  return new Set(values) as Set<T>;
}

function parseIntegerSetting(value: unknown, minimum: number, maximum: number) {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < minimum
    || value > maximum
  ) {
    throw new CheckoutConfigurationError();
  }
  return value;
}

function parseCurrency(value: unknown) {
  if (
    typeof value !== 'string'
    || !/^[A-Z]{3}$/.test(value)
    || !SUPPORTED_CHECKOUT_CURRENCIES.has(value as CheckoutCurrency)
  ) {
    throw new CheckoutConfigurationError();
  }
  return value as CheckoutCurrency;
}

/**
 * Checkout is opt-in per exact server-resolved tenant and fails closed. The
 * browser cannot select a tenant or capability config. No delivery, payment,
 * tax, shipping, or capability secret is inferred when its setting is absent.
 */
export function loadCheckoutRuntimeConfig(
  env: Record<string, string | undefined> = process.env,
  tenantSubdomain: string,
): CheckoutRuntimeConfig {
  const secret = env.STOREFRONT_ORDER_ACCESS_SECRET || '';
  if (!tenantSubdomain || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new CheckoutConfigurationError();
  }

  const rawConfig = env.STOREFRONT_CHECKOUT_CONFIG_JSON || '';
  if (!rawConfig || Buffer.byteLength(rawConfig, 'utf8') > MAX_CONFIG_BYTES) {
    throw new CheckoutConfigurationError();
  }

  try {
    const parsed: unknown = JSON.parse(rawConfig);
    if (
      !isRecord(parsed)
      || !Object.prototype.hasOwnProperty.call(parsed, tenantSubdomain)
      || !isRecord(parsed[tenantSubdomain])
    ) {
      throw new CheckoutConfigurationError();
    }

    const tenantConfig = parsed[tenantSubdomain];
    const allowedKeys = new Set<string>(TENANT_CONFIG_KEYS);
    if (
      Object.keys(tenantConfig).length !== TENANT_CONFIG_KEYS.length
      || Object.keys(tenantConfig).some((key) => !allowedKeys.has(key))
      || tenantConfig.enabled !== true
    ) {
      throw new CheckoutConfigurationError();
    }

    return {
      tenantSubdomain,
      currency: parseCurrency(tenantConfig.currency),
      deliveryMethodIds: parseList<CheckoutDeliveryMethodId>(
        tenantConfig.deliveryMethodIds,
        SUPPORTED_DELIVERY_IDS,
      ),
      paymentMethodIds: parseList<CheckoutPaymentMethodId>(
        tenantConfig.paymentMethodIds,
        SUPPORTED_PAYMENT_IDS,
      ),
      shippingCents: parseIntegerSetting(
        tenantConfig.shippingCents,
        0,
        MAX_SHIPPING_CENTS,
      ),
      taxBasisPoints: parseIntegerSetting(
        tenantConfig.taxBasisPoints,
        0,
        10_000,
      ),
      orderAccessSecret: secret,
    };
  } catch {
    throw new CheckoutConfigurationError();
  }
}
