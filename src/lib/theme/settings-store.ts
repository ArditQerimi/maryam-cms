import { eq, inArray } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import { settingsStore, themeSettings } from '@/db/schema-tenant';

/**
 * Small helpers around the flat `settings_store` (key/value) table and the
 * single-row-per-company `theme_settings` table.
 *
 * Values are stored as JSON strings so booleans/numbers round-trip; a value
 * that fails to parse is returned as the raw string.
 */

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

/** Read several keys in one query. Never throws — missing keys are just absent. */
export async function readSettingsValues(keys: string[]): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  if (!keys.length) return out;
  try {
    const db = await getContextDb();
    const rows = await db
      .select({ key: settingsStore.key, value: settingsStore.value })
      .from(settingsStore)
      .where(inArray(settingsStore.key, keys));
    for (const row of rows) out[row.key] = parseValue(row.value);
  } catch {
    // Callers keep their defaults when the store cannot be read.
  }
  return out;
}

export async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const values = await readSettingsValues([key]);
  return key in values ? (values[key] as T) : fallback;
}

/** Fill a defaults object with whatever is persisted (same shape in/out). */
export async function readSettingsWithDefaults<T extends Record<string, unknown>>(
  defaults: T,
): Promise<T> {
  const values = await readSettingsValues(Object.keys(defaults));
  const merged: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (key in values) merged[key] = values[key];
  }
  return merged as T;
}

export async function writeSetting(key: string, value: unknown): Promise<void> {
  const db = await getContextDb();
  const serialized = JSON.stringify(value ?? null);
  const now = new Date();
  await db
    .insert(settingsStore)
    .values({ key, value: serialized, updatedAt: now })
    .onConflictDoUpdate({
      target: settingsStore.key,
      set: { value: serialized, updatedAt: now },
    });
}

export async function writeSettings(entries: Array<[string, unknown]>): Promise<void> {
  for (const [key, value] of entries) {
    await writeSetting(key, value);
  }
}

/** The company's `theme_settings` row (no row yet → `null`). */
export async function getThemeSettings(companyId: number) {
  const db = await getContextDb();
  const rows = await db
    .select()
    .from(themeSettings)
    .where(eq(themeSettings.companyId, companyId))
    .limit(1);
  return rows[0] ?? null;
}

/** The company's `theme_settings` row, creating it on first use. */
export async function getOrCreateThemeSettings(companyId: number) {
  const existing = await getThemeSettings(companyId);
  if (existing) return existing;

  const db = await getContextDb();
  try {
    const [created] = await db
      .insert(themeSettings)
      .values({ companyId })
      .onConflictDoNothing()
      .returning();
    if (created) return created;
  } catch {
    // Concurrent insert — fall through and re-read below.
  }
  return getThemeSettings(companyId);
}
