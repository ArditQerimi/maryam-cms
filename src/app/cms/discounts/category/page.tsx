import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { Percent } from 'lucide-react';
import { getContextDb } from '@/lib/tenant';
import { categories, categoryDiscounts } from '@/db/schema-tenant';
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
import { deleteCategoryDiscount } from '@/app/cms/actions/discounts';

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

function toFormValues(row: typeof categoryDiscounts.$inferSelect): DiscountFormValues {
  return {
    id: row.id,
    entityId: row.categoryId,
    discountType: row.discountType,
    discountValue: row.discountValue,
    startDate: toInputDate(row.startDate),
    endDate: toInputDate(row.endDate),
    status: row.status,
  };
}

export default async function CategoryDiscountsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireCmsSession();
  const params = await searchParams;

  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const editId = Number(params.edit);
  const editing = Number.isSafeInteger(editId) && editId > 0 ? editId : null;

  const db = await getContextDb();

  const [rows, countRows, editRows, allCategories] = await Promise.all([
    db
      .select({
        id: categoryDiscounts.id,
        categoryId: categoryDiscounts.categoryId,
        categoryName: categories.name,
        discountType: categoryDiscounts.discountType,
        discountValue: categoryDiscounts.discountValue,
        startDate: categoryDiscounts.startDate,
        endDate: categoryDiscounts.endDate,
        status: categoryDiscounts.status,
      })
      .from(categoryDiscounts)
      .leftJoin(categories, eq(categoryDiscounts.categoryId, categories.id))
      .orderBy(desc(categoryDiscounts.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ value: sql<number>`count(*)::int` }).from(categoryDiscounts),
    editing
      ? db
          .select({ discount: categoryDiscounts, categoryName: categories.name })
          .from(categoryDiscounts)
          .leftJoin(categories, eq(categoryDiscounts.categoryId, categories.id))
          .where(eq(categoryDiscounts.id, editing))
          .limit(1)
      : Promise.resolve([]),
    db.select({ id: categories.id, name: categories.name }).from(categories),
  ]);

  const total = countRows[0]?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const edited = editRows.length > 0 ? toFormValues(editRows[0].discount) : null;
  const editedCategoryName = editRows.length > 0 ? editRows[0].categoryName : null;

  return (
    <div>
      <PageHeader
        title="Category discounts"
        description="Time-boxed price reductions applied to every product in a category."
        actions={
          <Link
            href="/cms/discounts/product"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Product discounts
          </Link>
        }
      />

      {/* Create / edit card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            {edited
              ? `Edit discount: ${editedCategoryName || 'deleted category'}`
              : 'Create category discount'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DiscountForm kind="category" discount={edited} categories={allCategories} />
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="No category discounts yet"
          description="Create a discount above to run a promotion across a whole category."
          icon={<Percent size={28} />}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Category</Th>
              <Th>Type</Th>
              <Th className="text-right">Value</Th>
              <Th>Date range</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="transition hover:bg-zinc-50">
                <Td className="font-medium text-zinc-900">
                  {row.categoryName || 'Deleted category'}
                </Td>
                <Td className="whitespace-nowrap text-zinc-500">
                  {row.discountType === 'Percentage' ? 'Percentage' : 'Fixed'}
                </Td>
                <Td className="whitespace-nowrap text-right font-medium text-zinc-900">
                  {row.discountType === 'Percentage'
                    ? `${Number(row.discountValue)}%`
                    : formatMoney(row.discountValue)}
                </Td>
                <Td className="whitespace-nowrap text-zinc-500">
                  {row.startDate ? formatDate(row.startDate) : '—'}
                  {' – '}
                  {row.endDate ? formatDate(row.endDate) : 'No expiry'}
                </Td>
                <Td>
                  <StatusBadge status={row.status} />
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/cms/discounts/category?edit=${row.id}`}
                      className="rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      Edit
                    </Link>
                    <ConfirmActionButton
                      action={deleteCategoryDiscount}
                      args={[row.id]}
                      confirmMessage="Delete this category discount? This cannot be undone."
                      successMessage="Discount deleted."
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
        basePath="/cms/discounts/category"
        page={page}
        totalPages={totalPages}
        total={total}
      />
    </div>
  );
}
