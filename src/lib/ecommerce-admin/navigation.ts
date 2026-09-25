import type {
  EcommerceCapabilities,
  EcommerceLink,
  EcommerceModuleCard,
  EcommerceModuleId,
  EcommerceModuleState,
} from './types';

export const ECOMMERCE_ALLOWED_PATHS = new Set([
  '/products',
  '/products/add',
  '/categories',
  '/sales/online',
  '/sales',
  '/sales/invoices',
  '/sales/returns',
  '/customers',
  '/coupons',
  '/gift-cards',
  '/discount/product',
  '/discount/category',
  '/cms/blog',
  '/cms/blog/new',
  '/cms/pages',
  '/cms/faq',
  '/settings/ecommerce-storefront',
  '/settings/website',
  '/shop',
]);

const MODULE_COPY: Record<EcommerceModuleId, { title: string; description: string }> = {
  catalog: {
    title: 'Catalog',
    description: 'Products, concrete variants, categories, and real stock availability.',
  },
  orders: {
    title: 'Orders',
    description: 'Review online orders, sales, invoices, and authoritative persisted revenue.',
  },
  customers: {
    title: 'Customers',
    description: 'Customer records available within your authorized data scope.',
  },
  marketing: {
    title: 'Marketing',
    description: 'Coupons, gift cards, and product or category discounts.',
  },
  content: {
    title: 'Content',
    description: 'Published storefront content, drafts, pages, and FAQs.',
  },
  'storefront-settings': {
    title: 'Storefront Settings',
    description: 'Website presentation and persisted storefront configuration.',
  },
  storefront: {
    title: 'Storefront',
    description: 'Open the public shopping experience for this tenant host.',
  },
};

function allowed(links: EcommerceLink[]) {
  return links.filter((link) => ECOMMERCE_ALLOWED_PATHS.has(link.href));
}

export function getModuleLinks(
  moduleId: EcommerceModuleId,
  capabilities: EcommerceCapabilities,
): EcommerceLink[] {
  switch (moduleId) {
    case 'catalog':
      return allowed([
        ...(capabilities.inventoryView ? [{ label: 'Products', href: '/products' }] : []),
        ...(capabilities.inventoryManage ? [{ label: 'Add product', href: '/products/add' }] : []),
        ...(capabilities.inventoryView ? [{ label: 'Categories', href: '/categories' }] : []),
      ]);
    case 'orders':
      return allowed([
        ...(capabilities.salesView ? [{ label: 'Online orders', href: '/sales/online' }] : []),
        ...(capabilities.salesView ? [{ label: 'All sales', href: '/sales' }] : []),
        ...(capabilities.salesView ? [{ label: 'Invoices', href: '/sales/invoices' }] : []),
      ]);
    case 'customers':
      return capabilities.peopleView ? [{ label: 'Customers', href: '/customers' }] : [];
    case 'marketing':
      return capabilities.promoView
        ? allowed([
            { label: 'Coupons', href: '/coupons' },
            { label: 'Gift cards', href: '/gift-cards' },
            { label: 'Product discounts', href: '/discount/product' },
            { label: 'Category discounts', href: '/discount/category' },
          ])
        : [];
    case 'content':
      return allowed([
        ...(capabilities.cmsView ? [{ label: 'Blog', href: '/cms/blog' }] : []),
        ...(capabilities.cmsManage ? [{ label: 'New post', href: '/cms/blog/new' }] : []),
        ...(capabilities.cmsView ? [{ label: 'Pages', href: '/cms/pages' }] : []),
        ...(capabilities.cmsView ? [{ label: 'FAQ', href: '/cms/faq' }] : []),
      ]);
    case 'storefront-settings':
      return capabilities.settingsView
        ? allowed([
            { label: 'Storefront settings', href: '/settings/ecommerce-storefront' },
            { label: 'Website settings', href: '/settings/website' },
          ])
        : [];
    case 'storefront':
      return [{ label: 'View storefront', href: '/shop' }];
  }
}

export function buildModuleCards(input: {
  capabilities: EcommerceCapabilities;
  states: Record<EcommerceModuleId, EcommerceModuleState>;
  details: Record<EcommerceModuleId, string>;
}): EcommerceModuleCard[] {
  const ids: EcommerceModuleId[] = [
    'catalog',
    'orders',
    'customers',
    'marketing',
    'content',
    'storefront-settings',
    'storefront',
  ];

  return ids.map((id) => ({
    id,
    ...MODULE_COPY[id],
    state: input.states[id],
    detail: input.details[id],
    links: getModuleLinks(id, input.capabilities),
  }));
}

export function buildQuickActions(capabilities: EcommerceCapabilities): EcommerceLink[] {
  return allowed([
    ...(capabilities.inventoryManage ? [{ label: 'Add product', href: '/products/add' }] : []),
    ...(capabilities.salesView ? [{ label: 'View online orders', href: '/sales/online' }] : []),
    ...(capabilities.peopleView ? [{ label: 'Review customers', href: '/customers' }] : []),
    ...(capabilities.cmsManage ? [{ label: 'Write a post', href: '/cms/blog/new' }] : []),
    ...(capabilities.settingsView ? [{ label: 'Store settings', href: '/settings/ecommerce-storefront' }] : []),
    { label: 'Open storefront', href: '/shop' },
  ]);
}
