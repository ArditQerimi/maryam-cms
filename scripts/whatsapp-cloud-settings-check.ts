/*
 * Checks the per-business WhatsApp Cloud settings against a TEST tenant database:
 *   npx tsx scripts/whatsapp-cloud-settings-check.ts postgres://postgres:postgres@localhost:5432/pos_tenant_arditi_test
 * Saves → reads back → secrets are encrypted at rest → keeping secrets on re-save → disconnect.
 */
import { inArray } from 'drizzle-orm';
import { getTenantDb } from '../src/db/index';
import { settingsStore } from '../src/db/schema-tenant';
import { clearWhatsAppCloudSettings, loadWhatsAppCloudConfig, saveWhatsAppCloudSettings, WA_KEYS } from '../src/lib/whatsapp-cloud';

const url = process.argv[2];
if (!url || !new URL(url).pathname.endsWith('_test')) {
  console.error('Pass the connection string of a *_test database.');
  process.exit(2);
}

let failures = 0;
const check = (ok: boolean, label: string) => {
  if (!ok) failures += 1;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}`);
};

async function main() {
  const db = getTenantDb(url);
  const raw = async () => new Map((await db.select().from(settingsStore).where(inArray(settingsStore.key, Object.values(WA_KEYS)))).map((row) => [row.key, row.value]));
  try {
    await clearWhatsAppCloudSettings(db);
    const empty = await loadWhatsAppCloudConfig(db);
    check(empty.source !== 'cms' && !empty.configured, 'nothing saved → not configured from the CMS');

    await saveWhatsAppCloudSettings(db, {
      phoneNumberId: '123456789012345', token: 'EAAG-test-token-value', appSecret: '0123456789abcdef0123456789abcdef',
      owner: '+383 49 000 111', template: 'porosi_e_re', agentEnabled: true,
    });
    const config = await loadWhatsAppCloudConfig(db);
    check(config.source === 'cms' && config.token === 'EAAG-test-token-value' && config.appSecret === '0123456789abcdef0123456789abcdef'
      && config.owner === '38349000111' && config.configured && config.agentEnabled, 'saved settings are read back (owner digits only)');
    check(/^wa-[\w-]{20,}$/.test(config.verifyToken), 'a verify token is generated');

    const stored = await raw();
    const tokenAtRest = String(stored.get(WA_KEYS.token));
    check(tokenAtRest.includes('enc:v1:') && !tokenAtRest.includes('EAAG') && !String(stored.get(WA_KEYS.appSecret)).includes('0123456789abcdef'),
      'token and app secret are encrypted in the database');

    await saveWhatsAppCloudSettings(db, { phoneNumberId: '123456789012345', owner: '38349000111', agentEnabled: false });
    const kept = await loadWhatsAppCloudConfig(db);
    check(kept.token === 'EAAG-test-token-value' && kept.verifyToken === config.verifyToken && !kept.agentEnabled,
      're-saving with empty secrets keeps them and the verify token; the assistant can be switched off');

    await clearWhatsAppCloudSettings(db);
    check((await raw()).size === 0, 'disconnect removes every WhatsApp setting');
  } finally {
    await clearWhatsAppCloudSettings(db).catch(() => undefined);
  }
  console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
