import 'server-only';

import {
  and,
  count,
  countDistinct,
  eq,
  inArray,
  lte,
  sql,
  sum,
  type SQL,
} from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

import { getTenantDb } from '@/db';
import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import * as schema from '@/db/schema-tenant';
import { getDefaultPermissionsForRole } from '@/lib/permissions';
import { getSession } from '@/lib/session';
import { getContextCompany } from '@/lib/tenant';
import {
  authorizeFreshStaff,
  hasFreshPermission,
  type FreshStaffIdentity,
} from './authorization';
import { buildModuleCards, buildQuickActions } from './navigation';
import { projectOnlineOrderSummary } from './projection';
import {
  BLOG_CMS_CHECKSUM,
  BLOG_CMS_REQUIREMENTS,
  CATALOG_REQUIREMENTS,
  CONTENT_REQUIREMENTS,
  CUSTOMER_REQUIREMENTS,
  MARKETING_REQUIREMENTS,
  SALE_ORDER_REQUIREMENTS,
  STOREFRONT_CART_CHECKSUM,
  STOREFRONT_CART_REQUIREMENTS,
  STOREFRONT_CHECKOUT_CHECKSUM,
  STOREFRONT_CHECKOUT_REQUIREMENTS,
  STOREFRONT_REVENUE_REQUIREMENTS,
  VARIANT_STOCK_REQUIREMENTS,
  WEBSITE_SETTINGS_REQUIREMENTS,
  assessReviewedMigration,
  schemaHasRequirements,
  type SchemaFacts,
} from './readiness';
import { resolveAuthoritativeRevenue, type PersistedCurrencyRevenueRow } from './revenue';
import { summarizeCatalogStock, type ProductStockSummaryInput } from './stock';
import type {
  CatalogSummary,
  ContentSummary,
  CustomersSummary,
  EcommerceCapabilities,
  EcommerceControlCenterData,
  EcommerceDataResult,
  EcommerceModuleId,
  EcommerceModuleState,
  EcommerceReadinessItem,
  OnlineOrderSummary,
  OrdersSummary,
  WebsiteSettingsSummary,
} from './types';

type TenantDatabase = ReturnType<typeof getTenantDb>;

type EcommerceAdminAccess = {
  db: TenantDatabase;
  company: Awaited<ReturnType<typeof getContextCompany>>;
  staff: Omit<FreshStaffIdentity, 'roleName'> & {
    name: string;
    roleName: string;
    storeName: string | null;
  };
  capabilities: EcommerceCapabilities;
  scopeKind: 'company' | 'store' | 'unassigned';
  storeId: number | null;
};

export class EcommerceTenantPersistenceError extends Error {
  constructor() {
    super('The exact tenant database schema could not be verified.');
    this.name = 'EcommerceTenantPersistenceError';
  }
}

function positiveInteger(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function countValue(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function errorCode(error: unknown) {
  if (!error || typeof error !== 'object') return null;
  const direct = (error as { code?: unknown }).code;
  if (typeof direct === 'string') return direct;
  const cause = (error as { cause?: unknown }).cause;
  return cause && typeof cause === 'object' && typeof (cause as { code?: unknown }).code === 'string'
    ? (cause as { code: string }).code
    : null;
}

function isMissingPersistenceObject(error: unknown) {
  return errorCode(error) === '42P01'
    || errorCode(error) === '42703'
    || errorCode(error) === '3F000';
}

function capabilitiesFromPermissions(permissions: string[]): EcommerceCapabilities {
  return {
    inventoryView: hasFreshPermission(permissions, 'inventory.view'),
    inventoryManage: hasFreshPermission(permissions, 'inventory.manage'),
    stockManage: hasFreshPermission(permissions, 'stock.manage'),
    salesView: hasFreshPermission(permissions, 'sales.view'),
    salesManage: hasFreshPermission(permissions, 'sales.manage'),
    peopleView: hasFreshPermission(permissions, 'people.view'),
    promoView: hasFreshPermission(permissions, 'promo.view'),
    promoManage: hasFreshPermission(permissions, 'promo.manage'),
    cmsView: hasFreshPermission(permissions, 'cms.view'),
    cmsManage: hasFreshPermission(permissions, 'cms.manage'),
    settingsView: hasFreshPermission(permissions, 'settings.view'),
    settingsManage: hasFreshPermission(permissions, 'settings.manage'),
  };
}

async function resolveCurrentPermissions(companyId: number, roleName: string) {
  const normalizedRoleName = roleName.trim().toLocaleLowerCase('en-US');
  try {
    // This is deliberately a direct read. The control center does not call a
    // permission-definition "ensure" helper that can create master rows.
    const rows = await masterDb
      .select({ key: masterSchema.permissionDefinitions.key })
      .from(masterSchema.companyRolePermissions)
      .innerJoin(
        masterSchema.permissionDefinitions,
        eq(
          masterSchema.companyRolePermissions.permissionId,
          masterSchema.permissionDefinitions.id,
        ),
      )
      .where(and(
        eq(masterSchema.companyRolePermissions.companyId, companyId),
        eq(
          sql`lower(${masterSchema.companyRolePermissions.roleName})`,
          normalizedRoleName,
        ),
      ));
    const permissions = Array.from(new Set(rows.map((row) => row.key)));
    return permissions.length > 0
      ? permissions
      : getDefaultPermissionsForRole(roleName);
  } catch (error) {
    if (isMissingPersistenceObject(error)) return getDefaultPermissionsForRole(roleName);
    throw error;
  }
}

async function requireEcommerceStaffAccess(): Promise<EcommerceAdminAccess> {
  const session = await getSession();
  if (!session) redirect('/login');

  const company = await getContextCompany();
  const sessionUserId = session && typeof session === 'object' && !Array.isArray(session)
    ? positiveInteger((session as Record<string, unknown>).userId)
    : null;
  if (!sessionUserId) redirect('/login');

  const db = getTenantDb(company.dbConnectionString, company.dbSchema);
  const [staff] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      status: schema.users.status,
      roleId: schema.users.tenantRoleId,
      roleName: schema.tenantRoles.name,
      storeId: schema.users.storeId,
      storeName: schema.stores.name,
      storeStatus: schema.stores.status,
    })
    .from(schema.users)
    .leftJoin(schema.tenantRoles, eq(schema.users.tenantRoleId, schema.tenantRoles.id))
    .leftJoin(schema.stores, eq(schema.users.storeId, schema.stores.id))
    .where(eq(schema.users.id, sessionUserId))
    .limit(1);

  if (!staff?.roleName) notFound();

  const permissions = await resolveCurrentPermissions(company.id, staff.roleName);

  const authorization = authorizeFreshStaff({
    session,
    currentCompanyId: company.id,
    freshStaff: staff,
    freshPermissions: permissions,
  });
  if (!authorization.allowed) notFound();

  const schemaResult = await db.execute<{ current_schema: string | null }>(sql`
    select current_schema() as current_schema
  `);
  const actualSchema = schemaResult.rows[0]?.current_schema;
  if (!actualSchema || actualSchema !== company.dbSchema) {
    throw new EcommerceTenantPersistenceError();
  }

  return {
    db,
    company,
    staff: {
      id: staff.id,
      name: staff.name,
      status: staff.status,
      roleId: staff.roleId,
      roleName: staff.roleName,
      storeId: staff.storeId,
      storeName: staff.storeName,
      storeStatus: staff.storeStatus,
    },
    capabilities: capabilitiesFromPermissions(permissions),
    scopeKind: authorization.scopeKind,
    storeId: staff.storeId,
  };
}

async function tryReadSchemaFacts(db: TenantDatabase): Promise<SchemaFacts | null> {
  try {
    const [tableResult, columnResult] = await Promise.all([
      db.execute<{ table_name: string }>(sql`
        select table_name
        from information_schema.tables
        where table_schema = current_schema()
          and table_type in ('BASE TABLE', 'VIEW')
      `),
      db.execute<{ table_name: string; column_name: string }>(sql`
        select table_name, column_name
        from information_schema.columns
        where table_schema = current_schema()
      `),
    ]);

    const tables = new Set(tableResult.rows.map((row) => row.table_name));
    const columns = new Set(columnResult.rows.map((row) => `${row.table_name}.${row.column_name}`));
    const ledger = new Map<string, string>();

    if (
      tables.has('storefront_migration_ledger')
      && columns.has('storefront_migration_ledger.migration_key')
      && columns.has('storefront_migration_ledger.checksum')
    ) {
      const ledgerResult = await db.execute<{ migration_key: string; checksum: string }>(sql`
        select migration_key, checksum
        from storefront_migration_ledger
      `);
      for (const row of ledgerResult.rows) ledger.set(row.migration_key, row.checksum);
    }

    return { tables, columns, ledger };
  } catch {
    return null;
  }
}

function unavailableResult<T>(reason: string): EcommerceDataResult<T> {
  return { status: 'unavailable', reason };
}

function unverifiedResult<T>(reason: string): EcommerceDataResult<T> {
  return { status: 'unverified', reason };
}

async function readCatalogSummary(
  access: EcommerceAdminAccess,
  facts: SchemaFacts | null,
): Promise<EcommerceDataResult<CatalogSummary>> {
  if (!facts) return unverifiedResult('Catalog persistence could not be verified.');
  if (!schemaHasRequirements(facts, CATALOG_REQUIREMENTS)) {
    return unavailableResult('A required product or concrete-variant table/column is missing.');
  }
  if (access.scopeKind === 'unassigned') {
    return unverifiedResult('This staff account has no server-derived store or company scope.');
  }

  const stockAvailable = schemaHasRequirements(facts, VARIANT_STOCK_REQUIREMENTS);
  const scopeSql = access.scopeKind === 'store'
    ? sql`where p.store_id = ${access.storeId!}`
    : sql``;

  try {
    const productTotals = await access.db.execute<{
      total_products: number | string;
      active_products: number | string;
    }>(sql`
      select
        count(*)::int as total_products,
        count(*) filter (where p.status = 'Active')::int as active_products
      from products p
      ${scopeSql}
    `);

    const stockJoin = stockAvailable
      ? sql`left join product_stocks ps on ps.variant_id = pv.id`
      : sql``;
    const stockSelection = stockAvailable
      ? sql`
          count(ps.id)::int as stock_row_count,
          coalesce(sum(ps.quantity) filter (where ps.id is not null), 0)::text as stock_quantity
        `
      : sql`0::int as stock_row_count, null::text as stock_quantity`;
    const stockGroup = stockAvailable
      ? sql`group by p.id, p.status, p.stock_quantity, pv.id, pv.status`
      : sql`group by p.id, p.status, p.stock_quantity, pv.id, pv.status`;

    const rows = await access.db.execute<{
      product_id: number;
      product_status: string;
      parent_quantity: number | null;
      variant_id: number | null;
      variant_status: string | null;
      stock_row_count: number;
      stock_quantity: string | null;
    }>(sql`
      select
        p.id::int as product_id,
        p.status::text as product_status,
        p.stock_quantity::int as parent_quantity,
        pv.id::int as variant_id,
        pv.status::text as variant_status,
        ${stockSelection}
      from products p
      left join product_variants pv on pv.product_id = p.id
      ${stockJoin}
      where p.status = 'Active'
      ${access.scopeKind === 'store' ? sql`and p.store_id = ${access.storeId!}` : sql``}
      ${stockGroup}
    `);

    const productMap = new Map<number, ProductStockSummaryInput>();
    for (const row of rows.rows) {
      const productId = positiveInteger(row.product_id);
      if (!productId) continue;
      let product = productMap.get(productId);
      if (!product) {
        product = {
          id: productId,
          status: row.product_status,
          parentQuantity: countValue(row.parent_quantity),
          variants: [],
        };
        productMap.set(productId, product);
      }
      const variantId = positiveInteger(row.variant_id);
      if (!variantId || row.variant_status === null) continue;
      const stockRowCount = countValue(row.stock_row_count) ?? 0;
      const totalStock = countValue(row.stock_quantity);
      product.variants.push({
        id: variantId,
        status: row.variant_status,
        stockRows: stockRowCount > 0
          ? [{ quantity: totalStock }]
          : [],
      });
    }

    const stockSummary = summarizeCatalogStock([...productMap.values()]);
    const totals = productTotals.rows[0];
    const activeProducts = countValue(totals?.active_products);
    const totalProducts = countValue(totals?.total_products);
    if (activeProducts === null || totalProducts === null) {
      return unverifiedResult('Catalog totals could not be read exactly.');
    }
    return {
      status: 'available',
      value: {
        activeProducts,
        totalProducts,
        activeVariants: stockSummary.activeVariants,
        productsWithActiveVariants: stockSummary.productsWithActiveVariants,
        outOfStockProducts: stockAvailable ? stockSummary.outOfStockProducts : null,
      },
    };
  } catch (error) {
    if (isMissingPersistenceObject(error)) {
      return unavailableResult('Catalog persistence changed or is incomplete.');
    }
    throw error;
  }
}

function orderScopeCondition(
  access: EcommerceAdminAccess,
  saleReference: SQL = sql`${schema.sales.id}`,
): SQL | undefined {
  if (access.scopeKind !== 'store') return undefined;
  const storeId = access.storeId!;
  const scopedItems = sql`
    from sale_items scope_items
    join product_variants scope_variants on scope_variants.id = scope_items.variant_id
    join products scope_products on scope_products.id = scope_variants.product_id
  `;

  return sql`
    exists (
      select 1
      ${scopedItems}
      where scope_items.sale_id = ${saleReference}
        and scope_products.store_id = ${storeId}
    )
    and not exists (
      select 1
      ${scopedItems}
      where scope_items.sale_id = ${saleReference}
        and scope_products.store_id is distinct from ${storeId}
    )
  `;
}

async function readOrdersSummary(
  access: EcommerceAdminAccess,
  facts: SchemaFacts | null,
): Promise<EcommerceDataResult<OrdersSummary>> {
  if (!facts) return unverifiedResult('Online order persistence could not be verified.');
  if (!schemaHasRequirements(facts, SALE_ORDER_REQUIREMENTS)) {
    return unavailableResult('A required sales table/column is missing.');
  }
  if (access.scopeKind === 'unassigned') {
    return unverifiedResult('Online orders require a server-derived store or company scope.');
  }
  if (access.scopeKind === 'store' && !schemaHasRequirements(facts, CATALOG_REQUIREMENTS)) {
    return unavailableResult('Store-scoped orders cannot be resolved without product and variant ownership data.');
  }

  const orderScope = orderScopeCondition(access);
  const recentOrderScope = orderScopeCondition(access, sql`s.id`);
  const onlineCondition = and(eq(schema.sales.isOnline, true), orderScope);
  const eligibleCondition = and(
    onlineCondition,
    inArray(schema.sales.status, ['Pending', 'Completed']),
  );
  const revenueAvailable = schemaHasRequirements(facts, STOREFRONT_REVENUE_REQUIREMENTS);
  const ownerColumnAvailable = facts.columns.has('sales.customer_user_id');
  const currencySelection = revenueAvailable
    ? sql`order_details.currency::text`
    : sql`null::text`;
  const ownerSelection = ownerColumnAvailable
    ? sql`s.customer_user_id::int`
    : sql`null::int`;
  const revenueJoin = revenueAvailable
    ? sql`left join storefront_order_details order_details on order_details.sale_id = s.id`
    : sql``;

  try {
    const [totalResult, eligibleResult, recentResult, revenueRows] = await Promise.all([
      access.db
        .select({ value: count() })
        .from(schema.sales)
        .where(onlineCondition),
      access.db
        .select({ value: count() })
        .from(schema.sales)
        .where(eligibleCondition),
      access.db.execute<{
        id: number;
        reference: string;
        grand_total: string;
        status: string;
        created_at: Date;
        customer_user_id: number | null;
        currency: string | null;
      }>(sql`
        select
          s.id::int as id,
          s.reference::text as reference,
          s.grand_total::text as grand_total,
          s.status::text as status,
          s.created_at as created_at,
          ${ownerSelection} as customer_user_id,
          ${currencySelection} as currency
        from sales s
        ${revenueJoin}
        where s.is_online = true
        ${recentOrderScope ? sql`and ${recentOrderScope}` : sql``}
        order by s.created_at desc, s.id desc
        limit 8
      `),
      revenueAvailable
        ? access.db
            .select({
              currency: schema.storefrontOrderDetails.currency,
              orderCount: count(),
              total: sum(schema.sales.grandTotal),
            })
            .from(schema.sales)
            .innerJoin(
              schema.storefrontOrderDetails,
              eq(schema.storefrontOrderDetails.saleId, schema.sales.id),
            )
            .where(eligibleCondition)
            .groupBy(schema.storefrontOrderDetails.currency)
        : Promise.resolve([]),
    ]);

    const itemUnitsByOrder = new Map<number, number>();
    const orderIds = recentResult.rows
      .map((row) => positiveInteger(row.id))
      .filter((id): id is number => id !== null);
    if (orderIds.length > 0) {
      const itemRows = await access.db
        .select({ saleId: schema.saleItems.saleId, units: sum(schema.saleItems.quantity) })
        .from(schema.saleItems)
        .where(inArray(schema.saleItems.saleId, orderIds))
        .groupBy(schema.saleItems.saleId);
      for (const row of itemRows) {
        const units = countValue(row.units);
        if (units !== null) itemUnitsByOrder.set(row.saleId, units);
      }
    }

    const recentOrders = recentResult.rows
      .map((row) => projectOnlineOrderSummary({
        id: row.id,
        reference: row.reference,
        grandTotal: row.grand_total,
        total: row.grand_total,
        status: row.status,
        createdAt: row.created_at,
        customerUserId: row.customer_user_id,
        currency: row.currency,
        itemUnits: itemUnitsByOrder.get(row.id) ?? null,
      }))
      .filter((order): order is OnlineOrderSummary => order !== null);

    const onlineOrderCount = countValue(totalResult[0]?.value);
    const eligibleOrderCount = countValue(eligibleResult[0]?.value);
    if (onlineOrderCount === null || eligibleOrderCount === null) {
      return unverifiedResult('Online order totals could not be read exactly.');
    }
    const revenue = revenueAvailable
      ? resolveAuthoritativeRevenue({
          eligibleOrderCount,
          rows: revenueRows as PersistedCurrencyRevenueRow[],
        })
      : {
          status: 'unavailable' as const,
          reason: 'Persisted checkout order currency is unavailable, so revenue is not asserted.',
        };

    return {
      status: 'available',
      value: { onlineOrderCount, recentOrders, revenue },
    };
  } catch (error) {
    if (isMissingPersistenceObject(error)) {
      return unavailableResult('Online order persistence changed or is incomplete.');
    }
    throw error;
  }
}

async function readCustomersSummary(
  access: EcommerceAdminAccess,
  facts: SchemaFacts | null,
): Promise<EcommerceDataResult<CustomersSummary>> {
  if (!facts) return unverifiedResult('Customer persistence could not be verified.');
  if (!schemaHasRequirements(facts, CUSTOMER_REQUIREMENTS)) {
    return unavailableResult('The customer table is missing.');
  }
  if (access.scopeKind === 'unassigned') {
    return unverifiedResult('Customers require a server-derived store or company scope.');
  }

  try {
    if (access.scopeKind === 'company') {
      const rows = await access.db.select({ value: count() }).from(schema.customers);
      const total = countValue(rows[0]?.value);
      return total === null
        ? unverifiedResult('Customer totals could not be read exactly.')
        : { status: 'available', value: { total } };
    }

    if (!schemaHasRequirements(facts, SALE_ORDER_REQUIREMENTS) || !schemaHasRequirements(facts, CATALOG_REQUIREMENTS)) {
      return unavailableResult('Store-scoped customer totals cannot be resolved from current ownership data.');
    }
    if (!facts.columns.has('sales.customer_id')) {
      return unavailableResult('Store-scoped customer totals require sales.customer_id.');
    }

    const rows = await access.db
      .select({ value: countDistinct(schema.sales.customerId) })
      .from(schema.sales)
      .innerJoin(schema.customers, eq(schema.customers.id, schema.sales.customerId))
      .where(and(
        orderScopeCondition(access),
        sql`${schema.sales.customerId} is not null`,
      ));
    const total = countValue(rows[0]?.value);
    return total === null
      ? unverifiedResult('Store-scoped customer totals could not be read exactly.')
      : { status: 'available', value: { total } };
  } catch (error) {
    if (isMissingPersistenceObject(error)) {
      return unavailableResult('Customer persistence changed or is incomplete.');
    }
    throw error;
  }
}

async function readContentSummary(
  access: EcommerceAdminAccess,
  facts: SchemaFacts | null,
): Promise<EcommerceDataResult<ContentSummary>> {
  if (!facts) return unverifiedResult('Blog persistence could not be verified.');
  if (!schemaHasRequirements(facts, BLOG_CMS_REQUIREMENTS)) {
    return unavailableResult('The reviewed blog CMS table/columns are not available.');
  }

  try {
    const now = new Date();
    const [totalResult, publishedResult] = await Promise.all([
      access.db.select({ value: count() }).from(schema.blogPosts),
      access.db
        .select({ value: count() })
        .from(schema.blogPosts)
        .where(and(
          eq(schema.blogPosts.status, 'Active'),
          lte(schema.blogPosts.publishedAt, now),
        )),
    ]);
    const totalPosts = countValue(totalResult[0]?.value);
    const publishedPosts = countValue(publishedResult[0]?.value);
    if (totalPosts === null || publishedPosts === null) {
      return unverifiedResult('Blog post totals could not be read exactly.');
    }
    return {
      status: 'available',
      value: {
        publishedPosts,
        draftPosts: Math.max(0, totalPosts - publishedPosts),
        totalPosts,
      },
    };
  } catch (error) {
    if (isMissingPersistenceObject(error)) {
      return unavailableResult('Blog persistence changed or is incomplete.');
    }
    throw error;
  }
}

async function readWebsiteSettingsSummary(
  access: EcommerceAdminAccess,
  facts: SchemaFacts | null,
): Promise<EcommerceDataResult<WebsiteSettingsSummary>> {
  if (!facts) return unverifiedResult('Website settings persistence could not be verified.');
  if (!schemaHasRequirements(facts, WEBSITE_SETTINGS_REQUIREMENTS)) {
    return unavailableResult('The tenant website settings table is missing.');
  }

  try {
    const [row] = await access.db
      .select({ updatedAt: schema.settingsStore.updatedAt })
      .from(schema.settingsStore)
      .where(eq(schema.settingsStore.key, 'settings_ecommerce_storefront'))
      .limit(1);
    return {
      status: 'available',
      value: {
        configured: Boolean(row),
        updatedAt: row?.updatedAt instanceof Date && !Number.isNaN(row.updatedAt.getTime())
          ? row.updatedAt.toISOString()
          : null,
      },
    };
  } catch (error) {
    if (isMissingPersistenceObject(error)) {
      return unavailableResult('Website settings persistence changed or is incomplete.');
    }
    throw error;
  }
}

function resultState<T>(result: EcommerceDataResult<T> | null): EcommerceModuleState {
  if (!result) return 'restricted';
  if (result.status === 'unavailable') return 'unavailable';
  if (result.status === 'unverified') return 'unverified';
  return 'ready';
}

function buildModulePresentation(input: {
  access: EcommerceAdminAccess;
  facts: SchemaFacts | null;
  catalog: EcommerceDataResult<CatalogSummary> | null;
  orders: EcommerceDataResult<OrdersSummary> | null;
  customers: EcommerceDataResult<CustomersSummary> | null;
  content: EcommerceDataResult<ContentSummary> | null;
  websiteSettings: EcommerceDataResult<WebsiteSettingsSummary> | null;
  cartMigration: ReturnType<typeof assessReviewedMigration>;
  checkoutMigration: ReturnType<typeof assessReviewedMigration>;
  blogMigration: ReturnType<typeof assessReviewedMigration>;
}) {
  const states: Record<EcommerceModuleId, EcommerceModuleState> = {
    catalog: 'restricted',
    orders: 'restricted',
    customers: 'restricted',
    marketing: 'restricted',
    content: 'restricted',
    'storefront-settings': 'restricted',
    storefront: 'unverified',
  };
  const details: Record<EcommerceModuleId, string> = {
    catalog: 'Catalog access is not assigned to this staff role.',
    orders: 'Sales access is not assigned to this staff role.',
    customers: 'People access is not assigned to this staff role.',
    marketing: 'Promotion access is not assigned to this staff role.',
    content: 'CMS access is not assigned to this staff role.',
    'storefront-settings': 'Settings access is not assigned to this staff role.',
    storefront: 'Readiness requires authorized catalog or sales access.',
  };

  if (input.access.capabilities.inventoryView) {
    if (!input.catalog) {
      states.catalog = 'restricted';
    } else if (input.catalog.status !== 'available') {
      states.catalog = resultState(input.catalog);
      details.catalog = input.catalog.reason;
    } else if (
      input.catalog.value.activeProducts === 0
      || input.catalog.value.productsWithActiveVariants === 0
    ) {
      states.catalog = 'setup';
      details.catalog = 'Add an Active product with at least one concrete Active variant.';
    } else if (input.catalog.value.outOfStockProducts === null) {
      states.catalog = 'attention';
      details.catalog = 'Active variants are visible, but variant-level stock persistence is incomplete.';
    } else {
      states.catalog = 'ready';
      details.catalog = 'Active products and concrete variant stock are readable. Use the hardened product editor for writes.';
    }
  }

  if (input.access.capabilities.salesView) {
    if (!input.orders) {
      states.orders = 'restricted';
    } else if (input.orders.status !== 'available') {
      states.orders = resultState(input.orders);
      details.orders = input.orders.reason;
    } else if (input.checkoutMigration.status === 'unverified') {
      states.orders = 'unverified';
      details.orders = input.checkoutMigration.detail;
    } else if (input.checkoutMigration.status === 'unavailable') {
      states.orders = 'attention';
      details.orders = 'Online orders are readable, but authoritative checkout persistence is incomplete.';
    } else {
      states.orders = 'ready';
      details.orders = 'Online orders and reviewed checkout persistence are readable; state changes, returns, and refunds still require a hardened order service.';
    }
  }

  if (input.access.capabilities.peopleView) {
    if (!input.customers) {
      states.customers = 'restricted';
    } else if (input.customers.status !== 'available') {
      states.customers = resultState(input.customers);
      details.customers = input.customers.reason;
    } else {
      states.customers = 'ready';
      details.customers = input.access.scopeKind === 'store'
        ? 'Customers linked to single-store orders are readable within the assigned store; CRM mutations are not exposed here.'
        : 'Tenant customer totals are readable within company scope; CRM mutations are not exposed here.';
    }
  }

  if (input.access.capabilities.promoView) {
    if (!input.facts) {
      states.marketing = 'unverified';
      details.marketing = 'Promotion persistence could not be verified.';
    } else if (!schemaHasRequirements(input.facts, MARKETING_REQUIREMENTS)) {
      states.marketing = 'unavailable';
      details.marketing = 'One or more promotion tables/columns are missing.';
    } else {
      states.marketing = 'ready';
      details.marketing = 'Promotion records are readable; secure redemption and mutation workflows are not available.';
    }
  }

  if (input.access.capabilities.cmsView) {
    if (!input.content) {
      states.content = 'restricted';
    } else if (input.content.status !== 'available') {
      states.content = resultState(input.content);
      details.content = input.content.reason;
    } else if (input.blogMigration.status === 'unverified') {
      states.content = 'unverified';
      details.content = input.blogMigration.detail;
    } else if (!input.facts || !schemaHasRequirements(input.facts, CONTENT_REQUIREMENTS)) {
      states.content = 'attention';
      details.content = 'Blog data is readable, but one or more storefront content tables are missing.';
    } else {
      states.content = 'ready';
      details.content = 'Blog CMS rollout is readable; legacy Pages and FAQ mutation surfaces are not approved storefront editors.';
    }
  }

  if (input.access.capabilities.settingsView) {
    if (!input.websiteSettings) {
      states['storefront-settings'] = 'restricted';
    } else if (input.websiteSettings.status !== 'available') {
      states['storefront-settings'] = resultState(input.websiteSettings);
      details['storefront-settings'] = input.websiteSettings.reason;
    } else if (!input.websiteSettings.value.configured) {
      states['storefront-settings'] = 'setup';
      details['storefront-settings'] = 'No persisted storefront presentation record was found; defaults were not treated as tenant data.';
    } else {
      states['storefront-settings'] = 'ready';
      details['storefront-settings'] = 'A persisted storefront presentation record is present.';
    }
  }

  if (input.access.capabilities.inventoryView || input.access.capabilities.salesView) {
    if (
      input.catalog?.status === 'unverified'
      || input.orders?.status === 'unverified'
      || !input.facts
    ) {
      states.storefront = 'unverified';
      details.storefront = 'Storefront scope or schema could not be verified.';
    } else if (
      (input.catalog && input.catalog.status !== 'available')
      || (input.orders && input.orders.status !== 'available')
      || input.cartMigration.status === 'unavailable'
      || input.checkoutMigration.status === 'unavailable'
    ) {
      states.storefront = 'unavailable';
      details.storefront = 'One or more required storefront persistence layers are unavailable.';
    } else if (
      input.cartMigration.status === 'unverified'
      || input.checkoutMigration.status === 'unverified'
    ) {
      states.storefront = 'unverified';
      details.storefront = 'Storefront schema is present, but a reviewed migration ledger is unverified.';
    } else if (
      input.catalog?.status === 'available'
      && input.catalog.value.productsWithActiveVariants === 0
    ) {
      states.storefront = 'setup';
      details.storefront = 'Publish an Active product with a concrete Active variant before storefront launch.';
    } else {
      states.storefront = 'ready';
      details.storefront = 'Catalog, cart, and checkout persistence are readable.';
    }
  }

  return { states, details };
}

function buildReadinessItems(input: {
  access: EcommerceAdminAccess;
  facts: SchemaFacts | null;
  catalog: EcommerceDataResult<CatalogSummary> | null;
  orders: EcommerceDataResult<OrdersSummary> | null;
  content: EcommerceDataResult<ContentSummary> | null;
  websiteSettings: EcommerceDataResult<WebsiteSettingsSummary> | null;
  cartMigration: ReturnType<typeof assessReviewedMigration>;
  checkoutMigration: ReturnType<typeof assessReviewedMigration>;
  blogMigration: ReturnType<typeof assessReviewedMigration>;
}): EcommerceReadinessItem[] {
  const items: EcommerceReadinessItem[] = [];
  if (input.access.capabilities.inventoryView) {
    const baseAvailable = schemaHasRequirements(input.facts, CATALOG_REQUIREMENTS);
    const stockAvailable = schemaHasRequirements(input.facts, VARIANT_STOCK_REQUIREMENTS);
    items.push({
      id: 'catalog',
      title: 'Catalog persistence',
      state: !input.facts
        ? 'unverified'
        : !baseAvailable
          ? 'unavailable'
          : !stockAvailable
            ? 'attention'
            : input.catalog?.status === 'unverified'
              ? 'unverified'
              : 'ready',
      detail: !input.facts
        ? 'Tenant schema state could not be verified.'
        : !baseAvailable
          ? 'Required product or variant objects are missing.'
          : !stockAvailable
            ? 'Variant-level stock objects are missing; no stock result was inferred.'
            : 'Product, concrete variant, and stock objects are readable.',
    });
  }

  if (input.access.capabilities.salesView) {
    items.push({
      id: 'order-persistence',
      title: 'Online order persistence',
      state: resultState(input.orders),
      detail: input.orders?.status === 'available'
        ? 'Online order rows and sale-item quantities are readable.'
        : input.orders?.reason || 'Online order access is restricted.',
    });
    items.push({
      id: 'cart-persistence',
      title: 'Storefront cart rollout',
      state: input.cartMigration.status,
      detail: input.cartMigration.detail,
    });
    items.push({
      id: 'checkout-persistence',
      title: 'Storefront checkout rollout',
      state: input.checkoutMigration.status,
      detail: input.checkoutMigration.detail,
    });
  }

  if (input.access.capabilities.cmsView) {
    items.push({
      id: 'blog-persistence',
      title: 'Blog CMS rollout',
      state: input.blogMigration.status === 'ready' ? 'ready' : input.blogMigration.status,
      detail: input.blogMigration.status === 'ready'
        ? 'Reviewed blog columns, post counts, and migration ledger are readable.'
        : input.blogMigration.detail,
    });
  }

  if (input.access.capabilities.settingsView) {
    const state: EcommerceModuleState = !input.websiteSettings
      ? 'restricted'
      : input.websiteSettings.status !== 'available'
        ? resultState(input.websiteSettings)
        : input.websiteSettings.value.configured
          ? 'ready'
          : 'setup';
    items.push({
      id: 'storefront-settings',
      title: 'Storefront settings',
      state,
      detail: !input.websiteSettings
        ? 'Settings access is restricted.'
        : input.websiteSettings.status !== 'available'
          ? input.websiteSettings.reason
          : input.websiteSettings.value.configured
            ? 'A persisted storefront presentation record is present.'
            : 'No tenant storefront presentation record is present; application defaults were not counted.',
    });
  }

  return items;
}

export async function getEcommerceControlCenterData(): Promise<EcommerceControlCenterData> {
  const access = await requireEcommerceStaffAccess();
  const facts = await tryReadSchemaFacts(access.db);

  const [catalog, orders, customers, content, websiteSettings] = await Promise.all([
    access.capabilities.inventoryView ? readCatalogSummary(access, facts) : Promise.resolve(null),
    access.capabilities.salesView ? readOrdersSummary(access, facts) : Promise.resolve(null),
    access.capabilities.peopleView ? readCustomersSummary(access, facts) : Promise.resolve(null),
    access.capabilities.cmsView ? readContentSummary(access, facts) : Promise.resolve(null),
    access.capabilities.settingsView ? readWebsiteSettingsSummary(access, facts) : Promise.resolve(null),
  ]);

  const cartMigration = assessReviewedMigration({
    facts,
    requirements: STOREFRONT_CART_REQUIREMENTS,
    migrationKey: '001_storefront_cart_wishlist',
    expectedChecksum: STOREFRONT_CART_CHECKSUM,
    readyDetail: 'Reviewed cart, wishlist, and catalog-variant rollout is recorded.',
  });
  const checkoutMigration = assessReviewedMigration({
    facts,
    requirements: STOREFRONT_CHECKOUT_REQUIREMENTS,
    migrationKey: '003_storefront_checkout',
    expectedChecksum: STOREFRONT_CHECKOUT_CHECKSUM,
    readyDetail: 'Reviewed checkout, order-currency, access, and idempotency rollout is recorded.',
  });
  const blogMigration = assessReviewedMigration({
    facts,
    requirements: BLOG_CMS_REQUIREMENTS,
    migrationKey: '002_blog_cms',
    expectedChecksum: BLOG_CMS_CHECKSUM,
    readyDetail: 'Reviewed blog columns and migration ledger are recorded.',
  });

  const presentation = buildModulePresentation({
    access,
    facts,
    catalog,
    orders,
    customers,
    content,
    websiteSettings,
    cartMigration,
    checkoutMigration,
    blogMigration,
  });

  const scopeLabel = access.scopeKind === 'store'
    ? access.staff.storeName || 'Assigned store'
    : access.scopeKind === 'company'
      ? 'Company-wide'
      : 'Unassigned';

  return {
    viewer: {
      displayName: access.staff.name,
      roleName: access.staff.roleName,
      companyName: access.company.name,
      storeName: access.scopeKind === 'store' ? access.staff.storeName : null,
      scopeKind: access.scopeKind,
      scopeLabel,
    },
    capabilities: access.capabilities,
    catalog,
    orders,
    customers,
    content,
    websiteSettings,
    modules: buildModuleCards({
      capabilities: access.capabilities,
      states: presentation.states,
      details: presentation.details,
    }),
    readiness: buildReadinessItems({
      access,
      facts,
      catalog,
      orders,
      content,
      websiteSettings,
      cartMigration,
      checkoutMigration,
      blogMigration,
    }),
    quickActions: buildQuickActions(access.capabilities),
    generatedAt: new Date().toISOString(),
  };
}
