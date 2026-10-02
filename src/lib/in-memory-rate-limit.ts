/**
 * Tiny in-memory sliding-window limiter for server actions (password reset
 * requests, verification resends). Process-local by design: it throttles
 * accidental repeats and abuse on a single instance without adding
 * infrastructure. Callers key by something the requester controls (email).
 */
const buckets = new Map<string, number[]>();

/** Returns true when the request is allowed, false when the window is full. */
export function allowRequest(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (buckets.get(key) || []).filter((at) => at > cutoff);

  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }

  hits.push(now);
  buckets.set(key, hits);

  // Opportunistic cleanup so an unbounded key space cannot grow forever.
  if (buckets.size > 5000) {
    for (const [bucketKey, timestamps] of buckets) {
      if (timestamps.every((at) => at <= cutoff)) buckets.delete(bucketKey);
    }
  }

  return true;
}
