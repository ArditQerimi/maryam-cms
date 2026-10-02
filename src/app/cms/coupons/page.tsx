import Link from 'next/link';
import { desc, eq, ilike, sql } from 'drizzle-orm';
import { TicketPercent } from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import { coupons } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { formatDate, formatMoney } from '@/lib/cms/format';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  PageHeader,
  StatusBadge,
  Table,
  Td,
  Th,
} from '@/components/admin/ui';
import Pagination from '@/components/admin/Pagination';
import ConfirmActionButton from '@/components/store/ConfirmActionButton';
import CouponForm, { type CouponFormValues } from '@/components/store/CouponForm';
import { deleteCoupon } from '@/app/cms/actions/coupons';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

type SearchParams = {
  q?: string;
  page?: string;
  edit?: string;
};

function toInputDate(value: Date | null) {
  if (!value) return '';
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

function toFormValues(row: typeof coupons.$inferSelect): CouponFormValues {
  return {
    id: row.id,
    code: row.code,
    discountType: row.discountType,
    discountValue: row.discountValue,
    startDate: toInputDate(row.startDate),
    endDate: toInputDate(row.endDate),
    usageLimit: row.usageLimit ?? 0,
    status: row.status,
  };
}

export default async function CouponsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireCmsSession();
  const t = await getT();
  const params = await searchParams;

  const q = (params.q || '').trim().slice(0, 120);
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const editId = Number(params.edit);
  const editing = Number.isSafeInteger(editId) && editId > 0 ? editId : null;

  const where = q ? ilike(coupons.code, `%${q}%`) : undefined;

  const db = await getContextDb();

  const [rows, countRows, editRows] = await Promise.all([
    db
      .select()
      .from(coupons)
      .where(where)
      .orderBy(desc(coupons.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ value: sql<number>`count(*)::int` }).from(coupons).where(where),
    editing ? db.select().from(coupons).where(eq(coupons.id, editing)).limit(1) : Promise.resolve([]),
  ]);

  const total = countRows[0]?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const edited = editRows.length > 0 ? toFormValues(editRows[0]) : null;

  const paginationParams: Record<string, string | undefined> = {};
  if (q) paginationParams.q = q;

  return (
    <div>
      <PageHeader
        title={t('cmspromo.coupons.title')}
        description={t('cmspromo.coupons.description')}
      />

      {/* Create / edit card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            {edited
              ? t('cmspromo.coupons.edit_title', { code: edited.code })
              : t('cmspromo.coupons.create_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CouponForm coupon={edited} />
        </CardContent>
      </Card>

      {/* Search */}
      <form
        method="get"
        className="mb-5 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label
            htmlFor="q"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            {t('cmspromo.coupons.search_label')}
          </label>
          <Input id="q" name="q" defaultValue={q} placeholder="SUMMER10…" />
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="md">
            {t('cmspromo.coupons.search')}
          </Button>
          <Link
            href="/cms/coupons"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            {t('cmspromo.coupons.clear')}
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={q ? t('cmspromo.coupons.empty_search_title') : t('cmspromo.coupons.empty_title')}
          description={
            q
              ? t('cmspromo.coupons.empty_search_desc')
              : t('cmspromo.coupons.empty_desc')
          }
          icon={<TicketPercent size={28} />}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t('cmspromo.coupons.th_code')}</Th>
              <Th>{t('cmspromo.th.type')}</Th>
              <Th className="text-right">{t('cmspromo.th.value')}</Th>
              <Th>{t('cmspromo.th.date_range')}</Th>
              <Th className="text-right">{t('cmspromo.coupons.th_usage_limit')}</Th>
              <Th>{t('cmspromo.th.status')}</Th>
              <Th className="text-right">{t('cmspromo.th.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((coupon) => (
              <tr key={coupon.id} className="transition hover:bg-zinc-50">
                <Td>
                  <span className="font-medium uppercase tracking-wide text-zinc-900">
                    {coupon.code}
                  </span>
                </Td>
                <Td className="whitespace-nowrap text-zinc-500">
                  {coupon.discountType === 'Percentage'
                    ? t('cmspromo.type.percentage')
                    : t('cmspromo.type.fixed')}
                </Td>
                <Td className="whitespace-nowrap text-right font-medium text-zinc-900">
                  {coupon.discountType === 'Percentage'
                    ? `${Number(coupon.discountValue)}%`
                    : formatMoney(coupon.discountValue)}
                </Td>
                <Td className="whitespace-nowrap text-zinc-500">
                  {coupon.startDate ? formatDate(coupon.startDate) : '—'}
                  {' – '}
                  {coupon.endDate ? formatDate(coupon.endDate) : t('cmspromo.date.no_expiry')}
                </Td>
                <Td className="text-right">
                  {coupon.usageLimit && coupon.usageLimit > 0
                    ? coupon.usageLimit
                    : t('cmspromo.date.unlimited')}
                </Td>
                <Td>
                  <StatusBadge status={coupon.status} />
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/cms/coupons?edit=${coupon.id}`}
                      className="rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      {t('cmspromo.action.edit')}
                    </Link>
                    <ConfirmActionButton
                      action={deleteCoupon}
                      args={[coupon.id]}
                      confirmMessage={t('cmspromo.coupons.confirm_delete', { code: coupon.code })}
                      successMessage={t('cmspromo.coupons.delete_success')}
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                    >
                      {t('cmspromo.action.delete')}
                    </ConfirmActionButton>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Pagination
        basePath="/cms/coupons"
        page={page}
        totalPages={totalPages}
        total={total}
        searchParams={paginationParams}
      />
    </div>
  );
}
