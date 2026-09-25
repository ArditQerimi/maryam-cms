import { NextResponse } from 'next/server';
import { desc, ilike, or } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import { cmsMedia } from '@/db/schema-tenant';
import { getSession } from '@/lib/session';
import { isCmsSession } from '@/lib/cms/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession().catch(() => null);
  if (!isCmsSession(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = (url.searchParams.get('q') || '').trim().slice(0, 120);
  const type = url.searchParams.get('type') || 'all';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 300, 500);

  const db = await getContextDb();

  const searchCondition = search
    ? or(
        ilike(cmsMedia.originalName, `%${search}%`),
        ilike(cmsMedia.filename, `%${search}%`),
        ilike(cmsMedia.altText, `%${search}%`),
      )
    : undefined;

  const rows = await db
    .select()
    .from(cmsMedia)
    .where(searchCondition)
    .orderBy(desc(cmsMedia.createdAt))
    .limit(limit);

  const items = rows.filter((row) => {
    const mime = row.mimeType || '';
    if (type === 'images') return mime.startsWith('image/');
    if (type === 'videos') return mime.startsWith('video/');
    if (type === 'documents') return mime === 'application/pdf';
    return true;
  });

  return NextResponse.json({ items });
}
