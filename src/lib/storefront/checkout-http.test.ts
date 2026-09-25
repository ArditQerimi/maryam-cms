import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { readBoundedCheckoutJson } from './checkout-handler';

function request(body: string, headers: Record<string, string> = {}) {
  return new NextRequest('https://acme.stores.example.com/api/storefront/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body,
  });
}

test('checkout JSON reader accepts a bounded exact body', async () => {
  const payload = { terms: { accepted: true } };
  assert.deepEqual(
    await readBoundedCheckoutJson(request(JSON.stringify(payload))),
    payload,
  );
});

test('checkout JSON reader rejects oversized declared and streamed bodies', async () => {
  await assert.rejects(
    readBoundedCheckoutJson(request('{}', { 'Content-Length': '32769' })),
    /too large/i,
  );

  const oversized = JSON.stringify({ value: 'x'.repeat(32 * 1024) });
  await assert.rejects(
    readBoundedCheckoutJson(request(oversized)),
    /too large/i,
  );
});

test('checkout JSON reader requires JSON media and valid bounded UTF-8 JSON', async () => {
  const wrongMedia = new NextRequest(
    'https://acme.stores.example.com/api/storefront/checkout',
    {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '{}',
    },
  );
  await assert.rejects(readBoundedCheckoutJson(wrongMedia), /application\/json/i);
  await assert.rejects(readBoundedCheckoutJson(request('{')), /valid JSON/i);
  await assert.rejects(
    readBoundedCheckoutJson(new NextRequest(
      'https://acme.stores.example.com/api/storefront/checkout',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: new Uint8Array([0x22, 0xff, 0x22]),
      },
    )),
    /valid UTF-8 JSON/i,
  );
});
