const MAX_IMAGE_URL_LENGTH = 2_048;

function safeImageCandidate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (!candidate || candidate.length > MAX_IMAGE_URL_LENGTH || /[\u0000-\u001f\u007f]/.test(candidate)) {
    return null;
  }

  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate;

  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      || parsed.username
      || parsed.password
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function findImageCandidate(value: unknown, depth = 0): string | null {
  const direct = safeImageCandidate(value);
  if (direct) return direct;
  if (depth >= 2) return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = findImageCandidate(item, depth + 1);
      if (candidate) return candidate;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['src', 'url', 'imageUrl', 'secure_url']) {
      const candidate = findImageCandidate(record[key], depth + 1);
      if (candidate) return candidate;
    }
  }

  return null;
}

/**
 * Extract a usable image URL from legacy plain values or the dashboard's JSON
 * media arrays. Unsafe protocols, credential-bearing URLs, control characters,
 * and excessively long values are rejected instead of reaching an image src.
 */
export function parseImageUrl(raw: string | null | undefined, fallback = ''): string {
  if (!raw) return safeImageCandidate(fallback) || '';

  try {
    const parsed: unknown = JSON.parse(raw);
    return findImageCandidate(parsed) || safeImageCandidate(fallback) || '';
  } catch {
    return safeImageCandidate(raw) || safeImageCandidate(fallback) || '';
  }
}
