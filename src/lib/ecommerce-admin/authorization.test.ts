import assert from 'node:assert/strict';
import test from 'node:test';

import { authorizeFreshStaff, canUseEcommerceControlCenter } from './authorization';

const staff = {
  id: 7,
  status: 'Active',
  roleId: 2,
  roleName: 'Catalog Manager',
  storeId: 4,
  storeStatus: 'Active',
};

const staffSession = {
  userId: 7,
  companyId: 11,
  platformRole: 'admin',
  tenantRole: 'Stale Role',
  audience: 'staff',
  permissions: ['*'],
  isPlatformUser: false,
};

test('authorization accepts active staff using fresh role, permissions, and assigned store', () => {
  const result = authorizeFreshStaff({
    session: staffSession,
    currentCompanyId: 11,
    freshStaff: staff,
    freshPermissions: ['inventory.view', 'inventory.manage'],
  });

  assert.deepEqual(result, {
    allowed: true,
    userId: 7,
    roleName: 'Catalog Manager',
    scopeKind: 'store',
  });
  assert.equal(staffSession.tenantRole, 'Stale Role');
});

test('authorization rejects customer and platform audiences', () => {
  for (const session of [
    { ...staffSession, platformRole: 'customer', audience: 'customer' },
    { ...staffSession, platformRole: 'super_admin', audience: 'platform' },
    { ...staffSession, isPlatformUser: true },
    { ...staffSession, audience: undefined },
  ]) {
    const result = authorizeFreshStaff({
      session,
      currentCompanyId: 11,
      freshStaff: staff,
      freshPermissions: ['*'],
    });
    assert.equal(result.allowed, false);
    assert.equal(result.allowed === false && result.reason, 'wrong-audience');
  }
});

test('authorization rejects company mismatch, inactive users, and inactive stores', () => {
  const mismatch = authorizeFreshStaff({
    session: staffSession,
    currentCompanyId: 12,
    freshStaff: staff,
    freshPermissions: ['inventory.view'],
  });
  assert.equal(mismatch.allowed === false && mismatch.reason, 'company-mismatch');

  const inactiveUser = authorizeFreshStaff({
    session: staffSession,
    currentCompanyId: 11,
    freshStaff: { ...staff, status: 'Suspended' },
    freshPermissions: ['inventory.view'],
  });
  assert.equal(inactiveUser.allowed === false && inactiveUser.reason, 'inactive-staff');

  const inactiveStore = authorizeFreshStaff({
    session: staffSession,
    currentCompanyId: 11,
    freshStaff: { ...staff, storeStatus: 'Inactive' },
    freshPermissions: ['inventory.view'],
  });
  assert.equal(inactiveStore.allowed === false && inactiveStore.reason, 'inactive-store');
});

test('non-admin roles without a server-derived store receive unassigned scope', () => {
  const result = authorizeFreshStaff({
    session: { ...staffSession },
    currentCompanyId: 11,
    freshStaff: { ...staff, storeId: null, storeStatus: null },
    freshPermissions: ['sales.view'],
  });

  assert.equal(result.allowed, true);
  assert.equal(result.allowed === true && result.scopeKind, 'unassigned');
  assert.equal(canUseEcommerceControlCenter(['sales.view']), true);
  assert.equal(canUseEcommerceControlCenter(['finance.view']), false);
});
