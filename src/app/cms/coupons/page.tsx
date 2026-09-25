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
        title="Coupons"
        description="Discount codes customers can redeem at checkout."
      />

      {/* Create / edit card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{edited ? `Edit coupon: ${edited.code}` : 'Create coupon'}</CardTitle>
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
            Search by code
          </label>
          <Input id="q" name="q" defaultValue={q} placeholder="SUMMER10…" />
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="md">
            Search
          </Button>
          <Link
            href="/cms/coupons"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Clear
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={q ? 'No coupons match this search' : 'No coupons yet'}
          description={
            q
              ? 'Try a different coupon code.'
              : 'Create your first coupon code with the form above.'
          }
          icon={<TicketPercent size={28} />}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Code</Th>
              <Th>Type</Th>
              <Th className="text-right">Value</Th>
              <Th>Date range</Th>
              <Th className="text-right">Usage limit</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
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
                  {coupon.discountType === 'Percentage' ? 'Percentage' : 'Fixed'}
                </Td>
                <Td className="whitespace-nowrap text-right font-medium text-zinc-900">
                  {coupon.discountType === 'Percentage'
                    ? `${Number(coupon.discountValue)}%`
                    : formatMoney(coupon.discountValue)}
                </Td>
                <Td className="whitespace-nowrap text-zinc-500">
                  {coupon.startDate ? formatDate(coupon.startDate) : '—'}
                  {' – '}
                  {coupon.endDate ? formatDate(coupon.endDate) : 'No expiry'}
                </Td>
                <Td className="text-right">
                  {coupon.usageLimit && coupon.usageLimit > 0 ? coupon.usageLimit : 'Unlimited'}
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
                      Edit
                    </Link>
                    <ConfirmActionButton
                      action={deleteCoupon}
                      args={[coupon.id]}
                      confirmMessage={`Delete the coupon "${coupon.code}"? This cannot be undone.`}
                      successMessage="Coupon deleted."
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                    >
                      Delete
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
