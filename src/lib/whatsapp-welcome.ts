import { eq, inArray } from 'drizzle-orm';
import { settingsStore } from '@/db/schema-tenant';
import type { getTenantDb } from '@/db/index';
import { cloudSend, cloudSendText, CloudApiError, type CloudConfig } from './whatsapp-cloud';

/*
 * Welcome message to a short list of numbers (the Meta test number's allowed recipients, or a few
 * customers). WhatsApp allows free text only within 24h of the person's last message; anyone else
 * gets an approved template (Meta's "hello_world" until the shop has its own). The webhook keeps,
 * for the listed numbers only, when each one last wrote.
 */

type Db = ReturnType<typeof getTenantDb>;

export const WELCOME_KEYS = {
  numbers: 'whatsapp_welcome_numbers',
  text: 'whatsapp_welcome_text',
  template: 'whatsapp_welcome_template',
  language: 'whatsapp_welcome_language',
  lastInbound: 'whatsapp_welcome_last_inbound',
} as const;

export const MAX_WELCOME_NUMBERS = 20;
const WINDOW_MS = 24 * 60 * 60 * 1000;

export const defaultWelcomeText = (shop: string) =>
  `Mirë se vini në ${shop}! 📚\nUnë jam asistenti i dyqanit: më shkruani çfarë libri kërkoni, pyetni për çmime ose dërgesë, ose porositni direkt këtu.`;

export type WelcomeSettings = { numbers: string[]; text: string; template: string; language: string };

export type WelcomeResult = { to: string; ok: boolean; via: 'text' | 'template'; error?: string };

const digits = (value: string) => value.replace(/\D/g, '').replace(/^00/, '');

/** One number per line / comma; only valid international numbers, no duplicates. */
export function parseNumbers(raw: string) {
  const seen = new Set<string>();
  const invalid: string[] = [];
  for (const part of raw.split(/[\n,;]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const number = digits(trimmed);
    if (/^\d{8,15}$/.test(number)) seen.add(number);
    else invalid.push(trimmed);
  }
  return { numbers: [...seen], invalid };
}

function parse(raw: string | undefined) {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

async function readAll(db: Db) {
  const rows = await db
    .select({ key: settingsStore.key, value: settingsStore.value })
    .from(settingsStore)
    .where(inArray(settingsStore.key, Object.values(WELCOME_KEYS)));
  return new Map(rows.map((row) => [row.key, parse(row.value)]));
}

async function write(db: Db, key: string, value: unknown) {
  const json = JSON.stringify(value);
  const updated = await db
    .update(settingsStore)
    .set({ value: json, updatedAt: new Date() })
    .where(eq(settingsStore.key, key))
    .returning({ id: settingsStore.id });
  if (updated.length === 0) await db.insert(settingsStore).values({ key, value: json });
}

export async function loadWelcomeSettings(db: Db, shop: string): Promise<WelcomeSettings> {
  const saved = await readAll(db).catch(() => new Map<string, unknown>());
  const numbers = saved.get(WELCOME_KEYS.numbers);
  const text = saved.get(WELCOME_KEYS.text);
  const template = saved.get(WELCOME_KEYS.template);
  const language = saved.get(WELCOME_KEYS.language);
  return {
    numbers: Array.isArray(numbers) ? numbers.filter((value): value is string => typeof value === 'string') : [],
    text: typeof text === 'string' && text.trim() ? text : defaultWelcomeText(shop),
    template: typeof template === 'string' ? template : '',
    language: typeof language === 'string' && language ? language : 'sq',
  };
}

export async function saveWelcomeSettings(db: Db, input: WelcomeSettings) {
  await write(db, WELCOME_KEYS.numbers, input.numbers);
  await write(db, WELCOME_KEYS.text, input.text);
  await write(db, WELCOME_KEYS.template, input.template);
  await write(db, WELCOME_KEYS.language, input.language);
}

async function lastInbound(db: Db): Promise<Record<string, string>> {
  const saved = (await readAll(db).catch(() => new Map<string, unknown>())).get(WELCOME_KEYS.lastInbound);
  return saved && typeof saved === 'object' && !Array.isArray(saved) ? (saved as Record<string, string>) : {};
}

/** Webhook: remember when a listed number last wrote (others are not stored). */
export async function noteWelcomeInbound(db: Db, from: string) {
  const saved = await readAll(db).catch(() => null);
  const numbers = saved?.get(WELCOME_KEYS.numbers);
  if (!Array.isArray(numbers) || !numbers.includes(from)) return;
  const seen = await lastInbound(db);
  const kept = Object.fromEntries(Object.entries(seen).filter(([number]) => numbers.includes(number)));
  await write(db, WELCOME_KEYS.lastInbound, { ...kept, [from]: new Date().toISOString() }).catch(() => undefined);
}

function describe(error: unknown) {
  if (error instanceof CloudApiError) {
    if (error.code === 131030) return 'notAllowed';
    if (error.code === 190 || error.status === 401) return 'badToken';
    if (error.code === 132001) return 'noTemplate';
    return `${error.code ?? error.status}: ${error.metaMessage}`.slice(0, 160);
  }
  return error instanceof Error ? error.message.slice(0, 160) : 'unknown';
}

/** Sends the welcome to every saved number: text inside the 24h window, otherwise the template. */
export async function sendWelcome(db: Db, config: CloudConfig, settings: WelcomeSettings): Promise<WelcomeResult[]> {
  const seen = await lastInbound(db);
  const template = settings.template.trim() || 'hello_world';
  const language = settings.template.trim() ? settings.language : 'en_US';
  const results: WelcomeResult[] = [];
  for (const to of settings.numbers) {
    const wrote = Date.parse(seen[to] ?? '');
    const insideWindow = Number.isFinite(wrote) && Date.now() - wrote < WINDOW_MS - 5 * 60_000;
    try {
      if (insideWindow) await cloudSendText(config, to, settings.text);
      else await cloudSend(config, { to, type: 'template', template: { name: template, language: { code: language } } });
      results.push({ to, ok: true, via: insideWindow ? 'text' : 'template' });
    } catch (error) {
      results.push({ to, ok: false, via: insideWindow ? 'text' : 'template', error: describe(error) });
    }
  }
  return results;
}
