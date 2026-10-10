import { randomBytes } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { settingsStore } from '@/db/schema-tenant';
import type { getTenantDb } from '@/db/index';
import { openSecret, sealSecret } from './secret-box';

/**
 * WhatsApp Cloud API (Meta) — the official API, no QR code and no phone kept online.
 *
 * Every business configures its own account in the CMS (Settings → WhatsApp): the values live in
 * that business's settings_store, the access token and app secret encrypted (secret-box). The
 * webhook URL is the business's own domain, so each request is answered with its own settings.
 * Environment variables are only a fallback for a single-shop install:
 *   WHATSAPP_CLOUD_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_OWNER_TO, WHATSAPP_APP_SECRET,
 *   WHATSAPP_VERIFY_TOKEN, WHATSAPP_ORDER_TEMPLATE, WHATSAPP_CLOUD_AGENT ("off")
 *   WHATSAPP_GRAPH_URL — Graph API base, only for the local webhook simulator
 */

type Db = ReturnType<typeof getTenantDb>;

export const WA_KEYS = {
  phoneNumberId: 'whatsapp_cloud_phone_number_id',
  token: 'whatsapp_cloud_token',
  appSecret: 'whatsapp_cloud_app_secret',
  verifyToken: 'whatsapp_cloud_verify_token',
  owner: 'whatsapp_cloud_owner_to',
  template: 'whatsapp_cloud_order_template',
  agent: 'whatsapp_cloud_agent',
  verifiedAt: 'whatsapp_cloud_verified_at',
  lastInboundAt: 'whatsapp_cloud_last_inbound_at',
} as const;

export type CloudConfig = {
  source: 'cms' | 'env' | 'none';
  token: string;
  phoneNumberId: string;
  owner: string;
  appSecret: string;
  verifyToken: string;
  template: string;
  /** Customers get answers by the shop assistant. */
  agentEnabled: boolean;
  /** Can send messages at all (token + number id). */
  canSend: boolean;
  /** New orders can be sent to the owner. */
  configured: boolean;
  /** A saved secret could not be decrypted (SESSION_SECRET changed): it must be entered again. */
  unreadableSecrets: boolean;
  verifiedAt: string;
  lastInboundAt: string;
};

const digits = (value: string) => value.replace(/\D/g, '').replace(/^00/, '');

function parse(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    return typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
  } catch {
    return raw;
  }
}

async function readKeys(db: Db) {
  const rows = await db
    .select({ key: settingsStore.key, value: settingsStore.value })
    .from(settingsStore)
    .where(inArray(settingsStore.key, Object.values(WA_KEYS)));
  return new Map(rows.map((row) => [row.key, parse(row.value).trim()]));
}

function finish(base: Omit<CloudConfig, 'canSend' | 'configured' | 'agentEnabled'>, agentSetting: string): CloudConfig {
  const canSend = Boolean(base.token && base.phoneNumberId);
  return {
    ...base,
    canSend,
    configured: canSend && Boolean(base.owner),
    agentEnabled: canSend && agentSetting !== 'off',
  };
}

/** This business's WhatsApp Cloud settings (CMS first, environment as fallback). */
export async function loadWhatsAppCloudConfig(db: Db): Promise<CloudConfig> {
  const saved = await readKeys(db).catch(() => new Map<string, string>());
  const stamps = { verifiedAt: saved.get(WA_KEYS.verifiedAt) ?? '', lastInboundAt: saved.get(WA_KEYS.lastInboundAt) ?? '' };

  if (saved.get(WA_KEYS.phoneNumberId)) {
    const token = openSecret(saved.get(WA_KEYS.token)) ?? '';
    const appSecret = openSecret(saved.get(WA_KEYS.appSecret)) ?? '';
    return finish({
      source: 'cms',
      token,
      phoneNumberId: saved.get(WA_KEYS.phoneNumberId) ?? '',
      owner: digits(saved.get(WA_KEYS.owner) ?? ''),
      appSecret,
      verifyToken: saved.get(WA_KEYS.verifyToken) ?? '',
      template: saved.get(WA_KEYS.template) ?? '',
      unreadableSecrets: (Boolean(saved.get(WA_KEYS.token)) && !token) || (Boolean(saved.get(WA_KEYS.appSecret)) && !appSecret),
      ...stamps,
    }, saved.get(WA_KEYS.agent) ?? '');
  }

  const env = process.env;
  const fromEnv = Boolean(env.WHATSAPP_CLOUD_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
  return finish({
    source: fromEnv ? 'env' : 'none',
    token: env.WHATSAPP_CLOUD_TOKEN ?? '',
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    owner: digits(env.WHATSAPP_OWNER_TO ?? ''),
    appSecret: env.WHATSAPP_APP_SECRET ?? '',
    verifyToken: env.WHATSAPP_VERIFY_TOKEN ?? '',
    template: env.WHATSAPP_ORDER_TEMPLATE ?? '',
    unreadableSecrets: false,
    ...stamps,
  }, env.WHATSAPP_CLOUD_AGENT ?? '');
}

async function writeKeys(db: Db, values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    await db
      .insert(settingsStore)
      .values({ key, value: JSON.stringify(value) })
      .onConflictDoUpdate({ target: settingsStore.key, set: { value: JSON.stringify(value), updatedAt: new Date() } });
  }
}

/** Saves the CMS form. Empty token / app secret keep the stored ones (they are never shown back). */
export async function saveWhatsAppCloudSettings(db: Db, input: {
  phoneNumberId: string;
  token?: string;
  appSecret?: string;
  owner: string;
  template?: string;
  agentEnabled: boolean;
}) {
  const values: Record<string, string> = {
    [WA_KEYS.phoneNumberId]: input.phoneNumberId.trim(),
    [WA_KEYS.owner]: digits(input.owner),
    [WA_KEYS.template]: (input.template ?? '').trim(),
    [WA_KEYS.agent]: input.agentEnabled ? 'on' : 'off',
  };
  if (input.token?.trim()) values[WA_KEYS.token] = sealSecret(input.token.trim());
  if (input.appSecret?.trim()) values[WA_KEYS.appSecret] = sealSecret(input.appSecret.trim());
  const existing = await readKeys(db);
  if (!existing.get(WA_KEYS.verifyToken)) values[WA_KEYS.verifyToken] = `wa-${randomBytes(18).toString('base64url')}`;
  await writeKeys(db, values);
}

/** Removes the business's WhatsApp Cloud settings (disconnect). */
export async function clearWhatsAppCloudSettings(db: Db) {
  await db.delete(settingsStore).where(inArray(settingsStore.key, Object.values(WA_KEYS)));
}

/** Remembers when Meta verified the webhook / last delivered a message (for the CMS status). */
export async function stampWhatsAppCloud(db: Db, what: 'verifiedAt' | 'lastInboundAt') {
  await writeKeys(db, { [WA_KEYS[what]]: new Date().toISOString() }).catch(() => undefined);
}

function graphBase() {
  return (process.env.WHATSAPP_GRAPH_URL || 'https://graph.facebook.com/v21.0').replace(/\/+$/, '');
}

export class CloudApiError extends Error {
  constructor(public status: number, public code: number | undefined, public metaMessage: string) {
    super(`cloud-api-${status}`);
  }
}

async function graph(config: CloudConfig, path: string, init?: RequestInit) {
  const response = await fetch(`${graphBase()}/${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
  const body = (await response.json().catch(() => null)) as { error?: { code?: number; message?: string } } | null;
  if (!response.ok) throw new CloudApiError(response.status, body?.error?.code, body?.error?.message ?? '');
  return body as Record<string, unknown> | null;
}

export async function cloudSend(config: CloudConfig, payload: Record<string, unknown>) {
  await graph(config, `${config.phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });
}

/** Checks the token and number id with Meta; returns the number's public details. */
export async function cloudCheck(config: CloudConfig) {
  const info = await graph(config, `${config.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`);
  return {
    number: String(info?.display_phone_number ?? ''),
    name: String(info?.verified_name ?? ''),
    quality: String(info?.quality_rating ?? ''),
  };
}

export function cloudSendText(config: CloudConfig, to: string, text: string) {
  return cloudSend(config, { to, type: 'text', text: { body: text.slice(0, 4000) } });
}

/** Blue ticks on the customer's message plus "typing…" while the assistant writes (best effort). */
export function cloudMarkReadTyping(config: CloudConfig, messageId: string) {
  return cloudSend(config, { status: 'read', message_id: messageId, typing_indicator: { type: 'text' } });
}

/** Order message with two reply buttons (works while the owner's 24h window is open). */
export function cloudSendOrderButtons(config: CloudConfig, to: string, text: string, saleId: number) {
  return cloudSend(config, {
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: text.slice(0, 1000) },
      action: {
        buttons: [
          { type: 'reply', reply: { id: `ok:${saleId}`, title: '✅ Konfirmo' } },
          { type: 'reply', reply: { id: `no:${saleId}`, title: '❌ Anulo' } },
        ],
      },
    },
  });
}

/** Template message for when the 24h window is closed (business-initiated). */
export function cloudSendOrderTemplate(config: CloudConfig, to: string, template: string, values: [string, string, string]) {
  return cloudSend(config, {
    to,
    type: 'template',
    template: {
      name: template,
      language: { code: 'sq' },
      components: [{ type: 'body', parameters: values.map((text) => ({ type: 'text', text: text.slice(0, 900) })) }],
    },
  });
}
