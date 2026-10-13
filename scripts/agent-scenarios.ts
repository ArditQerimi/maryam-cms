/*
 * Scenario tests for the shop assistant's tools (week 1, day 6) — deterministic, no AI calls:
 *
 *   npx tsx scripts/agent-scenarios.ts postgres://postgres:postgres@localhost:5432/pos_tenant_arditi_test
 *
 * Runs against a TEST copy of a shop database prepared with `npm run standalone -- convert`
 * (point-of-sale), so it holds the company row. Every outgoing channel is switched off first
 * (email, Telegram, WhatsApp): nothing leaves the machine. The test order is removed and the
 * stock put back at the end.
 */

import Module from 'node:module';
import path from 'node:path';

// App modules import Next.js's `server-only` marker, which only exists inside Next: stand in for it.
const moduleInternals = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const resolveFilename = moduleInternals._resolveFilename;
moduleInternals._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === 'server-only') return path.join(process.cwd(), 'scripts', 'server-only-shim.cjs');
  return resolveFilename.call(this, request, ...rest);
};

// Switch every notification / email channel off BEFORE the app modules (and dotenv) load.
for (const key of [
  'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'TELEGRAM_AGENT_BOT_TOKEN', 'WHATSAPP_AGENT_URL', 'WHATSAPP_AGENT_TOKEN',
  'WHATSAPP_CLOUD_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'TWILIO_ACCOUNT_SID', 'CALLMEBOT_APIKEY',
  'BREVO_API_KEY', 'RESEND_API_KEY', 'SMTP_HOST', 'SMTP_PASS', 'AGENT_API_KEY',
]) process.env[key] = '';
process.env.EMAIL_DELIVERY = 'off';

const url = process.argv[2] ?? '';
if (!/_test$/.test(new URL(url || 'postgres://x/none').pathname)) {
  console.error('Pass the connection string of a *_test database.');
  process.exit(2);
}
process.env.STANDALONE_DATABASE_URL = url; // the test copy holds its company row too

let failures = 0;
const check = (ok: boolean, label: string, detail?: unknown) => {
  if (!ok) failures += 1;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}${!ok && detail !== undefined ? `\n       ${JSON.stringify(detail).slice(0, 400)}` : ''}`);
};

async function main() {
  const { sql } = await import('drizzle-orm');
  const { getTenantDb } = await import('../src/db/index');
  const { runTool } = await import('../src/lib/agent/tools');
  const { maskArgs, hashSession } = await import('../src/lib/agent/store');
  type Env = Parameters<typeof runTool>[0];

  const db = getTenantDb(url);
  const rows = async <T,>(query: ReturnType<typeof sql>) => ((await db.execute(query)) as unknown as { rows: T[] }).rows;
  const [company] = await rows<{ id: number; subdomain: string }>(sql`SELECT id, subdomain FROM companies WHERE status = 'Active' ORDER BY id LIMIT 1`);
  if (!company) throw new Error('No company row in the test database (run `npm run standalone -- convert` in point-of-sale first).');

  const env = (sessionKey: string): Env => ({
    channel: 'whatsapp',
    sessionKey,
    context: {
      company: { id: company.id, subdomain: company.subdomain, dbConnectionString: url, dbSchema: 'public', status: 'Active' },
      db,
      customer: null,
      session: null,
      requestHost: 'localhost',
      requestAuthority: 'localhost:3003',
      requestProtocol: 'http:',
      requestOrigin: 'http://localhost:3003',
    } as Env['context'],
  });
  const started = new Date();
  const session = `scenario-${Date.now()}`;

  // ---------------------------------------------------------------- catalog
  const tefsir = await runTool(env(session), 'search_products', { query: 'libër tefsiri' }) as { products?: Array<{ name: string; variants: Array<{ price: string | null }> }> };
  const found = tefsir.products ?? [];
  check(found.length >= 2 && found.some((p) => /koment/i.test(p.name)) && found[0].variants.some((v) => v.price !== null),
    `search "tefsir" also finds "Koment …" books, buyable first (${found.length} found)`, found.map((p) => p.name));

  const nothing = await runTool(env(session), 'search_products', { query: 'xyzzyqwv' }) as { products?: unknown[]; note?: string };
  check((nothing.products ?? []).length === 0 && Boolean(nothing.note), 'search for something that does not exist: empty + a note (no invention)');

  const top = await runTool(env(session), 'browse_products', { sort: 'popular', limit: 10 }) as { products?: Array<{ variants: Array<{ price: string | null }>; stockLeft: number }>; totalMatching?: number };
  const list = top.products ?? [];
  check(list.length === 10 && list.every((p) => p.stockLeft > 0 && p.variants.some((v) => v.price !== null)),
    `browse popular: 10 products, all priced and in stock (of ${top.totalMatching})`);

  const capped = await runTool(env(session), 'browse_products', { sort: 'cheapest', limit: 99 }) as { products?: Array<{ variants: Array<{ price: string | null }> }> };
  const prices = (capped.products ?? []).map((p) => Number(p.variants.find((v) => v.price !== null)?.price ?? 0));
  check(prices.length === 15 && prices.every((price, i) => i === 0 || price >= prices[i - 1] - 0.0001), 'browse cheapest: limit capped at 15, sorted by price');

  const noCategory = await runTool(env(session), 'browse_products', { category: 'kategori-qe-nuk-ekziston' }) as { products?: unknown[]; categories?: unknown[] };
  check((noCategory.products ?? []).length === 0 && (noCategory.categories ?? []).length > 0, 'browse an unknown category: no products, the real categories offered');

  // ---------------------------------------------------------------- order guardrails
  const [buyable] = await rows<{ product_id: number; variant_id: number; stock: number }>(sql`
    SELECT p.id AS product_id, v.id AS variant_id, p.stock_quantity AS stock FROM products p
    JOIN product_variants v ON v.product_id = p.id AND v.status = 'Active'
    WHERE p.status = 'Active' AND p.price > 0 AND v.price > 0 AND p.stock_quantity >= 5
      AND NOT EXISTS (SELECT 1 FROM product_stocks s WHERE s.variant_id = v.id)
    ORDER BY p.id LIMIT 1`);
  const [unpriced] = await rows<{ product_id: number; variant_id: number }>(sql`
    SELECT p.id AS product_id, v.id AS variant_id FROM products p JOIN product_variants v ON v.product_id = p.id
    WHERE p.status = 'Active' AND coalesce(v.price, 0) <= 0 ORDER BY p.id LIMIT 1`);
  const customer = {
    firstName: 'Test', lastName: 'Skenari', phone: '+38349000999', email: 'skenari@example.invalid',
    address: 'Rruga Test 1', city: 'Prishtinë', country: 'XK',
  };
  const order = (sessionKey: string, items: unknown[], extra: Record<string, unknown> = {}) =>
    runTool(env(sessionKey), 'place_order', { items, ...customer, ...extra }) as Promise<{ ok: boolean; error?: string; orderNumber?: string }>;

  const zero = await order(`${session}-q0`, [{ productId: buyable.product_id, variantId: buyable.variant_id, quantity: 0 }]);
  const eleven = await order(`${session}-q11`, [{ productId: buyable.product_id, variantId: buyable.variant_id, quantity: 11 }]);
  check(!zero.ok && !eleven.ok, 'order with quantity 0 or 11 is refused (allowed 1-10)', { zero, eleven });

  const ghost = await order(`${session}-ghost`, [{ productId: 99999999, variantId: 99999999, quantity: 1 }]);
  check(!ghost.ok, 'order for a product that does not exist is refused', ghost);

  if (unpriced) {
    const noPrice = await order(`${session}-noprice`, [{ productId: unpriced.product_id, variantId: unpriced.variant_id, quantity: 1 }]);
    check(!noPrice.ok && /çmim/i.test(noPrice.error ?? ''), 'order for a product without a price is refused (the model never sets prices)', noPrice);
  }

  const empty = await order(`${session}-empty`, []);
  check(!empty.ok, 'order without products is refused', empty);

  const noEmail = await order(`${session}-noemail`, [{ productId: buyable.product_id, variantId: buyable.variant_id, quantity: 1 }], { email: '' });
  check(!noEmail.ok, 'order without the customer\'s email is refused', noEmail);

  // ---------------------------------------------------------------- the normal order, end to end
  const stockBefore = buyable.stock;
  const normal = await order(`${session}-ok`, [{ productId: buyable.product_id, variantId: buyable.variant_id, quantity: 2 }]);
  const [after] = await rows<{ stock: number }>(sql`SELECT stock_quantity AS stock FROM products WHERE id = ${buyable.product_id}`);
  const [sale] = await rows<{ id: number; status: string; is_online: boolean }>(sql`
    SELECT s.id, s.status::text, s.is_online FROM sales s
    JOIN order_notes n ON n.order_id = s.id AND n.body LIKE '🤖 Porosi e marrë nga agjenti AI%'
    WHERE s.created_at >= ${started.toISOString()}::timestamp - interval '1 minute' ORDER BY s.id DESC LIMIT 1`);
  check(normal.ok && Boolean(normal.orderNumber) && sale?.status === 'Pending' && sale.is_online && after.stock === stockBefore - 2,
    `normal order: created Pending online (${normal.orderNumber}), stock ${stockBefore} → ${after?.stock}, AI note added`, normal);

  if (normal.ok && normal.orderNumber) {
    const wrong = await runTool(env(session), 'check_order', { orderNumber: normal.orderNumber, phone: '+38344111222' }) as { ok: boolean };
    const right = await runTool(env(session), 'check_order', { orderNumber: normal.orderNumber, phone: customer.phone }) as { ok: boolean; status?: string };
    check(!wrong.ok && right.ok, `order status only with the matching phone (status: ${right.status})`);
  }

  const limited: Array<{ ok: boolean; error?: string }> = [];
  for (let i = 0; i < 4; i += 1) limited.push(await order(`${session}-flood`, [{ productId: 99999999, variantId: 99999999, quantity: 1 }]));
  check(/Shumë porosi/.test(limited[3].error ?? ''), 'a 4th order attempt within the hour from one chat is refused (max 3)', limited[3]);

  // ---------------------------------------------------------------- audit privacy helpers
  const masked = maskArgs({ items: [1], firstName: 'Ana', phone: '+383', email: 'a@b.c', address: 'X', city: 'Prishtinë' });
  check(masked.firstName === '***' && masked.phone === '***' && masked.email === '***' && masked.address === '***' && masked.city === 'Prishtinë',
    'audit trail masks name / phone / email / address in tool arguments');
  check(hashSession('tg:123') === hashSession('tg:123') && hashSession('tg:123') !== hashSession('tg:124') && !hashSession('tg:123').includes('123'),
    'audit trail stores chats as a stable hash, not the number');

  // ---------------------------------------------------------------- clean up the test order
  const created = await rows<{ id: number }>(sql`SELECT id FROM sales WHERE is_online AND created_at >= ${started.toISOString()}::timestamp - interval '1 minute'`);
  for (const { id } of created) {
    await db.execute(sql`DELETE FROM order_notes WHERE order_id = ${id}`);
    await db.execute(sql`DELETE FROM storefront_order_details WHERE sale_id = ${id}`).catch(() => undefined);
    await db.execute(sql`DELETE FROM storefront_order_access WHERE sale_id = ${id}`).catch(() => undefined);
    await db.execute(sql`DELETE FROM sale_items WHERE sale_id = ${id}`);
    await db.execute(sql`DELETE FROM sales WHERE id = ${id}`);
  }
  await db.execute(sql`UPDATE products SET stock_quantity = ${stockBefore} WHERE id = ${buyable.product_id}`);
  console.log(`       cleaned up ${created.length} test order(s), stock back to ${stockBefore}`);

  console.log(failures === 0 ? 'ALL SCENARIOS PASSED' : `${failures} SCENARIO(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
