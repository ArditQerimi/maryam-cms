'use client';

import { io, type Socket } from 'socket.io-client';

let messageSocket: Socket | null = null;

export function connectMessageSocket(input: {
  userId: number;
  companyId: number;
}): Socket {
  const socketUrl =
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  if (messageSocket && messageSocket.connected) {
    return messageSocket;
  }

  if (!socketUrl) {
    throw new Error('Socket URL is not configured. Set NEXT_PUBLIC_SOCKET_URL for production.');
  }

  messageSocket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    withCredentials: false,
    auth: {
      userId: String(input.userId),
      companyId: String(input.companyId),
    },
  });

  return messageSocket;
}

export function disconnectMessageSocket() {
  if (!messageSocket) return;
  messageSocket.disconnect();
  messageSocket = null;
}
