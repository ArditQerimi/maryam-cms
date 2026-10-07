/**
 * Server-side client for the whatsapp-agent service (see the whatsapp-agent
 * project). Configured with WHATSAPP_AGENT_URL / WHATSAPP_AGENT_TOKEN; the
 * token never reaches the browser.
 */
export function whatsAppAgentConfig() {
  const url = (process.env.WHATSAPP_AGENT_URL ?? '').replace(/\/+$/, '');
  const token = process.env.WHATSAPP_AGENT_TOKEN ?? '';
  const to = (process.env.WHATSAPP_AGENT_TO ?? '').replace(/\D/g, '');
  return { url, token, to, configured: Boolean(url && token) };
}

export async function agentRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, token } = whatsAppAgentConfig();
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(6000),
    cache: 'no-store',
  });
  const body = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !body) throw new Error(`agent-http-${response.status}`);
  return body;
}
