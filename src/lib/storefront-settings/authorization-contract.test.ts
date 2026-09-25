import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  hasSettingsPermission,
  isActiveSettingsStaffRole,
  isSettingsStaffSession,
  projectCompanyDisplayStatus,
} from './authorization-contract';

const staffSession = {
  userId: 9,
  companyId: 22,
  platformRole: 'admin',
  audience: 'staff',
  tenantRole: 'Admin',
  isPlatformUser: false,
  permissions: ['*'],
};

test('authorization contract accepts only active staff sessions for the exact company', () => {
  assert.equal(isSettingsStaffSession(staffSession, 22), true);
  assert.equal(isSettingsStaffSession({ ...staffSession, companyId: 23 }, 22), false);
  assert.equal(isSettingsStaffSession({ ...staffSession, platformRole: 'customer', audience: 'customer' }, 22), false);
  assert.equal(isSettingsStaffSession({ ...staffSession, platformRole: 'super_admin', isPlatformUser: true }, 22), false);
  assert.equal(isSettingsStaffSession({ ...staffSession, isPlatformUser: 'true' }, 22), false);
  assert.equal(isSettingsStaffSession({ ...staffSession, audience: undefined }, 22), false);
  assert.equal(isSettingsStaffSession({ ...staffSession, userId: 0 }, 22), false);
  assert.equal(isSettingsStaffSession(null, 22), false);
});

test('authorization contract rechecks active non-customer roles and permissions', () => {
  assert.equal(isActiveSettingsStaffRole({ status: 'Active', tenantRoleId: 3, roleName: 'Admin' }), true);
  assert.equal(isActiveSettingsStaffRole({ status: 'Suspended', tenantRoleId: 3, roleName: 'Admin' }), false);
  assert.equal(isActiveSettingsStaffRole({ status: 'Active', tenantRoleId: 3, roleName: 'Customer' }), false);
  assert.equal(isActiveSettingsStaffRole({ status: 'Active', tenantRoleId: null, roleName: 'Admin' }), false);
  assert.equal(hasSettingsPermission(['settings.view'], 'settings.view'), true);
  assert.equal(hasSettingsPermission(['settings.view'], 'settings.manage'), false);
  assert.equal(hasSettingsPermission(['*'], 'settings.manage'), true);
});

test('company projection excludes database routing fields', () => {
  assert.deepEqual(projectCompanyDisplayStatus({
    name: '  Bookshop  ',
    subdomain: 'bookshop',
    status: 'Active',
    dbConnectionString: 'postgres://secret',
    dbSchema: 'private_schema',
  } as unknown as { name?: unknown; subdomain?: unknown; status?: unknown }), {
    displayName: 'Bookshop',
    subdomain: 'bookshop',
    status: 'Active',
  });
});

test('server-only authorization source keeps host, audience, and permission checks near the DAL', () => {
  const source = readFileSync(path.join(process.cwd(), 'src/lib/storefront-settings/authorization.ts'), 'utf8');
  const contractSource = readFileSync(path.join(process.cwd(), 'src/lib/storefront-settings/authorization-contract.ts'), 'utf8');
  const dalSource = readFileSync(path.join(process.cwd(), 'src/lib/storefront-settings/dal.ts'), 'utf8');
  for (const required of [
    'getContextCompany',
    'getSession',
    'settings.view',
    'settings.manage',
    'getTenantDb',
  ]) {
    assert.equal(source.includes(required), true, required);
  }
  for (const required of ["audience === 'staff'", "platformRole === 'admin'", 'isPlatformUser']) {
    assert.equal(contractSource.includes(required), true, required);
  }
  assert.equal(dalSource.includes('requireEcommerceStorefrontSettingsManageAccess'), true);
  assert.equal(dalSource.includes('STOREFRONT_SETTINGS_KEY'), true);
  assert.equal(dalSource.includes('expectedUpdatedAt'), true);
  const readerSource = readFileSync(path.join(process.cwd(), 'src/lib/storefront-settings/reader.ts'), 'utf8');
  for (const productionSource of [source, dalSource, readerSource]) {
    assert.equal(productionSource.includes('CREATE TABLE'), false);
    assert.equal(productionSource.includes('ALTER TABLE'), false);
    assert.equal(productionSource.includes('ensure'), false);
  }
});
