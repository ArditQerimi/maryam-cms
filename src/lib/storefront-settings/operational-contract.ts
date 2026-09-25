import type { CheckoutRuntimeConfig } from '@/lib/storefront/checkout-config';
import type {
  CheckoutOperationalStatus,
  CompanyDisplayStatus,
  StorefrontOperationalStatus,
} from './contracts';

export const STOREFRONT_MIGRATION_003_KEY = '003_storefront_checkout' as const;

export function projectCheckoutRuntimeConfig(
  config: Pick<CheckoutRuntimeConfig, 'currency' | 'deliveryMethodIds' | 'paymentMethodIds' | 'shippingCents' | 'taxBasisPoints'>,
): CheckoutOperationalStatus {
  return {
    state: 'configured',
    currency: config.currency,
    allowedDeliveryMethodIds: [...config.deliveryMethodIds].sort(),
    allowedPaymentMethodIds: [...config.paymentMethodIds].sort(),
    shippingCents: config.shippingCents,
    taxBasisPoints: config.taxBasisPoints,
    // These are deliberately fixed policy projections. A valid config cannot
    // add card support, and this settings surface cannot activate checkout.
    card: 'unavailable',
    orderPlacement: 'disabled',
    uiAdapter: 'disconnected',
  };
}

export function unavailableCheckoutOperationalStatus(): CheckoutOperationalStatus {
  return {
    state: 'unavailable',
    currency: null,
    allowedDeliveryMethodIds: [],
    allowedPaymentMethodIds: [],
    shippingCents: null,
    taxBasisPoints: null,
    card: 'unavailable',
    orderPlacement: 'disabled',
    uiAdapter: 'disconnected',
  };
}

export function buildStorefrontOperationalStatus(input: {
  company: CompanyDisplayStatus;
  checkout: CheckoutOperationalStatus;
}): StorefrontOperationalStatus {
  return {
    company: {
      displayName: input.company.displayName,
      subdomain: input.company.subdomain,
      status: input.company.status,
    },
    checkout: {
      state: input.checkout.state,
      currency: input.checkout.currency,
      allowedDeliveryMethodIds: [...input.checkout.allowedDeliveryMethodIds],
      allowedPaymentMethodIds: [...input.checkout.allowedPaymentMethodIds],
      shippingCents: input.checkout.shippingCents,
      taxBasisPoints: input.checkout.taxBasisPoints,
      card: 'unavailable',
      orderPlacement: 'disabled',
      uiAdapter: 'disconnected',
    },
    // The application never runs migrations and does not infer readiness from
    // source files. A reviewer must verify the tenant ledger and schema.
    migration003: {
      state: 'unverified',
      ready: false,
      message: 'Unverified — application startup does not run migration 003; checkout remains not-ready.',
    },
    shipping: {
      state: input.checkout.state === 'configured' ? 'configured' : 'unavailable',
      amountCents: input.checkout.shippingCents,
      verification: 'unverified',
    },
    legal: {
      state: 'platform-managed',
      verification: 'unverified',
    },
    media: {
      state: 'managed-by-platform',
      verification: 'unverified',
    },
  };
}
