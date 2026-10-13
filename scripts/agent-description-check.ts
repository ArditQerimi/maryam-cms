/*
 * Description search check: questions taken from product DESCRIPTIONS (not titles) must find the
 * product in the top 3 — with keyword search alone (no vectors, as on the live shop).
 *
 *   npx tsx scripts/agent-description-check.ts postgres://postgres:postgres@localhost:5432/pos_tenant_arditi_test
 */
import Module from 'node:module';
import path from 'node:path';

const moduleInternals = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const resolveFilename = moduleInternals._resolveFilename;
moduleInternals._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === 'server-only') return path.join(process.cwd(), 'scripts', 'server-only-shim.cjs');
  return resolveFilename.call(this, request, ...rest);
};

const url = process.argv[2] ?? '';
if (!/_test$/.test(new URL(url || 'postgres://x/none').pathname)) {
  console.error('Pass the connection string of a *_test database.');
  process.exit(2);
}
process.env.STANDALONE_DATABASE_URL = url;
process.env.AGENT_EMBEDDINGS = process.env.AGENT_EMBEDDINGS || 'off';

// question (words from the description, not the title) → part of the expected title
const CASES: Array<[string, RegExp]> = [
  ['tregime për sfidat e mbulesës', /hixhab/i],
  ['libër për femrat muslimane shqiptare', /hixhab/i],
  ['ul sheqerin në gjak', /farës së zezë|fares se zeze|uthull/i],
  ['diçka kundër kolesterolit', /uthull/i],
  ['për prostatën e zmadhuar', /kungull/i],
  ['libra nga Ibn Abdulberr', /treguesi/i],
  ['përkthyer nga Blerim Rexha', /ibrahim|celes|çelës|medim/i],
  ['libra të Shefqet Krasniqit', /koment|djaloshi|krasniq/i],
  ['libër me 7563 hadithe', /buhari/i],
  ['libër i ilustruar', /heroi/i],
  ['aromë orientale e ëmbël', /khamrah/i],
  ['kundër mikrobeve', /farës së zezë|fares se zeze/i],
  ['flokë të thata', /rozmarin/i],
  ['hurme të freskëta', /hurme|sukeri/i],
  ['libër me 4700 faqe', /muslim/i],
];

async function main() {
  const { getTenantDb } = await import('../src/db/index');
  const { runTool } = await import('../src/lib/agent/tools');
  const { sql } = await import('drizzle-orm');
  type Env = Parameters<typeof runTool>[0];
  const db = getTenantDb(url);
  const [company] = ((await db.execute(sql`SELECT id, subdomain FROM companies WHERE status = 'Active' ORDER BY id LIMIT 1`)) as unknown as { rows: Array<{ id: number; subdomain: string }> }).rows;
  const env = { channel: 'web', sessionKey: `desc-${Date.now()}`, context: {
    company: { id: company.id, subdomain: company.subdomain, dbConnectionString: url, dbSchema: 'public', status: 'Active' },
    db, customer: null, session: null, requestHost: 'localhost', requestAuthority: 'localhost:3003', requestProtocol: 'http:', requestOrigin: 'http://localhost:3003',
  } } as unknown as Env;

  let hits = 0;
  for (const [question, expect] of CASES) {
    const result = await runTool(env, 'search_products', { query: question }) as { products?: Array<{ name: string }> };
    const names = (result.products ?? []).slice(0, 3).map((p) => p.name.replace(/^Titulli:\s*/i, ''));
    const ok = names.some((name) => expect.test(name));
    const top = names.map((name) => name.slice(0, 30));
    hits += Number(ok);
    console.log(`${ok ? '✔' : '✘'} ${question.padEnd(38)} → ${top.join(' | ') || '—'}`);
  }
  console.log(`\nfound from the description: ${hits}/${CASES.length} (vectors: ${process.env.AGENT_EMBEDDINGS})`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
