/*
 * Welcome message (CMS → Settings → WhatsApp) against a TEST database and a fake Meta Graph API:
 *   npx tsx scripts/whatsapp-welcome-check.ts postgres://postgres:postgres@localhost:5432/pos_tenant_arditi_test
 * Checks number parsing, saving, the 24h window (text vs template) and Meta's errors; removes what it saved.
 */
import { createServer } from 'node:http';
import { inArray } from 'drizzle-orm';
import { getTenantDb } from '../src/db/index';
import { settingsStore } from '../src/db/schema-tenant';
import type { CloudConfig } from '../src/lib/whatsapp-cloud';
import {
  defaultWelcomeText,
  knownNumbers,
  loadWelcomeSettings,
  noteWelcomeInbound,
  parseNumbers,
  saveWelcomeSettings,
  sendWelcome,
  WELCOME_KEYS,
} from '../src/lib/whatsapp-welcome';

const url = process.argv[2];
if (!url || !/_test$/.test(new URL(url).pathname)) {
  console.error('Pass the connection string of a *_test database.');
  process.exit(2);
}

let failures = 0;
const check = (ok: boolean, label: string) => {
  if (!ok) failures += 1;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}`);
};

const ALLOWED = '38344111111';
const RECENT = '38349222222';
const NOT_ALLOWED = '38345333333';
const sent: Array<{ to: string; type: string; template?: { name: string; language: { code: string } } }> = [];

async function main() {
  const graph = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      const payload = JSON.parse(body || '{}');
      sent.push(payload);
      response.setHeader('content-type', 'application/json');
      if (payload.to === NOT_ALLOWED) {
        response.statusCode = 400;
        response.end(JSON.stringify({ error: { code: 131030, message: 'Recipient phone number not in allowed list' } }));
        return;
      }
      response.end(JSON.stringify({ messages: [{ id: `wamid.${sent.length}` }] }));
    });
  });
  await new Promise<void>((resolve) => graph.listen(0, '127.0.0.1', resolve));
  const address = graph.address();
  process.env.WHATSAPP_GRAPH_URL = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

  const db = getTenantDb(url, 'public');
  const config = { token: 'test-token', phoneNumberId: '1234567890', canSend: true } as CloudConfig;
  try {
    const parsed = parseNumbers(`+383 44 111 111\n0038349222222, +38344111111\nabc\n+38345333333`);
    check(parsed.numbers.join(',') === `${ALLOWED},${RECENT},${NOT_ALLOWED}` && parsed.invalid.join() === 'abc', 'numbers: spaces / 00 / duplicates handled, junk reported');

    const fresh = await loadWelcomeSettings(db, 'Dyqani Elif');
    check(fresh.text === defaultWelcomeText('Dyqani Elif') && fresh.numbers.length === 0, 'nothing saved → default welcome text with the shop name');

    await saveWelcomeSettings(db, { numbers: parsed.numbers, text: 'Mirë se vini!', template: '', language: 'sq' });
    const saved = await loadWelcomeSettings(db, 'Dyqani Elif');
    check(saved.numbers.length === 3 && saved.text === 'Mirë se vini!', 'list and text are saved');

    await noteWelcomeInbound(db, '38340999999');
    await noteWelcomeInbound(db, RECENT);
    await noteWelcomeInbound(db, 'not-a-number');
    const known = await knownNumbers(db);
    check(known.join(',') === `${RECENT},38340999999`, 'webhook remembers who wrote, most recent first (junk ignored)');

    const results = await sendWelcome(db, config, saved);
    const byNumber = Object.fromEntries(results.map((result) => [result.to, result]));
    const call = (to: string) => sent.find((payload) => payload.to === to);
    check(byNumber[RECENT]?.ok === true && byNumber[RECENT].via === 'text' && call(RECENT)?.type === 'text', 'wrote in the last 24h → free text');
    check(
      byNumber[ALLOWED]?.ok === true && byNumber[ALLOWED].via === 'template' && call(ALLOWED)?.template?.name === 'hello_world' && call(ALLOWED)?.template?.language.code === 'en_US',
      'did not write → hello_world template (en_US)',
    );
    check(byNumber[NOT_ALLOWED]?.ok === false && byNumber[NOT_ALLOWED].error === 'notAllowed', 'number missing from Meta\'s test list → "notAllowed"');

    sent.length = 0;
    await sendWelcome(db, config, { ...saved, numbers: [ALLOWED], template: 'mireseardhje', language: 'sq' });
    check(sent[0]?.template?.name === 'mireseardhje' && sent[0]?.template?.language.code === 'sq', 'own template is used with its language');
  } finally {
    await db.delete(settingsStore).where(inArray(settingsStore.key, Object.values(WELCOME_KEYS)));
    graph.close();
  }
  console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
