import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { Percent } from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import { productDiscounts, products } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { formatDate, formatMoney } from '@/lib/cms/format';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  StatusBadge,
  Table,
  Td,
  Th,
} from '@/components/admin/ui';
import Pagination from '@/components/admin/Pagination';
import ConfirmActionButton from '@/components/store/ConfirmActionButton';
import DiscountForm, { type DiscountFormValues } from '@/components/store/DiscountForm';
import { deleteProductDiscount } from '@/app/cms/actions/discounts';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

type SearchParams = {
  page?: string;
  edit?: string;
};

function toInputDate(value: Date | null) {
  if (!value) return '';
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

function toFormValues(row: typeof productDiscounts.$inferSelect): DiscountFormValues {
  return {
    id: row.id,
    entityId: row.productId,
    discountType: row.discountType,
    discountValue: row.discountValue,
    startDate: toInputDate(row.startDate),
    endDate: toInputDate(row.endDate),
    status: row.status,
  };
}

export default async function ProductDiscountsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireCmsSession();
  const t = await getT();
  const params = await searchParams;

  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const editId = Number(params.edit);
  const editing = Number.isSafeInteger(editId) && editId > 0 ? editId : null;

  const db = await getContextDb();

  const [rows, countRows, editRows] = await Promise.all([
    db
      .select({
        id: productDiscounts.id,
        productId: productDiscounts.productId,
        productName: products.name,
        discountType: productDiscounts.discountType,
        discountValue: productDiscounts.discountValue,
        startDate: productDiscounts.startDate,
        endDate: productDiscounts.endDate,
        status: productDiscounts.status,
      })
      .from(productDiscounts)
      .leftJoin(products, eq(productDiscounts.productId, products.id))
      .orderBy(desc(productDiscounts.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ value: sql<number>`count(*)::int` }).from(productDiscounts),
    editing
      ? db
          .select({ discount: productDiscounts, productName: products.name })
          .from(productDiscounts)
          .leftJoin(products, eq(productDiscounts.productId, products.id))
          .where(eq(productDiscounts.id, editing))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const total = countRows[0]?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const edited = editRows.length > 0 ? toFormValues(editRows[0].discount) : null;
  const editedProductName = editRows.length > 0 ? editRows[0].productName : null;

  return (
    <div>
      <PageHeader
        title={t('cmspromo.product.title')}
        description={t('cmspromo.product.description')}
        actions={
          <Link
            href="/cms/discounts/category"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            {t('cmspromo.product.link_category')}
          </Link>
        }
      />

      {/* Create / edit card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            {edited
              ? t('cmspromo.discount.edit_title', {
                  name: editedProductName || t('cmspromo.product.deleted_fallback'),
                })
              : t('cmspromo.product.create_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DiscountForm kind="product" discount={edited} />
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title={t('cmspromo.product.empty_title')}
          description={t('cmspromo.product.empty_desc')}
          icon={<Percent size={28} />}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t('cmspromo.product.th_product')}</Th>
              <Th>{t('cmspromo.th.type')}</Th>
              <Th className="text-right">{t('cmspromo.th.value')}</Th>
              <Th>{t('cmspromo.th.date_range')}</Th>
              <Th>{t('cmspromo.th.status')}</Th>
              <Th className="text-right">{t('cmspromo.th.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="transition hover:bg-zinc-50">
                <Td>
                  <Link
                    href={`/cms/products/${row.productId}/edit`}
                    className="font-medium text-zinc-900 hover:text-[#5b59d6]"
                  >
                    {row.productName || t('cmspromo.product.deleted_row')}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap text-zinc-500">
                  {row.discountType === 'Percentage'
                    ? t('cmspromo.type.percentage')
                    : t('cmspromo.type.fixed')}
                </Td>
                <Td className="whitespace-nowrap text-right font-medium text-zinc-900">
                  {row.discountType === 'Percentage'
                    ? `${Number(row.discountValue)}%`
                    : formatMoney(row.discountValue)}
                </Td>
                <Td className="whitespace-nowrap text-zinc-500">
                  {row.startDate ? formatDate(row.startDate) : '—'}
                  {' – '}
                  {row.endDate ? formatDate(row.endDate) : t('cmspromo.date.no_expiry')}
                </Td>
                <Td>
                  <StatusBadge status={row.status} />
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/cms/discounts/product?edit=${row.id}`}
                      className="rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      {t('cmspromo.action.edit')}
                    </Link>
                    <ConfirmActionButton
                      action={deleteProductDiscount}
                      args={[row.id]}
                      confirmMessage={t('cmspromo.product.confirm_delete')}
                      successMessage={t('cmspromo.discount.delete_success')}
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

      <Pagination basePath="/cms/discounts/product" page={page} totalPages={totalPages} total={total} />
    </div>
  );
}

