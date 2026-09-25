import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  createMessageThread,
  getMessageThreadSummaries,
} from '@/lib/messages';
import { publishSocketEvent } from '@/lib/realtime-publisher';

function getSessionContext(session: Awaited<ReturnType<typeof getSession>>) {
  const userId = Number(session?.userId ?? 0);
  const companyId = Number(session?.companyId ?? 0);

  if (!userId || !companyId) {
    return null;
  }

  return { userId, companyId };
}

export async function GET(request: Request) {
  const session = await getSession();
  const context = getSessionContext(session);

  if (!context) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? '';

  const threads = await getMessageThreadSummaries({
    userId: context.userId,
    search,
  });

  return NextResponse.json({ threads });
}

export async function POST(request: Request) {
  const session = await getSession();
  const context = getSessionContext(session);

  if (!context) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const recipientEmail = String(body?.recipientEmail || '').trim();
    const subject = String(body?.subject || '').trim();
    const content = String(body?.body || '').trim();

    if (!recipientEmail || !subject || !content) {
      return NextResponse.json(
        { error: 'recipientEmail, subject, and body are required.' },
        { status: 400 },
      );
    }

    const created = await createMessageThread({
      senderUserId: context.userId,
      recipientEmail,
      subject,
      body: content,
    });

    await publishSocketEvent({
      event: 'messages:updated',
      baseUrl: new URL(request.url).origin,
      rooms: [
        `company:${context.companyId}`,
        ...created.participantIds.map((id) => `user:${id}`),
      ],
      payload: {
        threadId: created.threadId,
        actorUserId: context.userId,
      },
    });

    return NextResponse.json({ threadId: created.threadId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send message.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
