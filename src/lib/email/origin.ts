import { headers } from 'next/headers';

/**
 * Absolute origin (scheme://host[:port]) of the current request, used to
 * build links that must work from inside emails. Works in server actions
 * (request headers are still available) and honours proxy headers.
 */
export async function getRequestOrigin(): Promise<string> {
  const headerStore = await headers();
  const host = (headerStore.get('x-forwarded-host') || headerStore.get('host') || '').trim();
  const forwardedProto = (headerStore.get('x-forwarded-proto') || '').split(',')[0].trim();
  const isLocal = /^localhost(:|$)|^127\.0\.0\.1(:|$)|^\[::1\](:|$)/.test(host);
  const protocol = forwardedProto || (isLocal || !host ? 'http' : 'https');
  return `${protocol}://${host || 'localhost:3003'}`;
}
