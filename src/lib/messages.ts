import { getContextDb } from './tenant';
import * as schema from '@/db/schema-tenant';
import { and, asc, desc, eq, ilike, inArray, sql } from 'drizzle-orm';

export type MessageThreadSummary = {
  id: number;
  subject: string;
  updatedAt: string;
  counterpart: {
    id: number;
    name: string;
    email: string;
  } | null;
  latestMessage: {
    body: string;
    createdAt: string;
    senderId: number;
  } | null;
  unreadCount: number;
};

export type ThreadMessage = {
  id: number;
  senderId: number;
  senderName: string;
  senderEmail: string;
  body: string;
  createdAt: string;
  isMine: boolean;
};

export type MessageThreadDetail = {
  id: number;
  subject: string;
  participants: Array<{ id: number; name: string; email: string }>;
  messages: ThreadMessage[];
};

function asIso(date: Date | string | null): string {
  if (!date) return new Date(0).toISOString();
  if (date instanceof Date) return date.toISOString();
  return new Date(date).toISOString();
}

export async function getMessageThreadSummaries(input: {
  userId: number;
  search?: string;
}): Promise<MessageThreadSummary[]> {
  const { userId, search } = input;
  const db = await getContextDb();

  const baseThreads = await db
    .select({
      id: schema.messageThreads.id,
      subject: schema.messageThreads.subject,
      updatedAt: schema.messageThreads.updatedAt,
      lastReadAt: schema.messageThreadParticipants.lastReadAt,
    })
    .from(schema.messageThreads)
    .innerJoin(
      schema.messageThreadParticipants,
      and(
        eq(schema.messageThreadParticipants.threadId, schema.messageThreads.id),
        eq(schema.messageThreadParticipants.userId, userId),
      ),
    )
    .where(
      and(search ? ilike(schema.messageThreads.subject, `%${search.trim()}%`) : undefined),
    )
    .orderBy(desc(schema.messageThreads.updatedAt));

  if (!baseThreads.length) return [];

  const threadIds = baseThreads.map((row) => row.id);

  const participantRows = await db
    .select({
      threadId: schema.messageThreadParticipants.threadId,
      userId: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.messageThreadParticipants)
    .innerJoin(schema.users, eq(schema.users.id, schema.messageThreadParticipants.userId))
    .where(inArray(schema.messageThreadParticipants.threadId, threadIds));

  const entryRows = await db
    .select({
      id: schema.messageEntries.id,
      threadId: schema.messageEntries.threadId,
      senderId: schema.messageEntries.senderUserId,
      body: schema.messageEntries.body,
      createdAt: schema.messageEntries.createdAt,
    })
    .from(schema.messageEntries)
    .where(inArray(schema.messageEntries.threadId, threadIds))
    .orderBy(desc(schema.messageEntries.createdAt));

  const entriesByThread = new Map<number, typeof entryRows>();
  for (const row of entryRows) {
    const existing = entriesByThread.get(row.threadId) ?? [];
    existing.push(row);
    entriesByThread.set(row.threadId, existing);
  }

  const participantsByThread = new Map<number, typeof participantRows>();
  for (const row of participantRows) {
    const existing = participantsByThread.get(row.threadId) ?? [];
    existing.push(row);
    participantsByThread.set(row.threadId, existing);
  }

  return baseThreads.map((thread) => {
    const participants = participantsByThread.get(thread.id) ?? [];
    const counterpartRow = participants.find((p) => p.userId !== userId) ?? null;
    const entries = entriesByThread.get(thread.id) ?? [];
    const latest = entries[0] ?? null;

    const unreadCount = entries.filter((entry) => {
      if (entry.senderId === userId) return false;
      if (!thread.lastReadAt) return true;
      return new Date(entry.createdAt).getTime() > new Date(thread.lastReadAt).getTime();
    }).length;

    return {
      id: thread.id,
      subject: thread.subject,
      updatedAt: asIso(thread.updatedAt),
      counterpart: counterpartRow
        ? {
            id: counterpartRow.userId,
            name: counterpartRow.name,
            email: counterpartRow.email,
          }
        : null,
      latestMessage: latest
        ? {
            body: latest.body,
            createdAt: asIso(latest.createdAt),
            senderId: latest.senderId,
          }
        : null,
      unreadCount,
    };
  });
}

export async function getMessageThreadDetail(input: {
  threadId: number;
  userId: number;
}): Promise<MessageThreadDetail | null> {
  const { threadId, userId } = input;
  const db = await getContextDb();

  const membership = await db
    .select({ threadId: schema.messageThreadParticipants.threadId })
    .from(schema.messageThreadParticipants)
    .where(
      and(
        eq(schema.messageThreadParticipants.threadId, threadId),
        eq(schema.messageThreadParticipants.userId, userId),
      ),
    )
    .limit(1);

  if (!membership.length) return null;

  const [thread] = await db
    .select({
      id: schema.messageThreads.id,
      subject: schema.messageThreads.subject,
    })
    .from(schema.messageThreads)
    .where(eq(schema.messageThreads.id, threadId))
    .limit(1);

  if (!thread) return null;

  const participants = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.messageThreadParticipants)
    .innerJoin(schema.users, eq(schema.users.id, schema.messageThreadParticipants.userId))
    .where(eq(schema.messageThreadParticipants.threadId, threadId));

  const rows = await db
    .select({
      id: schema.messageEntries.id,
      senderId: schema.users.id,
      senderName: schema.users.name,
      senderEmail: schema.users.email,
      body: schema.messageEntries.body,
      createdAt: schema.messageEntries.createdAt,
    })
    .from(schema.messageEntries)
    .innerJoin(schema.users, eq(schema.users.id, schema.messageEntries.senderUserId))
    .where(eq(schema.messageEntries.threadId, threadId))
    .orderBy(asc(schema.messageEntries.createdAt));

  return {
    id: thread.id,
    subject: thread.subject,
    participants,
    messages: rows.map((row) => ({
      id: row.id,
      senderId: row.senderId,
      senderName: row.senderName,
      senderEmail: row.senderEmail,
      body: row.body,
      createdAt: asIso(row.createdAt),
      isMine: row.senderId === userId,
    })),
  };
}

export async function markMessageThreadAsRead(input: {
  threadId: number;
  userId: number;
}): Promise<void> {
  const { threadId, userId } = input;
  const db = await getContextDb();

  await db
    .update(schema.messageThreadParticipants)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(schema.messageThreadParticipants.threadId, threadId),
        eq(schema.messageThreadParticipants.userId, userId),
      ),
    );
}

export async function createMessageThread(input: {
  senderUserId: number;
  recipientEmail: string;
  subject: string;
  body: string;
}): Promise<{ threadId: number; participantIds: number[] }> {
  const { senderUserId, recipientEmail, subject, body } = input;
  const db = await getContextDb();

  const normalizedEmail = recipientEmail.trim().toLowerCase();

  const recipientRows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${normalizedEmail}`)
    .limit(1);

  const recipient = recipientRows[0] ?? null;

  if (!recipient) {
    throw new Error('Recipient was not found.');
  }

  const [thread] = await db
    .insert(schema.messageThreads)
    .values({
      subject: subject.trim(),
      createdByUserId: senderUserId,
    })
    .returning({ id: schema.messageThreads.id });

  if (!thread) {
    throw new Error('Failed to create message thread.');
  }

  await db.insert(schema.messageThreadParticipants).values([
    {
      threadId: thread.id,
      userId: senderUserId,
      lastReadAt: new Date(),
    },
    {
      threadId: thread.id,
      userId: recipient.id,
      lastReadAt: null,
    },
  ]);

  await db.insert(schema.messageEntries).values({
    threadId: thread.id,
    senderUserId,
    body: body.trim(),
  });

  await db
    .update(schema.messageThreads)
    .set({ updatedAt: new Date() })
    .where(eq(schema.messageThreads.id, thread.id));

  return { threadId: thread.id, participantIds: [senderUserId, recipient.id] };
}

export async function replyInMessageThread(input: {
  threadId: number;
  senderUserId: number;
  body: string;
}): Promise<{ participantIds: number[] }> {
  const { threadId, senderUserId, body } = input;
  const db = await getContextDb();

  const membership = await db
    .select({ threadId: schema.messageThreadParticipants.threadId })
    .from(schema.messageThreadParticipants)
    .where(
      and(
        eq(schema.messageThreadParticipants.threadId, threadId),
        eq(schema.messageThreadParticipants.userId, senderUserId),
      ),
    )
    .limit(1);

  if (!membership.length) {
    throw new Error('You are not a participant in this thread.');
  }

  await db.insert(schema.messageEntries).values({
    threadId,
    senderUserId,
    body: body.trim(),
  });

  await db
    .update(schema.messageThreads)
    .set({ updatedAt: new Date() })
    .where(eq(schema.messageThreads.id, threadId));

  const participants = await db
    .select({ userId: schema.messageThreadParticipants.userId })
    .from(schema.messageThreadParticipants)
    .where(eq(schema.messageThreadParticipants.threadId, threadId));

  await db
    .update(schema.messageThreadParticipants)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(schema.messageThreadParticipants.threadId, threadId),
        eq(schema.messageThreadParticipants.userId, senderUserId),
      ),
    );

  return { participantIds: participants.map((row) => row.userId) };
}
