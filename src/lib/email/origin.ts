import { getSiteOrigin } from '@/lib/site-origin';

/**
 * Absolute origin (scheme://host[:port]) of the current request, used to
 * build links that must work from inside emails. Works in server actions
 * (request headers are still available) and honours proxy headers.
 */
export async function getRequestOrigin(): Promise<string> {
  return getSiteOrigin();
}
