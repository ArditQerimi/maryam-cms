'use server';

import { getContextDb } from './tenant';
import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import * as schema from '@/db/schema-tenant';
import { and, desc, asc, eq, inArray, isNotNull, lte, sql, or, ilike } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { hash } from 'bcryptjs';
import { getSession } from '@/lib/session';
import { getDefaultPermissionsForRole, hasPermission } from './permissions';
import { deleteCompanyRolePermissions, getCompanyRolePermissionMap, syncCompanyRolePermissions } from './permission-store';
import { endOfDay, startOfDay } from './dashboard-range';
import { ensureScopedRecordAccess, ensureStoreScopedRecord, ensureTenantContext } from './isolation-guards';
import { normalizePosPaymentMethods, POS_PAYMENT_METHOD_DEFAULTS } from './pos-payment-methods';
import { ensureCompanyDedicatedDatabase } from './tenant-onboarding';

const ACTIVE_STORE_COOKIE = 'active_store_id';

type TenantScopeOptions = {
  bypassTenantScope?: boolean;
  activeStoreId?: number | null;
};

// ─── Multi-Tenancy: resolve current company ───────────────────────────────────
/**
 * Returns the companyId stored in the session.
 * - admin users  → their company's id (number)
 * - super_admin  → null (no tenant scope; can see everything)
 * - customer     → null
 */
export async function getTenantId(): Promise<number | null> {
  const session = await getSession();
  return (session?.companyId as number | null | undefined) ?? null;
}

export async function requireTenantId(): Promise<number> {
  return ensureTenantContext(await getTenantId());
}

async function resolveTenantScope(options?: TenantScopeOptions): Promise<{ activeStoreId: number | null }> {
  if (options?.bypassTenantScope) {
    const isTestEnv = process.env.NODE_ENV === 'test';
    let canBypass = isTestEnv;
    if (!isTestEnv) {
      const session = await getSession();
      canBypass = session?.platformRole === 'super_admin';
    }
    if (!canBypass) {
      throw new Error('Super admin bypass is not allowed for this session');
    }
    return {
      activeStoreId: options.activeStoreId ?? null,
    };
  }

  return {
    activeStoreId: options?.activeStoreId ?? await getActiveStoreId(),
  };
}

export async function getActiveStoreId(): Promise<number | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  const db = await getContextDb();
  const store = await db.query.stores.findFirst({
    where: and(eq(schema.stores.id, parsed), sql`true`),
  });

  return store ? store.id : null;
}

export async function setActiveStore(storeId: number | null) {
  const db = await getContextDb();

  const cookieStore = await cookies();

  if (!storeId) {
    cookieStore.delete(ACTIVE_STORE_COOKIE);
    revalidatePath('/');
    return;
  }

  const store = await db.query.stores.findFirst({
    where: and(eq(schema.stores.id, storeId), sql`true`),
  });

  if (!store) throw new Error('Invalid store selected');

  cookieStore.set(ACTIVE_STORE_COOKIE, String(store.id), {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
  });

  revalidatePath('/');
}

// Categories Actions
export async function getCategories() {
  const db = await getContextDb();
  await ensureCategoryIconColumn(db);
  return await db.select().from(schema.categories).where(sql`true`);
}

async function ensureCategoryAttributeTables(db: Awaited<ReturnType<typeof getContextDb>>) {
  await db.execute(sql`
    DO $$
    BEGIN
      CREATE TYPE "attribute_data_type" AS ENUM ('string', 'number', 'date', 'boolean');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "category_attributes" (
      "id" serial PRIMARY KEY NOT NULL,
      "category_id" integer NOT NULL,
      "name" varchar(255) NOT NULL,
      "data_type" "attribute_data_type" DEFAULT 'string' NOT NULL,
      "is_required" boolean DEFAULT false NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "product_attribute_values" (
      "id" serial PRIMARY KEY NOT NULL,
      "product_id" integer NOT NULL,
      "attribute_id" integer NOT NULL,
      "value" text
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "cat_attr_category_idx" ON "category_attributes" USING btree ("category_id")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "attr_val_product_idx" ON "product_attribute_values" USING btree ("product_id")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "attr_val_attribute_idx" ON "product_attribute_values" USING btree ("attribute_id")`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "attr_val_product_attr_idx" ON "product_attribute_values" USING btree ("product_id", "attribute_id")`);
}

async function ensureCategoryIconColumn(db: Awaited<ReturnType<typeof getContextDb>>) {
  await db.execute(sql`ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "icon_name" varchar(64)`);
}

export async function addCategory(name: string, description?: string, iconName?: string | null) {
  const db = await getContextDb();
  await db.execute(sql`ALTER TABLE "categories" DROP COLUMN IF EXISTS "company_id"`);
  await ensureCategoryIconColumn(db);
  const result = await db.insert(schema.categories).values({ name, description, iconName: iconName || null }).returning();
  revalidatePath('/categories');
  revalidatePath('/pos');
  return result[0];
}

export async function updateCategory(id: number, name: string, description?: string, iconName?: string | null) {
  const db = await getContextDb();
  await ensureCategoryIconColumn(db);
  const result = await db
    .update(schema.categories)
    .set({ name, description, iconName: iconName ?? null })
    .where(and(eq(schema.categories.id, id), sql`true`))
    .returning();
  revalidatePath('/categories');
  revalidatePath('/pos');
  return result[0];
}

export async function deleteCategory(id: number) {
  const db = await getContextDb();
  await db.delete(schema.categories).where(and(eq(schema.categories.id, id), sql`true`));
  revalidatePath('/categories');
}

export async function getProducts(options: {
  query?: string;
  categoryId?: number;
  brandId?: number;
  attributeFilters?: { id: number; value: string }[];
  limit?: number;
} = {}) {
  const db = await getContextDb();
  await ensureCategoryAttributeTables(db);
  let conditions = [sql`true`];

  if (options.query) {
    conditions.push(or(
      ilike(schema.products.name, `%${options.query}%`),
      ilike(schema.products.sku, `%${options.query}%`)
    )!);
  }

  if (options.categoryId) {
    conditions.push(eq(schema.products.categoryId, options.categoryId));
  }

  if (options.brandId) {
    conditions.push(eq(schema.products.brandId, options.brandId));
  }

  // If we have attribute filters, we need to filter product IDs that match ALL of them
  if (options.attributeFilters && options.attributeFilters.length > 0) {
    // This is the most performant way for EAV filtering: 
    // find products where (attr_id = X and val = Y) and count distinct matches = total filters requested
    const filteredProductIds = await db
      .select({ productId: schema.productAttributeValues.productId })
      .from(schema.productAttributeValues)
      .where(
        or(...options.attributeFilters.map(f =>
          and(
            eq(schema.productAttributeValues.attributeId, f.id),
            eq(schema.productAttributeValues.value, f.value)
          )
        )!)
      )
      .groupBy(schema.productAttributeValues.productId)
      .having(sql`count(distinct ${schema.productAttributeValues.attributeId}) = ${options.attributeFilters.length}`);

    const ids = filteredProductIds.map(f => f.productId);
    if (ids.length === 0) return [];
    conditions.push(inArray(schema.products.id, ids));
  }

  try {
    return await db.query.products.findMany({
      where: and(...conditions),
      with: {
        category: true,
        brand: true,
        attributeValues: { with: { attribute: true } },
        variants: { with: { stocks: true } }
      },
      limit: options.limit ?? 500,
    });
  } catch (error) {
    const code = (error as { code?: string; cause?: { code?: string } })?.cause?.code || (error as { code?: string }).code;
    if (code !== '42P01') {
      throw error;
    }

    return await db.query.products.findMany({
      where: and(...conditions),
      with: {
        category: true,
        brand: true,
        variants: { with: { stocks: true } }
      },
      limit: options.limit ?? 500,
    });
  }
}

export async function getExpiredProducts() {
  const db = await getContextDb();
  const { activeStoreId } = await resolveTenantScope();
  const now = new Date();

  const baseFilters = [
    sql`true`,
    isNotNull(schema.products.expiryDate),
    lte(schema.products.expiryDate, now),
  ];

  if (activeStoreId) {
    baseFilters.push(eq(schema.products.storeId, activeStoreId));
  }

  const products = await db.query.products.findMany({
    where: and(...baseFilters),
    with: {
      variants: {
        with: {
          stocks: true,
        },
      },
    },
    orderBy: [asc(schema.products.expiryDate)],
  });

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    manufacturedDate: product.manufacturedDate,
    expiryDate: product.expiryDate,
    stockQuantity: getProductAvailableStock(product),
  }));
}

export async function getCategoryAttributes(categoryId: number) {
  const db = await getContextDb();
  await ensureCategoryAttributeTables(db);
  return await db.query.categoryAttributes.findMany({
    where: and(
      eq(schema.categoryAttributes.categoryId, categoryId),
      sql`true`
    ),
    orderBy: [asc(schema.categoryAttributes.name)]
  });
}

export async function addCategoryAttribute(categoryId: number, data: { name: string; dataType: 'string' | 'number' | 'date' | 'boolean'; isRequired: boolean }) {
  const db = await getContextDb();
  await ensureCategoryAttributeTables(db);
  const result = await db.insert(schema.categoryAttributes).values({
    ...data,
    categoryId
  }).returning();
  revalidatePath(`/categories/${categoryId}/attributes`);
  return result[0];
}

export async function deleteCategoryAttribute(attributeId: number, categoryId: number) {
  const db = await getContextDb();
  await ensureCategoryAttributeTables(db);
  await db.delete(schema.categoryAttributes).where(and(
    eq(schema.categoryAttributes.id, attributeId),
    sql`true`
  ));
  revalidatePath(`/categories/${categoryId}/attributes`);
}

export async function addProduct(
  data: Omit<typeof schema.products.$inferInsert, 'companyId'> & {
    attributes?: { attributeId: number; value: string }[]
  },
  scopeOptions?: TenantScopeOptions
) {
  const db = await getContextDb();
  await resolveTenantScope();
  await ensureCategoryAttributeTables(db);
  const { attributes, ...productData } = data;

  const result = await db.transaction(async (tx) => {
    const [product] = await tx.insert(schema.products).values({ ...productData }).returning();

    if (attributes && attributes.length > 0) {
      await tx.insert(schema.productAttributeValues).values(
        attributes.map(attr => ({
          ...attr,
          productId: product.id
        }))
      );
    }

    return product;
  });

  revalidatePath('/products');
  revalidatePath('/pos');
  return result;
}

export async function deleteProduct(id: number) {
  const db = await getContextDb();
  await db.delete(schema.products).where(and(eq(schema.products.id, id), sql`true`));
  revalidatePath('/products');
}

export async function updateProduct(
  id: number,
  data: Partial<typeof schema.products.$inferInsert> & {
    attributes?: { attributeId: number; value: string }[]
  }
) {
  const db = await getContextDb();
  await ensureCategoryAttributeTables(db);
  const { attributes, ...productData } = data;

  const result = await db.transaction(async (tx) => {
    const [product] = await tx
      .update(schema.products)
      .set(productData)
      .where(and(eq(schema.products.id, id), sql`true`))
      .returning();

    if (attributes) {
      await tx.delete(schema.productAttributeValues).where(eq(schema.productAttributeValues.productId, id));
      const attrsToInsert = attributes.filter(a => a.value !== undefined && a.value !== null && a.value !== '');
      if (attrsToInsert.length > 0) {
        const attributeRows = attrsToInsert.map((attr) => ({
          productId: product.id,
          attributeId: attr.attributeId,
          value: attr.value,
        }));

        await tx.insert(schema.productAttributeValues).values(attributeRows);
      }
    }

    return product;
  });

  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
  revalidatePath('/pos');
  revalidatePath('/home');
  revalidatePath('/home/products');
  revalidatePath(`/home/products/${id}`);
  return result;
}

export async function getProductById(id: number) {
  const db = await getContextDb();
  await ensureCategoryAttributeTables(db);
  return await db.query.products.findFirst({
    where: and(eq(schema.products.id, id), sql`true`),
    with: {
      category: true,
      brand: true,
      unit: true,
      store: {
        columns: {
          id: true,
          name: true,
        },
      },
      warehouse: true,
      warranty: true,
      attributeValues: {
        with: {
          attribute: true
        }
      },
      variants: { with: { stocks: true } }
    }
  });
}

// Sales Actions
// Keep legacy dashboard/POS reads compatible with tenant databases that have
// not yet received the additive storefront checkout migration. Dedicated
// checkout code uses its own migration-gated model and never falls back to
// these compatibility reads.
const legacySalesColumns = {
  id: true,
  customerId: true,
  userId: true,
  warehouseId: true,
  reference: true,
  totalAmount: true,
  discount: true,
  tax: true,
  grandTotal: true,
  status: true,
  paymentMethod: true,
  isOnline: true,
  createdAt: true,
} as const;

export async function getSales(scopeOptions?: TenantScopeOptions) {
  const db = await getContextDb();
  const { activeStoreId } = await resolveTenantScope(scopeOptions);

  let where = sql`true`;

  if (activeStoreId) {
    const scopedUsers = await db.select({ id: schema.users.id }).from(schema.users).where(
      and(sql`true`, eq(schema.users.storeId, activeStoreId))
    );
    const userIds = scopedUsers.map((user: { id: number }) => user.id);
    if (userIds.length === 0) return [];
    const scopedWhere = and(sql`true`, inArray(schema.sales.userId, userIds))!;
    where = scopedWhere;
  }

  return await db.query.sales.findMany({
    columns: legacySalesColumns,
    where,
    with: {
      customer: true,
      user: true,
      items: {
        with: {
          variant: {
            with: {
              product: true
            }
          }
        }
      }
    },
    orderBy: [desc(schema.sales.createdAt)],
  });
}

export async function addSale(data: {
  customerId?: number | null;
  userId?: number | null;
  totalAmount: string;
  paymentMethod: string;
  status?: string;
  isOnline?: boolean;
  reference?: string;
  warehouseId?: number | null;
  items?: Array<{
    productId?: number;
    variantId?: number;
    quantity: number;
    unitPrice: string;
    subtotal: string;
  }>;
}, scopeOptions?: TenantScopeOptions) {
  const db = await getContextDb();
  const { activeStoreId } = await resolveTenantScope(scopeOptions);

  const normalizedStatus = (data.status as typeof schema.sales.$inferInsert.status | undefined) ?? 'Completed';
  const normalizedItems = (data.items ?? []).filter((item) => (((item.variantId ?? 0) > 0) || ((item.productId ?? 0) > 0)) && item.quantity > 0);
  const shouldDeductStock = normalizedStatus === 'Completed' && !data.isOnline;

  const result = await db.transaction(async (tx) => {
    const stockByVariant = new Map<number, typeof schema.productStocks.$inferSelect[]>();
    const resolvedItems: Array<{ variantId: number; quantity: number; unitPrice: string; subtotal: string }> = [];
    const variantToProductId = new Map<number, number>();
    const productStockById = new Map<number, number>();

    if (data.customerId) {
      const customer = await tx.query.customers.findFirst({
        where: and(eq(schema.customers.id, data.customerId), sql`true`),
      });
      if (!customer) {
        throw new Error('Invalid customer selected');
      }
    }

    if (data.userId) {
      const user = await tx.query.users.findFirst({
        where: and(
          eq(schema.users.id, data.userId),
          sql`true`,
          activeStoreId ? eq(schema.users.storeId, activeStoreId) : undefined,
        ),
      });
      if (!user) {
        throw new Error('Invalid user selected');
      }
    }

    if (data.warehouseId) {
      const warehouse = await tx.query.warehouses.findFirst({
        where: and(eq(schema.warehouses.id, data.warehouseId), sql`true`),
      });
      if (!warehouse) {
        throw new Error('Invalid warehouse selected');
      }
    }

    if (normalizedItems.length > 0) {
      const explicitVariantIds = Array.from(new Set(normalizedItems.map((item: { variantId?: number }) => item.variantId).filter((variantId): variantId is number => (variantId ?? 0) > 0)));
      const productIds = Array.from(new Set(normalizedItems.map((item: { productId?: number }) => item.productId).filter((productId): productId is number => (productId ?? 0) > 0)));

      const variants = explicitVariantIds.length > 0
        ? await tx.query.productVariants.findMany({
          where: and(inArray(schema.productVariants.id, explicitVariantIds), sql`true`),
          with: {
            product: true,
          },
        })
        : [];
      if (variants.length !== explicitVariantIds.length) {
        throw new Error('One or more sale items are invalid for this company');
      }

      if (activeStoreId) {
        const invalidStoreVariant = variants.find((variant) => variant.product?.storeId !== activeStoreId);
        if (invalidStoreVariant) {
          ensureStoreScopedRecord(activeStoreId, invalidStoreVariant.product?.storeId, 'Sale item');
        }
      }

      for (const variant of variants) {
        if (variant.productId) {
          variantToProductId.set(variant.id, variant.productId);
        }
      }

      const products = productIds.length > 0
        ? await tx.query.products.findMany({
          where: and(inArray(schema.products.id, productIds), sql`true`),
          with: {
            variants: true,
          },
        })
        : [];
      if (products.length !== productIds.length) {
        throw new Error('One or more sale items are invalid for this company');
      }

      const productVariantByProductId = new Map<number, number>();
      for (const product of products) {
        productStockById.set(product.id, Number(product.stockQuantity || 0));
        if (activeStoreId && product.storeId !== activeStoreId) {
          ensureStoreScopedRecord(activeStoreId, product.storeId, 'Sale item');
        }

        const resolvedVariant = [...(product.variants ?? [])].sort((left, right) => left.id - right.id)[0];
        if (resolvedVariant) {
          productVariantByProductId.set(product.id, resolvedVariant.id);
          variantToProductId.set(resolvedVariant.id, product.id);
          continue;
        }

        const [createdVariant] = await tx
          .insert(schema.productVariants)
          .values({
            productId: product.id,
            name: `${product.name} Default`,
            sku: `PRD-${product.id}-DEFAULT`,
            price: product.price || '0',
            costPrice: product.costPrice || '0',
            status: 'Active',
          })
          .returning();

        productVariantByProductId.set(product.id, createdVariant.id);
        variantToProductId.set(createdVariant.id, product.id);
      }

      for (const item of normalizedItems) {
        const resolvedVariantId = item.variantId ?? (item.productId ? productVariantByProductId.get(item.productId) : undefined);
        if (!resolvedVariantId) {
          throw new Error('One or more sale items are invalid for this company');
        }
        resolvedItems.push({
          variantId: resolvedVariantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        });
      }

      const resolvedVariantIds = Array.from(new Set(resolvedItems.map((item) => item.variantId)));
      const stocks = await tx.query.productStocks.findMany({
        where: and(inArray(schema.productStocks.variantId, resolvedVariantIds), sql`true`),
      });

      for (const stock of stocks) {
        const grouped = stockByVariant.get(stock.variantId) ?? [];
        grouped.push(stock);
        stockByVariant.set(stock.variantId, grouped);
      }

      // Kërkesa e biznesit: NUK ndalojmë shitjen kur mungon stoku (biznesi mund
      // të ketë stok fizik jashtë sistemit). Vetëm nxjerrim nga stoku sa është
      // e mundur. Në POS, klienti sheh gjendjen paraprakisht te badge te karta.
      // Verifikimi paraprak për variantë të pavlefshëm ende bëhet — vetëm alerti
      // "Insufficient stock" u hoq.
      if (shouldDeductStock) {
        for (const item of resolvedItems) {
          // s'bëhet asnjë ndalesë; ndarja e sasive për deduction bëhet më poshtë
          // te blloqet e insert-imit të productStocks / variants.
          void item;
        }
      }
    }

    const [sale] = await tx
      .insert(schema.sales)
      .values({
        customerId: data.customerId ?? null,
        userId: data.userId ?? null,
        warehouseId: data.warehouseId ?? null,
        totalAmount: data.totalAmount,
        grandTotal: data.totalAmount,
        paymentMethod: data.paymentMethod,
        status: normalizedStatus,
        isOnline: data.isOnline ?? false,
        reference: data.reference?.trim() || `SL${Date.now()}`,
      })
      .returning();

    if (normalizedItems.length > 0) {
      await tx.insert(schema.saleItems).values(
        resolvedItems.map((item) => ({
          saleId: sale.id,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        }))
      );
    }

    if (shouldDeductStock) {
      for (const item of resolvedItems) {
        const variantStocks = [...(stockByVariant.get(item.variantId) ?? [])];
        let remaining = item.quantity;

        if (variantStocks.length > 0) {
          for (const stock of variantStocks) {
            if (remaining <= 0) break;

            const currentQty = stock.quantity || 0;
            const deducted = Math.min(currentQty, remaining);
            remaining -= deducted;

            await tx
              .update(schema.productStocks)
              .set({ quantity: currentQty - deducted })
              .where(eq(schema.productStocks.id, stock.id));
          }
        } else {
          const productId = variantToProductId.get(item.variantId);
          if (productId && remaining > 0) {
            const currentQty = productStockById.get(productId) ?? 0;
            const deducted = Math.min(currentQty, remaining);
            remaining -= deducted;
            productStockById.set(productId, currentQty - deducted);
            await tx
              .update(schema.products)
              .set({ stockQuantity: currentQty - deducted })
              .where(and(eq(schema.products.id, productId), sql`true`));
          }
        }
      }
    }

    if (normalizedStatus === 'Completed' && data.customerId) {
      const customer = await tx.query.customers.findFirst({
        where: and(eq(schema.customers.id, data.customerId), sql`true`),
      });

      if (customer) {
        await tx
          .update(schema.customers)
          .set({
            totalSales: (Number(customer.totalSales || 0) + Number(data.totalAmount || 0)).toFixed(2),
          })
          .where(and(eq(schema.customers.id, customer.id), sql`true`));
      }
    }

    return sale;
  });

  revalidatePath('/sales');
  revalidatePath('/products');
  return result;
}

export async function markSaleAsCompleted(id: number) {
  const db = await getContextDb();
  const result = await db
    .update(schema.sales)
    .set({ status: 'Completed' })
    .where(and(eq(schema.sales.id, id), sql`true`))
    .returning();
  revalidatePath('/sales');
  return result[0];
}

export async function updateSale(
  id: number,
  data: {
    customerId?: number | null;
    userId?: number | null;
    totalAmount?: string;
    paymentMethod?: string;
    status?: string;
    isOnline?: boolean;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.sales.$inferInsert> = {
    customerId: data.customerId,
    userId: data.userId,
    totalAmount: data.totalAmount,
    paymentMethod: data.paymentMethod,
    isOnline: data.isOnline,
    status: data.status as typeof schema.sales.$inferInsert.status,
  };

  const result = await db
    .update(schema.sales)
    .set(payload)
    .where(and(eq(schema.sales.id, id), sql`true`))
    .returning();
  revalidatePath('/sales');
  return result[0];
}

export async function deleteSale(id: number) {
  const db = await getContextDb();
  await db.delete(schema.saleItems).where(and(eq(schema.saleItems.saleId, id), sql`true`));
  await db.delete(schema.sales).where(and(eq(schema.sales.id, id), sql`true`));
  revalidatePath('/sales');
}

// Purchases Actions
export async function getPurchases() {
  const db = await getContextDb();
  return await db.query.purchases.findMany({
    where: sql`true`,
    with: {
      supplier: true
    }
  });
}

export async function addPurchase(data: {
  supplierId?: number | null;
  reference: string;
  status?: string;
  totalAmount: string;
}) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.purchases)
    .values({
      supplierId: data.supplierId ?? null,
      reference: data.reference,
      status: (data.status as any) ?? 'Pending',
      totalAmount: data.totalAmount,
    })
    .returning();
  revalidatePath('/purchases');
  return result[0];
}

export async function updatePurchase(
  id: number,
  data: {
    supplierId?: number | null;
    reference?: string;
    status?: string;
    totalAmount?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.purchases.$inferInsert> = {
    supplierId: data.supplierId,
    reference: data.reference,
    totalAmount: data.totalAmount,
    status: data.status as typeof schema.purchases.$inferInsert.status,
  };

  const result = await db
    .update(schema.purchases)
    .set(payload)
    .where(and(eq(schema.purchases.id, id), sql`true`))
    .returning();
  revalidatePath('/purchases');
  return result[0];
}

export async function deletePurchase(id: number) {
  const db = await getContextDb();
  await db.delete(schema.purchases).where(and(eq(schema.purchases.id, id), sql`true`));
  revalidatePath('/purchases');
}

// Purchase Items Actions
export async function addPurchaseItems(data: {
  purchaseId: number;
  items: Array<{
    variantId: number;
    quantity: number;
    costPrice: string;
    subtotal: string;
  }>;
}) {
  const db = await getContextDb();
  if (data.items.length === 0) return [];
  
  const result = await db
    .insert(schema.purchaseItems)
    .values(data.items.map(item => ({
      purchaseId: data.purchaseId,
      variantId: item.variantId,
      quantity: item.quantity,
      costPrice: item.costPrice,
      subtotal: item.subtotal,
    })))
    .returning();
  revalidatePath('/purchases');
  return result;
}

export async function getPurchaseItems(purchaseId: number) {
  const db = await getContextDb();
  return await db
    .select()
    .from(schema.purchaseItems)
    .where(eq(schema.purchaseItems.purchaseId, purchaseId));
}

export async function deletePurchaseItem(id: number) {
  const db = await getContextDb();
  await db.delete(schema.purchaseItems).where(eq(schema.purchaseItems.id, id));
  revalidatePath('/purchases');
}

// Purchase Returns (tracked as notes on purchases for now)
export async function createPurchaseReturn(data: {
  purchaseId: number;
  reason: string;
  returnedQty: number;
  returnedAmount: string;
  notes?: string;
}) {
  const db = await getContextDb();
  // Update purchase with return status note
  const purchase = await db.query.purchases.findFirst({
    where: eq(schema.purchases.id, data.purchaseId),
  });
  
  if (!purchase) throw new Error('Purchase not found');
  
  // For now, return a confirmation object
  // In a full implementation, you'd have a purchase_returns table
  return {
    id: `return_${data.purchaseId}_${Date.now()}`,
    purchaseId: data.purchaseId,
    returnedQty: data.returnedQty,
    returnedAmount: data.returnedAmount,
    reason: data.reason,
    notes: data.notes,
    createdAt: new Date(),
  };
}

// People Actions
export async function getCustomers() {
  const db = await getContextDb();
  return await db
    .select()
    .from(schema.customers)
    .where(sql`true`)
    .orderBy(desc(schema.customers.createdAt));
}

export async function addCustomer(data: {
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  status?: string;
}) {
  const db = await getContextDb();
  const result = await db.insert(schema.customers).values({
    name: data.name,
    email: data.email,
    phone: data.phone,
    country: data.country,
    address: data.address,
    city: data.city,
    state: data.state,
    postalCode: data.postalCode,
    status: data.status as typeof schema.customers.$inferInsert.status,
  }).returning();
  revalidatePath('/customers');
  return result[0];
}

export async function updateCustomer(
  id: number,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    country?: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    status?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.customers.$inferInsert> = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    country: data.country,
    address: data.address,
    city: data.city,
    state: data.state,
    postalCode: data.postalCode,
    status: data.status as typeof schema.customers.$inferInsert.status,
  };

  const result = await db
    .update(schema.customers)
    .set(payload)
    .where(and(eq(schema.customers.id, id), sql`true`))
    .returning();
  revalidatePath('/customers');
  return result[0];
}

export async function deleteCustomer(id: number) {
  const db = await getContextDb();
  await db.delete(schema.sales).where(and(eq(schema.sales.customerId, id), sql`true`));
  await db.delete(schema.customers).where(and(eq(schema.customers.id, id), sql`true`));
  revalidatePath('/customers');
  revalidatePath('/sales');
}

export async function getBillers() {
  const db = await getContextDb();
  return await db
    .select()
    .from(schema.billers)
    .where(sql`true`)
    .orderBy(desc(schema.billers.createdAt));
}

export async function addBiller(data: {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  country?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  status?: string;
}) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.billers)
    .values({
      name: data.name,
      companyName: data.companyName,
      email: data.email,
      phone: data.phone,
      country: data.country,
      address: data.address,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      status: (data.status as any) ?? 'Active',
    })
    .returning();
  revalidatePath('/billers');
  return result[0];
}

export async function updateBiller(
  id: number,
  data: {
    name?: string;
    companyName?: string;
    email?: string;
    phone?: string;
    country?: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    status?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.billers.$inferInsert> = {
    name: data.name,
    companyName: data.companyName,
    email: data.email,
    phone: data.phone,
    country: data.country,
    address: data.address,
    city: data.city,
    state: data.state,
    postalCode: data.postalCode,
    status: data.status as typeof schema.billers.$inferInsert.status,
  };

  const result = await db
    .update(schema.billers)
    .set(payload)
    .where(and(eq(schema.billers.id, id), sql`true`))
    .returning();
  revalidatePath('/billers');
  return result[0];
}

export async function deleteBiller(id: number) {
  const db = await getContextDb();
  await db.delete(schema.billers).where(and(eq(schema.billers.id, id), sql`true`));
  revalidatePath('/billers');
}

export async function getSuppliers() {
  const db = await getContextDb();
  return await db
    .select()
    .from(schema.suppliers)
    .where(sql`true`)
    .orderBy(desc(schema.suppliers.createdAt));
}

export async function addSupplier(data: {
  name: string;
  email?: string;
  phone?: string;
  status?: string;
  address?: string;
}) {
  const db = await getContextDb();
  const result = await db.insert(schema.suppliers).values({
    name: data.name,
    email: data.email,
    phone: data.phone,
    address: data.address,
    status: data.status as typeof schema.suppliers.$inferInsert.status,
  }).returning();
  revalidatePath('/suppliers');
  return result[0];
}

export async function updateSupplier(
  id: number,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    status?: string;
    address?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.suppliers.$inferInsert> = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    address: data.address,
    status: data.status as typeof schema.suppliers.$inferInsert.status,
  };

  const result = await db
    .update(schema.suppliers)
    .set(payload)
    .where(and(eq(schema.suppliers.id, id), sql`true`))
    .returning();
  revalidatePath('/suppliers');
  return result[0];
}

export async function deleteSupplier(id: number) {
  const db = await getContextDb();
  await db.delete(schema.purchases).where(and(eq(schema.purchases.supplierId, id), sql`true`));
  await db.delete(schema.suppliers).where(and(eq(schema.suppliers.id, id), sql`true`));
  revalidatePath('/suppliers');
  revalidatePath('/purchases');
}

// Metadata Actions (for forms)
export async function getBrands() {
  const db = await getContextDb();
  return await db.select().from(schema.brands).where(sql`true`);
}
export async function addBrand(data: { name: string; code?: string; status?: string }) {
  const db = await getContextDb();
  const result = await db.insert(schema.brands).values({
    ...data,
    status: data.status as typeof schema.brands.$inferInsert.status,
  }).returning();
  revalidatePath('/brands');
  return result[0];
}
export async function updateBrand(id: number, data: { name?: string; code?: string; status?: string }) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.brands.$inferInsert> = {
    name: data.name,
    code: data.code,
    status: data.status as typeof schema.brands.$inferInsert.status,
  };
  const result = await db
    .update(schema.brands)
    .set(payload)
    .where(and(eq(schema.brands.id, id), sql`true`))
    .returning();
  revalidatePath('/brands');
  return result[0];
}
export async function deleteBrand(id: number) {
  const db = await getContextDb();
  await db.delete(schema.products).where(and(eq(schema.products.brandId, id), sql`true`));
  await db.delete(schema.brands).where(and(eq(schema.brands.id, id), sql`true`));
  revalidatePath('/brands');
  revalidatePath('/products');
}

export async function getUnits() {
  const db = await getContextDb();
  return await db.select().from(schema.units).where(sql`true`);
}
export async function addUnit(data: { name: string; shortName?: string; status?: string }) {
  const db = await getContextDb();
  const result = await db.insert(schema.units).values({
    ...data,
    status: data.status as typeof schema.units.$inferInsert.status,
  }).returning();
  revalidatePath('/units');
  return result[0];
}
export async function updateUnit(id: number, data: { name?: string; shortName?: string; status?: string }) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.units.$inferInsert> = {
    name: data.name,
    shortName: data.shortName,
    status: data.status as typeof schema.units.$inferInsert.status,
  };
  const result = await db
    .update(schema.units)
    .set(payload)
    .where(and(eq(schema.units.id, id), sql`true`))
    .returning();
  revalidatePath('/units');
  return result[0];
}
export async function deleteUnit(id: number) {
  const db = await getContextDb();
  await db.delete(schema.products).where(and(eq(schema.products.unitId, id), sql`true`));
  await db.delete(schema.units).where(and(eq(schema.units.id, id), sql`true`));
  revalidatePath('/units');
  revalidatePath('/products');
}

export async function getWarranties() {
  const db = await getContextDb();
  return await db.select().from(schema.warranties).where(sql`true`);
}
export async function addWarranty(data: { name: string; duration?: string; type?: string; status?: string }) {
  const db = await getContextDb();
  const result = await db.insert(schema.warranties).values({
    name: data.name,
    duration: data.duration,
    type: data.type,
    status: data.status as typeof schema.warranties.$inferInsert.status,
  }).returning();
  revalidatePath('/warranty');
  return result[0];
}
export async function updateWarranty(id: number, data: { name?: string; duration?: string; type?: string; status?: string }) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.warranties.$inferInsert> = {
    name: data.name,
    duration: data.duration,
    type: data.type,
    status: data.status as typeof schema.warranties.$inferInsert.status,
  };
  const result = await db
    .update(schema.warranties)
    .set(payload)
    .where(and(eq(schema.warranties.id, id), sql`true`))
    .returning();
  revalidatePath('/warranty');
  return result[0];
}
export async function deleteWarranty(id: number) {
  const db = await getContextDb();
  await db.delete(schema.products).where(and(eq(schema.products.warrantyId, id), sql`true`));
  await db.delete(schema.warranties).where(and(eq(schema.warranties.id, id), sql`true`));
  revalidatePath('/warranty');
  revalidatePath('/products');
}

export async function getStores(scopeOptions?: TenantScopeOptions) {
  const db = await getContextDb();
  await resolveTenantScope();
  return await db.query.stores.findMany({
    where: sql`true`,
    orderBy: [desc(schema.stores.createdAt)],
  });
}

export async function addStore(data: {
  name: string;
  userName?: string;
  email?: string;
  phone?: string;
  code?: string;
  status?: string;
}) {
  const db = await getContextDb();
  const result = await db.insert(schema.stores).values({
    name: data.name,
    userName: data.userName,
    email: data.email,
    phone: data.phone,
    code: data.code,
    status: data.status as typeof schema.stores.$inferInsert.status,
  }).returning();
  revalidatePath('/stores');
  return result[0];
}

export async function updateStore(
  id: number,
  data: {
    name?: string;
    userName?: string;
    email?: string;
    phone?: string;
    code?: string;
    status?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.stores.$inferInsert> = {
    name: data.name,
    userName: data.userName,
    email: data.email,
    phone: data.phone,
    code: data.code,
    status: data.status as typeof schema.stores.$inferInsert.status,
  };
  const result = await db
    .update(schema.stores)
    .set(payload)
    .where(and(eq(schema.stores.id, id), sql`true`))
    .returning();
  revalidatePath('/stores');
  return result[0];
}

export async function deleteStore(id: number) {
  const db = await getContextDb();
  await db.delete(schema.products).where(and(eq(schema.products.storeId, id), sql`true`));
  await db.delete(schema.stores).where(and(eq(schema.stores.id, id), sql`true`));
  revalidatePath('/stores');
  revalidatePath('/products');
}

export async function getWarehouses() {
  const db = await getContextDb();
  return await db
    .select()
    .from(schema.warehouses)
    .where(sql`true`)
    .orderBy(desc(schema.warehouses.createdAt));
}

export async function addWarehouse(data: {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  code?: string;
  status?: string;
}) {
  const db = await getContextDb();
  const result = await db.insert(schema.warehouses).values({
    name: data.name,
    contactPerson: data.contactPerson,
    email: data.email,
    phone: data.phone,
    address: data.address,
    code: data.code,
    status: data.status as any
  }).returning();
  revalidatePath('/warehouses');
  return result[0];
}

export async function updateWarehouse(
  id: number,
  data: {
    name?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    code?: string;
    status?: string;
  }
) {
  const db = await getContextDb();
  const result = await db
    .update(schema.warehouses)
    .set({
      name: data.name,
      contactPerson: data.contactPerson,
      email: data.email,
      phone: data.phone,
      address: data.address,
      code: data.code,
      status: data.status as any
    })
    .where(and(eq(schema.warehouses.id, id), sql`true`))
    .returning();
  revalidatePath('/warehouses');
  return result[0];
}

export async function deleteWarehouse(id: number) {
  const db = await getContextDb();
  await db.delete(schema.products).where(and(eq(schema.products.warehouseId, id), sql`true`));
  await db.delete(schema.warehouses).where(and(eq(schema.warehouses.id, id), sql`true`));
  revalidatePath('/warehouses');
  revalidatePath('/products');
}
export async function getCategoryById(id: number) {
  const db = await getContextDb();
  const results = await db
    .select()
    .from(schema.categories)
    .where(and(eq(schema.categories.id, id), sql`true`));
  return results[0];
}

export async function getSubCategories() {
  const db = await getContextDb();
  return await db.select().from(schema.subCategories).where(sql`true`);
}
export async function addSubCategory(data: { categoryId: number; name: string; description?: string }) {
  const db = await getContextDb();
  const result = await db.insert(schema.subCategories).values({
    categoryId: data.categoryId,
    name: data.name,
    description: data.description
  }).returning();
  revalidatePath('/categories/sub');
  revalidatePath('/products/add');
  return result[0];
}
export async function updateSubCategory(
  id: number,
  data: { categoryId?: number; name?: string; description?: string }
) {
  const db = await getContextDb();
  const result = await db
    .update(schema.subCategories)
    .set({
      categoryId: data.categoryId,
      name: data.name,
      description: data.description
    })
    .where(and(eq(schema.subCategories.id, id), sql`true`))
    .returning();
  revalidatePath('/categories/sub');
  revalidatePath('/products/add');
  return result[0];
}
export async function deleteSubCategory(id: number) {
  const db = await getContextDb();
  await db.delete(schema.products).where(and(eq(schema.products.subCategoryId, id), sql`true`));
  await db.delete(schema.subCategories).where(and(eq(schema.subCategories.id, id), sql`true`));
  revalidatePath('/categories/sub');
  revalidatePath('/products');
}
export async function getSubCategoriesByCategory(categoryId: number) {
  const db = await getContextDb();
  return await db
    .select()
    .from(schema.subCategories)
    .where(and(eq(schema.subCategories.categoryId, categoryId), sql`true`));
}

export async function getLowStockProducts() {
  const db = await getContextDb();
  const activeStoreId = await getActiveStoreId();
  const stocks = await db.query.productStocks.findMany({
    where: sql`true`,
    with: {
      variant: {
        with: {
          product: true
        }
      },
      warehouse: true
    },
  });

  return stocks.filter((stock) => {
    if (activeStoreId && stock.variant?.product?.storeId !== activeStoreId) {
      return false;
    }
    const minStock = stock.minStockLevel ?? 0;
    return stock.quantity <= minStock;
  });
}

export async function adjustProductStock(id: number, stockQuantity: number, minStockLevel?: number | null) {
  const db = await getContextDb();
  // Update the product's stock quantity directly
  const result = await db
    .update(schema.products)
    .set({
      stockQuantity: stockQuantity,
    })
    .where(eq(schema.products.id, id))
    .returning();

  revalidatePath('/products');
  revalidatePath('/products/low-stock');
  revalidatePath('/products/stock-management');
  revalidatePath('/products/stock-adjustment');
  return result[0];
}

/**
 * Atomically adjust stock by a delta amount (add/subtract).
 * Uses database-level SQL operations to prevent race conditions.
 * @param id - Product ID
 * @param delta - Amount to add (positive) or subtract (negative)
 * @param minStockLevel - Minimum allowed stock level (0 if not specified)
 */
export async function adjustProductStockByDelta(id: number, delta: number, minStockLevel?: number | null) {
  const db = await getContextDb();
  const minStock = minStockLevel ?? 0;
  
  // Use atomic SQL operation: stock = MAX(stock + delta, minStock)
  // This ensures concurrent adjustments don't conflict
  const result = await db
    .update(schema.products)
    .set({
      stockQuantity: sql`CASE 
        WHEN ${schema.products.stockQuantity} + ${delta} < ${minStock} THEN ${minStock}
        ELSE ${schema.products.stockQuantity} + ${delta}
      END`,
    })
    .where(eq(schema.products.id, id))
    .returning();

  revalidatePath('/products');
  revalidatePath('/products/low-stock');
  revalidatePath('/products/stock-management');
  revalidatePath('/products/stock-adjustment');
  return result[0];
}

/**
 * Set stock to exact count (for physical inventory counts).
 * Use this sparingly - prefer adjustProductStockByDelta for normal operations.
 * @param id - Product ID
 * @param quantity - Exact quantity to set
 */
export async function setProductStockCount(id: number, quantity: number) {
  const db = await getContextDb();
  const result = await db
    .update(schema.products)
    .set({
      stockQuantity: Math.max(quantity, 0),
    })
    .where(eq(schema.products.id, id))
    .returning();

  revalidatePath('/products');
  revalidatePath('/products/low-stock');
  revalidatePath('/products/stock-management');
  revalidatePath('/products/stock-adjustment');
  return result[0];
}

export async function transferProductStock(id: number, quantity: number, warehouseId?: number | null, storeId?: number | null) {
  const db = await getContextDb();
  const product = await db.query.products.findFirst({ where: and(eq(schema.products.id, id), sql`true`) });
  if (!product) return null;

  const result = await db
    .update(schema.products)
    .set({
      warehouseId: warehouseId ?? product.warehouseId,
      storeId: storeId ?? product.storeId,
    })
    .where(and(eq(schema.products.id, id), sql`true`))
    .returning();

  revalidatePath('/products');
  revalidatePath('/products/stock-transfer');
  revalidatePath('/products/stock-management');
  revalidatePath('/products/low-stock');
  return result[0];
}

// Other entity actions
export async function getCompanies() {
  return await masterDb.select().from(masterSchema.companies);
}

export async function addCompany(data: { name: string; email: string; subdomain: string; dbConnectionString: string; status?: string }) {
  const result = await masterDb.insert(masterSchema.companies).values({
    name: data.name,
    email: data.email,
    subdomain: data.subdomain,
    dbConnectionString: data.dbConnectionString,
    status: (data.status as any) ?? 'Active',
  }).returning();
  revalidatePath('/companies');
  return result[0];
}

export async function updateCompany(id: number, data: { name?: string; email?: string; subdomain?: string; dbConnectionString?: string; status?: string }) {
  const result = await masterDb.update(masterSchema.companies).set({
    ...data,
    ...(data.status ? { status: data.status as any } : {}),
  }).where(eq(masterSchema.companies.id, id)).returning();
  revalidatePath('/companies');
  return result[0];
}

export async function deleteCompany(id: number) {
  await masterDb.delete(masterSchema.subscriptions).where(eq(masterSchema.subscriptions.companyId, id));
  await masterDb.delete(masterSchema.companies).where(eq(masterSchema.companies.id, id));
  revalidatePath('/companies');
  revalidatePath('/subscriptions');
}

export async function getExpenses() {
  const db = await getContextDb();
  return await db.select().from(schema.expenses).where(sql`true`);
}

export async function addExpense(data: { category: string; amount: string; reference?: string; status?: string }) {
  const db = await getContextDb();
  const result = await db.insert(schema.expenses).values({
    category: data.category,
    amount: data.amount,
    reference: data.reference,
    status: data.status as any
  }).returning();
  revalidatePath('/expenses');
  return result[0];
}

export async function updateExpense(
  id: number,
  data: { category?: string; amount?: string; reference?: string; status?: string }
) {
  const db = await getContextDb();
  const result = await db
    .update(schema.expenses)
    .set({
      category: data.category,
      amount: data.amount,
      reference: data.reference,
      status: data.status as any
    })
    .where(and(eq(schema.expenses.id, id), sql`true`))
    .returning();
  revalidatePath('/expenses');
  return result[0];
}

export async function deleteExpense(id: number) {
  const db = await getContextDb();
  await db.delete(schema.expenses).where(and(eq(schema.expenses.id, id), sql`true`));
  revalidatePath('/expenses');
}

// Finance Actions
export async function getBankAccountTypes() {
  const db = await getContextDb();
  return await db
    .select()
    .from(schema.bankAccountTypes)
    .where(sql`true`)
    .orderBy(desc(schema.bankAccountTypes.createdAt));
}

export async function addBankAccountType(data: { name: string; status?: string }) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.bankAccountTypes)
    .values({
      name: data.name,
      status: (data.status as any) ?? 'Active',
    })
    .returning();
  revalidatePath('/bank-accounts');
  return result[0];
}

export async function updateBankAccountType(id: number, data: { name?: string; status?: string }) {
  const db = await getContextDb();
  const result = await db
    .update(schema.bankAccountTypes)
    .set({
      name: data.name,
      status: data.status as any
    })
    .where(and(eq(schema.bankAccountTypes.id, id), sql`true`))
    .returning();
  revalidatePath('/bank-accounts');
  return result[0];
}

export async function deleteBankAccountType(id: number) {
  const db = await getContextDb();
  await db
    .update(schema.bankAccounts)
    .set({ accountTypeId: null })
    .where(and(eq(schema.bankAccounts.accountTypeId, id), sql`true`));
  await db.delete(schema.bankAccountTypes).where(and(eq(schema.bankAccountTypes.id, id), sql`true`));
  revalidatePath('/bank-accounts');
}

export async function getBankAccounts() {
  const db = await getContextDb();
  return await db.query.bankAccounts.findMany({
    where: sql`true`,
    with: {
      accountType: true,
    },
    orderBy: [desc(schema.bankAccounts.createdAt)],
  });
}

export async function addBankAccount(data: {
  accountHolderName: string;
  accountNo: string;
  accountTypeId?: number | null;
  openingBalance: string;
  notes?: string;
  status?: string;
}) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.bankAccounts)
    .values({
      accountHolderName: data.accountHolderName,
      accountNo: data.accountNo,
      accountTypeId: data.accountTypeId ?? null,
      openingBalance: data.openingBalance,
      notes: data.notes,
      status: (data.status as any) ?? 'Active',
    })
    .returning();
  revalidatePath('/bank-accounts');
  revalidatePath('/money-transfer');
  revalidatePath('/balance-sheet');
  revalidatePath('/cash-flow');
  return result[0];
}

export async function updateBankAccount(
  id: number,
  data: {
    accountHolderName?: string;
    accountNo?: string;
    accountTypeId?: number | null;
    openingBalance?: string;
    notes?: string;
    status?: string;
  }
) {
  const db = await getContextDb();
  const result = await db
    .update(schema.bankAccounts)
    .set({
      accountHolderName: data.accountHolderName,
      accountNo: data.accountNo,
      accountTypeId: data.accountTypeId,
      openingBalance: data.openingBalance,
      notes: data.notes,
      status: data.status as any
    })
    .where(and(eq(schema.bankAccounts.id, id), sql`true`))
    .returning();
  revalidatePath('/bank-accounts');
  revalidatePath('/money-transfer');
  revalidatePath('/balance-sheet');
  revalidatePath('/cash-flow');
  return result[0];
}

export async function deleteBankAccount(id: number) {
  const db = await getContextDb();
  await db.delete(schema.moneyTransfers).where(and(eq(schema.moneyTransfers.fromAccountId, id), sql`true`));
  await db.delete(schema.moneyTransfers).where(and(eq(schema.moneyTransfers.toAccountId, id), sql`true`));
  await db.delete(schema.bankAccounts).where(and(eq(schema.bankAccounts.id, id), sql`true`));
  revalidatePath('/bank-accounts');
  revalidatePath('/money-transfer');
  revalidatePath('/balance-sheet');
  revalidatePath('/cash-flow');
}

export async function getMoneyTransfers() {
  const db = await getContextDb();
  return await db.query.moneyTransfers.findMany({
    where: sql`true`,
    with: {
      fromAccount: true,
      toAccount: true,
    },
    orderBy: [desc(schema.moneyTransfers.date)],
  });
}

export async function addMoneyTransfer(data: {
  fromAccountId: number;
  toAccountId: number;
  amount: string;
  date?: Date;
  paymentMethod?: string;
  description?: string;
}) {
  if (data.fromAccountId === data.toAccountId) {
    throw new Error('From account and to account must be different.');
  }

  const db = await getContextDb();
  const nextRef = `#MT${Date.now().toString().slice(-6)}`;
  const result = await db
    .insert(schema.moneyTransfers)
    .values({
      referenceNumber: nextRef,
      fromAccountId: data.fromAccountId,
      toAccountId: data.toAccountId,
      amount: data.amount,
      date: data.date ?? new Date(),
      paymentMethod: data.paymentMethod ?? 'Bank Transfer',
      description: data.description,
    })
    .returning();

  revalidatePath('/money-transfer');
  revalidatePath('/balance-sheet');
  revalidatePath('/cash-flow');
  return result[0];
}

export async function updateMoneyTransfer(
  id: number,
  data: {
    fromAccountId?: number;
    toAccountId?: number;
    amount?: string;
    date?: Date;
    paymentMethod?: string;
    description?: string;
  }
) {
  if (data.fromAccountId && data.toAccountId && data.fromAccountId === data.toAccountId) {
    throw new Error('From account and to account must be different.');
  }

  const db = await getContextDb();
  const result = await db
    .update(schema.moneyTransfers)
    .set({
      fromAccountId: data.fromAccountId,
      toAccountId: data.toAccountId,
      amount: data.amount,
      date: data.date,
      paymentMethod: data.paymentMethod,
      description: data.description
    })
    .where(and(eq(schema.moneyTransfers.id, id), sql`true`))
    .returning();
  revalidatePath('/money-transfer');
  revalidatePath('/balance-sheet');
  revalidatePath('/cash-flow');
  return result[0];
}

export async function deleteMoneyTransfer(id: number) {
  const db = await getContextDb();
  await db.delete(schema.moneyTransfers).where(and(eq(schema.moneyTransfers.id, id), sql`true`));
  revalidatePath('/money-transfer');
  revalidatePath('/balance-sheet');
  revalidatePath('/cash-flow');
}

export async function getBalanceSheetRows() {
  const db = await getContextDb();
  const accounts = await db.query.bankAccounts.findMany({
    where: sql`true`,
    with: { accountType: true },
    orderBy: [desc(schema.bankAccounts.createdAt)],
  });

  const creditRows = await db
    .select({
      accountId: schema.moneyTransfers.toAccountId,
      amount: sql<string>`coalesce(sum(${schema.moneyTransfers.amount}), 0)`,
    })
    .from(schema.moneyTransfers)
    .where(sql`true`)
    .groupBy(schema.moneyTransfers.toAccountId);

  const debitRows = await db
    .select({
      accountId: schema.moneyTransfers.fromAccountId,
      amount: sql<string>`coalesce(sum(${schema.moneyTransfers.amount}), 0)`,
    })
    .from(schema.moneyTransfers)
    .where(sql`true`)
    .groupBy(schema.moneyTransfers.fromAccountId);

  const creditMap = new Map(creditRows.map((row) => [row.accountId, Number(row.amount || 0)]));
  const debitMap = new Map(debitRows.map((row) => [row.accountId, Number(row.amount || 0)]));

  return accounts.map((account) => {
    const opening: number = Number(account.openingBalance || 0);
    const credit: number = creditMap.get(account.id) ?? 0;
    const debit: number = debitMap.get(account.id) ?? 0;

    return {
      id: account.id,
      name: account.accountHolderName,
      bankAndAccountNumber: `${account.accountType?.name ?? 'Bank'} - ${account.accountNo}`,
      credit,
      debit,
      balance: opening + credit - debit,
    };
  });
}

export async function getCashFlowRows() {
  const db = await getContextDb();
  const accounts = await db.select().from(schema.bankAccounts).where(sql`true`);
  const transfers = await db.query.moneyTransfers.findMany({
    where: sql`true`,
    with: {
      fromAccount: true,
      toAccount: true,
    },
    orderBy: [desc(schema.moneyTransfers.date)],
  });

  const initialBalances = new Map<number, number>(accounts.map((account) => [account.id, Number(account.openingBalance || 0)]));
  const totalBalance = Array.from(initialBalances.values()).reduce((acc, value) => acc + value, 0);

  const ascending = [...transfers].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const runningBalances = new Map(initialBalances);
  const rowByTransferId = new Map<number, { fromBalance: number; toBalance: number }>();

  for (const transfer of ascending) {
    const amount = Number(transfer.amount || 0);
    const fromBalance = (runningBalances.get(transfer.fromAccountId) ?? 0) - amount;
    const toBalance = (runningBalances.get(transfer.toAccountId) ?? 0) + amount;
    runningBalances.set(transfer.fromAccountId, fromBalance);
    runningBalances.set(transfer.toAccountId, toBalance);
    rowByTransferId.set(transfer.id, { fromBalance, toBalance });
  }

  const rows: Array<{
    id: number;
    date: Date;
    bankAndAccountNumber: string;
    description: string;
    credit: number;
    debit: number;
    accountBalance: number;
    totalBalance: number;
    paymentMethod: string;
  }> = [];

  for (const transfer of transfers) {
    const amount = Number(transfer.amount || 0);
    const balanceInfo = rowByTransferId.get(transfer.id);
    const date = new Date(transfer.date);
    const fromLabel = transfer.fromAccount ? transfer.fromAccount.accountNo : `Account #${transfer.fromAccountId}`;
    const toLabel = transfer.toAccount ? transfer.toAccount.accountNo : `Account #${transfer.toAccountId}`;

    rows.push({
      id: transfer.id * 2,
      date,
      bankAndAccountNumber: fromLabel,
      description: transfer.description || `Transfer to ${toLabel}`,
      credit: 0,
      debit: amount,
      accountBalance: balanceInfo?.fromBalance ?? 0,
      totalBalance,
      paymentMethod: transfer.paymentMethod || 'Bank Transfer',
    });

    rows.push({
      id: transfer.id * 2 + 1,
      date,
      bankAndAccountNumber: toLabel,
      description: transfer.description || `Transfer from ${fromLabel}`,
      credit: amount,
      debit: 0,
      accountBalance: balanceInfo?.toBalance ?? 0,
      totalBalance,
      paymentMethod: transfer.paymentMethod || 'Bank Transfer',
    });
  }

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function getUsers(options?: { ignoreStoreScope?: boolean } & TenantScopeOptions) {
  const db = await getContextDb();
  const { activeStoreId: resolvedStoreId } = await resolveTenantScope();
  const activeStoreId = options?.ignoreStoreScope ? null : resolvedStoreId;

  const where = activeStoreId
    ? and(sql`true`, eq(schema.users.storeId, activeStoreId))
    : sql`true`;

  return await db.query.users.findMany({
    where,
    with: {
      tenantRole: true,
      store: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [desc(schema.users.createdAt)],
  });
}

export async function getCurrentSessionUser() {
  const session = await getSession();
  const sessionUserId = Number(session?.userId ?? 0);

  if (!sessionUserId) {
    return null;
  }

  const db = await getContextDb();
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, sessionUserId),
    with: {
      tenantRole: true,
      store: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  const sessionCompanyId = Number(session?.companyId ?? 0);
  if (sessionCompanyId && false) {
    return null;
  }

  return user;
}

export async function getTenantRoles() {
  const db = await getContextDb();
  const companyId = await requireTenantId();
  // 1. Fetch roles and their permission IDs from Tenant DB
  const roles = await db.query.tenantRoles.findMany({
    where: sql`true`,
    with: {
      rolePermissions: true,
    },
    orderBy: [desc(schema.tenantRoles.createdAt)],
  });

  const definitions = await masterDb.select().from(masterSchema.permissionDefinitions);
  const permissionMap = await getCompanyRolePermissionMap(companyId, roles.map((role) => role.name));
  const defMap = new Map(definitions.map((definition) => [definition.key, definition]));

  return roles.map(role => ({
    ...role,
    rolePermissions: (permissionMap.get(role.name.trim().toLowerCase()) || [])
      .map((permissionKey, index) => ({
        tenantRoleId: role.id,
        permissionId: -(index + 1),
        createdAt: role.createdAt,
        permission: defMap.get(permissionKey) || null,
      }))
      .filter((row) => row.permission !== null),
  }));
}

export async function getTenantRoleOptions() {
  const db = await getContextDb();
  return await db.query.tenantRoles.findMany({
    where: sql`true`,
    orderBy: [desc(schema.tenantRoles.createdAt)],
  });
}

export async function addTenantRole(data: { name: string; permissions?: string[]; status?: string }) {
  const db = await getContextDb();
  const companyId = await requireTenantId();
  const permissions = data.permissions?.length ? data.permissions : getDefaultPermissionsForRole(data.name);
  const result = await db.transaction(async (tx) => {
    const [role] = await tx
      .insert(schema.tenantRoles)
      .values({
        name: data.name,
      })
      .returning();
    return role;
  });

  await syncCompanyRolePermissions(companyId, result.name, permissions);
  revalidatePath('/roles-permissions');
  revalidatePath('/users');
  return result;
}

export async function updateTenantRole(id: number, data: { name?: string; permissions?: string[]; status?: string }) {
  const db = await getContextDb();
  const companyId = await requireTenantId();
  const normalizedPermissions = data.permissions ?? undefined;
  const result = await db.transaction(async (tx) => {
    const [existingRole] = await tx
      .select()
      .from(schema.tenantRoles)
      .where(and(eq(schema.tenantRoles.id, id), sql`true`))
      .limit(1);

    if (!existingRole) {
      throw new Error('Role not found');
    }

    const [role] = await tx
      .update(schema.tenantRoles)
      .set({
        name: data.name,
      })
      .where(and(eq(schema.tenantRoles.id, id), sql`true`))
      .returning();

    if (data.name && data.name.trim().toLowerCase() !== existingRole.name.trim().toLowerCase()) {
      const existingPerms = await getCompanyRolePermissionMap(companyId, [existingRole.name]);
      const previousPermissions = existingPerms.get(existingRole.name.trim().toLowerCase()) || [];
      await deleteCompanyRolePermissions(companyId, existingRole.name);
      await syncCompanyRolePermissions(companyId, role.name, previousPermissions);
    }

    if (normalizedPermissions) {
      await syncCompanyRolePermissions(companyId, role.name, normalizedPermissions);
    }

    return role;
  });
  revalidatePath('/roles-permissions');
  revalidatePath('/users');
  return result;
}

export async function deleteTenantRole(id: number) {
  const db = await getContextDb();
  const companyId = await requireTenantId();
  const [role] = await db
    .select()
    .from(schema.tenantRoles)
    .where(and(eq(schema.tenantRoles.id, id), sql`true`))
    .limit(1);

  if (!role) {
    return;
  }

  await db
    .update(schema.users)
    .set({ tenantRoleId: null })
    .where(and(eq(schema.users.tenantRoleId, id), sql`true`));
  await db.delete(schema.tenantRoles).where(and(eq(schema.tenantRoles.id, id), sql`true`));
  await deleteCompanyRolePermissions(companyId, role.name);
  revalidatePath('/roles-permissions');
  revalidatePath('/users');
}

export async function getDeleteAccountRequests() {
  const db = await getContextDb();
  const scopedUsers = await db.select({ id: schema.users.id }).from(schema.users).where(sql`true`);
  const userIds = scopedUsers.map((user: { id: number }) => user.id);
  if (userIds.length === 0) {
    return [];
  }

  return await db.query.deleteAccountRequests.findMany({
    where: inArray(schema.deleteAccountRequests.userId, userIds),
    with: {
      user: true,
    },
    orderBy: [desc(schema.deleteAccountRequests.requisitionDate)],
  });
}

export async function addDeleteAccountRequest(data: {
  userId: number;
  requisitionDate: Date;
  deleteRequestDate: Date;
  status?: string;
}) {
  const db = await getContextDb();
  const user = await db.query.users.findFirst({
    where: and(eq(schema.users.id, data.userId), sql`true`),
  });
  if (!user) {
    throw new Error('Invalid user selected');
  }

  const result = await db
    .insert(schema.deleteAccountRequests)
    .values({
      userId: data.userId,
      requisitionDate: data.requisitionDate,
      deleteRequestDate: data.deleteRequestDate,
      status: (data.status as any) ?? 'Pending',
    })
    .returning();
  revalidatePath('/delete-account-requests');
  return result[0];
}

export async function updateDeleteAccountRequest(
  id: number,
  data: {
    userId?: number;
    requisitionDate?: Date;
    deleteRequestDate?: Date;
    status?: string;
  }
) {
  const db = await getContextDb();
  const scopedUsers = await db.select({ id: schema.users.id }).from(schema.users).where(sql`true`);
  const userIds = scopedUsers.map((user) => user.id);
  if (userIds.length === 0) {
    throw new Error('No company users available for this request');
  }

  if (data.userId) {
    ensureScopedRecordAccess(userIds, data.userId, 'user');
  }

  const payload: Partial<typeof schema.deleteAccountRequests.$inferInsert> = {
    userId: data.userId,
    requisitionDate: data.requisitionDate,
    deleteRequestDate: data.deleteRequestDate,
    status: data.status as typeof schema.deleteAccountRequests.$inferInsert.status,
  };

  const result = await db
    .update(schema.deleteAccountRequests)
    .set(payload)
    .where(and(eq(schema.deleteAccountRequests.id, id), inArray(schema.deleteAccountRequests.userId, userIds)))
    .returning();
  revalidatePath('/delete-account-requests');
  return result[0];
}

export async function deleteDeleteAccountRequest(id: number) {
  const db = await getContextDb();
  const scopedUsers = await db.select({ id: schema.users.id }).from(schema.users).where(sql`true`);
  const userIds = scopedUsers.map((user: { id: number }) => user.id);
  if (userIds.length === 0) {
    return;
  }

  await db
    .delete(schema.deleteAccountRequests)
    .where(and(eq(schema.deleteAccountRequests.id, id), inArray(schema.deleteAccountRequests.userId, userIds)));
  revalidatePath('/delete-account-requests');
}

export async function addUser(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  photoUrl?: string;
  storeId?: number | null;
  tenantRoleId?: number | null;
  status?: string;
}, scopeOptions?: TenantScopeOptions) {
  const passwordHash = await hash(data.password, 10);

  const db = await getContextDb();
  await resolveTenantScope();

  const storeId = data.storeId ?? null;
  if (!storeId) {
    throw new Error('Store is required');
  }

  if (storeId) {
    const store = await db.query.stores.findFirst({
      where: and(eq(schema.stores.id, storeId), sql`true`),
    });
    if (!store) {
      throw new Error('Invalid store selected');
    }
  }

  const existingUser = await db.query.users.findFirst({
    where: eq(schema.users.email, data.email.trim().toLowerCase()),
  });
  if (existingUser) {
    throw new Error('A user with that email already exists');
  }


  const result = await db
    .insert(schema.users)
    .values({
      name: data.name,
      email: data.email.trim().toLowerCase(),
      passwordHash,
      phone: data.phone,
      photoUrl: data.photoUrl,
      storeId,
      tenantRoleId: data.tenantRoleId ?? null,
      status: (data.status as any) ?? 'Active',
    })
    .returning();
  revalidatePath('/users');
  return result[0];
}

export async function updateUser(
  id: number,
  data: {
    name?: string;
    email?: string;
    password?: string;
    phone?: string;
    photoUrl?: string;
    storeId?: number | null;
    tenantRoleId?: number | null;
    status?: string;
  }
) {
  const db = await getContextDb();
  if (data.storeId !== undefined && data.storeId !== null) {
    const store = await db.query.stores.findFirst({
      where: and(eq(schema.stores.id, data.storeId), sql`true`),
    });
    if (!store) {
      throw new Error('Invalid store selected');
    }
  }

  const payload: Partial<typeof schema.users.$inferInsert> = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    photoUrl: data.photoUrl,
    storeId: data.storeId,
    tenantRoleId: data.tenantRoleId,
    status: data.status as any,
  };

  if (data.password) {
    payload.passwordHash = await hash(data.password, 10);
  }

  const result = await db
    .update(schema.users)
    .set(payload)
    .where(and(eq(schema.users.id, id), sql`true`))
    .returning();
  revalidatePath('/users');
  revalidatePath('/profile');
  revalidatePath('/settings/profile');
  return result[0];
}

export async function deleteUser(id: number) {
  const db = await getContextDb();
  await db.delete(schema.deleteAccountRequests).where(eq(schema.deleteAccountRequests.userId, id));
  await db.delete(schema.sales).where(and(eq(schema.sales.userId, id), sql`true`));
  await db.delete(schema.users).where(and(eq(schema.users.id, id), sql`true`));
  revalidatePath('/users');
  revalidatePath('/delete-account-requests');
  revalidatePath('/sales');
}

export async function getPackages() {
  return await masterDb.select().from(masterSchema.packages);
}

export async function addPackage(data: { name: string; price?: string; users?: string; status?: string }) {
  const result = await masterDb.insert(masterSchema.packages).values({
    name: data.name,
    price: data.price ?? '0',
    userLimit: Number(data.users ?? 0),
    status: data.status as typeof masterSchema.packages.$inferInsert.status,
  }).returning();
  revalidatePath('/packages');
  return result[0];
}

export async function updatePackage(
  id: number,
  data: { name?: string; price?: string; users?: string; status?: string }
) {
  const payload: Partial<typeof masterSchema.packages.$inferInsert> = {
    name: data.name,
    price: data.price,
    userLimit: data.users === undefined ? undefined : Number(data.users),
    status: data.status as typeof masterSchema.packages.$inferInsert.status,
  };
  const result = await masterDb.update(masterSchema.packages).set(payload).where(eq(masterSchema.packages.id, id)).returning();
  revalidatePath('/packages');
  return result[0];
}

export async function deletePackage(id: number) {
  await masterDb.delete(masterSchema.subscriptions).where(eq(masterSchema.subscriptions.packageId, id));
  await masterDb.delete(masterSchema.packages).where(eq(masterSchema.packages.id, id));
  revalidatePath('/packages');
  revalidatePath('/subscriptions');
}

export async function getSubscriptions() {
  return await masterDb.query.subscriptions.findMany({
    with: {
      company: true,
      package: true,
    },
  });
}

export async function addSubscription(data: {
  companyId?: number | null;
  packageId?: number | null;
  status?: string;
  expiryDate?: Date | null;
}) {
  if (!data.companyId || !data.packageId) throw new Error("Company and package are required");

  const requestedStatus = data.status || 'Active';

  const result = await masterDb
    .insert(masterSchema.subscriptions)
    .values({
      companyId: data.companyId,
      packageId: data.packageId,
      status: requestedStatus as typeof masterSchema.subscriptions.$inferInsert.status,
      expiryDate: data.expiryDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    .returning();

  if (requestedStatus === 'Active') {
    await ensureCompanyDedicatedDatabase(data.companyId);

    await masterDb
      .update(masterSchema.companies)
      .set({ status: 'Active' })
      .where(eq(masterSchema.companies.id, data.companyId));
  }

  revalidatePath('/subscriptions');
  revalidatePath('/companies');
  return result[0];
}

export async function updateSubscription(
  id: number,
  data: {
    companyId?: number | null;
    packageId?: number | null;
    status?: string;
    expiryDate?: Date | null;
  }
) {
  const payload: Partial<typeof masterSchema.subscriptions.$inferInsert> = {
    packageId: data.packageId ?? undefined,
    expiryDate: data.expiryDate ?? undefined,
    status: data.status as typeof masterSchema.subscriptions.$inferInsert.status,
  };
  const result = await masterDb.update(masterSchema.subscriptions).set(payload).where(eq(masterSchema.subscriptions.id, id)).returning();
  revalidatePath('/subscriptions');
  return result[0];
}

export async function deleteSubscription(id: number) {
  await masterDb.delete(masterSchema.subscriptions).where(eq(masterSchema.subscriptions.id, id));
  revalidatePath('/subscriptions');
}

export async function getVariants() {
  const db = await getContextDb();
  return await db.select().from(schema.variantAttributes).where(sql`true`);
}

export async function addVariant(data: { name: string; values?: string; status?: string }) {
  const db = await getContextDb();
  const result = await db.insert(schema.variantAttributes).values({ name: data.name }).returning();
  revalidatePath('/variants');
  return result[0];
}

export async function updateVariant(id: number, data: { name?: string; values?: string; status?: string }) {
  const db = await getContextDb();
  const result = await db
    .update(schema.variantAttributes)
    .set({ name: data.name })
    .where(and(eq(schema.variantAttributes.id, id), sql`true`))
    .returning();
  revalidatePath('/variants');
  return result[0];
}

export async function deleteVariant(id: number) {
  const db = await getContextDb();
  await db.delete(schema.variantAttributes).where(and(eq(schema.variantAttributes.id, id), sql`true`));
  revalidatePath('/variants');
}

// Promo Actions
export async function getCoupons() {
  const db = await getContextDb();
  return await db
    .select()
    .from(schema.coupons)
    .where(sql`true`)
    .orderBy(desc(schema.coupons.createdAt));
}

export async function addCoupon(data: {
  code: string;
  discountType: string;
  discountValue: string;
  startDate?: Date | null;
  endDate?: Date | null;
  usageLimit?: number;
  status?: string;
}) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.coupons)
    .values({
      code: data.code,
      discountType: data.discountType as any,
      discountValue: data.discountValue,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      usageLimit: data.usageLimit ?? 0,
      status: (data.status as any) ?? 'Active',
    })
    .returning();
  revalidatePath('/coupons');
  return result[0];
}

export async function updateCoupon(
  id: number,
  data: {
    code?: string;
    discountType?: string;
    discountValue?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    usageLimit?: number;
    status?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.coupons.$inferInsert> = {
    code: data.code,
    discountType: data.discountType as typeof schema.coupons.$inferInsert.discountType,
    discountValue: data.discountValue,
    startDate: data.startDate,
    endDate: data.endDate,
    usageLimit: data.usageLimit,
    status: data.status as typeof schema.coupons.$inferInsert.status,
  };
  const result = await db
    .update(schema.coupons)
    .set(payload)
    .where(and(eq(schema.coupons.id, id), sql`true`))
    .returning();
  revalidatePath('/coupons');
  return result[0];
}

export async function deleteCoupon(id: number) {
  const db = await getContextDb();
  await db.delete(schema.coupons).where(and(eq(schema.coupons.id, id), sql`true`));
  revalidatePath('/coupons');
}

export async function getGiftCards() {
  const db = await getContextDb();
  return await db
    .select()
    .from(schema.giftCards)
    .where(sql`true`)
    .orderBy(desc(schema.giftCards.createdAt));
}

export async function addGiftCard(data: {
  code: string;
  initialAmount: string;
  balance: string;
  expiryDate?: Date | null;
  status?: string;
}) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.giftCards)
    .values({
      code: data.code,
      initialAmount: data.initialAmount,
      balance: data.balance,
      expiryDate: data.expiryDate ?? null,
      status: (data.status as any) ?? 'Active',
    })
    .returning();
  revalidatePath('/gift-cards');
  return result[0];
}

export async function updateGiftCard(
  id: number,
  data: {
    code?: string;
    initialAmount?: string;
    balance?: string;
    expiryDate?: Date | null;
    status?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.giftCards.$inferInsert> = {
    code: data.code,
    initialAmount: data.initialAmount,
    balance: data.balance,
    expiryDate: data.expiryDate,
    status: data.status as typeof schema.giftCards.$inferInsert.status,
  };
  const result = await db
    .update(schema.giftCards)
    .set(payload)
    .where(and(eq(schema.giftCards.id, id), sql`true`))
    .returning();
  revalidatePath('/gift-cards');
  return result[0];
}

export async function deleteGiftCard(id: number) {
  const db = await getContextDb();
  await db.delete(schema.giftCards).where(and(eq(schema.giftCards.id, id), sql`true`));
  revalidatePath('/gift-cards');
}

export async function getProductDiscounts() {
  const db = await getContextDb();
  return await db.query.productDiscounts.findMany({
    where: sql`true`,
    with: {
      product: true,
    },
  });
}

export async function addProductDiscount(data: {
  productId: number;
  discountType: string;
  discountValue: string;
  startDate?: Date | null;
  endDate?: Date | null;
  status?: string;
}) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.productDiscounts)
    .values({
      productId: data.productId,
      discountType: data.discountType as any,
      discountValue: data.discountValue,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      status: (data.status as any) ?? 'Active',
    })
    .returning();
  revalidatePath('/discount/product');
  return result[0];
}

export async function updateProductDiscount(
  id: number,
  data: {
    productId?: number;
    discountType?: string;
    discountValue?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    status?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.productDiscounts.$inferInsert> = {
    productId: data.productId,
    discountType: data.discountType as typeof schema.productDiscounts.$inferInsert.discountType,
    discountValue: data.discountValue,
    startDate: data.startDate,
    endDate: data.endDate,
    status: data.status as typeof schema.productDiscounts.$inferInsert.status,
  };
  const result = await db
    .update(schema.productDiscounts)
    .set(payload)
    .where(and(eq(schema.productDiscounts.id, id), sql`true`))
    .returning();
  revalidatePath('/discount/product');
  return result[0];
}

export async function deleteProductDiscount(id: number) {
  const db = await getContextDb();
  await db.delete(schema.productDiscounts).where(and(eq(schema.productDiscounts.id, id), sql`true`));
  revalidatePath('/discount/product');
}

export async function getCategoryDiscounts() {
  const db = await getContextDb();
  return await db.query.categoryDiscounts.findMany({
    where: sql`true`,
    with: {
      category: true,
    },
  });
}

export async function addCategoryDiscount(data: {
  categoryId: number;
  discountType: string;
  discountValue: string;
  startDate?: Date | null;
  endDate?: Date | null;
  status?: string;
}) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.categoryDiscounts)
    .values({
      categoryId: data.categoryId,
      discountType: data.discountType as any,
      discountValue: data.discountValue,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      status: (data.status as any) ?? 'Active',
    })
    .returning();
  revalidatePath('/discount/category');
  return result[0];
}

export async function updateCategoryDiscount(
  id: number,
  data: {
    categoryId?: number;
    discountType?: string;
    discountValue?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    status?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.categoryDiscounts.$inferInsert> = {
    categoryId: data.categoryId,
    discountType: data.discountType as typeof schema.categoryDiscounts.$inferInsert.discountType,
    discountValue: data.discountValue,
    startDate: data.startDate,
    endDate: data.endDate,
    status: data.status as typeof schema.categoryDiscounts.$inferInsert.status,
  };
  const result = await db
    .update(schema.categoryDiscounts)
    .set(payload)
    .where(and(eq(schema.categoryDiscounts.id, id), sql`true`))
    .returning();
  revalidatePath('/discount/category');
  return result[0];
}

export async function deleteCategoryDiscount(id: number) {
  const db = await getContextDb();
  await db.delete(schema.categoryDiscounts).where(and(eq(schema.categoryDiscounts.id, id), sql`true`));
  revalidatePath('/discount/category');
}

// CMS Actions
export async function getCmsPages() {
  const db = await getContextDb();
  return await db
    .select()
    .from(schema.cmsPages)
    .where(sql`true`)
    .orderBy(desc(schema.cmsPages.updatedAt));
}

export async function addCmsPage(data: {
  title: string;
  slug: string;
  status?: string;
}) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.cmsPages)
    .values({
      title: data.title,
      slug: data.slug,
      status: data.status as typeof schema.cmsPages.$inferInsert.status,
    })
    .returning();
  revalidatePath('/cms/pages');
  return result[0];
}

export async function updateCmsPage(
  id: number,
  data: {
    title?: string;
    slug?: string;
    status?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.cmsPages.$inferInsert> = {
    title: data.title,
    slug: data.slug,
    status: data.status as typeof schema.cmsPages.$inferInsert.status,
  };

  const result = await db
    .update(schema.cmsPages)
    .set(payload)
    .where(and(eq(schema.cmsPages.id, id), sql`true`))
    .returning();
  revalidatePath('/cms/pages');
  return result[0];
}

export async function deleteCmsPage(id: number) {
  const db = await getContextDb();
  await db.delete(schema.cmsPages).where(and(eq(schema.cmsPages.id, id), sql`true`));
  revalidatePath('/cms/pages');
}

export async function getCmsCountries() {
  const db = await getContextDb();
  return await db
    .select()
    .from(schema.cmsCountries)
    .where(sql`true`)
    .orderBy(desc(schema.cmsCountries.createdAt));
}

export async function addCmsCountry(data: { name: string; code: string; status?: string }) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.cmsCountries)
    .values({
      name: data.name,
      code: data.code,
      status: (data.status as typeof schema.cmsCountries.$inferInsert.status) ?? 'Active',
    })
    .returning();
  revalidatePath('/cms/location/countries');
  revalidatePath('/cms/location/states');
  revalidatePath('/cms/location/cities');
  return result[0];
}

export async function updateCmsCountry(id: number, data: { name?: string; code?: string; status?: string }) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.cmsCountries.$inferInsert> = {
    name: data.name,
    code: data.code,
    status: data.status as typeof schema.cmsCountries.$inferInsert.status,
  };
  const result = await db
    .update(schema.cmsCountries)
    .set(payload)
    .where(and(eq(schema.cmsCountries.id, id), sql`true`))
    .returning();
  revalidatePath('/cms/location/countries');
  revalidatePath('/cms/location/states');
  revalidatePath('/cms/location/cities');
  return result[0];
}

export async function deleteCmsCountry(id: number) {
  const db = await getContextDb();
  const relatedStates = await db
    .select({ id: schema.cmsStates.id })
    .from(schema.cmsStates)
    .where(and(eq(schema.cmsStates.countryId, id), sql`true`));

  const relatedStateIds = relatedStates.map((row: { id: number }) => row.id);
  if (relatedStateIds.length > 0) {
    await db
      .delete(schema.cmsCities)
      .where(and(inArray(schema.cmsCities.stateId, relatedStateIds), sql`true`));
  }

  await db.delete(schema.cmsCities).where(and(eq(schema.cmsCities.countryId, id), sql`true`));
  await db.delete(schema.cmsStates).where(and(eq(schema.cmsStates.countryId, id), sql`true`));
  await db.delete(schema.cmsCountries).where(and(eq(schema.cmsCountries.id, id), sql`true`));
  revalidatePath('/cms/location/countries');
  revalidatePath('/cms/location/states');
  revalidatePath('/cms/location/cities');
}

export async function getCmsStates() {
  const db = await getContextDb();
  return await db.query.cmsStates.findMany({
    where: sql`true`,
    with: {
      country: true,
    },
    orderBy: [desc(schema.cmsStates.createdAt)],
  });
}

export async function addCmsState(data: { countryId: number; name: string; status?: string }) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.cmsStates)
    .values({
      countryId: data.countryId,
      name: data.name,
      status: (data.status as typeof schema.cmsStates.$inferInsert.status) ?? 'Active',
    })
    .returning();
  revalidatePath('/cms/location/states');
  revalidatePath('/cms/location/cities');
  return result[0];
}

export async function updateCmsState(id: number, data: { countryId?: number; name?: string; status?: string }) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.cmsStates.$inferInsert> = {
    countryId: data.countryId,
    name: data.name,
    status: data.status as typeof schema.cmsStates.$inferInsert.status,
  };
  const result = await db
    .update(schema.cmsStates)
    .set(payload)
    .where(and(eq(schema.cmsStates.id, id), sql`true`))
    .returning();
  revalidatePath('/cms/location/states');
  revalidatePath('/cms/location/cities');
  return result[0];
}

export async function deleteCmsState(id: number) {
  const db = await getContextDb();
  await db.delete(schema.cmsCities).where(and(eq(schema.cmsCities.stateId, id), sql`true`));
  await db.delete(schema.cmsStates).where(and(eq(schema.cmsStates.id, id), sql`true`));
  revalidatePath('/cms/location/states');
  revalidatePath('/cms/location/cities');
}

export async function getCmsCities() {
  const db = await getContextDb();
  return await db.query.cmsCities.findMany({
    where: sql`true`,
    with: {
      state: true,
      country: true,
    },
    orderBy: [desc(schema.cmsCities.createdAt)],
  });
}

export async function addCmsCity(data: { stateId: number; countryId: number; name: string; status?: string }) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.cmsCities)
    .values({
      stateId: data.stateId,
      countryId: data.countryId,
      name: data.name,
      status: (data.status as typeof schema.cmsCities.$inferInsert.status) ?? 'Active',
    })
    .returning();
  revalidatePath('/cms/location/cities');
  return result[0];
}

export async function updateCmsCity(
  id: number,
  data: { stateId?: number; countryId?: number; name?: string; status?: string }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.cmsCities.$inferInsert> = {
    stateId: data.stateId,
    countryId: data.countryId,
    name: data.name,
    status: data.status as typeof schema.cmsCities.$inferInsert.status,
  };
  const result = await db
    .update(schema.cmsCities)
    .set(payload)
    .where(and(eq(schema.cmsCities.id, id), sql`true`))
    .returning();
  revalidatePath('/cms/location/cities');
  return result[0];
}

export async function deleteCmsCity(id: number) {
  const db = await getContextDb();
  await db.delete(schema.cmsCities).where(and(eq(schema.cmsCities.id, id), sql`true`));
  revalidatePath('/cms/location/cities');
}

export async function getCmsTestimonials() {
  const db = await getContextDb();
  return await db
    .select()
    .from(schema.cmsTestimonials)
    .where(sql`true`)
    .orderBy(desc(schema.cmsTestimonials.createdAt));
}

export async function addCmsTestimonial(data: {
  author: string;
  role: string;
  content: string;
  rating?: number;
  avatarUrl?: string;
  status?: string;
}) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.cmsTestimonials)
    .values({
      author: data.author,
      role: data.role,
      content: data.content,
      rating: data.rating ?? 5,
      status: data.status as typeof schema.cmsTestimonials.$inferInsert.status,
    })
    .returning();
  revalidatePath('/cms/testimonials');
  return result[0];
}

export async function updateCmsTestimonial(
  id: number,
  data: {
    author?: string;
    role?: string;
    content?: string;
    rating?: number;
    avatarUrl?: string;
    status?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.cmsTestimonials.$inferInsert> = {
    author: data.author,
    role: data.role,
    content: data.content,
    rating: data.rating,
    status: data.status as typeof schema.cmsTestimonials.$inferInsert.status,
  };
  const result = await db
    .update(schema.cmsTestimonials)
    .set(payload)
    .where(and(eq(schema.cmsTestimonials.id, id), sql`true`))
    .returning();
  revalidatePath('/cms/testimonials');
  return result[0];
}

export async function deleteCmsTestimonial(id: number) {
  const db = await getContextDb();
  await db.delete(schema.cmsTestimonials).where(and(eq(schema.cmsTestimonials.id, id), sql`true`));
  revalidatePath('/cms/testimonials');
}

export async function getCmsFaqs() {
  const db = await getContextDb();
  return await db
    .select()
    .from(schema.cmsFaqs)
    .where(sql`true`)
    .orderBy(desc(schema.cmsFaqs.createdAt));
}

export async function addCmsFaq(data: {
  category: string;
  question: string;
  answer: string;
  status?: string;
}) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.cmsFaqs)
    .values({
      category: data.category,
      question: data.question,
      answer: data.answer,
      status: (data.status as typeof schema.cmsFaqs.$inferInsert.status) ?? 'Active',
    })
    .returning();
  revalidatePath('/cms/faq');
  return result[0];
}

export async function updateCmsFaq(
  id: number,
  data: {
    category?: string;
    question?: string;
    answer?: string;
    status?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.cmsFaqs.$inferInsert> = {
    category: data.category,
    question: data.question,
    answer: data.answer,
    status: data.status as typeof schema.cmsFaqs.$inferInsert.status,
  };
  const result = await db
    .update(schema.cmsFaqs)
    .set(payload)
    .where(and(eq(schema.cmsFaqs.id, id), sql`true`))
    .returning();
  revalidatePath('/cms/faq');
  return result[0];
}

export async function deleteCmsFaq(id: number) {
  const db = await getContextDb();
  await db.delete(schema.cmsFaqs).where(and(eq(schema.cmsFaqs.id, id), sql`true`));
  revalidatePath('/cms/faq');
}

export async function getBlogTags() {
  const db = await getContextDb();
  return await db
    .select()
    .from(schema.blogTags)
    .where(sql`true`)
    .orderBy(desc(schema.blogTags.createdAt));
}

export async function addBlogTag(data: { name: string; status?: string }) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.blogTags)
    .values({
      name: data.name,
      status: (data.status as typeof schema.blogTags.$inferInsert.status) ?? 'Active',
    })
    .returning();
  revalidatePath('/cms/blog/tags');
  revalidatePath('/cms/blog');
  return result[0];
}

export async function updateBlogTag(id: number, data: { name?: string; status?: string }) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.blogTags.$inferInsert> = {
    name: data.name,
    status: data.status as typeof schema.blogTags.$inferInsert.status,
  };
  const result = await db
    .update(schema.blogTags)
    .set(payload)
    .where(and(eq(schema.blogTags.id, id), sql`true`))
    .returning();
  revalidatePath('/cms/blog/tags');
  revalidatePath('/cms/blog');
  return result[0];
}

export async function deleteBlogTag(id: number) {
  const db = await getContextDb();
  await db.delete(schema.blogPostTags).where(and(eq(schema.blogPostTags.tagId, id), sql`true`));
  await db.delete(schema.blogTags).where(and(eq(schema.blogTags.id, id), sql`true`));
  revalidatePath('/cms/blog/tags');
  revalidatePath('/cms/blog');
}

export async function getBlogCategories() {
  const db = await getContextDb();
  return await db
    .select()
    .from(schema.blogCategories)
    .where(sql`true`)
    .orderBy(desc(schema.blogCategories.createdAt));
}

export async function addBlogCategory(data: { name: string; status?: string }) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.blogCategories)
    .values({
      name: data.name,
      status: (data.status as typeof schema.blogCategories.$inferInsert.status) ?? 'Active',
    })
    .returning();
  revalidatePath('/cms/blog/categories');
  revalidatePath('/cms/blog');
  return result[0];
}

export async function updateBlogCategory(id: number, data: { name?: string; status?: string }) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.blogCategories.$inferInsert> = {
    name: data.name,
    status: data.status as typeof schema.blogCategories.$inferInsert.status,
  };
  const result = await db
    .update(schema.blogCategories)
    .set(payload)
    .where(and(eq(schema.blogCategories.id, id), sql`true`))
    .returning();
  revalidatePath('/cms/blog/categories');
  revalidatePath('/cms/blog');
  return result[0];
}

export async function deleteBlogCategory(id: number) {
  const db = await getContextDb();
  await db
    .update(schema.blogPosts)
    .set({ categoryId: null })
    .where(and(eq(schema.blogPosts.categoryId, id), sql`true`));
  await db.delete(schema.blogCategories).where(and(eq(schema.blogCategories.id, id), sql`true`));
  revalidatePath('/cms/blog/categories');
  revalidatePath('/cms/blog');
}

async function ensureBlogTagIds(tagNames: string[]) {
  const db = await getContextDb();
  const ids: number[] = [];

  for (const rawName of tagNames) {
    const name = rawName.trim();
    if (!name) continue;

    const existing = await db.query.blogTags.findFirst({
      where: and(eq(schema.blogTags.name, name), sql`true`),
    });

    if (existing) {
      ids.push(existing.id);
      continue;
    }

    const inserted = await db
      .insert(schema.blogTags)
      .values({
        name,
        status: 'Active',
      })
      .returning();
    ids.push(inserted[0].id);
  }

  return ids;
}

export async function getBlogPosts() {
  const db = await getContextDb();
  return await db.query.blogPosts.findMany({
    where: sql`true`,
    with: {
      category: true,
      tagLinks: {
        with: {
          tag: true,
        },
      },
      comments: true,
    },
    orderBy: [desc(schema.blogPosts.publishedAt)],
  });
}

export async function addBlogPost(data: {
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  authorName: string;
  categoryId?: number | null;
  coverImageUrl?: string;
  status?: string;
  publishedAt?: Date;
  tagNames?: string[];
}) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.blogPosts)
    .values({
      title: data.title,
      slug: data.slug,
      content: data.content,
      authorName: data.authorName,
      categoryId: data.categoryId ?? null,
      status: data.status as typeof schema.blogPosts.$inferInsert.status,
      publishedAt: data.publishedAt ?? new Date(),
    })
    .returning();

  const post = result[0];

  if (data.tagNames && data.tagNames.length > 0) {
    const tagIds = await ensureBlogTagIds(data.tagNames);
    for (const tagId of tagIds) {
      await db.insert(schema.blogPostTags).values({
        postId: post.id,
        tagId,
      });
    }
  }

  revalidatePath('/cms/blog');
  revalidatePath('/cms/blog/tags');
  revalidatePath('/cms/blog/comments');
  return post;
}

export async function updateBlogPost(
  id: number,
  data: {
    title?: string;
    slug?: string;
    excerpt?: string;
    content?: string;
    authorName?: string;
    categoryId?: number | null;
    coverImageUrl?: string;
    status?: string;
    publishedAt?: Date;
    tagNames?: string[];
  }
) {
  const db = await getContextDb();
  const result = await db
    .update(schema.blogPosts)
    .set({
      title: data.title,
      slug: data.slug,
      content: data.content,
      authorName: data.authorName,
      categoryId: data.categoryId ?? undefined,
      status: data.status as typeof schema.blogPosts.$inferInsert.status,
      publishedAt: data.publishedAt,
    })
    .where(and(eq(schema.blogPosts.id, id), sql`true`))
    .returning();

  if (data.tagNames) {
    await db.delete(schema.blogPostTags).where(and(eq(schema.blogPostTags.postId, id), sql`true`));
    const tagIds = await ensureBlogTagIds(data.tagNames);
    for (const tagId of tagIds) {
      await db.insert(schema.blogPostTags).values({
        postId: id,
        tagId,
      });
    }
  }

  revalidatePath('/cms/blog');
  revalidatePath('/cms/blog/tags');
  revalidatePath('/cms/blog/comments');
  return result[0];
}

export async function deleteBlogPost(id: number) {
  const db = await getContextDb();
  await db.delete(schema.blogComments).where(and(eq(schema.blogComments.postId, id), sql`true`));
  await db.delete(schema.blogPostTags).where(and(eq(schema.blogPostTags.postId, id), sql`true`));
  await db.delete(schema.blogPosts).where(and(eq(schema.blogPosts.id, id), sql`true`));
  revalidatePath('/cms/blog');
  revalidatePath('/cms/blog/comments');
}

export async function getBlogComments() {
  const db = await getContextDb();
  return await db.query.blogComments.findMany({
    where: sql`true`,
    with: {
      post: true,
    },
    orderBy: [desc(schema.blogComments.createdAt)],
  });
}

export async function addBlogComment(data: {
  postId: number;
  commenterName: string;
  comment: string;
  rating?: number;
  status?: string;
}) {
  const db = await getContextDb();
  const payload: typeof schema.blogComments.$inferInsert = {
    postId: data.postId,
    commenterName: data.commenterName,
    comment: data.comment,
    status: data.status as typeof schema.blogComments.$inferInsert.status,
  };

  const result = await db
    .insert(schema.blogComments)
    .values({
      ...payload,
      status: payload.status ?? 'Active',
    })
    .returning();
  revalidatePath('/cms/blog/comments');
  revalidatePath('/cms/blog');
  return result[0];
}

export async function updateBlogComment(
  id: number,
  data: {
    comment?: string;
    rating?: number;
    status?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.blogComments.$inferInsert> = {
    comment: data.comment,
    status: data.status as typeof schema.blogComments.$inferInsert.status,
  };

  const result = await db
    .update(schema.blogComments)
    .set(payload)
    .where(and(eq(schema.blogComments.id, id), sql`true`))
    .returning();
  revalidatePath('/cms/blog/comments');
  revalidatePath('/cms/blog');
  return result[0];
}

export async function deleteBlogComment(id: number) {
  const db = await getContextDb();
  await db.delete(schema.blogComments).where(and(eq(schema.blogComments.id, id), sql`true`));
  revalidatePath('/cms/blog/comments');
  revalidatePath('/cms/blog');
}

// HRM Actions
export async function getDepartments() {
  const db = await getContextDb();
  return await db
    .select()
    .from(schema.departments)
    .where(sql`true`)
    .orderBy(desc(schema.departments.createdAt));
}

export async function addDepartment(data: {
  name: string;
  hodName?: string;
  description?: string;
  status?: string;
}) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.departments)
    .values({
      name: data.name,
      hodName: data.hodName,
      description: data.description,
      status: (data.status as any) ?? 'Active',
    })
    .returning();
  revalidatePath('/departments');
  revalidatePath('/designation');
  revalidatePath('/employees');
  return result[0];
}

export async function updateDepartment(
  id: number,
  data: {
    name?: string;
    hodName?: string;
    description?: string;
    status?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.departments.$inferInsert> = {
    name: data.name,
    hodName: data.hodName,
    description: data.description,
    status: data.status as typeof schema.departments.$inferInsert.status,
  };

  const result = await db
    .update(schema.departments)
    .set(payload)
    .where(and(eq(schema.departments.id, id), sql`true`))
    .returning();
  revalidatePath('/departments');
  revalidatePath('/designation');
  revalidatePath('/employees');
  return result[0];
}

export async function deleteDepartment(id: number) {
  const db = await getContextDb();
  const relatedDesignations = await db
    .select({ id: schema.designations.id })
    .from(schema.designations)
    .where(and(eq(schema.designations.departmentId, id), sql`true`));

  for (const designation of relatedDesignations) {
    await db
      .update(schema.employees)
      .set({ designationId: null })
      .where(and(eq(schema.employees.designationId, designation.id), sql`true`));
  }

  await db
    .update(schema.employees)
    .set({ departmentId: null })
    .where(and(eq(schema.employees.departmentId, id), sql`true`));

  await db.delete(schema.designations).where(and(eq(schema.designations.departmentId, id), sql`true`));
  await db.delete(schema.departments).where(and(eq(schema.departments.id, id), sql`true`));
  revalidatePath('/departments');
  revalidatePath('/designation');
  revalidatePath('/employees');
}

export async function getDesignations() {
  const db = await getContextDb();
  return await db.query.designations.findMany({
    where: sql`true`,
    with: {
      department: true,
    },
    orderBy: [desc(schema.designations.createdAt)],
  });
}

export async function addDesignation(data: {
  name: string;
  departmentId?: number | null;
  status?: string;
}) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.designations)
    .values({
      name: data.name,
      departmentId: data.departmentId ?? null,
      status: (data.status as any) ?? 'Active',
    })
    .returning();
  revalidatePath('/designation');
  revalidatePath('/employees');
  return result[0];
}

export async function updateDesignation(
  id: number,
  data: {
    name?: string;
    departmentId?: number | null;
    status?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.designations.$inferInsert> = {
    name: data.name,
    departmentId: data.departmentId,
    status: data.status as typeof schema.designations.$inferInsert.status,
  };

  const result = await db
    .update(schema.designations)
    .set(payload)
    .where(and(eq(schema.designations.id, id), sql`true`))
    .returning();
  revalidatePath('/designation');
  revalidatePath('/employees');
  return result[0];
}

export async function deleteDesignation(id: number) {
  const db = await getContextDb();
  await db.update(schema.employees).set({ designationId: null }).where(and(eq(schema.employees.designationId, id), sql`true`));
  await db.delete(schema.designations).where(and(eq(schema.designations.id, id), sql`true`));
  revalidatePath('/designation');
  revalidatePath('/employees');
}

export async function getShifts() {
  const db = await getContextDb();
  return await db
    .select()
    .from(schema.shifts)
    .where(sql`true`)
    .orderBy(desc(schema.shifts.createdAt));
}

export async function addShift(data: {
  name: string;
  startTime?: string;
  endTime?: string;
  weekOff?: string;
  recurring?: boolean;
  breakDescription?: string;
  status?: string;
}) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.shifts)
    .values({
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      status: (data.status as any) ?? 'Active',
    })
    .returning();
  revalidatePath('/shifts');
  revalidatePath('/employees');
  return result[0];
}

export async function updateShift(
  id: number,
  data: {
    name?: string;
    startTime?: string;
    endTime?: string;
    weekOff?: string;
    recurring?: boolean;
    breakDescription?: string;
    status?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.shifts.$inferInsert> = {
    name: data.name,
    startTime: data.startTime,
    endTime: data.endTime,
    status: data.status as typeof schema.shifts.$inferInsert.status,
  };

  const result = await db
    .update(schema.shifts)
    .set(payload)
    .where(and(eq(schema.shifts.id, id), sql`true`))
    .returning();
  revalidatePath('/shifts');
  revalidatePath('/employees');
  return result[0];
}

export async function deleteShift(id: number) {
  const db = await getContextDb();
  await db.update(schema.employees).set({ shiftId: null }).where(and(eq(schema.employees.shiftId, id), sql`true`));
  await db.delete(schema.shifts).where(and(eq(schema.shifts.id, id), sql`true`));
  revalidatePath('/shifts');
  revalidatePath('/employees');
}

export async function getEmployees() {
  const db = await getContextDb();
  return await db.query.employees.findMany({
    where: sql`true`,
    with: {
      department: true,
      designation: true,
      shift: true,
    },
    orderBy: [desc(schema.employees.createdAt)],
  });
}

export async function addEmployee(data: {
  firstName: string;
  lastName: string;
  email: string;
  empCode: string;
  contactNumber?: string;
  dateOfBirth?: Date | null;
  gender?: string;
  nationality?: string;
  joiningDate?: Date | null;
  shiftId?: number | null;
  departmentId?: number | null;
  designationId?: number | null;
  bloodGroup?: string;
  about?: string;
  address?: string;
  country?: string;
  state?: string;
  city?: string;
  zipcode?: string;
  emergencyContact1?: string;
  emergencyRelation1?: string;
  emergencyName1?: string;
  emergencyContact2?: string;
  emergencyRelation2?: string;
  emergencyName2?: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
  password?: string;
  status?: string;
  photoUrl?: string;
}) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.employees)
    .values({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.contactNumber,
      empCode: data.empCode,
      shiftId: data.shiftId ?? null,
      departmentId: data.departmentId ?? null,
      designationId: data.designationId ?? null,
      joiningDate: data.joiningDate ?? null,
      salary: undefined,
      status: (data.status as any) ?? 'Active',
    })
    .returning();
  revalidatePath('/employees');
  revalidatePath('/attendance/employee');
  revalidatePath('/attendance/admin');
  return result[0];
}

export async function updateEmployee(
  id: number,
  data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    empCode?: string;
    contactNumber?: string;
    dateOfBirth?: Date | null;
    gender?: string;
    nationality?: string;
    joiningDate?: Date | null;
    shiftId?: number | null;
    departmentId?: number | null;
    designationId?: number | null;
    bloodGroup?: string;
    about?: string;
    address?: string;
    country?: string;
    state?: string;
    city?: string;
    zipcode?: string;
    emergencyContact1?: string;
    emergencyRelation1?: string;
    emergencyName1?: string;
    emergencyContact2?: string;
    emergencyRelation2?: string;
    emergencyName2?: string;
    bankName?: string;
    accountNumber?: string;
    ifsc?: string;
    branch?: string;
    password?: string;
    status?: string;
    photoUrl?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.employees.$inferInsert> = {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.contactNumber,
    empCode: data.empCode,
    joiningDate: data.joiningDate,
    shiftId: data.shiftId,
    departmentId: data.departmentId,
    designationId: data.designationId,
    status: data.status as typeof schema.employees.$inferInsert.status,
  };

  const result = await db
    .update(schema.employees)
    .set(payload)
    .where(and(eq(schema.employees.id, id), sql`true`))
    .returning();
  revalidatePath('/employees');
  revalidatePath('/attendance/employee');
  revalidatePath('/attendance/admin');
  return result[0];
}

export async function deleteEmployee(id: number) {
  const db = await getContextDb();
  await db.delete(schema.attendanceRecords).where(and(eq(schema.attendanceRecords.employeeId, id), sql`true`));
  await db.delete(schema.employees).where(and(eq(schema.employees.id, id), sql`true`));
  revalidatePath('/employees');
  revalidatePath('/attendance/employee');
  revalidatePath('/attendance/admin');
}

export async function getEmployeeStats() {
  const db = await getContextDb();
  const all = await db.select().from(schema.employees).where(sql`true`);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const active = all.filter((row) => (row.status ?? 'Active') === 'Active').length;
  const inactive = all.filter((row) => (row.status ?? 'Active') !== 'Active').length;
  const newJoiners = all.filter((row) => (row.joiningDate ? new Date(row.joiningDate) >= monthStart : false)).length;

  return {
    total: all.length,
    active,
    inactive,
    newJoiners,
  };
}

export async function getAttendanceAdminRows() {
  const db = await getContextDb();
  const rows = await db.query.attendanceRecords.findMany({
    where: sql`true`,
    with: {
      employee: true,
    },
    orderBy: [desc(schema.attendanceRecords.date)],
  });

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    status: row.status || 'Present',
    clockIn: row.clockIn || '-',
    clockOut: row.clockOut || '-',
    production: row.production || '-',
    breakDuration: row.breakDuration || '-',
    overtime: row.overtime || '-',
    totalHours: row.totalHours || '-',
    employee: row.employee,
  }));
}

export async function getEmployeeAttendanceDashboard(employeeId?: number) {
  const db = await getContextDb();
  const employees = await db
    .select()
    .from(schema.employees)
    .where(sql`true`)
    .orderBy(desc(schema.employees.createdAt));
  const activeEmployee = employees.find((row) => row.id === employeeId) || employees[0] || null;

  if (!activeEmployee) {
    return {
      employee: null,
      records: [],
      summary: { working: 0, absent: 0, present: 0, halfDay: 0, late: 0, holidays: 0 },
    };
  }

  const records = await db
    .select()
    .from(schema.attendanceRecords)
    .where(and(eq(schema.attendanceRecords.employeeId, activeEmployee.id), sql`true`));

  const summary = {
    working: records.length,
    absent: records.filter((row) => row.status === 'Absent').length,
    present: records.filter((row) => row.status === 'Present').length,
    halfDay: records.filter((row) => row.status === 'Half Day').length,
    late: records.filter((row) => row.status === 'Late').length,
    holidays: records.filter((row) => row.status === 'Holiday').length,
  };

  return {
    employee: activeEmployee,
    records: records.sort((a, b) => b.date.getTime() - a.date.getTime()),
    summary,
  };
}

export async function getLeaveTypes() {
  const db = await getContextDb();
  return await db
    .select()
    .from(schema.leaveTypes)
    .where(sql`true`)
    .orderBy(desc(schema.leaveTypes.createdAt));
}

export async function addLeaveType(data: { name: string; leaveQuota: number; status?: string }) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.leaveTypes)
    .values({
      name: data.name,
      leaveQuota: data.leaveQuota,
      status: (data.status as any) ?? 'Active',
    })
    .returning();
  revalidatePath('/leaves/types');
  revalidatePath('/leaves/admin');
  revalidatePath('/leaves/employee');
  return result[0];
}

export async function updateLeaveType(
  id: number,
  data: {
    name?: string;
    leaveQuota?: number;
    status?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.leaveTypes.$inferInsert> = {
    name: data.name,
    leaveQuota: data.leaveQuota,
    status: data.status as typeof schema.leaveTypes.$inferInsert.status,
  };

  const result = await db
    .update(schema.leaveTypes)
    .set(payload)
    .where(and(eq(schema.leaveTypes.id, id), sql`true`))
    .returning();
  revalidatePath('/leaves/types');
  revalidatePath('/leaves/admin');
  revalidatePath('/leaves/employee');
  return result[0];
}

export async function deleteLeaveType(id: number) {
  const db = await getContextDb();
  await db.delete(schema.employeeLeaves).where(and(eq(schema.employeeLeaves.leaveTypeId, id), sql`true`));
  await db.delete(schema.leaveTypes).where(and(eq(schema.leaveTypes.id, id), sql`true`));
  revalidatePath('/leaves/types');
  revalidatePath('/leaves/admin');
  revalidatePath('/leaves/employee');
}

export async function getEmployeeLeaves() {
  const db = await getContextDb();
  return await db.query.employeeLeaves.findMany({
    where: sql`true`,
    with: {
      employee: true,
      leaveType: true,
    },
    orderBy: [desc(schema.employeeLeaves.fromDate)],
  });
}

export async function addEmployeeLeave(data: {
  employeeId: number;
  leaveTypeId: number;
  fromDate: Date;
  toDate: Date;
  daysHours?: string;
  appliedOn?: Date;
  shift?: string;
  reason?: string;
  status?: string;
}) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.employeeLeaves)
    .values({
      employeeId: data.employeeId,
      leaveTypeId: data.leaveTypeId,
      fromDate: data.fromDate,
      toDate: data.toDate,
      reason: data.reason,
      status: (data.status as any) ?? 'Applied',
    })
    .returning();
  revalidatePath('/leaves/admin');
  revalidatePath('/leaves/employee');
  return result[0];
}

export async function updateEmployeeLeave(
  id: number,
  data: {
    employeeId?: number;
    leaveTypeId?: number;
    fromDate?: Date;
    toDate?: Date;
    daysHours?: string;
    appliedOn?: Date;
    shift?: string;
    reason?: string;
    status?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.employeeLeaves.$inferInsert> = {
    employeeId: data.employeeId,
    leaveTypeId: data.leaveTypeId,
    fromDate: data.fromDate,
    toDate: data.toDate,
    reason: data.reason,
    status: data.status as typeof schema.employeeLeaves.$inferInsert.status,
  };

  const result = await db
    .update(schema.employeeLeaves)
    .set(payload)
    .where(and(eq(schema.employeeLeaves.id, id), sql`true`))
    .returning();
  revalidatePath('/leaves/admin');
  revalidatePath('/leaves/employee');
  return result[0];
}

export async function deleteEmployeeLeave(id: number) {
  const db = await getContextDb();
  await db.delete(schema.employeeLeaves).where(and(eq(schema.employeeLeaves.id, id), sql`true`));
  revalidatePath('/leaves/admin');
  revalidatePath('/leaves/employee');
}

export async function getHolidays() {
  const db = await getContextDb();
  return await db
    .select()
    .from(schema.holidays)
    .where(sql`true`)
    .orderBy(desc(schema.holidays.fromDate));
}

export async function addHoliday(data: {
  name: string;
  fromDate: Date;
  toDate: Date;
  noOfDays: number;
  description?: string;
  status?: string;
}) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.holidays)
    .values({
      name: data.name,
      fromDate: data.fromDate,
      toDate: data.toDate,
      status: (data.status as any) ?? 'Active',
    })
    .returning();
  revalidatePath('/holidays');
  return result[0];
}

export async function updateHoliday(
  id: number,
  data: {
    name?: string;
    fromDate?: Date;
    toDate?: Date;
    noOfDays?: number;
    description?: string;
    status?: string;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.holidays.$inferInsert> = {
    name: data.name,
    fromDate: data.fromDate,
    toDate: data.toDate,
    status: data.status as typeof schema.holidays.$inferInsert.status,
  };

  const result = await db
    .update(schema.holidays)
    .set(payload)
    .where(and(eq(schema.holidays.id, id), sql`true`))
    .returning();
  revalidatePath('/holidays');
  return result[0];
}

export async function deleteHoliday(id: number) {
  const db = await getContextDb();
  await db.delete(schema.holidays).where(and(eq(schema.holidays.id, id), sql`true`));
  revalidatePath('/holidays');
}

export async function getPayrolls() {
  const db = await getContextDb();
  return await db.query.payrolls.findMany({
    where: sql`true`,
    with: {
      employee: true,
    },
    orderBy: [desc(schema.payrolls.createdAt)],
  });
}

export async function addPayroll(data: {
  employeeId: number;
  payPeriod: string;
  basicSalary: string;
  status?: string;
  hraAllowance?: string;
  conveyanceAllowance?: string;
  medicalAllowance?: string;
  bonus?: string;
  allowanceOthers?: string;
  deductionPf?: string;
  deductionProfessionalTax?: string;
  deductionTds?: string;
  deductionLoans?: string;
  deductionOthers?: string;
  totalAllowance?: string;
  totalDeduction?: string;
  netSalary?: string;
  paidOn?: Date;
}) {
  const db = await getContextDb();
  const result = await db
    .insert(schema.payrolls)
    .values({
      employeeId: data.employeeId,
      payPeriod: data.payPeriod,
      netSalary: data.netSalary ?? data.basicSalary,
      paidOn: data.paidOn,
      status: (data.status as any) ?? 'Paid',
    })
    .returning();
  revalidatePath('/payroll/employee-salary');
  revalidatePath('/payroll/payslip');
  return result[0];
}

export async function updatePayroll(
  id: number,
  data: {
    employeeId?: number;
    payPeriod?: string;
    basicSalary?: string;
    status?: string;
    hraAllowance?: string;
    conveyanceAllowance?: string;
    medicalAllowance?: string;
    bonus?: string;
    allowanceOthers?: string;
    deductionPf?: string;
    deductionProfessionalTax?: string;
    deductionTds?: string;
    deductionLoans?: string;
    deductionOthers?: string;
    totalAllowance?: string;
    totalDeduction?: string;
    netSalary?: string;
    paidOn?: Date;
  }
) {
  const db = await getContextDb();
  const payload: Partial<typeof schema.payrolls.$inferInsert> = {
    employeeId: data.employeeId,
    payPeriod: data.payPeriod,
    netSalary: data.netSalary,
    paidOn: data.paidOn,
    status: data.status as typeof schema.payrolls.$inferInsert.status,
  };

  const result = await db
    .update(schema.payrolls)
    .set(payload)
    .where(and(eq(schema.payrolls.id, id), sql`true`))
    .returning();
  revalidatePath('/payroll/employee-salary');
  revalidatePath('/payroll/payslip');
  return result[0];
}

export async function deletePayroll(id: number) {
  const db = await getContextDb();
  await db.delete(schema.payrolls).where(and(eq(schema.payrolls.id, id), sql`true`));
  revalidatePath('/payroll/employee-salary');
  revalidatePath('/payroll/payslip');
}

export async function getPayslipRows() {
  const db = await getContextDb();
  return await db.query.payrolls.findMany({
    where: sql`true`,
    with: {
      employee: true,
    },
    orderBy: [desc(schema.payrolls.paidOn)],
  });
}

// Dashboard Actions
type DashboardDateRangeInput = {
  startDate: Date;
  endDate: Date;
};

type DashboardBucket = {
  name: string;
  sales: number;
  purchase: number;
};

type DashboardStatsCard = {
  title: string;
  value: number;
  change: number;
};

type DashboardListProduct = {
  id: number;
  name: string;
  sku: string;
  price: number;
  unitsSold: number;
  revenue: number;
  stockQuantity: number;
  minStockLevel: number;
  categoryName: string;
};

type DashboardRecentSale = {
  id: number;
  reference: string;
  customerName: string;
  customerEmail: string;
  total: number;
  status: string;
  createdAt: string;
  categoryName: string;
  productName: string;
};

type DashboardTopCustomer = {
  id: number;
  name: string;
  country: string;
  orders: number;
  totalSales: number;
};

type DashboardCategoryStat = {
  name: string;
  sales: number;
  value: number;
};

type DashboardHeatCell = {
  day: string;
  hour: string;
  value: number;
};

type DashboardCategoryActivity = {
  createdAt: string;
  categoryName: string;
  quantity: number;
  value: number;
};

type DashboardOrderActivity = {
  createdAt: string;
};

export type DashboardData = {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  headline: {
    ordersToday: number;
    welcomeName: string;
  };
  alerts: {
    lowStockProductName: string | null;
    lowStockQuantity: number | null;
    lowStockThreshold: number | null;
  };
  heroCards: DashboardStatsCard[];
  miniCards: DashboardStatsCard[];
  salesChart: DashboardBucket[];
  salesTotals: {
    purchase: number;
    sales: number;
  };
  overviewCounts: {
    suppliers: number;
    customers: number;
    orders: number;
  };
  customerOverview: {
    firstTime: number;
    returning: number;
    firstTimeChange: number;
    returningChange: number;
  };
  topSellingProducts: DashboardListProduct[];
  lowStockProducts: DashboardListProduct[];
  recentSales: DashboardRecentSale[];
  salesStatistics: Array<{
    name: string;
    revenue: number;
    expense: number;
  }>;
  salesStatisticSummary: {
    revenue: number;
    expense: number;
    revenueChange: number;
    expenseChange: number;
  };
  recentTransactions: Array<{
    id: number;
    date: string;
    customer: string;
    reference: string;
    status: string;
    total: number;
  }>;
  recentTransactionGroups: {
    sale: Array<{
      id: number;
      date: string;
      customer: string;
      reference: string;
      status: string;
      total: number;
    }>;
    purchase: Array<{
      id: number;
      date: string;
      customer: string;
      reference: string;
      status: string;
      total: number;
    }>;
    quotation: Array<{
      id: number;
      date: string;
      customer: string;
      reference: string;
      status: string;
      total: number;
    }>;
    expenses: Array<{
      id: number;
      date: string;
      customer: string;
      reference: string;
      status: string;
      total: number;
    }>;
    invoices: Array<{
      id: number;
      date: string;
      customer: string;
      reference: string;
      status: string;
      total: number;
    }>;
  };
  topCustomers: DashboardTopCustomer[];
  categoryStats: DashboardCategoryStat[];
  categoryActivity: DashboardCategoryActivity[];
  categoryTotals: {
    categories: number;
    products: number;
  };
  orderHeatmap: DashboardHeatCell[];
  orderActivity: DashboardOrderActivity[];
};

export type InvoiceReportRow = {
  id: number;
  dateISO: string;
  invoiceNo: string;
  customer: string;
  customerId: number | null;
  dueDate: string;
  dueDateISO: string;
  amount: number;
  paid: number;
  amountDue: number;
  status: 'Paid' | 'Unpaid' | 'Overdue';
};

export type InvoiceReportData = {
  range: {
    startDate: string;
    endDate: string;
  };
  rows: InvoiceReportRow[];
  customerOptions: string[];
};

export type DashboardTwoData = {
  summaryCards: Array<{
    title: string;
    value: number;
    tone: 'amber' | 'green' | 'cyan' | 'rose';
  }>;
  highlightCards: Array<{
    title: string;
    value: number;
    tone: 'orange' | 'sky' | 'navy' | 'green';
  }>;
  chartYears: number[];
  chartSeries: Array<{
    year: number;
    month: string;
    sales: number;
    purchases: number;
  }>;
  recentProducts: Array<{
    id: number;
    name: string;
    price: number;
    imageUrl: string | null;
  }>;
  expiredProducts: Array<{
    id: number;
    name: string;
    sku: string;
    imageUrl: string | null;
    manufacturedDate: string | null;
    expiryDate: string | null;
  }>;
};

export type SalesDashboardData = {
  headlineName: string;
  range: {
    startDate: string;
    endDate: string;
  };
  summary: {
    weeklyEarning: number;
    weeklyEarningChange: number;
    totalSalesQuantity: number;
    totalSalesCount: number;
  };
  bestSellers: Array<{
    id: number;
    name: string;
    amount: number;
    salesCount: number;
    imageUrl: string | null;
  }>;
  recentTransactions: Array<{
    id: number;
    productName: string;
    productImageUrl: string | null;
    createdAt: string;
    paymentMethod: string;
    reference: string;
    status: string;
    amount: number;
  }>;
  analyticsYears: number[];
  analyticsSeries: Array<{
    year: number;
    month: string;
    value: number;
  }>;
  countrySalesActivity: Array<{
    createdAt: string;
    country: string;
    amount: number;
  }>;
};

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildDailyBuckets(startDate: Date, endDate: Date): DashboardBucket[] {
  const buckets: DashboardBucket[] = [];

  for (const cursor = new Date(startOfDay(startDate)); cursor <= endDate; cursor.setDate(cursor.getDate() + 1)) {
    const bucket: DashboardBucket = {
      name: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sales: 0,
      purchase: 0,
    };
    buckets.push(bucket);
  }

  return buckets;
}

function buildMonthlyBuckets(startDate: Date, endDate: Date): DashboardBucket[] {
  const buckets: DashboardBucket[] = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const finalMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (cursor <= finalMonth) {
    buckets.push({
      name: cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      sales: 0,
      purchase: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return buckets;
}

function aggregateDashboardSeries(
  salesData: Array<{ createdAt: Date; totalAmount: string | number }>,
  purchaseData: Array<{ createdAt: Date; totalAmount: string | number }>,
  startDate: Date,
  endDate: Date,
) {
  const normalizedStart = startOfDay(startDate);
  const normalizedEnd = endOfDay(endDate);
  const totalDays = Math.floor((normalizedEnd.getTime() - normalizedStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const buckets = totalDays <= 31
    ? buildDailyBuckets(normalizedStart, normalizedEnd)
    : buildMonthlyBuckets(normalizedStart, normalizedEnd);

  const bucketLookup = new Map<string, DashboardBucket>();

  buckets.forEach((bucket, index) => {
    if (totalDays <= 31) {
      const day = new Date(normalizedStart);
      day.setDate(day.getDate() + index);
      bucketLookup.set(getDateKey(day), bucket);
      return;
    }

    const month = new Date(normalizedStart.getFullYear(), normalizedStart.getMonth() + index, 1);
    bucketLookup.set(getMonthKey(month), bucket);
  });

  salesData.forEach((sale) => {
    const saleDate = new Date(sale.createdAt);
    if (saleDate < normalizedStart || saleDate > normalizedEnd) return;

    const key = totalDays <= 31 ? getDateKey(saleDate) : getMonthKey(saleDate);
    const bucket = bucketLookup.get(key);
    if (bucket) {
      bucket.sales += Number(sale.totalAmount || 0);
    }
  });

  purchaseData.forEach((purchase) => {
    const purchaseDate = new Date(purchase.createdAt);
    if (purchaseDate < normalizedStart || purchaseDate > normalizedEnd) return;

    const key = totalDays <= 31 ? getDateKey(purchaseDate) : getMonthKey(purchaseDate);
    const bucket = bucketLookup.get(key);
    if (bucket) {
      bucket.purchase += Number(purchase.totalAmount || 0);
    }
  });

  return buckets;
}

function calculateChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function sumNumber<T>(items: T[], selector: (item: T) => number) {
  return items.reduce((total, item) => total + selector(item), 0);
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short' });
}

function buildTrailingMonthSeries(
  salesData: Array<{ createdAt: Date; totalAmount: string | number }>,
  expenseData: Array<{ createdAt: Date; amount: string | number }>,
  endDate: Date,
) {
  const buckets: Array<{ name: string; revenue: number; expense: number }> = [];
  const bucketLookup = new Map<string, { name: string; revenue: number; expense: number }>();
  const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  for (let index = 11; index >= 0; index -= 1) {
    const month = new Date(endMonth.getFullYear(), endMonth.getMonth() - index, 1);
    const key = getMonthKey(month);
    const bucket = {
      name: formatMonthLabel(month),
      revenue: 0,
      expense: 0,
    };
    buckets.push(bucket);
    bucketLookup.set(key, bucket);
  }

  salesData.forEach((sale) => {
    const key = getMonthKey(new Date(sale.createdAt));
    const bucket = bucketLookup.get(key);
    if (bucket) {
      bucket.revenue += Number(sale.totalAmount || 0);
    }
  });

  expenseData.forEach((expense) => {
    const key = getMonthKey(new Date(expense.createdAt));
    const bucket = bucketLookup.get(key);
    if (bucket) {
      bucket.expense += Number(expense.amount || 0);
    }
  });

  return buckets;
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function hourBucketLabel(hour: number) {
  const normalizedHour = hour === 0 ? 24 : hour;
  const suffix = normalizedHour < 12 ? 'Am' : 'Pm';
  return `${normalizedHour} ${suffix}`;
}

function getLatestActivityDate(values: Array<Date | null | undefined>) {
  return values.reduce<Date | null>((latest, current) => {
    if (!current) {
      return latest;
    }

    if (!latest || current.getTime() > latest.getTime()) {
      return current;
    }

    return latest;
  }, null);
}

function getProductAvailableStock(product: {
  stockQuantity?: number | null;
  variants?: Array<{
    stocks?: Array<{
      quantity?: number | null;
    }>;
  }>;
}) {
  const stockEntries = product.variants?.flatMap((variant) => variant.stocks ?? []) ?? [];

  if (stockEntries.length > 0) {
    return stockEntries.reduce((total, stock) => total + Number(stock.quantity || 0), 0);
  }

  return Number(product.stockQuantity || 0);
}

function getProductMinimumStock(product: {
  minStockLevel?: number | null;
  variants?: Array<{
    stocks?: Array<{
      minStockLevel?: number | null;
    }>;
  }>;
}) {
  const stockEntries = product.variants?.flatMap((variant) => variant.stocks ?? []) ?? [];
  const stockMinimum = stockEntries.reduce((total, stock) => total + Number(stock.minStockLevel || 0), 0);

  return stockMinimum > 0 ? stockMinimum : Number(product.minStockLevel || 0);
}

export async function getDashboardData(dateRange?: DashboardDateRangeInput, scopeOptions?: TenantScopeOptions): Promise<DashboardData> {
  const db = await getContextDb();
  const { activeStoreId } = await resolveTenantScope(scopeOptions);

  let scopedUserIds: number[] = [];
  if (activeStoreId) {
    const usersInStore = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(sql`true`, eq(schema.users.storeId, activeStoreId)));
    scopedUserIds = usersInStore.map((entry: { id: number }) => entry.id);
  }

  const salesWhere = activeStoreId
    ? scopedUserIds.length > 0
      ? and(sql`true`, inArray(schema.sales.userId, scopedUserIds))
      : and(sql`true`, sql`1 = 0`)
    : sql`true`;

  const productsWhere = activeStoreId
    ? and(sql`true`, eq(schema.products.storeId, activeStoreId))
    : sql`true`;

  const [
    scopedSales,
    scopedPurchases,
    scopedExpenses,
    scopedCustomers,
    scopedProducts,
    scopedSuppliers,
    scopedCategories,
  ] = await Promise.all([
    db.query.sales.findMany({
      columns: legacySalesColumns,
      where: salesWhere,
      with: {
        customer: true,
        items: {
          with: {
            variant: {
              with: {
                product: {
                  with: {
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [desc(schema.sales.createdAt)],
    }),
    db.query.purchases.findMany({
      where: sql`true`,
      with: {
        supplier: true,
      },
      orderBy: [desc(schema.purchases.createdAt)],
    }),
    db.query.expenses.findMany({
      where: sql`true`,
      orderBy: [desc(schema.expenses.createdAt)],
    }),
    db.query.customers.findMany({
      where: sql`true`,
      orderBy: [desc(schema.customers.createdAt)],
    }),
    db.query.products.findMany({
      where: productsWhere,
      with: {
        category: true,
        variants: {
          with: {
            stocks: true,
          },
        },
      },
      orderBy: [desc(schema.products.createdAt)],
    }),
    db.query.suppliers.findMany({
      where: sql`true`,
    }),
    db.query.categories.findMany({
      where: sql`true`,
    }),
  ]);

  const fallbackEndDate = endOfDay(
    getLatestActivityDate([
      scopedSales[0]?.createdAt,
      scopedPurchases[0]?.createdAt,
      scopedExpenses[0]?.createdAt,
      scopedCustomers[0]?.createdAt,
      scopedProducts[0]?.createdAt,
      new Date(),
    ]) ?? new Date()
  );
  const fallbackStartDate = startOfDay(new Date(fallbackEndDate.getTime() - (6 * 24 * 60 * 60 * 1000)));
  const normalizedRange = {
    startDate: startOfDay(dateRange?.startDate ?? fallbackStartDate),
    endDate: endOfDay(dateRange?.endDate ?? fallbackEndDate),
  };
  const rangeDuration = normalizedRange.endDate.getTime() - normalizedRange.startDate.getTime() + 1;
  const previousRange = {
    startDate: new Date(normalizedRange.startDate.getTime() - rangeDuration),
    endDate: new Date(normalizedRange.startDate.getTime() - 1),
  };
  const todayRange = {
    startDate: startOfDay(normalizedRange.endDate),
    endDate: endOfDay(normalizedRange.endDate),
  };

  const isWithinRange = (value: Date, start: Date, end: Date) => value >= start && value <= end;

  const currentSales = scopedSales.filter((sale) => isWithinRange(new Date(sale.createdAt), normalizedRange.startDate, normalizedRange.endDate));
  const previousSales = scopedSales.filter((sale) => isWithinRange(new Date(sale.createdAt), previousRange.startDate, previousRange.endDate));
  const currentPurchases = scopedPurchases.filter((purchase) => isWithinRange(new Date(purchase.createdAt), normalizedRange.startDate, normalizedRange.endDate));
  const previousPurchases = scopedPurchases.filter((purchase) => isWithinRange(new Date(purchase.createdAt), previousRange.startDate, previousRange.endDate));
  const currentExpenses = scopedExpenses.filter((expense) => isWithinRange(new Date(expense.createdAt), normalizedRange.startDate, normalizedRange.endDate));
  const previousExpenses = scopedExpenses.filter((expense) => isWithinRange(new Date(expense.createdAt), previousRange.startDate, previousRange.endDate));
  const todayOrders = scopedSales.filter((sale) => isWithinRange(new Date(sale.createdAt), todayRange.startDate, todayRange.endDate)).length;

  const currentCompletedSales = currentSales.filter((sale) => sale.status === 'Completed');
  const previousCompletedSales = previousSales.filter((sale) => sale.status === 'Completed');
  const currentReturnedSales = currentSales.filter((sale) => sale.status === 'Returned');
  const previousReturnedSales = previousSales.filter((sale) => sale.status === 'Returned');
  const currentPurchaseTotal = currentPurchases.filter((purchase) => purchase.status !== 'Cancelled');
  const previousPurchaseTotal = previousPurchases.filter((purchase) => purchase.status !== 'Cancelled');
  const currentPurchaseReturns = currentPurchases.filter((purchase) => purchase.status === 'Cancelled');
  const previousPurchaseReturns = previousPurchases.filter((purchase) => purchase.status === 'Cancelled');
  const currentPendingSales = currentSales.filter((sale) => sale.status === 'Pending');
  const previousPendingSales = previousSales.filter((sale) => sale.status === 'Pending');
  const currentCancelledSales = currentSales.filter((sale) => sale.status === 'Cancelled');
  const previousCancelledSales = previousSales.filter((sale) => sale.status === 'Cancelled');
  const reportableSales = scopedSales.filter((sale) => sale.status === 'Completed' || sale.status === 'Pending');

  const totalSales = sumNumber(currentCompletedSales, (sale) => Number(sale.totalAmount || 0));
  const previousTotalSales = sumNumber(previousCompletedSales, (sale) => Number(sale.totalAmount || 0));
  const totalSalesReturn = sumNumber(currentReturnedSales, (sale) => Number(sale.totalAmount || 0));
  const previousTotalSalesReturn = sumNumber(previousReturnedSales, (sale) => Number(sale.totalAmount || 0));
  const totalPurchases = sumNumber(currentPurchaseTotal, (purchase) => Number(purchase.totalAmount || 0));
  const previousTotalPurchases = sumNumber(previousPurchaseTotal, (purchase) => Number(purchase.totalAmount || 0));
  const totalPurchaseReturn = sumNumber(currentPurchaseReturns, (purchase) => Number(purchase.totalAmount || 0));
  const previousTotalPurchaseReturn = sumNumber(previousPurchaseReturns, (purchase) => Number(purchase.totalAmount || 0));
  const totalExpenses = sumNumber(currentExpenses, (expense) => Number(expense.amount || 0));
  const previousTotalExpenses = sumNumber(previousExpenses, (expense) => Number(expense.amount || 0));
  const invoiceDue = sumNumber(currentPendingSales, (sale) => Number(sale.grandTotal || sale.totalAmount || 0));
  const previousInvoiceDue = sumNumber(previousPendingSales, (sale) => Number(sale.grandTotal || sale.totalAmount || 0));
  const paymentReturns = sumNumber(currentCancelledSales, (sale) => Number(sale.totalAmount || 0));
  const previousPaymentReturns = sumNumber(previousCancelledSales, (sale) => Number(sale.totalAmount || 0));
  const profit = totalSales - totalPurchases - totalExpenses;
  const previousProfit = previousTotalSales - previousTotalPurchases - previousTotalExpenses;

  const salesChart = aggregateDashboardSeries(currentCompletedSales, currentPurchaseTotal, normalizedRange.startDate, normalizedRange.endDate);
  const salesStatistics = buildTrailingMonthSeries(scopedSales.filter((sale) => sale.status === 'Completed'), scopedExpenses, normalizedRange.endDate);
  const salesStatisticSummary = {
    revenue: salesStatistics[salesStatistics.length - 1]?.revenue ?? 0,
    expense: salesStatistics[salesStatistics.length - 1]?.expense ?? 0,
    revenueChange: salesStatistics.length > 1 ? calculateChange(salesStatistics[salesStatistics.length - 1]?.revenue ?? 0, salesStatistics[salesStatistics.length - 2]?.revenue ?? 0) : 0,
    expenseChange: salesStatistics.length > 1 ? calculateChange(salesStatistics[salesStatistics.length - 1]?.expense ?? 0, salesStatistics[salesStatistics.length - 2]?.expense ?? 0) : 0,
  };

  const productMap = new Map<number, DashboardListProduct>();
  currentCompletedSales.forEach((sale) => {
    sale.items.forEach((item) => {
      const product = (item as any).variant?.product;
      if (!product) {
        return;
      }

      const existing = productMap.get(product.id) ?? {
        id: product.id,
        name: product.name,
        sku: product.sku || (item as any).variant?.sku,
        price: Number(product.price || (item as any).unitPrice || 0),
        unitsSold: 0,
        revenue: 0,
        stockQuantity: getProductAvailableStock(product),
        minStockLevel: getProductMinimumStock(product),
        categoryName: product.category?.name || 'Uncategorized',
      };

      existing.unitsSold += Number(item.quantity || 0);
      existing.revenue += Number(item.subtotal || 0);
      productMap.set(product.id, existing);
    });
  });

  const topSellingProducts = Array.from(productMap.values())
    .sort((left, right) => right.unitsSold - left.unitsSold || right.revenue - left.revenue)
    .slice(0, 5);

  const lowStockProducts = scopedProducts
    .map((product) => {
      const stockQuantity = getProductAvailableStock(product);
      const minStockLevel = getProductMinimumStock(product);

      return {
        id: product.id,
        name: product.name,
        sku: product.sku || `PRD-${product.id}`,
        price: Number(product.price || 0),
        unitsSold: 0,
        revenue: 0,
        stockQuantity,
        minStockLevel,
        categoryName: product.category?.name || 'Uncategorized',
      };
    })
    .filter((product) => product.stockQuantity <= Math.max(product.minStockLevel, 5))
    .sort((left, right) => left.stockQuantity - right.stockQuantity || left.minStockLevel - right.minStockLevel)
    .slice(0, 5);

  const recentSales = currentSales.slice(0, 5).map((sale) => ({
    id: sale.id,
    reference: sale.reference,
    customerName: sale.customer?.name || 'Walk-in customer',
    customerEmail: sale.customer?.email || '',
    total: Number(sale.grandTotal || sale.totalAmount || 0),
    status: sale.status,
    createdAt: sale.createdAt.toISOString(),
    categoryName: (sale.items[0] as any)?.variant?.product?.category?.name || 'General',
    productName: (sale.items[0] as any)?.variant?.product?.name || sale.reference,
  }));

  const recentTransactions = currentSales.slice(0, 5).map((sale) => ({
    id: sale.id,
    date: formatDateLabel(sale.createdAt),
    customer: sale.customer?.name || 'Walk-in customer',
    reference: sale.reference,
    status: sale.status,
    total: Number(sale.grandTotal || sale.totalAmount || 0),
  }));

  const purchaseTransactions = currentPurchases
    .slice(0, 5)
    .map((purchase) => ({
      id: purchase.id,
      date: formatDateLabel(purchase.createdAt),
      customer: purchase.supplier?.name || 'Unknown supplier',
      reference: purchase.reference,
      status: purchase.status,
      total: Number(purchase.totalAmount || 0),
    }));

  const quotationTransactions = currentPendingSales
    .slice(0, 5)
    .map((sale) => ({
      id: sale.id,
      date: formatDateLabel(sale.createdAt),
      customer: sale.customer?.name || 'Walk-in customer',
      reference: sale.reference,
      status: sale.status,
      total: Number(sale.grandTotal || sale.totalAmount || 0),
    }));

  const expenseTransactions = currentExpenses
    .slice(0, 5)
    .map((expense) => ({
      id: expense.id,
      date: formatDateLabel(expense.createdAt),
      customer: expense.category || 'Expense',
      reference: expense.reference || `EXP-${expense.id}`,
      status: expense.status || 'Active',
      total: Number(expense.amount || 0),
    }));

  const invoiceTransactions = currentSales
    .slice(0, 5)
    .map((sale) => {
      const dueDate = new Date(sale.createdAt);
      dueDate.setDate(dueDate.getDate() + 7);
      const isPaid = sale.status === 'Completed';
      const isOverdue = !isPaid && dueDate.getTime() < Date.now();

      return {
        id: sale.id,
        date: formatDateLabel(sale.createdAt),
        customer: sale.customer?.name || 'Walk-in customer',
        reference: `INV${String(sale.id).padStart(3, '0')}`,
        status: isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Unpaid',
        total: Number(sale.grandTotal || sale.totalAmount || 0),
      };
    });

  const customerOrderMap = new Map<number, DashboardTopCustomer>();
  reportableSales.forEach((sale) => {
    if (!sale.customerId || !sale.customer) {
      return;
    }

    const existing = customerOrderMap.get(sale.customerId) ?? {
      id: sale.customerId,
      name: sale.customer.name,
      country: sale.customer.country || 'Unknown',
      orders: 0,
      totalSales: 0,
    };

    existing.orders += 1;
    existing.totalSales += Number(sale.grandTotal || sale.totalAmount || 0);
    customerOrderMap.set(sale.customerId, existing);
  });

  const topCustomers = Array.from(customerOrderMap.values())
    .sort((left, right) => right.totalSales - left.totalSales)
    .slice(0, 5);

  const customerOrderCounts = Array.from(customerOrderMap.values()).map((entry) => entry.orders);
  const firstTimeCustomers = customerOrderCounts.filter((count) => count === 1).length;
  const returningCustomers = customerOrderCounts.filter((count) => count > 1).length;
  const customerFirstPurchaseMap = reportableSales.reduce((map, sale) => {
    if (!sale.customerId) {
      return map;
    }

    const currentValue = map.get(sale.customerId);
    if (!currentValue || sale.createdAt.getTime() < currentValue.getTime()) {
      map.set(sale.customerId, sale.createdAt);
    }
    return map;
  }, new Map<number, Date>());
  const currentFirstTimeCustomers = Array.from(customerFirstPurchaseMap.values()).filter((createdAt) =>
    isWithinRange(createdAt, normalizedRange.startDate, normalizedRange.endDate)
  ).length;
  const previousFirstTimeCustomers = Array.from(customerFirstPurchaseMap.values()).filter((createdAt) =>
    isWithinRange(createdAt, previousRange.startDate, previousRange.endDate)
  ).length;
  const currentReturningCustomers = reportableSales
    .filter((sale) => sale.customerId && isWithinRange(new Date(sale.createdAt), normalizedRange.startDate, normalizedRange.endDate))
    .reduce((map, sale) => {
      const key = sale.customerId as number;
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<number, number>());
  const previousReturningCustomers = reportableSales
    .filter((sale) => sale.customerId && isWithinRange(new Date(sale.createdAt), previousRange.startDate, previousRange.endDate))
    .reduce((map, sale) => {
      const key = sale.customerId as number;
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<number, number>());

  const categoryStats = Array.from(
    currentCompletedSales.reduce((map, sale) => {
      sale.items.forEach((item) => {
        const categoryName = (item as any).variant?.product?.category?.name || 'Uncategorized';
        const next = map.get(categoryName) ?? { name: categoryName, sales: 0, value: 0 };
        next.sales += Number(item.quantity || 0);
        next.value += Number(item.subtotal || 0);
        map.set(categoryName, next);
      });
      return map;
    }, new Map<string, DashboardCategoryStat>()).values(),
  )
    .sort((left, right) => right.value - left.value)
    .slice(0, 3);

  const categoryActivity = reportableSales.flatMap((sale) =>
    sale.status === 'Completed'
      ? sale.items.map((item) => ({
        createdAt: sale.createdAt.toISOString(),
        categoryName: (item as any).variant?.product?.category?.name || 'Uncategorized',
        quantity: Number(item.quantity || 0),
        value: Number(item.subtotal || 0),
      }))
      : []
  );

  const heatmapDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const heatmapHours = [18, 16, 14, 12, 10, 8, 6, 4, 2];
  const orderHeatmap: DashboardHeatCell[] = [];

  heatmapHours.forEach((hour) => {
    heatmapDays.forEach((day) => {
      const value = reportableSales.filter((sale) => {
        const saleDate = new Date(sale.createdAt);
        const saleHour = saleDate.getHours();
        const bucketStart = hour === 18 ? 18 : hour;
        const bucketEnd = hour === 18 ? 24 : hour + 2;
        const dayLabel = heatmapDays[(saleDate.getDay() + 6) % 7];

        return dayLabel === day && saleHour >= bucketStart && saleHour < bucketEnd;
      }).length;

      orderHeatmap.push({
        day,
        hour: hourBucketLabel(hour),
        value,
      });
    });
  });

  const orderActivity = reportableSales.map((sale) => ({
    createdAt: sale.createdAt.toISOString(),
  }));

  return {
    dateRange: {
      startDate: normalizedRange.startDate.toISOString(),
      endDate: normalizedRange.endDate.toISOString(),
    },
    headline: {
      ordersToday: todayOrders,
      welcomeName: 'Admin',
    },
    alerts: {
      lowStockProductName: lowStockProducts[0]?.name ?? null,
      lowStockQuantity: lowStockProducts[0]?.stockQuantity ?? null,
      lowStockThreshold: lowStockProducts[0]?.minStockLevel ?? null,
    },
    heroCards: [
      { title: 'Total Sales', value: totalSales, change: calculateChange(totalSales, previousTotalSales) },
      { title: 'Total Sales Return', value: totalSalesReturn, change: calculateChange(totalSalesReturn, previousTotalSalesReturn) },
      { title: 'Total Purchase', value: totalPurchases, change: calculateChange(totalPurchases, previousTotalPurchases) },
      { title: 'Total Purchase Return', value: totalPurchaseReturn, change: calculateChange(totalPurchaseReturn, previousTotalPurchaseReturn) },
    ],
    miniCards: [
      { title: 'Profit', value: profit, change: calculateChange(profit, previousProfit) },
      { title: 'Invoice Due', value: invoiceDue, change: calculateChange(invoiceDue, previousInvoiceDue) },
      { title: 'Total Expenses', value: totalExpenses, change: calculateChange(totalExpenses, previousTotalExpenses) },
      { title: 'Total Payment Returns', value: paymentReturns, change: calculateChange(paymentReturns, previousPaymentReturns) },
    ],
    salesChart,
    salesTotals: {
      purchase: sumNumber(salesChart, (bucket) => bucket.purchase),
      sales: sumNumber(salesChart, (bucket) => bucket.sales),
    },
    overviewCounts: {
      suppliers: scopedSuppliers.length,
      customers: scopedCustomers.length,
      orders: scopedSales.length,
    },
    customerOverview: {
      firstTime: firstTimeCustomers,
      returning: returningCustomers,
      firstTimeChange: calculateChange(currentFirstTimeCustomers, previousFirstTimeCustomers),
      returningChange: calculateChange(currentReturningCustomers.size, previousReturningCustomers.size),
    },
    topSellingProducts,
    lowStockProducts,
    recentSales,
    salesStatistics,
    salesStatisticSummary,
    recentTransactions,
    recentTransactionGroups: {
      sale: recentTransactions,
      purchase: purchaseTransactions,
      quotation: quotationTransactions,
      expenses: expenseTransactions,
      invoices: invoiceTransactions,
    },
    topCustomers,
    categoryStats,
    categoryActivity,
    categoryTotals: {
      categories: scopedCategories.length,
      products: scopedProducts.length,
    },
    orderHeatmap,
    orderActivity,
  };
}


export async function getInvoiceReportData(dateRange?: DashboardDateRangeInput, scopeOptions?: TenantScopeOptions): Promise<InvoiceReportData> {
  const db = await getContextDb();
  const { activeStoreId } = await resolveTenantScope(scopeOptions);

  let scopedUserIds: number[] = [];
  if (activeStoreId) {
    const usersInStore = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(sql`true`, eq(schema.users.storeId, activeStoreId)));
    scopedUserIds = usersInStore.map((entry: { id: number }) => entry.id);
  }

  const normalizedRange = {
    startDate: startOfDay(dateRange?.startDate ?? new Date(new Date().setDate(new Date().getDate() - 6))),
    endDate: endOfDay(dateRange?.endDate ?? new Date()),
  };
  const now = new Date();

  const sales = await db.query.sales.findMany({
    columns: legacySalesColumns,
    where: activeStoreId
      ? scopedUserIds.length > 0
        ? and(sql`true`, inArray(schema.sales.userId, scopedUserIds))
        : and(sql`true`, sql`1 = 0`)
      : sql`true`,
    with: {
      customer: true,
    },
    orderBy: [desc(schema.sales.createdAt)],
  });

  const rows = sales
    .filter((sale) => sale.createdAt >= normalizedRange.startDate && sale.createdAt <= normalizedRange.endDate)
    .map((sale) => {
      const amount = Number(sale.grandTotal || sale.totalAmount || 0);
      const dueDate = new Date(sale.createdAt);
      dueDate.setDate(dueDate.getDate() + 7);

      let status: InvoiceReportRow['status'] = 'Unpaid';
      let paid = 0;
      let amountDue = amount;

      if (sale.status === 'Completed') {
        status = 'Paid';
        paid = amount;
        amountDue = 0;
      } else if (dueDate < now || sale.status === 'Cancelled' || sale.status === 'Returned') {
        status = 'Overdue';
      }

      return {
        id: sale.id,
        dateISO: sale.createdAt.toISOString(),
        invoiceNo: `INV${String(sale.id).padStart(3, '0')}`,
        customer: sale.customer?.name || 'Walk-in Customer',
        customerId: sale.customerId ?? null,
        dueDate: formatDateLabel(dueDate),
        dueDateISO: dueDate.toISOString(),
        amount,
        paid,
        amountDue,
        status,
      };
    });

  return {
    range: {
      startDate: normalizedRange.startDate.toISOString(),
      endDate: normalizedRange.endDate.toISOString(),
    },
    rows,
    customerOptions: Array.from(new Set(rows.map((row) => row.customer))).sort((left, right) => left.localeCompare(right)),
  };
}

export async function getDashboardTwoData(scopeOptions?: TenantScopeOptions): Promise<DashboardTwoData> {
  const db = await getContextDb();
  const { activeStoreId } = await resolveTenantScope(scopeOptions);

  let scopedUserIds: number[] = [];
  if (activeStoreId) {
    const usersInStore = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(sql`true`, eq(schema.users.storeId, activeStoreId)));
    scopedUserIds = usersInStore.map((entry: { id: number }) => entry.id);
  }

  const [sales, purchases, expenses, customers, suppliers, products] = await Promise.all([
    db.query.sales.findMany({
      columns: legacySalesColumns,
      where: activeStoreId
        ? scopedUserIds.length > 0
          ? and(sql`true`, inArray(schema.sales.userId, scopedUserIds))
          : and(sql`true`, sql`1 = 0`)
        : sql`true`,
      orderBy: [desc(schema.sales.createdAt)],
    }),
    db.query.purchases.findMany({
      where: sql`true`,
      orderBy: [desc(schema.purchases.createdAt)],
    }),
    db.query.expenses.findMany({
      where: sql`true`,
      orderBy: [desc(schema.expenses.createdAt)],
    }),
    db.query.customers.findMany({
      where: sql`true`,
    }),
    db.query.suppliers.findMany({
      where: sql`true`,
    }),
    db.query.products.findMany({
      where: activeStoreId
        ? and(sql`true`, eq(schema.products.storeId, activeStoreId))
        : sql`true`,
      orderBy: [desc(schema.products.createdAt)],
    }),
  ]);

  const purchaseDue = purchases
    .filter((purchase) => purchase.status !== 'Received' && purchase.status !== 'Cancelled')
    .reduce((sum, purchase) => sum + Number(purchase.totalAmount || 0), 0);
  const salesDue = sales
    .filter((sale) => sale.status === 'Pending')
    .reduce((sum, sale) => sum + Number(sale.grandTotal || sale.totalAmount || 0), 0);
  const saleAmount = sales
    .filter((sale) => sale.status === 'Completed')
    .reduce((sum, sale) => sum + Number(sale.grandTotal || sale.totalAmount || 0), 0);
  const expenseAmount = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  const highlightCards: DashboardTwoData['highlightCards'] = [
    { title: 'Customers', value: customers.length, tone: 'orange' },
    { title: 'Suppliers', value: suppliers.length, tone: 'sky' },
    { title: 'Purchase Invoice', value: purchases.length, tone: 'navy' },
    { title: 'Sales Invoice', value: sales.length, tone: 'green' },
  ];

  const allYears = Array.from(
    new Set([
      ...sales.map((sale) => new Date(sale.createdAt).getFullYear()),
      ...purchases.map((purchase) => new Date(purchase.createdAt).getFullYear()),
      new Date().getFullYear(),
    ])
  ).sort((left, right) => right - left);

  const chartYears = allYears.length ? allYears : [new Date().getFullYear()];
  const chartSeries = chartYears.flatMap((year) =>
    Array.from({ length: 12 }, (_, monthIndex) => {
      const monthDate = new Date(year, monthIndex, 1);
      const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short' });
      const salesTotal = sales
        .filter((sale) => {
          const createdAt = new Date(sale.createdAt);
          return createdAt.getFullYear() === year && createdAt.getMonth() === monthIndex && sale.status === 'Completed';
        })
        .reduce((sum, sale) => sum + Number(sale.grandTotal || sale.totalAmount || 0), 0);
      const purchaseTotal = purchases
        .filter((purchase) => {
          const createdAt = new Date(purchase.createdAt);
          return createdAt.getFullYear() === year && createdAt.getMonth() === monthIndex && purchase.status !== 'Cancelled';
        })
        .reduce((sum, purchase) => sum + Number(purchase.totalAmount || 0), 0);

      return {
        year,
        month: monthLabel,
        sales: salesTotal,
        purchases: purchaseTotal,
      };
    })
  );

  const recentProducts = products.slice(0, 5).map((product) => ({
    id: product.id,
    name: product.name,
    price: Number(product.price || 0),
    imageUrl: product.imageUrl || null,
  }));

  const expiredProducts = products
    .filter((product) => product.expiryDate && new Date(product.expiryDate) <= new Date())
    .sort((left, right) => new Date(left.expiryDate || 0).getTime() - new Date(right.expiryDate || 0).getTime())
    .slice(0, 5)
    .map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku || `PT${String(product.id).padStart(3, '0')}`,
      imageUrl: product.imageUrl || null,
      manufacturedDate: product.manufacturedDate ? product.manufacturedDate.toISOString() : null,
      expiryDate: product.expiryDate ? product.expiryDate.toISOString() : null,
    }));

  return {
    summaryCards: [
      { title: 'Total Purchase Due', value: purchaseDue, tone: 'amber' },
      { title: 'Total Sales Due', value: salesDue, tone: 'green' },
      { title: 'Total Sale Amount', value: saleAmount, tone: 'cyan' },
      { title: 'Total Expense Amount', value: expenseAmount, tone: 'rose' },
    ],
    highlightCards,
    chartYears,
    chartSeries,
    recentProducts,
    expiredProducts,
  };
}

export async function getSalesDashboardData(dateRange?: DashboardDateRangeInput, scopeOptions?: TenantScopeOptions): Promise<SalesDashboardData> {
  const db = await getContextDb();
  const { activeStoreId } = await resolveTenantScope(scopeOptions);

  let scopedUserIds: number[] = [];
  if (activeStoreId) {
    const usersInStore = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(sql`true`, eq(schema.users.storeId, activeStoreId)));
    scopedUserIds = usersInStore.map((entry: { id: number }) => entry.id);
  }

  const sales = await db.query.sales.findMany({
    columns: legacySalesColumns,
    where: activeStoreId
      ? scopedUserIds.length > 0
        ? and(sql`true`, inArray(schema.sales.userId, scopedUserIds))
        : and(sql`true`, sql`1 = 0`)
      : sql`true`,
    with: {
      customer: true,
      items: {
        with: {
          variant: {
            with: {
              product: true,
            },
          },
        },
      },
    },
    orderBy: [desc(schema.sales.createdAt)],
  });

  const reportableSales = sales.filter((sale) => sale.status !== 'Cancelled' && sale.status !== 'Returned');
  const latestActivityDate = reportableSales[0]?.createdAt ?? sales[0]?.createdAt ?? new Date();
  const fallbackEndDate = endOfDay(latestActivityDate);
  const fallbackStartDate = startOfDay(new Date(fallbackEndDate.getTime() - (6 * 24 * 60 * 60 * 1000)));
  const normalizedRange = {
    startDate: startOfDay(dateRange?.startDate ?? fallbackStartDate),
    endDate: endOfDay(dateRange?.endDate ?? fallbackEndDate),
  };
  const rangeDuration = normalizedRange.endDate.getTime() - normalizedRange.startDate.getTime() + 1;
  const previousRange = {
    startDate: new Date(normalizedRange.startDate.getTime() - rangeDuration),
    endDate: new Date(normalizedRange.startDate.getTime() - 1),
  };

  const currentSales = reportableSales.filter((sale) => sale.createdAt >= normalizedRange.startDate && sale.createdAt <= normalizedRange.endDate);
  const previousSales = reportableSales.filter((sale) => sale.createdAt >= previousRange.startDate && sale.createdAt <= previousRange.endDate);

  const weeklyEarning = currentSales.reduce((sum, sale) => sum + Number(sale.grandTotal || sale.totalAmount || 0), 0);
  const previousWeeklyEarning = previousSales.reduce((sum, sale) => sum + Number(sale.grandTotal || sale.totalAmount || 0), 0);
  const totalSalesQuantity = currentSales.reduce(
    (sum, sale) => sum + sale.items.reduce((itemsSum, item) => itemsSum + Number(item.quantity || 0), 0),
    0
  );
  const totalSalesCount = currentSales.length;

  const productStats = new Map<number, { id: number; name: string; amount: number; salesCount: number; imageUrl: string | null }>();
  currentSales.forEach((sale) => {
    sale.items.forEach((item) => {
      const product = (item as any).variant?.product;
      if (!product) return;

      const existing = productStats.get(product.id) ?? {
        id: product.id,
        name: product.name,
        amount: 0,
        salesCount: 0,
        imageUrl: product.imageUrl || null,
      };

      existing.amount += Number(item.subtotal || 0);
      existing.salesCount += Number(item.quantity || 0);
      productStats.set(product.id, existing);
    });
  });

  const bestSellers = Array.from(productStats.values())
    .sort((left, right) => right.salesCount - left.salesCount || right.amount - left.amount)
    .slice(0, 5);

  const recentTransactions = reportableSales
    .slice(0, 5)
    .map((sale) => ({
      id: sale.id,
      productName: (sale.items[0] as any)?.variant?.product?.name || sale.reference,
      productImageUrl: (sale.items[0] as any)?.variant?.product?.imageUrl || null,
      createdAt: sale.createdAt.toISOString(),
      paymentMethod: sale.paymentMethod || 'Cash',
      reference: sale.reference,
      status: sale.status,
      amount: Number(sale.grandTotal || sale.totalAmount || 0),
    }));

  const analyticsYears = Array.from(new Set([...reportableSales.map((sale) => new Date(sale.createdAt).getFullYear()), new Date().getFullYear()]))
    .sort((left, right) => right - left);
  const analyticsSeries = analyticsYears.flatMap((year) =>
    Array.from({ length: 12 }, (_, monthIndex) => {
      const monthLabel = new Date(year, monthIndex, 1).toLocaleDateString('en-US', { month: 'short' });
      const value = reportableSales
        .filter((sale) => {
          const createdAt = new Date(sale.createdAt);
          return createdAt.getFullYear() === year && createdAt.getMonth() === monthIndex;
        })
        .reduce((sum, sale) => sum + Number(sale.grandTotal || sale.totalAmount || 0), 0);

      return {
        year,
        month: monthLabel,
        value,
      };
    })
  );

  const countrySalesActivity = reportableSales.map((sale) => ({
    createdAt: sale.createdAt.toISOString(),
    country: sale.customer?.country || 'Unknown',
    amount: Number(sale.grandTotal || sale.totalAmount || 0),
  }));

  return {
    headlineName: 'John Smilga',
    range: {
      startDate: normalizedRange.startDate.toISOString(),
      endDate: normalizedRange.endDate.toISOString(),
    },
    summary: {
      weeklyEarning,
      weeklyEarningChange: calculateChange(weeklyEarning, previousWeeklyEarning),
      totalSalesQuantity,
      totalSalesCount,
    },
    bestSellers,
    recentTransactions,
    analyticsYears,
    analyticsSeries,
    countrySalesActivity,
  };
}

type SecurityItem = {
  code: string;
  title: string;
  description: string;
  enabled: boolean;
  statusText?: string;
  actionLabel?: string;
  danger?: boolean;
};

type NotificationRule = {
  code: string;
  title: string;
  push: boolean;
  sms: boolean;
  email: boolean;
};

type ConnectedAppItem = {
  code: string;
  name: string;
  tag: string;
  enabled: boolean;
};

type SystemSettingsConfig = {
  company: {
    companyName: string;
    companyEmail: string;
    phoneNumber: string;
    fax: string;
    website: string;
    iconUrl: string;
    faviconUrl: string;
    logoUrl: string;
    darkLogoUrl: string;
    address: string;
    countryId: string;
    stateId: string;
    cityId: string;
    postalCode: string;
  };
  localization: {
    language: string;
    languageSwitcher: boolean;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
    financialYear: string;
    startingMonth: string;
    currency: string;
    currencySymbol: string;
    currencyPosition: string;
    decimalSeparator: string;
    thousandSeparator: string;
    countriesRestriction: string;
    allowedFiles: string;
    maxFileSizeMb: string;
  };
  prefixes: {
    sku: string;
    supplier: string;
    purchase: string;
    purchaseReturn: string;
    sales: string;
    salesReturn: string;
    customer: string;
    expense: string;
    stockTransfer: string;
    stockAdjustment: string;
    salesOrder: string;
    posInvoice: string;
    estimation: string;
    transaction: string;
    employee: string;
  };
  preference: {
    maintenanceMode: boolean;
    coupon: boolean;
    offers: boolean;
    multiLanguage: boolean;
    multiCurrency: boolean;
    sms: boolean;
    stores: boolean;
    warehouses: boolean;
    barcode: boolean;
    qrCode: boolean;
    hrms: boolean;
  };
  appearance: {
    theme: 'light' | 'dark' | 'auto';
    accentColor: string;
    expandSidebar: boolean;
    sidebarSize: string;
    fontFamily: string;
  };
  socialAuthentication: {
    providers: Array<{
      code: string;
      name: string;
      connected: boolean;
      enabled: boolean;
    }>;
  };
  language: {
    rows: Array<{
      code: string;
      language: string;
      shortCode: string;
      rtl: boolean;
      isDefault: boolean;
      total: number;
      done: number;
      progress: number;
      status: boolean;
    }>;
  };
};

type AppSettingsConfig = {
  invoiceSettings: {
    invoiceLogoUrl: string;
    invoicePrefix: string;
    invoiceDueDays: string;
    roundOff: string;
    showCompanyDetails: boolean;
    invoiceHeaderTerms: string;
    invoiceFooterTerms: string;
  };
  invoiceTemplates: Array<{
    id: string;
    type: 'Invoices' | 'Purchases' | 'Receipts';
    name: string;
    imageUrl: string;
    layoutKey: string;
  }>;
  selectedTemplateIds: {
    Invoices: string;
    Purchases: string;
    Receipts: string;
  };
  printers: Array<{
    id: string;
    name: string;
    connectionType: string;
    ipAddress: string;
    port: string;
  }>;
  posSettings: {
    posPrinter: string;
    paymentMethods: string[];
    enableSoundEffect: boolean;
  };
  signatures: Array<{
    id: string;
    name: string;
    imageUrl: string;
    isDefault: boolean;
    status: boolean;
  }>;
  customFields: Array<{
    id: string;
    module: string;
    label: string;
    inputType: string;
    defaultValue: string;
    required: boolean;
    disabled: boolean;
    status: boolean;
  }>;
};

type FinancialSettingsConfig = {
  tax: {
    enableTax: boolean;
    defaultTaxRate: string;
    registrationNumber: string;
    vatEnabled: boolean;
    vatRate: string;
  };
  invoicing: {
    discountType: string;
    roundingMethod: string;
    allowPartialPayments: boolean;
    defaultDueDays: string;
  };
  paymentGateways: Array<{
    code: string;
    name: string;
    enabled: boolean;
    mode: string;
    merchantId: string;
    secretKey: string;
  }>;
  bankAccounts: Array<{
    id: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
    ifsc: string;
    isDefault: boolean;
  }>;
  expenseControls: {
    requireApproval: boolean;
    approvalLimit: string;
    autoCategorize: boolean;
    blockNegativeCash: boolean;
  };
};

type WebsiteSettingsConfig = {
  branding: {
    siteName: string;
    tagline: string;
    logoUrl: string;
    faviconUrl: string;
    primaryColor: string;
  };
  seo: {
    metaTitle: string;
    metaDescription: string;
    canonicalUrl: string;
    keywords: string[];
    robotsIndex: boolean;
  };
  contact: {
    supportEmail: string;
    supportPhone: string;
    address: string;
    mapEmbedUrl: string;
  };
  social: {
    facebook: string;
    instagram: string;
    twitter: string;
    linkedin: string;
    youtube: string;
  };
  footer: {
    copyrightText: string;
    showPoweredBy: boolean;
    customScript: string;
  };
  maintenance: {
    enabled: boolean;
    message: string;
    allowedIps: string;
  };
};

type OtherSettingsConfig = {
  backup: {
    autoBackup: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    retentionDays: string;
    lastBackupAt: string;
  };
  integration: {
    webhookUrl: string;
    apiKey: string;
    enableApi: boolean;
    allowCors: boolean;
  };
  audit: {
    trackInventory: boolean;
    trackSales: boolean;
    trackUsers: boolean;
  };
  dataRetention: {
    anonymizeExports: boolean;
    hardDeleteAfterDays: string;
  };
  featureFlags: Array<{
    code: string;
    name: string;
    description: string;
    enabled: boolean;
  }>;
};

const defaultSecurityItems: SecurityItem[] = [
  { code: 'password', title: 'Password', description: 'Last Changed 22 Dec 2024, 10:30 AM', enabled: true, actionLabel: 'Change Password' },
  { code: 'two-factor', title: 'Two Factor Authentication', description: 'Receive codes via SMS or email every time you login', enabled: true },
  { code: 'google-auth', title: 'Google Authentication', description: 'Connect to Google', enabled: true, statusText: 'Connected' },
  { code: 'phone-verification', title: 'Phone Number Verification', description: 'Verified Mobile Number : +81699799974', enabled: true, actionLabel: 'Change' },
  { code: 'email-verification', title: 'Email Verification', description: 'Verified Email : info@example.com', enabled: true, actionLabel: 'Change' },
  { code: 'device-management', title: 'Device Management', description: 'Manage devices associated with the account', enabled: true, actionLabel: 'Manage' },
  { code: 'account-activity', title: 'Account Activity', description: 'Manage activities associated with the account', enabled: true, actionLabel: 'View' },
  { code: 'deactivate-account', title: 'Deactivate Account', description: 'This will shutdown your account. Your account will be reactive when you sign in again', enabled: true, actionLabel: 'Deactivate' },
  { code: 'delete-account', title: 'Delete Account', description: 'Your account will be permanently deleted', enabled: false, actionLabel: 'Delete', danger: true },
];

const defaultNotificationConfig = {
  toggles: {
    mobilePush: true,
    desktop: true,
    email: true,
    msms: true,
  },
  rules: [
    { code: 'general', title: 'General Notification', push: true, sms: true, email: true },
    { code: 'payment', title: 'Payment', push: true, sms: true, email: true },
    { code: 'transaction', title: 'Transaction', push: true, sms: true, email: true },
    { code: 'email-verification', title: 'Email Verification', push: true, sms: true, email: true },
    { code: 'otp', title: 'OTP', push: true, sms: true, email: true },
    { code: 'activity', title: 'Activity', push: true, sms: true, email: true },
    { code: 'account', title: 'Account', push: true, sms: true, email: true },
  ] as NotificationRule[],
};

const defaultConnectedApps: ConnectedAppItem[] = [
  { code: 'calendar', name: 'Calendar', tag: 'Connected', enabled: true },
  { code: 'figma', name: 'Figma', tag: 'Connected', enabled: true },
  { code: 'dropbox', name: 'Dropbox', tag: 'Connected', enabled: true },
  { code: 'slack', name: 'Slack', tag: 'Connected', enabled: true },
  { code: 'github', name: 'Github', tag: 'Connected', enabled: true },
  { code: 'gmail', name: 'Gmail', tag: 'Connected', enabled: true },
];

const defaultSystemSettingsConfig: SystemSettingsConfig = {
  company: {
    companyName: 'DreamsPOS',
    companyEmail: 'info@example.com',
    phoneNumber: '+1 555 0202',
    fax: '+1 555 0203',
    website: 'https://example.com',
    iconUrl: '/noor.png',
    faviconUrl: '/noor.png',
    logoUrl: '/next.svg',
    darkLogoUrl: '/vercel.svg',
    address: '',
    countryId: '',
    stateId: '',
    cityId: '',
    postalCode: '',
  },
  localization: {
    language: 'English',
    languageSwitcher: true,
    timezone: 'UTC +5:30',
    dateFormat: '01 Jan 2026',
    timeFormat: '12 Hours',
    financialYear: '2026',
    startingMonth: 'January',
    currency: 'USA',
    currencySymbol: '$',
    currencyPosition: '$100',
    decimalSeparator: '.',
    thousandSeparator: ',',
    countriesRestriction: 'Allow All Countries',
    allowedFiles: 'JPG, GIF, PNG',
    maxFileSizeMb: '5000',
  },
  prefixes: {
    sku: 'SKU -',
    supplier: 'SUP -',
    purchase: 'PU -',
    purchaseReturn: 'PR -',
    sales: 'SA -',
    salesReturn: 'SR -',
    customer: 'CT -',
    expense: 'EX -',
    stockTransfer: 'ST -',
    stockAdjustment: 'SA -',
    salesOrder: 'SO -',
    posInvoice: 'PINV -',
    estimation: 'EST -',
    transaction: 'TRN -',
    employee: 'EMP -',
  },
  preference: {
    maintenanceMode: true,
    coupon: true,
    offers: true,
    multiLanguage: true,
    multiCurrency: true,
    sms: true,
    stores: true,
    warehouses: true,
    barcode: true,
    qrCode: true,
    hrms: true,
  },
  appearance: {
    theme: 'light',
    accentColor: '#ff9f43',
    expandSidebar: true,
    sidebarSize: 'Small - 85px',
    fontFamily: 'Nunito',
  },
  socialAuthentication: {
    providers: [
      { code: 'facebook', name: 'Facebook', connected: true, enabled: true },
      { code: 'twitter', name: 'Twitter', connected: false, enabled: true },
      { code: 'linkedin', name: 'Linkedin', connected: true, enabled: true },
      { code: 'google', name: 'Google', connected: true, enabled: true },
    ],
  },
  language: {
    rows: [
      { code: 'en', language: 'English', shortCode: 'en', rtl: true, isDefault: true, total: 2145, done: 1815, progress: 80, status: true },
      { code: 'de', language: 'German', shortCode: 'Ar', rtl: true, isDefault: true, total: 2045, done: 2045, progress: 70, status: true },
      { code: 'ar', language: 'Arabic', shortCode: 'zh', rtl: true, isDefault: true, total: 2245, done: 295, progress: 50, status: true },
      { code: 'fr', language: 'French', shortCode: 'hi', rtl: true, isDefault: true, total: 2535, done: 1145, progress: 30, status: true },
    ],
  },
};

const defaultAppSettingsConfig: AppSettingsConfig = {
  invoiceSettings: {
    invoiceLogoUrl: '/next.svg',
    invoicePrefix: 'INV -',
    invoiceDueDays: '5',
    roundOff: 'Round Off Up',
    showCompanyDetails: true,
    invoiceHeaderTerms: '',
    invoiceFooterTerms: '',
  },
  invoiceTemplates: [
    { id: 'inv-1', type: 'Invoices', name: 'General Invoice 1', imageUrl: '/auth-illustration.png', layoutKey: 'invoice-1' },
    { id: 'inv-2', type: 'Invoices', name: 'General Invoice 2', imageUrl: '/auth-illustration.png', layoutKey: 'invoice-2' },
    { id: 'inv-3', type: 'Invoices', name: 'General Invoice 3', imageUrl: '/auth-illustration.png', layoutKey: 'invoice-3' },
    { id: 'inv-4', type: 'Invoices', name: 'General Invoice 4', imageUrl: '/auth-illustration.png', layoutKey: 'invoice-4' },
    { id: 'inv-5', type: 'Invoices', name: 'General Invoice 5', imageUrl: '/auth-illustration.png', layoutKey: 'invoice-5' },
    { id: 'pur-1', type: 'Purchases', name: 'Purchase Invoice 1', imageUrl: '/auth-illustration.png', layoutKey: 'purchase-1' },
    { id: 'pur-2', type: 'Purchases', name: 'Purchase Invoice 2', imageUrl: '/auth-illustration.png', layoutKey: 'purchase-2' },
    { id: 'pur-3', type: 'Purchases', name: 'Purchase Invoice 3', imageUrl: '/auth-illustration.png', layoutKey: 'purchase-3' },
    { id: 'pur-4', type: 'Purchases', name: 'Purchase Invoice 4', imageUrl: '/auth-illustration.png', layoutKey: 'purchase-4' },
    { id: 'rec-1', type: 'Receipts', name: 'Receipt Template 1', imageUrl: '/auth-illustration.png', layoutKey: 'receipt-1' },
    { id: 'rec-2', type: 'Receipts', name: 'Receipt Template 2', imageUrl: '/auth-illustration.png', layoutKey: 'receipt-2' },
    { id: 'rec-3', type: 'Receipts', name: 'Receipt Template 3', imageUrl: '/auth-illustration.png', layoutKey: 'receipt-3' },
    { id: 'rec-4', type: 'Receipts', name: 'Receipt Template 4', imageUrl: '/auth-illustration.png', layoutKey: 'receipt-4' },
  ],
  selectedTemplateIds: {
    Invoices: 'inv-1',
    Purchases: 'pur-1',
    Receipts: 'rec-1',
  },
  printers: [
    { id: 'pr-1', name: 'HP Printer', connectionType: 'Network', ipAddress: '151.00.1.22', port: '$200' },
    { id: 'pr-2', name: 'Epson', connectionType: 'Network', ipAddress: '151.00.2.20', port: '$50' },
  ],
  posSettings: {
    posPrinter: '',
    paymentMethods: [...POS_PAYMENT_METHOD_DEFAULTS],
    enableSoundEffect: true,
  },
  signatures: [
    { id: 'sg-1', name: 'Allen', imageUrl: '/auth-illustration.png', isDefault: true, status: true },
    { id: 'sg-2', name: 'Raymond', imageUrl: '/auth-illustration.png', isDefault: false, status: true },
    { id: 'sg-3', name: 'Ralph', imageUrl: '/auth-illustration.png', isDefault: false, status: true },
    { id: 'sg-4', name: 'Steven', imageUrl: '/auth-illustration.png', isDefault: false, status: true },
  ],
  customFields: [
    { id: 'cf-1', module: 'Product', label: 'Weight', inputType: 'Number', defaultValue: '0', required: true, disabled: false, status: true },
    { id: 'cf-2', module: 'Customer', label: 'Type', inputType: 'Select', defaultValue: 'Regular', required: true, disabled: false, status: true },
    { id: 'cf-3', module: 'Supplier', label: 'Type', inputType: 'Select', defaultValue: '-', required: true, disabled: false, status: true },
    { id: 'cf-4', module: 'Biller', label: 'Type', inputType: 'Select', defaultValue: 'Utility', required: true, disabled: false, status: true },
  ],
};

const POS_PAYMENT_FEATURE_GROUP = 'pos_payment_methods';

const POS_PAYMENT_FEATURE_DEFAULTS = POS_PAYMENT_METHOD_DEFAULTS.map((label) => ({
  featureKey: label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
  label,
  enabled: true,
}));

function isMissingFeatureConfigurationsTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const code = (error as { code?: string }).code;
  if (code === '42P01') return true;

  const cause = (error as { cause?: unknown }).cause;
  if (cause && typeof cause === 'object') {
    return (cause as { code?: string }).code === '42P01';
  }

  return false;
}

async function getPosPaymentFeatureConfigurations() {
  const db = await getContextDb();
  let rows: Array<{ featureKey: string; label: string; enabled: boolean }> = [];

  try {
    rows = await db
      .select({
        featureKey: schema.featureConfigurations.featureKey,
        label: schema.featureConfigurations.label,
        enabled: schema.featureConfigurations.enabled,
      })
      .from(schema.featureConfigurations)
      .where(
        and(
          sql`true`,
          eq(schema.featureConfigurations.featureGroup, POS_PAYMENT_FEATURE_GROUP)
        )
      );
  } catch (error) {
    if (isMissingFeatureConfigurationsTableError(error)) {
      return POS_PAYMENT_FEATURE_DEFAULTS;
    }
    throw error;
  }

  if (rows.length === 0) {
    return POS_PAYMENT_FEATURE_DEFAULTS;
  }

  const byKey = new Map(rows.map((row) => [row.featureKey, row]));

  return POS_PAYMENT_FEATURE_DEFAULTS.map((feature) => {
    const existing = byKey.get(feature.featureKey);
    return {
      featureKey: feature.featureKey,
      label: feature.label,
      enabled: existing?.enabled ?? feature.enabled,
    };
  });
}

async function savePosPaymentFeatureConfigurations(enabledMethods: string[]) {
  const db = await getContextDb();
  const normalizedMethods = new Set(normalizePosPaymentMethods(enabledMethods, POS_PAYMENT_METHOD_DEFAULTS));

  let existingRows: Array<{ id: number; featureKey: string; label: string; enabled: boolean }> = [];

  try {
    existingRows = await db
      .select({
        id: schema.featureConfigurations.id,
        featureKey: schema.featureConfigurations.featureKey,
        label: schema.featureConfigurations.label,
        enabled: schema.featureConfigurations.enabled,
      })
      .from(schema.featureConfigurations)
      .where(
        and(
          sql`true`,
          eq(schema.featureConfigurations.featureGroup, POS_PAYMENT_FEATURE_GROUP)
        )
      );
  } catch (error) {
    if (isMissingFeatureConfigurationsTableError(error)) {
      // Table is not migrated yet; keep settings_store as source of truth for now.
      return;
    }
    throw error;
  }

  const existingByKey = new Map(existingRows.map((row) => [row.featureKey, row]));
  const validFeatureKeys = POS_PAYMENT_FEATURE_DEFAULTS.map((feature) => feature.featureKey);

  for (const feature of POS_PAYMENT_FEATURE_DEFAULTS) {
    const enabled = normalizedMethods.has(feature.label);
    const existing = existingByKey.get(feature.featureKey);

    if (existing) {
      if (existing.enabled !== enabled || existing.label !== feature.label) {
        await db
          .update(schema.featureConfigurations)
          .set({
            label: feature.label,
            enabled,
            updatedAt: new Date(),
          })
          .where(eq(schema.featureConfigurations.id, existing.id));
      }
      continue;
    }

    await db.insert(schema.featureConfigurations).values({
      featureGroup: POS_PAYMENT_FEATURE_GROUP,
      featureKey: feature.featureKey,
      label: feature.label,
      enabled,
      updatedAt: new Date(),
    });
  }

  const staleRows = existingRows.filter((row) => !validFeatureKeys.includes(row.featureKey));
  if (staleRows.length > 0) {
    await db
      .delete(schema.featureConfigurations)
      .where(
        and(
          sql`true`,
          eq(schema.featureConfigurations.featureGroup, POS_PAYMENT_FEATURE_GROUP),
          inArray(schema.featureConfigurations.id, staleRows.map((row) => row.id))
        )
      );
  }
}

function normalizeAppSettingsConfig(config: AppSettingsConfig): AppSettingsConfig {
  const incomingTemplates = Array.isArray(config.invoiceTemplates) ? config.invoiceTemplates : [];
  const incomingById = new Map(incomingTemplates.map((template) => [template.id, template]));

  const mergedTemplates = defaultAppSettingsConfig.invoiceTemplates.map((template) => ({
    ...template,
    ...(incomingById.get(template.id) || {}),
    layoutKey: incomingById.get(template.id)?.layoutKey || template.layoutKey,
  }));

  const selectedTemplateIds = {
    ...defaultAppSettingsConfig.selectedTemplateIds,
    ...(config.selectedTemplateIds || {}),
  };

  if (!mergedTemplates.some((template) => template.id === selectedTemplateIds.Invoices && template.type === 'Invoices')) {
    selectedTemplateIds.Invoices = defaultAppSettingsConfig.selectedTemplateIds.Invoices;
  }
  if (!mergedTemplates.some((template) => template.id === selectedTemplateIds.Purchases && template.type === 'Purchases')) {
    selectedTemplateIds.Purchases = defaultAppSettingsConfig.selectedTemplateIds.Purchases;
  }
  if (!mergedTemplates.some((template) => template.id === selectedTemplateIds.Receipts && template.type === 'Receipts')) {
    selectedTemplateIds.Receipts = defaultAppSettingsConfig.selectedTemplateIds.Receipts;
  }

  return {
    ...defaultAppSettingsConfig,
    ...config,
    invoiceSettings: {
      ...defaultAppSettingsConfig.invoiceSettings,
      ...(config.invoiceSettings || {}),
    },
    posSettings: {
      ...defaultAppSettingsConfig.posSettings,
      ...(config.posSettings || {}),
      paymentMethods: normalizePosPaymentMethods(config.posSettings?.paymentMethods),
    },
    invoiceTemplates: mergedTemplates,
    selectedTemplateIds,
  };
}

const defaultFinancialSettingsConfig: FinancialSettingsConfig = {
  tax: {
    enableTax: true,
    defaultTaxRate: '15',
    registrationNumber: 'TRN-8472817',
    vatEnabled: true,
    vatRate: '5',
  },
  invoicing: {
    discountType: 'Percentage',
    roundingMethod: 'Round to nearest',
    allowPartialPayments: true,
    defaultDueDays: '7',
  },
  paymentGateways: [
    { code: 'stripe', name: 'Stripe', enabled: true, mode: 'live', merchantId: 'mch-stripe-001', secretKey: 'sk_live_xxx' },
    { code: 'paypal', name: 'PayPal', enabled: false, mode: 'test', merchantId: 'mch-paypal-002', secretKey: 'sk_test_xxx' },
  ],
  bankAccounts: [
    { id: 'ba-1', bankName: 'ABC Bank', accountName: 'DreamsPOS Main', accountNumber: '1234567890', ifsc: 'ABCD0123456', isDefault: true },
    { id: 'ba-2', bankName: 'National Trust', accountName: 'DreamsPOS Payroll', accountNumber: '6789012345', ifsc: 'NATB0987654', isDefault: false },
  ],
  expenseControls: {
    requireApproval: true,
    approvalLimit: '500',
    autoCategorize: true,
    blockNegativeCash: true,
  },
};

const defaultWebsiteSettingsConfig: WebsiteSettingsConfig = {
  branding: {
    siteName: 'Noor POS',
    tagline: 'Sell smarter, grow faster',
    logoUrl: '/next.svg',
    faviconUrl: '/noor.png',
    primaryColor: '#ff9f43',
  },
  seo: {
    metaTitle: 'Noor POS | Complete POS Platform',
    metaDescription: 'Noor POS helps you manage products, customers, billing and reports from one place.',
    canonicalUrl: 'https://example.com',
    keywords: ['pos', 'inventory', 'billing', 'sales'],
    robotsIndex: true,
  },
  contact: {
    supportEmail: 'support@example.com',
    supportPhone: '+1 555 3000',
    address: '221B Main Street, New York',
    mapEmbedUrl: '',
  },
  social: {
    facebook: 'https://facebook.com',
    instagram: 'https://instagram.com',
    twitter: 'https://x.com',
    linkedin: 'https://linkedin.com',
    youtube: 'https://youtube.com',
  },
  footer: {
    copyrightText: 'Copyright 2026 Noor POS. All rights reserved.',
    showPoweredBy: true,
    customScript: '',
  },
  maintenance: {
    enabled: false,
    message: 'We are doing scheduled maintenance. Please check back soon.',
    allowedIps: '',
  },
};

const defaultOtherSettingsConfig: OtherSettingsConfig = {
  backup: {
    autoBackup: true,
    frequency: 'weekly',
    retentionDays: '30',
    lastBackupAt: '2026-03-25 02:30 UTC',
  },
  integration: {
    webhookUrl: '',
    apiKey: '',
    enableApi: false,
    allowCors: false,
  },
  audit: {
    trackInventory: true,
    trackSales: true,
    trackUsers: true,
  },
  dataRetention: {
    anonymizeExports: false,
    hardDeleteAfterDays: '365',
  },
  featureFlags: [
    { code: 'advanced-discount-engine', name: 'Advanced Discount Engine', description: 'Enable tiered and campaign-based discounting.', enabled: false },
    { code: 'smart-reorder-suggestions', name: 'Smart Reorder Suggestions', description: 'Show AI-based product reorder recommendations.', enabled: true },
    { code: 'beta-reports-v2', name: 'Reports V2', description: 'Enable beta report layouts and faster chart loading.', enabled: false },
  ],
};

async function readSettingsValue<T>(key: string, fallback: T): Promise<T> {
  const db = await getContextDb();
  const row = await db.query.settingsStore.findFirst({
    where: and(
      sql`true`,
      eq(schema.settingsStore.key, key)
    ),
  });
  if (!row) return fallback;

  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

async function requireSettingsManagePermission(): Promise<void> {
  const session = await getSession();
  const permissions = Array.isArray(session?.permissions) ? (session.permissions as string[]) : [];

  if (hasPermission(permissions, 'settings.manage')) {
    return;
  }

  throw new Error('You do not have permission to manage settings');
}

async function writeSettingsValue(key: string, value: unknown, pathsToRevalidate: string[]) {
  await requireSettingsManagePermission();

  const db = await getContextDb();
  const serialized = JSON.stringify(value);
  const existing = await db.query.settingsStore.findFirst({
    where: and(
      sql`true`,
      eq(schema.settingsStore.key, key)
    ),
  });

  if (existing) {
    await db
      .update(schema.settingsStore)
      .set({
        value: serialized,
        updatedAt: new Date(),
      })
      .where(eq(schema.settingsStore.id, existing.id));
  } else {
    await db.insert(schema.settingsStore).values({
      key,
      value: serialized,
      updatedAt: new Date(),
    });
  }

  pathsToRevalidate.forEach((path) => revalidatePath(path));
}

export async function getSecuritySettingsConfig() {
  return await readSettingsValue<SecurityItem[]>('settings_security', defaultSecurityItems);
}

export async function saveSecuritySettingsConfig(items: SecurityItem[]) {
  await writeSettingsValue('settings_security', items, ['/settings/security']);
}

export async function getNotificationSettingsConfig() {
  return await readSettingsValue('settings_notifications', defaultNotificationConfig);
}

export async function saveNotificationSettingsConfig(config: typeof defaultNotificationConfig) {
  await writeSettingsValue('settings_notifications', config, ['/settings/notifications']);
}

export async function getConnectedAppsSettingsConfig() {
  return await readSettingsValue<ConnectedAppItem[]>('settings_connected_apps', defaultConnectedApps);
}

export async function saveConnectedAppsSettingsConfig(items: ConnectedAppItem[]) {
  await writeSettingsValue('settings_connected_apps', items, ['/settings/connected-apps']);
}

export async function getSystemSettingsConfig() {
  return await readSettingsValue<SystemSettingsConfig>('settings_system', defaultSystemSettingsConfig);
}

export async function saveSystemSettingsConfig(config: SystemSettingsConfig) {
  await writeSettingsValue('settings_system', config, ['/settings/system']);
}

export async function getAppSettingsConfig() {
  const config = await readSettingsValue<AppSettingsConfig>('settings_app', defaultAppSettingsConfig);
  const paymentFeatures = await getPosPaymentFeatureConfigurations();
  const enabledPaymentMethods = paymentFeatures.filter((item) => item.enabled).map((item) => item.label);

  return normalizeAppSettingsConfig({
    ...config,
    posSettings: {
      ...defaultAppSettingsConfig.posSettings,
      ...(config.posSettings || {}),
      paymentMethods: enabledPaymentMethods,
    },
  });
}

export async function saveAppSettingsConfig(config: AppSettingsConfig) {
  const normalizedConfig = normalizeAppSettingsConfig(config);
  await writeSettingsValue('settings_app', normalizedConfig, ['/settings/app', '/pos']);
  await savePosPaymentFeatureConfigurations(normalizedConfig.posSettings.paymentMethods);
}

export async function getFinancialSettingsConfig() {
  return await readSettingsValue<FinancialSettingsConfig>('settings_financial', defaultFinancialSettingsConfig);
}

export async function saveFinancialSettingsConfig(config: FinancialSettingsConfig) {
  await writeSettingsValue('settings_financial', config, ['/settings/financial']);
}

export async function getWebsiteSettingsConfig() {
  return await readSettingsValue<WebsiteSettingsConfig>('settings_website', defaultWebsiteSettingsConfig);
}

export async function saveWebsiteSettingsConfig(config: WebsiteSettingsConfig) {
  await writeSettingsValue('settings_website', config, ['/settings/website']);
}

export async function getOtherSettingsConfig() {
  return await readSettingsValue<OtherSettingsConfig>('settings_other', defaultOtherSettingsConfig);
}

export async function saveOtherSettingsConfig(config: OtherSettingsConfig) {
  await writeSettingsValue('settings_other', config, ['/settings/other']);
}


