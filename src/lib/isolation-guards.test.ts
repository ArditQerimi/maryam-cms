import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureScopedRecordAccess, ensureStoreScopedRecord, ensureTenantContext } from './isolation-guards';

test('ensureTenantContext returns tenant id when present', () => {
  assert.equal(ensureTenantContext(42), 42);
});

test('ensureTenantContext throws when tenant id missing', () => {
  assert.throws(() => ensureTenantContext(null), /Company ID not found/);
});

test('ensureScopedRecordAccess allows id in scope', () => {
  assert.doesNotThrow(() => ensureScopedRecordAccess([2, 4, 6], 4, 'user'));
});

test('ensureScopedRecordAccess rejects id outside scope', () => {
  assert.throws(() => ensureScopedRecordAccess([2, 4, 6], 3, 'user'), /Invalid user selected/);
});

test('ensureStoreScopedRecord allows records in active store', () => {
  assert.doesNotThrow(() => ensureStoreScopedRecord(10, 10, 'Product'));
});

test('ensureStoreScopedRecord rejects records outside active store', () => {
  assert.throws(() => ensureStoreScopedRecord(10, 12, 'Product'), /outside the active store/);
});
