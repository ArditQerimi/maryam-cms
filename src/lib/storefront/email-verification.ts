import { eq } from 'drizzle-orm';
import { users } from '@/db/schema-tenant';
import type { StorefrontContext } from './context';

type VerificationDb = Pick<StorefrontContext['db'], 'select'>;

/**
 * Orders need a confirmed email address: the order emails (received / confirmed /
 * shipped) must reach a real inbox. Applies to customer accounts; store staff
 * shopping as themselves (testing) are not blocked.
 */
export function requiresVerifiedEmail(session: Record<string, unknown> | null | undefined) {
  return session?.platformRole === 'customer';
}

export async function isEmailVerified(db: VerificationDb, userId: number) {
  const [row] = await db
    .select({ at: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return Boolean(row?.at);
}
