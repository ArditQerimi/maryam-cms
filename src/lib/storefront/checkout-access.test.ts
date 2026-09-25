import assert from 'node:assert/strict';
import test from 'node:test';
import { NextResponse } from 'next/server';
import {
  ORDER_ACCESS_COOKIE_NAME,
  createOrderAccessMaterial,
  hashOrderAccessToken,
  isValidOrderAccessToken,
  orderAccessMaterialMatchesHash,
  setOrderAccessCookie,
} from './checkout-access';

const secret = 'test-only-order-access-secret-32-bytes-minimum';

test('guest order capabilities are keyed, random-looking, and deterministically replayable', () => {
  const accessId = '00000000-0000-4000-8000-000000000123';
  const first = createOrderAccessMaterial(secret, 'acme', accessId);
  const replay = createOrderAccessMaterial(secret, 'acme', accessId);
  const another = createOrderAccessMaterial(secret, 'acme');

  assert.equal(first.token, replay.token);
  assert.equal(first.tokenHash, replay.tokenHash);
  assert.notEqual(first.token, another.token);
  assert.notEqual(
    first.token,
    createOrderAccessMaterial(secret, 'other', accessId).token,
  );
  assert.equal(isValidOrderAccessToken(first.token), true);
  assert.equal(isValidOrderAccessToken(`${first.token}x`), false);
  assert.match(first.tokenHash, /^[0-9a-f]{64}$/);
  assert.notEqual(first.tokenHash, first.token);
  assert.equal(first.tokenHash, hashOrderAccessToken(first.token));
  assert.equal(
    orderAccessMaterialMatchesHash(secret, 'acme', accessId, first.tokenHash)?.token,
    first.token,
  );
  assert.equal(
    orderAccessMaterialMatchesHash(`${secret}-rotated`, 'acme', accessId, first.tokenHash),
    null,
  );
});

test('guest confirmation cookie is host-only, HttpOnly, scoped, and Secure when requested', () => {
  const { token } = createOrderAccessMaterial(secret, 'acme');
  const response = NextResponse.json({ ok: true });
  setOrderAccessCookie(response, token, true);
  const cookie = response.headers.get('set-cookie') || '';

  assert.match(cookie, new RegExp(`^${ORDER_ACCESS_COOKIE_NAME}=`));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\/shop\/order-confirmation/i);
  assert.doesNotMatch(cookie, /Domain=/i);
});
