import { redirect } from 'next/navigation';
import { requireCmsSession } from '@/lib/cms/session';

export const dynamic = 'force-dynamic';

export default async function DiscountsIndexPage() {
  await requireCmsSession();
  redirect('/cms/discounts/product');
}
