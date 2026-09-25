import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractStorefrontSubdomain,
  isSameOrigin,
  normalizeStorefrontHostname,
} from './host';

test('storefront host parsing requires one exact tenant label', () => {
  assert.equal(normalizeStorefrontHostname('Arditi.Localhost:3000'), 'arditi.localhost');
  assert.equal(extractStorefrontSubdomain('arditi.localhost:3000'), 'arditi');
  assert.equal(extractStorefrontSubdomain('a.b.example.com', 'example.com'), null);
  assert.equal(extractStorefrontSubdomain('example.com', 'example.com'), null);
  assert.equal(extractStorefrontSubdomain('admin.localhost'), null);
});

test('same-origin checks include protocol and authority', () => {
  assert.equal(isSameOrigin('https://arditi.example.com', 'arditi.example.com', 'https:'), true);
  assert.equal(isSameOrigin('http://arditi.example.com', 'arditi.example.com', 'https:'), false);
  assert.equal(isSameOrigin('https://other.example.com', 'arditi.example.com', 'https:'), false);
  assert.equal(isSameOrigin(null, 'arditi.example.com', 'https:'), false);
});
