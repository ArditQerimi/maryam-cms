import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { replyInMessageThread } from '@/lib/messages';
import { publishSocketEvent } from '@/lib/realtime-publisher';

function parseThreadId(value: string): number {
  const id = Number(value);
  return Number.isFinite(id) ? id : 0;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  const session = await getSession();
  const userId = Number(session?.userId ?? 0);
  const companyId = Number(session?.companyId ?? 0);

  if (!userId || !companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await context.params;
  const threadId = parseThreadId(params.threadId);

  if (!threadId) {
    return NextResponse.json({ error: 'Invalid thread id.' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const content = String(body?.body || '').trim();

    if (!content) {
      return NextResponse.json({ error: 'Message body is required.' }, { status: 400 });
    }

    const result = await replyInMessageThread({
      threadId,
      senderUserId: userId,
      body: content,
    });

    await publishSocketEvent({
      event: 'messages:updated',
      baseUrl: new URL(request.url).origin,
      rooms: [
        `company:${companyId}`,
        ...result.participantIds.map((id) => `user:${id}`),
        `thread:${threadId}`,
      ],
      payload: {
        threadId,
        actorUserId: userId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reply.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
