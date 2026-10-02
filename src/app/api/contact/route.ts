import type { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { and, count, eq, gt } from 'drizzle-orm';
import * as schema from '@/db/schema-tenant';
import * as masterSchema from '@/db/schema-master';
import { masterDb } from '@/db/master';
import { getStorefrontContext, assertMutationOrigin } from '@/lib/storefront/context';
import { readJsonBody, runStorefrontRoute, noStoreJson } from '@/lib/storefront/http';
import { StorefrontError, StorefrontInputError } from '@/lib/storefront/errors';
import { sendEmail } from '@/lib/email/send';
import { contactAckMessage, contactNotifyMessage } from '@/lib/email/contact-templates';
import { logError, logInfo } from '@/lib/app-logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 8 * 1024;
const RATE_WINDOW_MS = 60 * 60 * 1000;
/** Per sender email — one person cannot flood the inbox. */
const RATE_LIMIT_PER_EMAIL = 10;
/** Per source IP — high enough that shared office/mobile IPs stay usable. */
const RATE_LIMIT_PER_IP = 20;

function readField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function requireLength(field: string, value: string, min: number, max: number) {
  if (value.length < min || value.length > max) {
    throw new StorefrontInputError(
      min === max
        ? `${field} must be at most ${max} characters.`
        : `${field} must be between ${min} and ${max} characters.`,
      field,
    );
  }
  return value;
}

function firstForwardedIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  const candidate = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || '';
  return candidate || null;
}

/**
 * Public contact-form endpoint. Same-origin mutations only; the message is
 * persisted tenant-locally (contact_messages, migration 004). Signed-in
 * shoppers are linked by user id, guests are stored without identity. A raw
 * IP is never written — only a SHA-256 digest for throttling.
 */
export async function POST(request: NextRequest) {
  return runStorefrontRoute(async () => {
    const context = await getStorefrontContext(request);
    assertMutationOrigin(request, context);

    const body = await readJsonBody(request);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new StorefrontInputError('A JSON object is required.', 'body');
    }
    const record = body as Record<string, unknown>;
    if (JSON.stringify(record).length > MAX_BODY_BYTES) {
      throw new StorefrontInputError('Request body is too large.', 'body');
    }

    const name = requireLength('name', readField(record.name), 2, 160);
    const email = readField(record.email);
    if (email.length < 5 || email.length > 254 || !EMAIL_PATTERN.test(email)) {
      throw new StorefrontInputError('Enter a valid email address.', 'email');
    }
    const subject = requireLength('subject', readField(record.subject), 2, 200);
    const message = requireLength('message', readField(record.message), 5, 5000);

    const forwardedIp = firstForwardedIp(request);
    const ipHash = forwardedIp
      ? createHash('sha256').update(forwardedIp).digest('hex')
      : null;

    // Light abuse throttling with two independent rolling-hour counters:
    // one per sender email and one per source IP. Splitting them keeps a
    // shared office or mobile-carrier IP from locking out unrelated people.
    const windowStart = new Date(Date.now() - RATE_WINDOW_MS);

    const [recentByEmail] = await context.db
      .select({ total: count() })
      .from(schema.contactMessages)
      .where(
        and(
          gt(schema.contactMessages.createdAt, windowStart),
          eq(schema.contactMessages.email, email),
        ),
      );
    const [recentByIp] = ipHash
      ? await context.db
          .select({ total: count() })
          .from(schema.contactMessages)
          .where(
            and(
              gt(schema.contactMessages.createdAt, windowStart),
              eq(schema.contactMessages.ipHash, ipHash),
            ),
          )
      : [{ total: 0 }];

    if (
      (recentByEmail?.total ?? 0) >= RATE_LIMIT_PER_EMAIL ||
      (recentByIp?.total ?? 0) >= RATE_LIMIT_PER_IP
    ) {
      throw new StorefrontError(
        429,
        'contact-rate-limited',
        'Too many messages were sent recently. Please try again a little later.',
      );
    }

    await context.db.insert(schema.contactMessages).values({
      name,
      email,
      subject,
      message,
      userId: context.customer?.id ?? null,
      ipHash,
    });

    // Best-effort notifications — the message is already stored, so an email
    // delivery problem must never fail the request.
    try {
      const [company] = await masterDb
        .select({
          name: masterSchema.companies.name,
          email: masterSchema.companies.email,
        })
        .from(masterSchema.companies)
        .where(eq(masterSchema.companies.id, context.company.id))
        .limit(1);
      const storeName = company?.name?.trim() || 'the store';
      const notifyTo =
        process.env.CONTACT_NOTIFY_EMAIL?.trim() || company?.email?.trim() || '';

      const describe = (outcome: Awaited<ReturnType<typeof sendEmail>>) =>
        outcome.ok
          ? outcome.provider
          : 'error' in outcome
            ? `failed: ${outcome.error}`
            : 'not-configured';

      const results: Record<string, string> = {};

      if (notifyTo) {
        const notifyOutcome = await sendEmail({
          to: notifyTo,
          subject: `New contact message: ${subject}`,
          react: contactNotifyMessage({ storeName, name, email, subject, message }),
          text: `New contact message for ${storeName}\n\nFrom: ${name} (${email})\nSubject: ${subject}\n\n${message}`,
        });
        results.notify = describe(notifyOutcome);
      }

      // The visitor receives a receipt as well — skipped when it would just
      // duplicate the store notification (same address).
      if (!notifyTo || notifyTo.toLowerCase() !== email.toLowerCase()) {
        const ackOutcome = await sendEmail({
          to: email,
          subject: `We received your message — ${storeName}`,
          react: contactAckMessage({ name, storeName, subject }),
          text: `Hello ${name},\n\nThank you for contacting ${storeName}. Your message about "${subject}" has arrived and the store team will reply to ${email}.`,
        });
        results.ack = describe(ackOutcome);
      }

      await logInfo('Contact Message Emails', { results, subject });
    } catch (error) {
      await logError('Contact Email Error', { error });
    }

    return noStoreJson({ ok: true });
  });
}
