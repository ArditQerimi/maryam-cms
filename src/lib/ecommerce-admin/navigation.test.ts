import assert from 'node:assert/strict';
import test from 'node:test';

import { ECOMMERCE_ALLOWED_PATHS, buildModuleCards, buildQuickActions } from './navigation';
import type { EcommerceCapabilities, EcommerceModuleState } from './types';

const capabilities: EcommerceCapabilities = {
  inventoryView: true,
  inventoryManage: true,
  stockManage: true,
  salesView: true,
  salesManage: true,
  peopleView: true,
  promoView: true,
  promoManage: true,
  cmsView: true,
  cmsManage: true,
  settingsView: true,
  settingsManage: true,
};

const states: Record<ReturnType<typeof buildModuleCards>[number]['id'], EcommerceModuleState> = {
  catalog: 'ready',
  orders: 'ready',
  customers: 'ready',
  marketing: 'ready',
  content: 'ready',
  'storefront-settings': 'ready',
  storefront: 'ready',
};

test('ecommerce navigation only emits the reviewed canonical route allowlist', () => {
  const links = [
    ...buildModuleCards({
      capabilities,
      states,
      details: {
        catalog: '',
        orders: '',
        customers: '',
        marketing: '',
        content: '',
        'storefront-settings': '',
        storefront: '',
      },
    }).flatMap((module) => module.links),
    ...buildQuickActions(capabilities),
  ];
  const hrefs = links.map((link) => link.href);

  assert.ok(hrefs.length > 0);
  assert.equal(hrefs.every((href) => ECOMMERCE_ALLOWED_PATHS.has(href)), true);
  assert.equal(hrefs.includes('/customer/orders'), false);
  assert.equal(hrefs.includes('/settings/ecommerce-storefront'), true);
  assert.equal(hrefs.includes('/products/stock-management'), false);
  assert.equal(hrefs.includes('/sales/returns'), false);
});
