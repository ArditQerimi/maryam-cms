import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  hasCustomerSessionAudience,
  isActiveCustomerAccount,
  isRoleAllowedForAudience,
  isSessionForCompany,
  parseLoginAudience,
} from './auth-validation';
import {
  resolveTenantCompanyForHost,
  resolveTenantSubdomainFromHostname,
} from './tenant';
import { buildCustomerSessionPayload } from './session';
import { decrypt, encrypt, resolveSessionSecret } from './session-token';
import {
  getSafeReturnTo,
  withSafeReturnTo,
} from '@/app/shop/login/safe-return-to';

const productionHostEnv = {
  NODE_ENV: 'production',
  STOREFRONT_BASE_DOMAIN: 'stores.example.com',
};

test('unknown production tenant host fails closed without a default-company fallback', async () => {
  const companies = new Map([
    ['known', { id: 7, status: 'Active' }],
  ]);

  await assert.rejects(
    resolveTenantCompanyForHost(
      'unknown.stores.example.com',
      async (subdomain) => companies.get(subdomain),
      productionHostEnv,
    ),
    (error: unknown) => {
      assert.match(String((error as Error).message), /No company is configured/);
      return true;
    },
  );

  assert.deepEqual(
    await resolveTenantCompanyForHost(
      'known.stores.example.com',
      async (subdomain) => companies.get(subdomain),
      productionHostEnv,
    ),
    { id: 7, status: 'Active' },
  );

  assert.throws(
    () => resolveTenantSubdomainFromHostname('shop.localhost', {
      NODE_ENV: 'production',
      STOREFRONT_BASE_DOMAIN: 'localhost',
    }),
    /local development domain/,
  );
});

test('explicit local development hosts use the documented default only when appropriate', async () => {
  const env = {
    NODE_ENV: 'development',
    DEFAULT_TENANT_SUBDOMAIN: 'local-shop',
  };
  const companies = new Map([
    ['local-shop', { id: 11, status: 'Active' }],
    ['other-shop', { id: 12, status: 'Active' }],
  ]);
  const lookup = async (subdomain: string) => companies.get(subdomain);

  assert.equal((await resolveTenantCompanyForHost('localhost:3000', lookup, env)).id, 11);
  assert.equal((await resolveTenantCompanyForHost('192.168.1.25:3000', lookup, env)).id, 11);
  assert.equal((await resolveTenantCompanyForHost('other-shop.localhost:3000', lookup, env)).id, 12);

  await assert.rejects(
    resolveTenantCompanyForHost('unknown.localhost:3000', lookup, env),
    /No company is configured/,
  );
});

test('tenant company status must be Active', async () => {
  await assert.rejects(
    resolveTenantCompanyForHost(
      'inactive.stores.example.com',
      async () => ({ id: 9, status: 'Suspended' }),
      productionHostEnv,
    ),
    /not active/,
  );
});

test('customer sessions are bound to the exact company and audience', () => {
  const session = {
    userId: 4,
    companyId: 22,
    platformRole: 'customer',
    audience: 'customer',
    isPlatformUser: false,
  };

  assert.equal(isSessionForCompany(session, 22), true);
  assert.equal(isSessionForCompany(session, 23), false);
  assert.equal(hasCustomerSessionAudience(session), true);
  assert.equal(hasCustomerSessionAudience({ ...session, audience: 'staff' }), false);
  assert.equal(hasCustomerSessionAudience({ ...session, tenantRole: 'Administrator' }), false);
  assert.equal(hasCustomerSessionAudience({ ...session, isPlatformUser: true }), false);
});

test('login audience requires an actual active Customer role', () => {
  assert.equal(parseLoginAudience('customer'), 'customer');
  assert.equal(parseLoginAudience(null), 'staff');
  assert.equal(parseLoginAudience('administrator'), null);
  assert.equal(isRoleAllowedForAudience('Customer', 'customer'), true);
  assert.equal(isRoleAllowedForAudience('Customer', 'staff'), false);
  assert.equal(isRoleAllowedForAudience('Administrator', 'customer'), false);
  assert.equal(isActiveCustomerAccount({ status: 'Active', roleName: 'Customer' }), true);
  assert.equal(isActiveCustomerAccount({ status: 'Suspended', roleName: 'Customer' }), false);
});

test('customer returnTo stays on the same store and allowed account paths', () => {
  const allowed = [
    '/shop',
    '/shop/cart?coupon=summer',
    '/shop/checkout',
    '/shop/checkout/payment?step=2',
    '/shop/wishlist',
    '/shop/compare#products',
    '/shop/account',
    '/shop/account/security?tab=password',
    '/customer',
    '/customer/orders?page=2',
  ];
  for (const value of allowed) {
    assert.equal(getSafeReturnTo(value), value);
  }

  for (const value of [
    'https://evil.example/phish',
    '//evil.example/phish',
    '/\\evil.example/phish',
    '/%2f%2fevil.example/phish',
    '/settings/profile',
    '/shop/products/42',
    '/super-admin/dashboard',
    '/shop/login',
  ]) {
    assert.equal(getSafeReturnTo(value), '/customer/orders');
  }

  const externalWrapper = new URL(
    withSafeReturnTo('https://evil.example', '/shop/cart'),
    'https://store.invalid',
  );
  assert.equal(externalWrapper.pathname, '/shop/login');
  assert.equal(externalWrapper.searchParams.get('returnTo'), '/shop/cart');
});

test('new customer payloads contain audience/company binding but no PII', () => {
  const payload = buildCustomerSessionPayload(4, 22);
  assert.deepEqual(payload, {
    userId: 4,
    companyId: 22,
    platformRole: 'customer',
    tenantRole: 'Customer',
    audience: 'customer',
    permissions: [],
    isPlatformUser: false,
  });
  assert.equal('email' in payload, false);
  assert.equal('name' in payload, false);
});

test('legacy JWT-like development tokens remain readable', async () => {
  const encode = (value: string) => btoa(value)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encode(JSON.stringify({
    userId: 5,
    companyId: 10,
    platformRole: 'customer',
    tenantRole: 'Customer',
    exp: Date.now() + 60_000,
  }));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(
      process.env.SESSION_SECRET || 'super-secret-default-key-please-change-in-production'
    ),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  ));
  const encodedSignature = encode(String.fromCharCode(...signature));
  const token = `${header}.${payload}.${encodedSignature}`;

  const decoded = await decrypt(token);
  assert.equal(decoded?.userId, 5);
  assert.equal(decoded?.companyId, 10);
});

test('production module startup fails closed without SESSION_SECRET', () => {
  const tsxCli = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const result = spawnSync(
    process.execPath,
    [
      tsxCli,
      '-e',
      "delete process.env.SESSION_SECRET; void import('./src/lib/session-token.ts')",
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production', SESSION_SECRET: '' },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SESSION_SECRET must be configured/);
});

test('production secret resolution and token creation fail closed', async () => {
  assert.throws(
    () => resolveSessionSecret({ NODE_ENV: 'production' }),
    /SESSION_SECRET must be configured/,
  );
  assert.throws(
    () => resolveSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: 'too-short' }),
    /at least 32 bytes/,
  );
  assert.throws(
    () => resolveSessionSecret({
      NODE_ENV: 'production',
      SESSION_SECRET: 'replace-me-with-a-random-secret-value',
    }),
    /placeholder/,
  );

  const strongSecret = '7Jm!pQ2@xV9#nL4$kR8^uY6&zT3%wC5*dF1+hG0';
  assert.equal(
    resolveSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: strongSecret }),
    strongSecret,
  );

  const mutableEnv = process.env as Record<string, string | undefined>;
  const previousNodeEnv = mutableEnv.NODE_ENV;
  const previousSecret = mutableEnv.SESSION_SECRET;
  try {
    mutableEnv.NODE_ENV = 'production';
    delete mutableEnv.SESSION_SECRET;
    await assert.rejects(encrypt({ userId: 1 }), /SESSION_SECRET must be configured/);

    mutableEnv.SESSION_SECRET = strongSecret;
    const token = await encrypt({ userId: 8, companyId: 3, audience: 'customer' });
    const payload = await decrypt(token);
    assert.equal(payload?.userId, 8);
    assert.equal(payload?.companyId, 3);
    assert.equal(payload?.audience, 'customer');
  } finally {
    if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = previousNodeEnv;
    if (previousSecret === undefined) delete mutableEnv.SESSION_SECRET;
    else mutableEnv.SESSION_SECRET = previousSecret;
  }
});
