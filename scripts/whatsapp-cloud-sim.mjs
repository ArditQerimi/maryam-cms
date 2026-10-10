// Local simulator for the WhatsApp Cloud API bot (no Meta account needed).
//
// 1. Start the shop with test values (process env only, nothing is written to .env):
//      WHATSAPP_APP_SECRET=sim-app-secret-0123456789 WHATSAPP_VERIFY_TOKEN=sim-verify-token \
//      WHATSAPP_CLOUD_TOKEN=sim-token WHATSAPP_PHONE_NUMBER_ID=1000000001 \
//      WHATSAPP_OWNER_TO=38349000111 WHATSAPP_GRAPH_URL=http://127.0.0.1:3999 npm run dev
// 2. node scripts/whatsapp-cloud-sim.mjs [http://localhost:3003]
//
// It plays Meta: a fake Graph API on :3999 records what the bot sends, and webhooks are signed
// with the app secret exactly like Meta signs them (x-hub-signature-256).
import http from 'node:http';
import { createHmac } from 'node:crypto';

const SHOP = (process.argv[2] || 'http://localhost:3003').replace(/\/+$/, '');
const SECRET = 'sim-app-secret-0123456789';
const VERIFY = 'sim-verify-token';
const OWNER = '38349000111';
const CUSTOMER = '38349000222';
const NUMBER_ID = '1000000001';

const sent = [];
const graph = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    sent.push({ path: req.url, auth: req.headers.authorization, body: JSON.parse(body || '{}') });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ messages: [{ id: `wamid.sim${sent.length}` }] }));
  });
});
await new Promise((resolve) => graph.listen(3999, '127.0.0.1', resolve));

let failures = 0;
const check = (ok, label) => {
  if (!ok) failures += 1;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function webhook(messages, contacts = []) {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: 'WABA', changes: [{ field: 'messages', value: {
      messaging_product: 'whatsapp',
      metadata: { display_phone_number: '38349000000', phone_number_id: NUMBER_ID },
      contacts,
      messages,
    } }] }],
  });
}

async function post(body, signature = `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`) {
  const response = await fetch(`${SHOP}/api/whatsapp/cloud`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature },
    body,
  });
  return response.status;
}

/** Waits until the bot sent a text to `to` (the assistant can take a while). */
async function waitForText(to, after, seconds = 90) {
  for (let i = 0; i < seconds * 2; i += 1) {
    const found = sent.slice(after).find((call) => call.body.type === 'text' && call.body.to === to);
    if (found) return found;
    await sleep(500);
  }
  return null;
}

const now = () => String(Math.floor(Date.now() / 1000));

try {
  // 1. Meta's webhook verification
  const ok = await fetch(`${SHOP}/api/whatsapp/cloud?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=4242`);
  const bad = await fetch(`${SHOP}/api/whatsapp/cloud?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=4242`);
  check(ok.status === 200 && (await ok.text()) === '4242' && bad.status === 403, 'webhook verification: right token answers the challenge, wrong token 403');

  // 2. Forged request
  check(await post(webhook([]), 'sha256=forged') === 401, 'request without Meta\'s signature is refused (401)');

  // 3. A customer asks something
  let mark = sent.length;
  const question = { id: 'wamid.customer1', from: CUSTOMER, timestamp: now(), type: 'text', text: { body: 'Përshëndetje, a e keni Sahihun e Buhariut dhe sa kushton?' } };
  check(await post(webhook([question], [{ wa_id: CUSTOMER, profile: { name: 'Klient Test' } }])) === 200, 'customer message acknowledged at once (200)');
  const reply = await waitForText(CUSTOMER, mark);
  const read = sent.slice(mark).find((call) => call.body.status === 'read' && call.body.message_id === 'wamid.customer1');
  check(Boolean(read?.body.typing_indicator), 'message marked as read with "typing…"');
  check(Boolean(reply) && reply.path === `/${NUMBER_ID}/messages` && reply.auth === 'Bearer sim-token', 'assistant reply sent through the Cloud API with the token');
  if (reply) console.log(`       reply: ${reply.body.text.body.slice(0, 300).replace(/\n/g, ' ')}`);

  // 4. Meta re-delivers the same message
  mark = sent.length;
  await post(webhook([question]));
  await sleep(4000);
  check(!sent.slice(mark).some((call) => call.body.type === 'text'), 're-delivered message is not answered twice');

  // 5. A voice message
  mark = sent.length;
  await post(webhook([{ id: 'wamid.customer2', from: CUSTOMER, timestamp: now(), type: 'audio', audio: { id: 'media1' } }]));
  const media = await waitForText(CUSTOMER, mark, 15);
  check(Boolean(media) && /me shkrim/.test(media.body.text.body), 'voice / photo gets the "text only" reply');

  // 6. The owner's decision (no such order) — handled without the assistant
  mark = sent.length;
  await post(webhook([{ id: 'wamid.owner1', from: OWNER, timestamp: now(), type: 'text', text: { body: 'KONFIRMO 999999' } }]));
  const toast = await waitForText(OWNER, mark, 15);
  check(Boolean(toast) && /nuk u gjet/i.test(toast.body.text.body), 'owner "KONFIRMO <id>" goes to the order decision (unknown order → "nuk u gjet")');

  // 7. The owner chatting is not answered by the assistant
  mark = sent.length;
  await post(webhook([{ id: 'wamid.owner2', from: OWNER, timestamp: now(), type: 'text', text: { body: 'Faleminderit' } }]));
  await sleep(4000);
  check(!sent.slice(mark).some((call) => call.body.type === 'text'), 'owner\'s ordinary messages are not answered by the assistant');
} finally {
  graph.close();
}

console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
