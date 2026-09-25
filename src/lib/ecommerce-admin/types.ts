export type StoreCurrency = 'EUR' | 'USD' | 'GBP' | 'CHF' | 'CAD' | 'AUD';

export type EcommerceDataResult<T> =
  | { status: 'available'; value: T }
  | { status: 'unavailable'; reason: string }
  | { status: 'unverified'; reason: string };

export type EcommerceScopeKind = 'company' | 'store' | 'unassigned';

export type EcommerceCapabilities = {
  inventoryView: boolean;
  inventoryManage: boolean;
  stockManage: boolean;
  salesView: boolean;
  salesManage: boolean;
  peopleView: boolean;
  promoView: boolean;
  promoManage: boolean;
  cmsView: boolean;
  cmsManage: boolean;
  settingsView: boolean;
  settingsManage: boolean;
};

export type EcommerceModuleId =
  | 'catalog'
  | 'orders'
  | 'customers'
  | 'marketing'
  | 'content'
  | 'storefront-settings'
  | 'storefront';

export type EcommerceModuleState =
  | 'ready'
  | 'attention'
  | 'setup'
  | 'unavailable'
  | 'unverified'
  | 'restricted';

export type EcommerceLink = {
  label: string;
  href: string;
};

export type EcommerceModuleCard = {
  id: EcommerceModuleId;
  title: string;
  description: string;
  state: EcommerceModuleState;
  detail: string;
  links: EcommerceLink[];
};

export type EcommerceReadinessItem = {
  id: string;
  title: string;
  state: EcommerceModuleState;
  detail: string;
};

export type CatalogSummary = {
  activeProducts: number;
  totalProducts: number;
  activeVariants: number | null;
  productsWithActiveVariants: number | null;
  outOfStockProducts: number | null;
};

export type RevenueSummary =
  | {
      status: 'available';
      amount: string;
      currency: StoreCurrency;
      orderCount: number;
    }
  | { status: 'unavailable'; reason: string }
  | { status: 'unverified'; reason: string };

export type OnlineOrderSummary = {
  id: number;
  reference: string;
  createdAt: string | null;
  status: 'Pending' | 'Completed' | 'Cancelled' | 'Returned' | 'Unknown';
  customerKind: 'registered' | 'guest' | 'unknown';
  itemUnits: number | null;
  total: string | null;
  currency: StoreCurrency | null;
};

export type OrdersSummary = {
  onlineOrderCount: number;
  recentOrders: OnlineOrderSummary[];
  revenue: RevenueSummary;
};

export type CustomersSummary = {
  total: number;
};

export type ContentSummary = {
  publishedPosts: number;
  draftPosts: number;
  totalPosts: number;
};

export type WebsiteSettingsSummary = {
  configured: boolean;
  updatedAt: string | null;
};

export type EcommerceControlCenterData = {
  viewer: {
    displayName: string;
    roleName: string;
    companyName: string;
    storeName: string | null;
    scopeKind: EcommerceScopeKind;
    scopeLabel: string;
  };
  capabilities: EcommerceCapabilities;
  catalog: EcommerceDataResult<CatalogSummary> | null;
  orders: EcommerceDataResult<OrdersSummary> | null;
  customers: EcommerceDataResult<CustomersSummary> | null;
  content: EcommerceDataResult<ContentSummary> | null;
  websiteSettings: EcommerceDataResult<WebsiteSettingsSummary> | null;
  modules: EcommerceModuleCard[];
  readiness: EcommerceReadinessItem[];
  quickActions: EcommerceLink[];
  generatedAt: string;
};
