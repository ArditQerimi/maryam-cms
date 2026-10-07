'use server';

import { requireCmsSession } from '@/lib/cms/session';
import { agentRequest, whatsAppAgentConfig } from '@/lib/whatsapp-agent';

export type WhatsAppStatus =
  | { state: 'not-configured' }
  | { state: 'unreachable' }
  | { state: 'linked'; number: string | null; sendTo: string }
  | { state: 'waiting-for-scan'; qr: string | null };

/** Status of the linked WhatsApp account (and the QR to scan while it is not linked). CMS users only. */
export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  await requireCmsSession();
  const config = whatsAppAgentConfig();
  if (!config.configured) return { state: 'not-configured' };
  try {
    const status = await agentRequest<{ linked: boolean; qr: string | null; number: string | null }>('/qr');
    return status.linked
      ? { state: 'linked', number: status.number, sendTo: config.to }
      : { state: 'waiting-for-scan', qr: status.qr };
  } catch {
    return { state: 'unreachable' };
  }
}

/** Sends a short test message to the configured notification number. */
export async function sendWhatsAppTest(): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireCmsSession();
  const config = whatsAppAgentConfig();
  if (!config.configured || !config.to) {
    return { ok: false, error: 'WHATSAPP_AGENT_TO is not set.' };
  }
  try {
    await agentRequest('/send', {
      method: 'POST',
      body: JSON.stringify({ to: config.to, text: '✅ Test nga CMS: lidhja me WhatsApp punon.' }),
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'The message could not be sent. Is WhatsApp linked and the number allowed?' };
  }
}
