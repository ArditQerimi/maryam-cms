'use server';

import { requireCmsSession } from '@/lib/cms/session';
import { getRequestOrigin } from '@/lib/email/origin';
import { getContextDb } from '@/lib/tenant';
import {
  clearWhatsAppCloudSettings,
  CloudApiError,
  cloudCheck,
  cloudSendText,
  loadWhatsAppCloudConfig,
  saveWhatsAppCloudSettings,
} from '@/lib/whatsapp-cloud';

/** What the CMS setup page shows. Secrets are never sent back to the browser, only whether they are set. */
export type WhatsAppCloudStatus = {
  source: 'cms' | 'env' | 'none';
  phoneNumberId: string;
  owner: string;
  template: string;
  agentEnabled: boolean;
  hasToken: boolean;
  hasAppSecret: boolean;
  unreadableSecrets: boolean;
  webhookUrl: string;
  verifyToken: string;
  verifiedAt: string;
  lastInboundAt: string;
};

export async function getWhatsAppCloudStatus(): Promise<WhatsAppCloudStatus> {
  await requireCmsSession();
  const config = await loadWhatsAppCloudConfig(await getContextDb());
  const origin = await getRequestOrigin().catch(() => '');
  return {
    source: config.source,
    phoneNumberId: config.phoneNumberId,
    owner: config.owner,
    template: config.template,
    agentEnabled: config.source === 'none' ? true : config.agentEnabled,
    hasToken: Boolean(config.token),
    hasAppSecret: Boolean(config.appSecret),
    unreadableSecrets: config.unreadableSecrets,
    webhookUrl: origin ? `${origin.replace(/\/+$/, '')}/api/whatsapp/cloud` : '/api/whatsapp/cloud',
    verifyToken: config.verifyToken,
    verifiedAt: config.verifiedAt,
    lastInboundAt: config.lastInboundAt,
  };
}

/** code → cmssettings.waCloud.msg.<code> in the dictionaries; params fill its {placeholders}. */
export type CloudActionResult = { ok: boolean; code: string; params?: Record<string, string> };
const fail = (code: string, params?: Record<string, string>): CloudActionResult => ({ ok: false, code, params });
const done = (code: string, params?: Record<string, string>): CloudActionResult => ({ ok: true, code, params });

/** Meta's error, in words the shop understands. */
function explain(error: unknown): CloudActionResult {
  if (error instanceof CloudApiError) {
    if (error.code === 190 || error.status === 401) return fail('badToken');
    if (error.code === 100 || error.status === 404) return fail('unknownNumberId');
    if (error.code === 131030) return fail('ownerNotAllowed');
    if (error.code === 131047) return fail('windowClosed');
    return fail('meta', { detail: error.metaMessage || String(error.status) });
  }
  return fail('unreachable');
}

export async function saveWhatsAppCloud(input: {
  phoneNumberId: string;
  token: string;
  appSecret: string;
  owner: string;
  template: string;
  agentEnabled: boolean;
}): Promise<CloudActionResult> {
  await requireCmsSession();
  const db = await getContextDb();
  const current = await loadWhatsAppCloudConfig(db);
  const keepsSecrets = current.source === 'cms' && !current.unreadableSecrets;

  const phoneNumberId = input.phoneNumberId.trim();
  const owner = input.owner.replace(/\D/g, '').replace(/^00/, '');
  if (!/^\d{8,20}$/.test(phoneNumberId)) return fail('numberIdFormat');
  if (!input.token.trim() && !(keepsSecrets && current.token)) return fail('tokenMissing');
  if (!input.appSecret.trim() && !(keepsSecrets && current.appSecret)) return fail('appSecretMissing');
  if (input.appSecret.trim() && !/^[a-f0-9]{32}$/i.test(input.appSecret.trim())) return fail('appSecretFormat');
  if (owner && !/^\d{8,15}$/.test(owner)) return fail('ownerFormat');
  if (input.template.trim() && !/^[a-z0-9_]{1,512}$/.test(input.template.trim())) return fail('templateFormat');

  try {
    await saveWhatsAppCloudSettings(db, { ...input, phoneNumberId, owner });
  } catch {
    return fail('encryption');
  }
  return done('saved');
}

/** Checks the saved token + number with Meta and, when an owner number is set, sends a test message. */
export async function testWhatsAppCloud(): Promise<CloudActionResult> {
  await requireCmsSession();
  const config = await loadWhatsAppCloudConfig(await getContextDb());
  if (!config.canSend) return fail('saveFirst');
  try {
    const info = await cloudCheck(config);
    const label = [info.name, info.number].filter(Boolean).join(' · ') || config.phoneNumberId;
    if (!config.owner) return done('connectedNoOwner', { label });
    await cloudSendText(config, config.owner, '✅ WhatsApp ↔ CMS: OK');
    return done('connected', { label, owner: `+${config.owner}` });
  } catch (error) {
    return explain(error);
  }
}

export async function disconnectWhatsAppCloud(): Promise<CloudActionResult> {
  await requireCmsSession();
  await clearWhatsAppCloudSettings(await getContextDb());
  return done('disconnected');
}
