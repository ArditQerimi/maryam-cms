import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import { passwordResetTokens } from '@/db/schema-tenant';

/**
 * Single-use auth tokens for the storefront email flows (password reset and
 * email confirmation). Only the SHA-256 digest of a token is persisted — a
 * database leak cannot be replayed against the storefront — and consuming a
 * token marks it used so every emailed link works exactly once.
 */

export type AuthTokenPurpose = 'password_reset' | 'email_verification';

/** Password reset links expire after one hour. */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** Email confirmation links expire after 24 hours. */
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Issues a fresh token for a user. Older unconsumed rows for the same
 * (user, purpose) are marked used first, so only the most recently emailed
 * link stays valid. The plaintext token is returned once and never stored.
 */
export async function issueAuthToken(
  userId: number,
  purpose: AuthTokenPurpose,
  ttlMs: number,
): Promise<string> {
  const db = await getContextDb();
  const token = randomBytes(32).toString('hex');

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokens.userId, userId),
        eq(passwordResetTokens.purpose, purpose),
        isNull(passwordResetTokens.usedAt),
      ),
    );

  await db.insert(passwordResetTokens).values({
    userId,
    purpose,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMs),
  });

  return token;
}

/**
 * Validates and consumes a token in one step (single use). Returns the user
 * the token belonged to, or null when it is missing, malformed, expired, or
 * already used. The claim is atomic, so a concurrent replay loses the race.
 */
export async function consumeAuthToken(
  token: string,
  purpose: AuthTokenPurpose,
): Promise<number | null> {
  const normalized = String(token || '').trim().toLowerCase();
  if (!TOKEN_PATTERN.test(normalized)) return null;

  const db = await getContextDb();
  const [row] = await db
    .select({ id: passwordResetTokens.id, userId: passwordResetTokens.userId })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, hashToken(normalized)),
        eq(passwordResetTokens.purpose, purpose),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) return null;

  const [claimed] = await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.id, row.id), isNull(passwordResetTokens.usedAt)))
    .returning({ id: passwordResetTokens.id });

  return claimed ? row.userId : null;
}
