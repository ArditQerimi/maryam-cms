export const STOREFRONT_SETTINGS_KEY = 'settings_ecommerce_storefront' as const;
export const STOREFRONT_SETTINGS_VERSION = 1 as const;

export const STOREFRONT_SETTINGS_MAX_CONFIG_BYTES = 16 * 1024;
export const STOREFRONT_SETTINGS_MAX_FORM_BYTES = 24 * 1024;
export const STOREFRONT_SETTINGS_MAX_TITLE_CHARS = 120;
export const STOREFRONT_SETTINGS_MAX_DESCRIPTION_CHARS = 320;
export const STOREFRONT_SETTINGS_MAX_SUPPORTING_TEXT_CHARS = 240;

export type EcommerceStorefrontMetadata = {
  title: string;
  description: string;
};

export type EcommerceStorefrontFooter = {
  supportingText: string;
  showPoweredBy: boolean;
};

/** V1 is intentionally presentation-only: it has no URL, tenant, or payment fields. */
export type EcommerceStorefrontConfig = {
  version: typeof STOREFRONT_SETTINGS_VERSION;
  metadata: EcommerceStorefrontMetadata;
  footer: EcommerceStorefrontFooter;
};

export type StorefrontSettingsField =
  | 'metadataTitle'
  | 'metadataDescription'
  | 'footerSupportingText'
  | 'footerShowPoweredBy'
  | 'expectedUpdatedAt';

export type StorefrontSettingsReadState =
  | {
      status: 'ready';
      config: EcommerceStorefrontConfig;
      updatedAt: string;
    }
  | {
      status: 'uninitialized';
      config: null;
      updatedAt: null;
      message: string;
    }
  | {
      status: 'invalid';
      config: null;
      updatedAt: string | null;
      code:
        | 'invalid-json'
        | 'unsupported-version'
        | 'invalid-config'
        | 'duplicate-row';
      message: string;
    }
  | {
      status: 'unavailable';
      config: null;
      updatedAt: null;
      code: 'schema-unavailable' | 'host-unavailable' | 'read-unavailable';
      message: string;
    };

export type PublicStorefrontPresentation =
  | {
      status: 'ready';
      config: EcommerceStorefrontConfig;
      updatedAt: string;
    }
  | {
      status: 'uninitialized' | 'invalid' | 'unavailable';
      config: null;
      updatedAt: string | null;
      code?: string;
    };

export type CompanyDisplayStatus = {
  displayName: string;
  subdomain: string;
  status: string;
};

export type CheckoutOperationalStatus = {
  state: 'configured' | 'unavailable';
  currency: string | null;
  allowedDeliveryMethodIds: string[];
  allowedPaymentMethodIds: string[];
  shippingCents: number | null;
  taxBasisPoints: number | null;
  card: 'unavailable';
  orderPlacement: 'disabled';
  uiAdapter: 'disconnected';
};

export type Migration003OperationalStatus = {
  state: 'unverified';
  ready: false;
  message: string;
};

export type StorefrontOperationalStatus = {
  company: CompanyDisplayStatus;
  checkout: CheckoutOperationalStatus;
  migration003: Migration003OperationalStatus;
  shipping: {
    state: 'configured' | 'unavailable';
    amountCents: number | null;
    verification: 'unverified';
  };
  legal: {
    state: 'platform-managed';
    verification: 'unverified';
  };
  media: {
    state: 'managed-by-platform';
    verification: 'unverified';
  };
};

export type StorefrontSettingsPageState = {
  readState: StorefrontSettingsReadState;
  canManage: boolean;
  operational: StorefrontOperationalStatus;
};

export type EcommerceStorefrontActionState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Partial<Record<StorefrontSettingsField, string>>;
  completion?: number;
};

export const STOREFRONT_SETTINGS_FORM_FIELDS = {
  metadataTitle: 'metadataTitle',
  metadataDescription: 'metadataDescription',
  footerSupportingText: 'footerSupportingText',
  footerShowPoweredBy: 'footerShowPoweredBy',
  expectedUpdatedAt: 'expectedUpdatedAt',
} as const satisfies Record<StorefrontSettingsField, string>;

export const STOREFRONT_SETTINGS_ROUTES_TO_REVALIDATE = [
  '/shop/products',
  '/shop/collections/[slug]',
  '/shop/blogs',
] as const;
