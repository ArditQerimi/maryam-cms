import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  getMessageThreadDetail,
  markMessageThreadAsRead,
} from '@/lib/messages';

function parseThreadId(value: string): number {
  const id = Number(value);
  return Number.isFinite(id) ? id : 0;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  const session = await getSession();
  const userId = Number(session?.userId ?? 0);

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await context.params;
  const threadId = parseThreadId(params.threadId);

  if (!threadId) {
    return NextResponse.json({ error: 'Invalid thread id.' }, { status: 400 });
  }

  const thread = await getMessageThreadDetail({ threadId, userId });
  if (!thread) {
    return NextResponse.json({ error: 'Thread not found.' }, { status: 404 });
  }

  await markMessageThreadAsRead({ threadId, userId });

  return NextResponse.json({ thread });
}
