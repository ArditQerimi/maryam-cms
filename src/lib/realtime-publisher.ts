type SocketEmitPayload = {
  event: string;
  rooms?: string[];
  payload?: Record<string, unknown>;
  baseUrl?: string;
};

export async function publishSocketEvent(data: SocketEmitPayload): Promise<void> {
  const socketServerUrl =
    process.env.SOCKET_SERVER_URL ||
    data.baseUrl ||
    'http://localhost:4001';
  const socketSecret = process.env.SOCKET_SERVER_SECRET || '';

  try {
    await fetch(`${socketServerUrl}/emit`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-socket-secret': socketSecret,
      },
      body: JSON.stringify(data),
      cache: 'no-store',
    });
  } catch {
    // No-op: messaging remains functional even if realtime transport is offline.
  }
}
