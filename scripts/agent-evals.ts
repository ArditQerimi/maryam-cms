/*
 * Golden dataset from the shop's own corrections (CMS → AI assistant → "Teach the assistant"):
 * every active correction is asked again to the real assistant, and the answer must contain the
 * key facts of the correct answer (numbers, prices, names).
 *
 *   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/agent-evals.ts <shop database url>
 *
 * Uses the model (AGENT_API_KEY) and waits between questions for the free per-minute quota.
 * Notifications and emails are switched off; nothing leaves the machine except the model calls.
 */
import Module from 'node:module';
import path from 'node:path';

const moduleInternals = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const resolveFilename = moduleInternals._resolveFilename;
moduleInternals._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === 'server-only') return path.join(process.cwd(), 'scripts', 'server-only-shim.cjs');
  return resolveFilename.call(this, request, ...rest);
};

for (const key of [
  'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'TELEGRAM_AGENT_BOT_TOKEN', 'WHATSAPP_AGENT_URL', 'WHATSAPP_AGENT_TOKEN',
  'WHATSAPP_CLOUD_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'TWILIO_ACCOUNT_SID', 'CALLMEBOT_APIKEY', 'BREVO_API_KEY', 'RESEND_API_KEY', 'SMTP_HOST', 'SMTP_PASS',
]) process.env[key] = '';
process.env.EMAIL_DELIVERY = 'off';

const url = process.argv[2] ?? '';
if (!url) {
  console.error('Pass the shop database connection string.');
  process.exit(2);
}
const PAUSE_MS = Number(process.env.EVAL_PAUSE_MS) || 20_000;

const fold = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/,/g, '.');

/** The facts an answer must keep: numbers (prices, pages, counts) and capitalised names. */
function keyFacts(answer: string) {
  const numbers = answer.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const names = (answer.match(/\b[A-ZÇË][\p{L}'’-]{3,}/gu) ?? []).filter((word) => !/^(Po|Jo|Ju|Na|Nese|Nëse|Për|Per|Pas|Kur|Ky|Kjo)$/.test(word));
  return [...new Set([...numbers.map((n) => n.replace(',', '.')), ...names.map(fold)])];
}

async function main() {
  const { sql } = await import('drizzle-orm');
  const { getTenantDb } = await import('../src/db/index');
  const { runAgent } = await import('../src/lib/agent/run');
  const { listCorrections } = await import('../src/lib/agent/store');
  type Env = Parameters<typeof runAgent>[0]['env'];

  const db = getTenantDb(url);
  const rowsOf = <T,>(result: unknown) => ((result as { rows?: T[] }).rows ?? []);
  // The company: in the database itself (standalone), or in the master database by database name.
  let company = rowsOf<{ id: number; subdomain: string; name: string }>(
    await db.execute(sql`SELECT id, subdomain, name FROM companies WHERE status = 'Active' ORDER BY id LIMIT 1`).catch(() => ({ rows: [] })))[0];
  if (!company) {
    const { Client } = await import('pg');
    const masterUrl = process.env.MASTER_DATABASE_URL || (() => { const u = new URL(url); u.pathname = '/pos_master'; return u.toString(); })();
    const master = new Client({ connectionString: masterUrl });
    await master.connect();
    const dbName = new URL(url).pathname.slice(1);
    company = (await master.query(`SELECT id, subdomain, name FROM companies WHERE db_connection_string LIKE '%/' || $1 || '%' OR 'pos_tenant_' || subdomain = $1 LIMIT 1`, [dbName])).rows[0];
    await master.end();
  }
  if (!company) throw new Error('Company not found for this database.');

  const cases = await listCorrections(db, { activeOnly: true });
  if (cases.length === 0) {
    console.log('No active corrections yet — write some in CMS → AI assistant.');
    process.exit(0);
  }

  let passed = 0;
  for (const [index, item] of cases.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    const env = {
      channel: 'web',
      sessionKey: `eval-${Date.now()}-${index}`,
      context: {
        company: { id: company.id, subdomain: company.subdomain, dbConnectionString: url, dbSchema: 'public', status: 'Active' },
        db, customer: null, session: null,
        requestHost: 'localhost', requestAuthority: 'localhost:3003', requestProtocol: 'http:', requestOrigin: 'http://localhost:3003',
      },
    } as unknown as Env;
    const reply = await runAgent({ env, shopName: company.name || company.subdomain, history: [], message: item.question });
    const facts = keyFacts(item.answer);
    const found = facts.filter((fact) => fold(reply).includes(fact));
    const share = facts.length ? found.length / facts.length : 1;
    const ok = share >= 0.6;
    passed += Number(ok);
    console.log(`\n[${ok ? 'PASS' : 'FAIL'}] #${item.id} "${item.question}"  (${found.length}/${facts.length} facts)`);
    console.log(`  expected: ${item.answer.replace(/\s+/g, ' ').slice(0, 200)}`);
    console.log(`  answer:   ${reply.replace(/\s+/g, ' ').slice(0, 300)}`);
    if (!ok) console.log(`  missing:  ${facts.filter((fact) => !found.includes(fact)).join(', ')}`);
  }
  console.log(`\n${passed}/${cases.length} corrections followed`);
  process.exit(passed === cases.length ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
