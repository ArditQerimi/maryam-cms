import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTenantSubdomainFromHostname } from './tenant';

const prod = { NODE_ENV: 'production' } as NodeJS.ProcessEnv;

test('production without a base domain rejects an unknown host', () => {
  assert.throws(() => resolveTenantSubdomainFromHostname('shop.onrender.com', prod));
});

test('SINGLE_TENANT_SUBDOMAIN maps any host to that one tenant', () => {
  const env = { ...prod, SINGLE_TENANT_SUBDOMAIN: 'admin' } as NodeJS.ProcessEnv;
  assert.equal(resolveTenantSubdomainFromHostname('shop.onrender.com', env), 'admin');
});

test('SINGLE_TENANT_SUBDOMAIN must be a valid hostname label', () => {
  const env = { ...prod, SINGLE_TENANT_SUBDOMAIN: 'bad host!' } as NodeJS.ProcessEnv;
  assert.throws(() => resolveTenantSubdomainFromHostname('shop.onrender.com', env));
});
