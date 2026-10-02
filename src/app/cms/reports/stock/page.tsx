import { asc, eq, isNull, or, sql } from 'drizzle-orm';
import { AlertTriangle, PackageX, Wrench } from 'lucide-react';
import Link from 'next/link';
import { getContextDb } from '@/lib/tenant';
import { products } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { getT, type Translator } from '@/lib/i18n/server';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

async function getLowStockProducts() {
  const db = await getContextDb();
  return db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      stockQuantity: products.stockQuantity,
      minStockLevel: products.minStockLevel,
    })
    .from(products)
    .where(sql`
      coalesce(${products.stockQuantity}, 0) > 0
      AND coalesce(${products.stockQuantity}, 0) <= coalesce(${products.minStockLevel}, 0)
    `)
    .orderBy(asc(products.stockQuantity))
    .limit(LIMIT);
}

async function getOutOfStockProducts() {
  const db = await getContextDb();
  return db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      stockQuantity: products.stockQuantity,
      minStockLevel: products.minStockLevel,
    })
    .from(products)
    .where(or(eq(products.stockQuantity, 0), isNull(products.stockQuantity)))
    .orderBy(asc(products.name))
    .limit(LIMIT);
}

function StockTable({
  rows,
  tone,
  empty,
  t,
}: {
  rows: Awaited<ReturnType<typeof getLowStockProducts>>;
  tone: 'warning' | 'danger';
  empty: { title: string; description: string };
  t: Translator;
}) {
  if (rows.length === 0) {
    return (
      <CardContent>
        <EmptyState description={empty.description} icon={<Wrench size={28} />} title={empty.title} />
      </CardContent>
    );
  }

  return (
    <div>
      <Table bare>
        <thead>
          <tr>
            <Th>{t('cmsdash.th.product')}</Th>
            <Th>{t('cmsdash.th.sku')}</Th>
            <Th className="text-right">{t('cmsdash.stock.currentStock')}</Th>
            <Th className="text-right">{t('cmsdash.stock.minLevel')}</Th>
            <Th>{t('cmsdash.th.status')}</Th>
            <Th className="text-right">{t('cmsdash.stock.action')}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((product) => (
            <tr className="transition hover:bg-zinc-50" key={product.id}>
              <Td className="max-w-[300px] truncate font-medium text-zinc-900">
                {product.name}
              </Td>
              <Td className="whitespace-nowrap text-zinc-500">{product.sku || '—'}</Td>
              <Td className="text-right font-medium text-zinc-900">
                {(product.stockQuantity ?? 0).toLocaleString()}
              </Td>
              <Td className="text-right text-zinc-500">
                {(product.minStockLevel ?? 0).toLocaleString()}
              </Td>
              <Td>
                <Badge tone={tone === 'warning' ? 'warning' : 'danger'}>
                  {tone === 'warning' ? t('cmsdash.stock.low') : t('cmsdash.stock.out')}
                </Badge>
              </Td>
              <Td className="text-right">
                <Link
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5b59d6] hover:underline"
                  href={`/cms/products/${product.id}/edit`}
                >
                  <Wrench size={14} />
                  {t('cmsdash.stock.restock')}
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export default async function StockReportPage() {
  await requireCmsSession();
  const t = await getT();

  const [lowStock, outOfStock] = await Promise.all([
    getLowStockProducts(),
    getOutOfStockProducts(),
  ]);

  return (
    <div>
      <PageHeader
        title={t('cmsdash.stock.title')}
        description={t('cmsdash.stock.description')}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={16} />
              {t('cmsdash.stock.low')}
            </CardTitle>
            <Badge tone="warning">{lowStock.length}</Badge>
          </CardHeader>
          <StockTable
            empty={{
              title: t('cmsdash.stock.emptyLowTitle'),
              description: t('cmsdash.stock.emptyLowDescription'),
            }}
            rows={lowStock}
            t={t}
            tone="warning"
          />
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <PackageX className="text-red-500" size={16} />
              {t('cmsdash.stock.out')}
            </CardTitle>
            <Badge tone="danger">{outOfStock.length}</Badge>
          </CardHeader>
          <StockTable
            empty={{
              title: t('cmsdash.stock.emptyOutTitle'),
              description: t('cmsdash.stock.emptyOutDescription'),
            }}
            rows={outOfStock}
            t={t}
            tone="danger"
          />
        </Card>
      </div>

      {(lowStock.length >= LIMIT || outOfStock.length >= LIMIT) ? (
        <p className="mt-4 text-xs text-zinc-400">
          {t('cmsdash.stock.limitNote', { limit: LIMIT })}
        </p>
      ) : null}
    </div>
  );
}
