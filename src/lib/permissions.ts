export type PermissionDefinition = {
  key: string;
  label: string;
  description: string;
};

export type PermissionGroup = {
  id: string;
  label: string;
  permissions: PermissionDefinition[];
};

export type FeatureFlagsMap = Record<string, boolean>;

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    permissions: [
      { key: 'dashboard.view', label: 'View dashboard', description: 'Access the main dashboard and overview widgets.' },
    ],
  },
  {
    id: 'pos',
    label: 'POS',
    permissions: [
      { key: 'pos.use', label: 'Use POS', description: 'Open the POS workspace and complete transactions.' },
      { key: 'sales.view', label: 'View sales', description: 'Open sales lists, invoices, and POS sales history.' },
      { key: 'sales.manage', label: 'Manage sales', description: 'Create, edit, or delete sales and returns.' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    permissions: [
      { key: 'inventory.view', label: 'View inventory', description: 'Open products, categories, brands, and low-stock pages.' },
      { key: 'inventory.manage', label: 'Manage inventory', description: 'Create and edit products, categories, brands, units, and warranties.' },
      { key: 'stock.manage', label: 'Manage stock', description: 'Use stock management, transfer, and adjustment screens.' },
    ],
  },
  {
    id: 'purchases',
    label: 'Purchases',
    permissions: [
      { key: 'purchases.view', label: 'View purchases', description: 'Open purchase, purchase order, and return pages.' },
      { key: 'purchases.manage', label: 'Manage purchases', description: 'Create and update purchases and purchase returns.' },
    ],
  },
  {
    id: 'promo',
    label: 'Promo',
    permissions: [
      { key: 'promo.view', label: 'View promo tools', description: 'Open coupons, gift cards, and discount pages.' },
      { key: 'promo.manage', label: 'Manage promo tools', description: 'Create and edit coupons, gift cards, and discounts.' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance & Accounts',
    permissions: [
      { key: 'finance.view', label: 'View finance', description: 'Open finance, bank, and account reports.' },
      { key: 'finance.manage', label: 'Manage finance', description: 'Create and update expenses, income, transfers, and bank entries.' },
    ],
  },
  {
    id: 'people',
    label: 'People',
    permissions: [
      { key: 'people.view', label: 'View people', description: 'Open customers, suppliers, stores, warehouses, and users.' },
      { key: 'people.manage', label: 'Manage people', description: 'Create and update customers, suppliers, stores, and warehouses.' },
    ],
  },
  {
    id: 'hrm',
    label: 'HRM',
    permissions: [
      { key: 'hrm.view', label: 'View HRM', description: 'Open employee, attendance, leave, holiday, and payroll pages.' },
      { key: 'hrm.manage', label: 'Manage HRM', description: 'Create and update HR modules like employees, departments, and payroll.' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    permissions: [
      { key: 'reports.view', label: 'View reports', description: 'Access sales, inventory, finance, and annual reports.' },
    ],
  },
  {
    id: 'cms',
    label: 'CMS',
    permissions: [
      { key: 'cms.view', label: 'View CMS', description: 'Open CMS pages, blogs, location pages, testimonials, and FAQ.' },
      { key: 'cms.manage', label: 'Manage CMS', description: 'Create and edit CMS content.' },
    ],
  },
  {
    id: 'users',
    label: 'User Management',
    permissions: [
      { key: 'users.view', label: 'View users & roles', description: 'Open user management and delete account requests.' },
      { key: 'users.manage', label: 'Manage users & roles', description: 'Create and edit users, roles, and permissions.' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    permissions: [
      { key: 'settings.view', label: 'View settings', description: 'Open all system and website settings pages.' },
      { key: 'settings.manage', label: 'Manage settings', description: 'Update app, website, security, and financial settings.' },
    ],
  },
];

const KNOWN_PERMISSION_KEYS = new Set(
  PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.key))
);

export function parsePermissions(value: string | null | undefined): string[] {
  if (!value) return [];
  if (value.trim() === '*') return ['*'];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function serializePermissions(permissions: string[]): string {
  const normalized = Array.from(new Set(permissions.filter(Boolean)));
  if (normalized.includes('*')) return '*';
  return JSON.stringify(normalized);
}

export function hasPermission(permissions: string[] | null | undefined, permissionKey: string): boolean {
  const normalized = permissions ?? [];
  return normalized.includes('*') || normalized.includes(permissionKey);
}

export function hasFeature(featureFlags: FeatureFlagsMap | null | undefined, featureKey?: string): boolean {
  if (!featureKey) return true;
  return featureFlags?.[featureKey] !== false;
}

type DefaultRouteRule = {
  path: string;
  permission: string;
  featureKey?: string;
};

const DEFAULT_ROUTE_RULES: DefaultRouteRule[] = [
  { path: '/', permission: 'dashboard.view', featureKey: 'dashboard' },
  { path: '/pos', permission: 'pos.use', featureKey: 'pos_terminal' },
  { path: '/products', permission: 'inventory.view', featureKey: 'product_variants' },
  { path: '/sales', permission: 'sales.view', featureKey: 'sales_orders' },
  { path: '/purchases', permission: 'purchases.view', featureKey: 'purchase_orders' },
  { path: '/coupons', permission: 'promo.view', featureKey: 'coupons' },
  { path: '/expenses', permission: 'finance.view', featureKey: 'expense_tracking' },
  { path: '/customers', permission: 'people.view' },
  { path: '/employees', permission: 'hrm.view', featureKey: 'employee_management' },
  { path: '/reports', permission: 'reports.view', featureKey: 'sales_reports' },
  { path: '/cms/pages', permission: 'cms.view', featureKey: 'pages' },
  { path: '/users', permission: 'users.view' },
  { path: '/settings/app', permission: 'settings.view' },
];

export function getDefaultAuthorizedPath(
  platformRole: string | null | undefined,
  permissions: string[] | null | undefined,
  featureFlags?: FeatureFlagsMap | null,
): string {
  if (platformRole === 'super_admin') return '/super-admin/dashboard';
  if (platformRole === 'customer') return '/customer/orders';

  const normalized = permissions ?? [];
  const canAccess = (rule: DefaultRouteRule) =>
    (normalized.includes('*') || normalized.includes(rule.permission)) && hasFeature(featureFlags, rule.featureKey);

  for (const rule of DEFAULT_ROUTE_RULES) {
    if (canAccess(rule)) {
      return rule.path;
    }
  }

  return '/login';
}

export function getDefaultPermissionsForRole(roleName: string): string[] {
  const normalizedRole = roleName.trim().toLowerCase();
  if (normalizedRole === 'admin') return ['*'];
  if (normalizedRole === 'manager') {
    return ['dashboard.view', 'pos.use', 'sales.view', 'sales.manage', 'inventory.view', 'stock.manage', 'purchases.view', 'promo.view', 'reports.view'];
  }
  if (normalizedRole === 'salesman') {
    return ['dashboard.view', 'pos.use', 'sales.view', 'sales.manage', 'people.view'];
  }
  if (normalizedRole === 'supervisor') {
    return ['dashboard.view', 'people.view', 'hrm.view', 'reports.view'];
  }
  if (normalizedRole === 'store keeper') {
    return ['dashboard.view', 'inventory.view', 'inventory.manage', 'stock.manage'];
  }
  if (normalizedRole === 'inventory manager') {
    return ['dashboard.view', 'inventory.view', 'inventory.manage', 'stock.manage', 'purchases.view', 'purchases.manage'];
  }
  return ['dashboard.view'];
}

export function sanitizePermissions(permissions: string[], allowedKeys: Iterable<string> = KNOWN_PERMISSION_KEYS): string[] {
  if (permissions.includes('*')) return ['*'];
  const allowed = allowedKeys instanceof Set ? allowedKeys : new Set(allowedKeys);
  return Array.from(new Set(permissions.filter((permission) => allowed.has(permission))));
}

export function getRequiredPermissionForPath(pathname: string): string | null {
  if (pathname === '/' || pathname.startsWith('/dashboard-2') || pathname.startsWith('/sales-dashboard')) return 'dashboard.view';
  if (pathname.startsWith('/pos')) return 'pos.use';
  if (pathname.startsWith('/products') || pathname.startsWith('/categories') || pathname.startsWith('/brands') || pathname.startsWith('/units') || pathname.startsWith('/variants') || pathname.startsWith('/warranty')) return 'inventory.view';
  if (pathname.startsWith('/sales')) return 'sales.view';
  if (pathname.startsWith('/discount') || pathname.startsWith('/coupons') || pathname.startsWith('/gift-cards')) return 'promo.view';
  if (pathname.startsWith('/purchases')) return 'purchases.view';
  if (pathname.startsWith('/expenses') || pathname.startsWith('/income') || pathname.startsWith('/bank-accounts') || pathname.startsWith('/money-transfer') || pathname.startsWith('/balance-sheet') || pathname.startsWith('/trial-balance') || pathname.startsWith('/cash-flow') || pathname.startsWith('/account-statement')) return 'finance.view';
  if (pathname.startsWith('/customers') || pathname.startsWith('/billers') || pathname.startsWith('/suppliers') || pathname.startsWith('/stores') || pathname.startsWith('/warehouses')) return 'people.view';
  if (pathname.startsWith('/employees') || pathname.startsWith('/departments') || pathname.startsWith('/designation') || pathname.startsWith('/shifts') || pathname.startsWith('/attendance') || pathname.startsWith('/leaves') || pathname.startsWith('/holidays') || pathname.startsWith('/payroll')) return 'hrm.view';
  if (pathname.startsWith('/reports')) return 'reports.view';
  if (pathname.includes('/cms/')) return 'cms.view';
  if (pathname.startsWith('/users') || pathname.startsWith('/roles-permissions') || pathname.startsWith('/delete-account-requests')) return 'users.view';
  if (pathname.startsWith('/settings')) return 'settings.view';
  return null;
}

export function getRequiredFeatureForPath(pathname: string): string | null {
  const routeFeatureRules: Array<{ path: string; featureKey: string }> = [
    { path: '/dashboard-2', featureKey: 'dashboard_2' },
    { path: '/sales-dashboard', featureKey: 'sales_dashboard' },
    { path: '/messages', featureKey: 'messages' },

    { path: '/pos', featureKey: 'pos_terminal' },

    { path: '/sales/returns', featureKey: 'returns_refunds' },
    { path: '/sales/quotation', featureKey: 'quotations' },
    { path: '/sales/invoices', featureKey: 'sales_invoices' },
    { path: '/sales/online', featureKey: 'online_sales' },
    { path: '/sales/pos', featureKey: 'pos_sales' },
    { path: '/sales', featureKey: 'sales_orders' },

    { path: '/discount/product', featureKey: 'product_discounts' },
    { path: '/discount/category', featureKey: 'category_discounts' },
    { path: '/coupons', featureKey: 'coupons' },
    { path: '/gift-cards', featureKey: 'gift_cards' },

    { path: '/products/stock-management', featureKey: 'stock_management' },
    { path: '/products/stock-adjustment', featureKey: 'stock_adjustment' },
    { path: '/products/stock-transfer', featureKey: 'stock_transfer' },
    { path: '/products/barcode', featureKey: 'barcode_printing' },
    { path: '/products/qrcode', featureKey: 'qr_printing' },
    { path: '/products', featureKey: 'products_list' },
    { path: '/categories/sub', featureKey: 'sub_categories' },
    { path: '/categories', featureKey: 'categories' },
    { path: '/brands', featureKey: 'brands' },
    { path: '/units', featureKey: 'units' },
    { path: '/variants', featureKey: 'variant_attributes' },
    { path: '/warranty', featureKey: 'warranties' },

    { path: '/purchases/order', featureKey: 'purchase_orders' },
    { path: '/purchases/returns', featureKey: 'purchase_returns' },
    { path: '/purchases', featureKey: 'purchases_list' },

    { path: '/expenses/categories', featureKey: 'expense_categories' },
    { path: '/expenses', featureKey: 'expenses' },
    { path: '/income/categories', featureKey: 'income_categories' },
    { path: '/income', featureKey: 'income' },
    { path: '/bank-accounts', featureKey: 'bank_accounts' },
    { path: '/money-transfer', featureKey: 'money_transfer' },
    { path: '/balance-sheet', featureKey: 'balance_sheet' },
    { path: '/trial-balance', featureKey: 'trial_balance' },
    { path: '/cash-flow', featureKey: 'cash_flow' },
    { path: '/account-statement', featureKey: 'account_statement' },

    { path: '/customers', featureKey: 'customers' },
    { path: '/billers', featureKey: 'billers' },
    { path: '/suppliers', featureKey: 'suppliers' },
    { path: '/stores', featureKey: 'stores' },
    { path: '/warehouses', featureKey: 'warehouses' },
    { path: '/users', featureKey: 'users' },
    { path: '/roles-permissions', featureKey: 'roles_permissions' },
    { path: '/delete-account-requests', featureKey: 'delete_account_requests' },

    { path: '/attendance/employee', featureKey: 'attendance_employee' },
    { path: '/attendance/admin', featureKey: 'attendance_admin' },
    { path: '/leaves/admin', featureKey: 'leave_admin' },
    { path: '/leaves/employee', featureKey: 'leave_employee' },
    { path: '/leaves/types', featureKey: 'leave_types' },
    { path: '/holidays', featureKey: 'holidays' },
    { path: '/payroll/employee-salary', featureKey: 'payroll_employee_salary' },
    { path: '/payroll/payslip', featureKey: 'payroll_payslip' },
    { path: '/employees', featureKey: 'employees' },
    { path: '/departments', featureKey: 'departments' },
    { path: '/designation', featureKey: 'designation' },
    { path: '/shifts', featureKey: 'shifts' },

    { path: '/reports/sales-report/best-seller', featureKey: 'best_seller' },
    { path: '/reports/sales-report', featureKey: 'sales_reports' },
    { path: '/reports/purchase-report', featureKey: 'purchase_report' },
    { path: '/reports/products-report/stock-history', featureKey: 'stock_history' },
    { path: '/reports/products-report/sold-stock', featureKey: 'sold_stock' },
    { path: '/reports/products-report', featureKey: 'inventory_reports' },
    { path: '/reports/invoice-report', featureKey: 'invoice_report' },
    { path: '/reports/supplier-report/due', featureKey: 'supplier_due' },
    { path: '/reports/supplier-report', featureKey: 'supplier_report' },
    { path: '/reports/customer-report/due', featureKey: 'customer_due' },
    { path: '/reports/customer-report', featureKey: 'customer_report' },
    { path: '/reports/product-report/expiry', featureKey: 'product_expiry_report' },
    { path: '/reports/product-report/quantity-alert', featureKey: 'product_quantity_alert' },
    { path: '/reports/product-report', featureKey: 'product_report' },
    { path: '/reports/expense-report', featureKey: 'expense_report' },
    { path: '/reports/income-report', featureKey: 'income_report' },
    { path: '/reports/tax-report/sales-tax', featureKey: 'sales_tax_report' },
    { path: '/reports/tax-report', featureKey: 'tax_report' },
    { path: '/reports/profit-loss', featureKey: 'profit_loss' },
    { path: '/reports/annual-report', featureKey: 'annual_report' },
    { path: '/reports', featureKey: 'sales_reports' },

    { path: '/cms/pages', featureKey: 'pages' },
    { path: '/cms/blog/tags', featureKey: 'blog_tags' },
    { path: '/cms/blog/categories', featureKey: 'blog_categories' },
    { path: '/cms/blog/comments', featureKey: 'blog_comments' },
    { path: '/cms/blog', featureKey: 'blog' },
    { path: '/cms/location/countries', featureKey: 'countries' },
    { path: '/cms/location/states', featureKey: 'states' },
    { path: '/cms/location/cities', featureKey: 'cities' },
    { path: '/cms/testimonials', featureKey: 'testimonials' },
    { path: '/cms/faq', featureKey: 'faq' },

    { path: '/settings/security', featureKey: 'security' },
    { path: '/settings/notifications', featureKey: 'notifications' },
    { path: '/settings/connected-apps', featureKey: 'connected_apps' },
    { path: '/settings/website', featureKey: 'website_settings' },
    { path: '/settings/app', featureKey: 'app_settings' },
    { path: '/settings/system', featureKey: 'system_settings' },
    { path: '/settings/financial', featureKey: 'financial_settings' },
    { path: '/settings/other', featureKey: 'other_settings' },
    { path: '/settings', featureKey: 'settings_section' },
  ];

  for (const rule of routeFeatureRules) {
    if (pathname === rule.path || pathname.startsWith(`${rule.path}/`)) {
      return rule.featureKey;
    }
  }

  if (pathname === '/') return 'dashboard';
  return null;
}
