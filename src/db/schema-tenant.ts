import { pgTable, serial, text, decimal, integer, timestamp, varchar, boolean, pgEnum, index, uniqueIndex, primaryKey, uuid, check, jsonb } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// --- ENUMS ---

export const statusEnum = pgEnum('status', ['Active', 'Inactive', 'Archived', 'Pending', 'Suspended']);
export const userStatusEnum = pgEnum('user_status', ['Active', 'Inactive', 'Pending', 'Suspended']);
export const invitationStatusEnum = pgEnum('invitation_status', ['Pending', 'Accepted', 'Expired', 'Revoked']);
export const discountTypeEnum = pgEnum('discount_type', ['Percentage', 'Fixed']);
export const leaveStatusEnum = pgEnum('leave_status', ['Applied', 'Approved', 'Rejected', 'Cancelled']);
export const payrollStatusEnum = pgEnum('payroll_status', ['Draft', 'Paid', 'Partial']);
export const saleStatusEnum = pgEnum('sale_status', ['Pending', 'Completed', 'Cancelled', 'Returned']);
export const purchaseStatusEnum = pgEnum('purchase_status', ['Ordered', 'Received', 'Pending', 'Cancelled']);
export const attributeDataTypeEnum = pgEnum('attribute_data_type', ['string', 'number', 'date', 'boolean']);

// --- USERS & AUTH ---

export const tenantRoles = pgTable('tenant_roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueRole: uniqueIndex('unique_role_per_company').on(table.name),
}));

export const tenantRolePermissions = pgTable('tenant_role_permissions', {
  tenantRoleId: integer('tenant_role_id').references(() => tenantRoles.id, { onDelete: 'cascade' }).notNull(),
  permissionId: integer('permission_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.tenantRoleId, table.permissionId] }),
}));

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id').references(() => stores.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  phone: varchar('phone', { length: 50 }),
  photoUrl: text('photo_url'),
  tenantRoleId: integer('tenant_role_id').references(() => tenantRoles.id),
  status: userStatusEnum('status').default('Active').notNull(),
  // 'storefront' = e-commerce account (store customer), 'erp' = staff account
  // that manages the CMS. Mirrors migration 008 (backfilled from the role).
  userType: varchar('user_type', { length: 16 }).default('erp').notNull(),
  lastLogin: timestamp('last_login'),
  emailVerifiedAt: timestamp('email_verified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  storeIdx: index('user_store_idx').on(table.storeId),
  userTypeCheck: check('users_user_type_check', sql`${table.userType} IN ('storefront', 'erp')`),
}));

export const userInvitations = pgTable('user_invitations', {
  id: serial('id').primaryKey(),
  invitedBy: integer('invited_by').references(() => users.id).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).unique().notNull(),
  tenantRoleId: integer('tenant_role_id').references(() => tenantRoles.id).notNull(),
  status: invitationStatusEnum('status').default('Pending').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
}));

/**
 * Single-use auth tokens (password reset + email confirmation). Only the
 * SHA-256 digest of a token is persisted — mirrors migration 007.
 */
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  purpose: varchar('purpose', { length: 32 }).notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tokenHashIdx: uniqueIndex('password_reset_tokens_hash_idx').on(table.tokenHash),
  userPurposeIdx: index('password_reset_tokens_user_purpose_idx')
    .on(table.userId, table.purpose, table.createdAt),
  purposeCheck: check(
    'password_reset_tokens_purpose_check',
    sql`${table.purpose} IN ('password_reset', 'email_verification')`,
  ),
  hashFormatCheck: check(
    'password_reset_tokens_hash_format_check',
    sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`,
  ),
}));

export const deleteAccountRequests = pgTable('delete_account_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  requisitionDate: timestamp('requisition_date').notNull(),
  deleteRequestDate: timestamp('delete_request_date').notNull(),
  status: statusEnum('status').default('Pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- MESSAGING ---

export const messageThreads = pgTable('message_threads', {
  id: serial('id').primaryKey(),
  subject: varchar('subject', { length: 255 }).notNull(),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const messageThreadParticipants = pgTable('message_thread_participants', {
  threadId: integer('thread_id').references(() => messageThreads.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  lastReadAt: timestamp('last_read_at'),
}, (table) => ({
  pk: primaryKey({ columns: [table.threadId, table.userId] }),
}));

export const messageEntries = pgTable('message_entries', {
  id: serial('id').primaryKey(),
  threadId: integer('thread_id').references(() => messageThreads.id, { onDelete: 'cascade' }).notNull(),
  senderUserId: integer('sender_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- INVENTORY ---

export const brands = pgTable('brands', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const units = pgTable('units', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  shortName: varchar('short_name', { length: 50 }),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  iconName: varchar('icon_name', { length: 64 }),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const subCategories = pgTable('sub_categories', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const warranties = pgTable('warranties', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  duration: varchar('duration', { length: 100 }),
  type: varchar('type', { length: 100 }),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stores = pgTable('stores', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  userName: varchar('user_name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  code: varchar('code', { length: 100 }),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const warehouses = pgTable('warehouses', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  contactPerson: varchar('contact_person', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  code: varchar('code', { length: 20 }),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id),
  subCategoryId: integer('sub_category_id').references(() => subCategories.id),
  brandId: integer('brand_id').references(() => brands.id),
  unitId: integer('unit_id').references(() => units.id),
  storeId: integer('store_id').references(() => stores.id),
  warehouseId: integer('warehouse_id').references(() => warehouses.id),
  warrantyId: integer('warranty_id').references(() => warranties.id),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }),
  sku: varchar('sku', { length: 100 }),
  barcode: varchar('barcode', { length: 100 }),
  barcodeSymbology: varchar('barcode_symbology', { length: 50 }),
  itemCode: varchar('item_code', { length: 100 }),
  productType: varchar('product_type', { length: 50 }),
  price: decimal('price', { precision: 12, scale: 2 }),
  costPrice: decimal('cost_price', { precision: 12, scale: 2 }),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }),
  discountType: varchar('discount_type', { length: 50 }),
  discountValue: decimal('discount_value', { precision: 12, scale: 2 }),
  stockQuantity: integer('stock_quantity').default(0),
  minStockLevel: integer('min_stock_level').default(0),
  manufacturedDate: timestamp('manufactured_date'),
  expiryDate: timestamp('expiry_date'),
  description: text('description'),
  imageUrl: text('image_url'),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  stockQuantityNonnegative: check('products_stock_quantity_nonnegative_check', sql`${table.stockQuantity} IS NULL OR ${table.stockQuantity} >= 0`),
}));

export const variantAttributes = pgTable('variant_attributes', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
});

export const variantAttributeValues = pgTable('variant_attribute_values', {
  id: serial('id').primaryKey(),
  attributeId: integer('attribute_id').references(() => variantAttributes.id, { onDelete: 'cascade' }).notNull(),
  value: varchar('value', { length: 255 }).notNull(),
});

export const productVariants = pgTable('product_variants', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 100 }).unique().notNull(),
  barcode: varchar('barcode', { length: 100 }),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  costPrice: decimal('cost_price', { precision: 12, scale: 2 }),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

// --- STOREFRONT PERSISTENCE (TENANT-LOCAL) ---
// These tables intentionally contain no tenant discriminator column. The
// selected tenant database/schema is the isolation boundary for every query.

export const carts = pgTable('carts', {
  // The application supplies a cryptographically random UUID. A user cart is
  // identified by user_id; a guest cart is identified by this opaque id.
  id: uuid('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  userUnique: uniqueIndex('carts_user_unique').on(table.userId),
  updatedAtIdx: index('carts_updated_at_idx').on(table.updatedAt),
  userPositive: check('carts_user_id_positive_check', sql`${table.userId} IS NULL OR ${table.userId} > 0`),
}));

export const cartItems = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  cartId: uuid('cart_id').references(() => carts.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  // A storefront line is always a concrete, active variant. The service
  // verifies that the variant belongs to product_id before writing.
  variantId: integer('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }).notNull(),
  quantity: integer('quantity').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  cartVariantUnique: uniqueIndex('cart_items_cart_variant_unique').on(table.cartId, table.variantId),
  cartIdx: index('cart_items_cart_idx').on(table.cartId),
  variantIdx: index('cart_items_variant_idx').on(table.variantId),
  productIdx: index('cart_items_product_idx').on(table.productId),
  quantityCheck: check('cart_items_quantity_check', sql`${table.quantity} >= 1 AND ${table.quantity} <= 99`),
}));

export const wishlistItems = pgTable('wishlist_items', {
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.productId] }),
  userIdx: index('wishlist_items_user_idx').on(table.userId),
  productIdx: index('wishlist_items_product_idx').on(table.productId),
  userPositive: check('wishlist_items_user_id_positive_check', sql`${table.userId} > 0`),
}));

// A tenant-local ledger makes the additive rollout repeatable without
// putting migration state in the master database.
export const storefrontMigrationLedger = pgTable('storefront_migration_ledger', {
  migrationKey: varchar('migration_key', { length: 160 }).primaryKey(),
  checksum: varchar('checksum', { length: 128 }).notNull(),
  appliedAt: timestamp('applied_at').defaultNow().notNull(),
}, (table) => ({
  appliedAtIdx: index('storefront_migration_ledger_applied_at_idx').on(table.appliedAt),
}));

export const variantOptions = pgTable('variant_options', {
  variantId: integer('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }).notNull(),
  attributeValueId: integer('attribute_value_id').references(() => variantAttributeValues.id).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.variantId, table.attributeValueId] }),
}));

export const productStocks = pgTable('product_stocks', {
  id: serial('id').primaryKey(),
  warehouseId: integer('warehouse_id').references(() => warehouses.id, { onDelete: 'cascade' }).notNull(),
  variantId: integer('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }).notNull(),
  quantity: integer('quantity').default(0).notNull(),
  minStockLevel: integer('min_stock_level').default(0),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  whVariantIdx: uniqueIndex('wh_variant_unique').on(table.warehouseId, table.variantId),
  quantityNonnegative: check('product_stocks_quantity_nonnegative_check', sql`${table.quantity} >= 0`),
}));

export const categoryAttributes = pgTable('category_attributes', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  dataType: attributeDataTypeEnum('data_type').default('string').notNull(),
  isRequired: boolean('is_required').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  categoryIdx: index('cat_attr_category_idx').on(table.categoryId),
}));

export const productAttributeValues = pgTable('product_attribute_values', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  attributeId: integer('attribute_id').references(() => categoryAttributes.id, { onDelete: 'cascade' }).notNull(),
  value: text('value'),
}, (table) => ({
  productIdx: index('attr_val_product_idx').on(table.productId),
  attributeIdx: index('attr_val_attribute_idx').on(table.attributeId),
  uniqueVal: uniqueIndex('attr_val_product_attr_idx').on(table.productId, table.attributeId),
}));

// --- SALES ---

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  country: varchar('country', { length: 100 }),
  postalCode: varchar('postal_code', { length: 30 }),
  status: statusEnum('status').default('Active').notNull(),
  totalSales: decimal('total_sales', { precision: 12, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const billers = pgTable('billers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  companyName: varchar('company_name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  country: varchar('country', { length: 100 }),
  postalCode: varchar('postal_code', { length: 30 }),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sales = pgTable('sales', {
  id: serial('id').primaryKey(),
  // CRM customerId and POS operator userId intentionally remain separate.
  // Only customerUserId proves dedicated storefront purchaser ownership.
  customerUserId: integer('customer_user_id').references(() => users.id, { onDelete: 'set null' }),
  customerId: integer('customer_id').references(() => customers.id),
  userId: integer('user_id').references(() => users.id),
  warehouseId: integer('warehouse_id').references(() => warehouses.id),
  reference: varchar('reference', { length: 100 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  discount: decimal('discount', { precision: 12, scale: 2 }).default('0'),
  tax: decimal('tax', { precision: 12, scale: 2 }).default('0'),
  grandTotal: decimal('grand_total', { precision: 12, scale: 2 }).notNull(),
  status: saleStatusEnum('status').default('Pending').notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }),
  isOnline: boolean('is_online').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  refIdx: uniqueIndex('sale_ref_idx').on(table.reference),
  customerOnlineIdx: index('sales_customer_user_online_idx').on(table.isOnline, table.customerUserId, table.createdAt),
  customerUserPositive: check('sales_customer_user_id_positive_check', sql`${table.customerUserId} IS NULL OR ${table.customerUserId} > 0`),
}));

export const saleItems = pgTable('sale_items', {
  id: serial('id').primaryKey(),
  saleId: integer('sale_id').references(() => sales.id, { onDelete: 'cascade' }).notNull(),
  variantId: integer('variant_id').references(() => productVariants.id).notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
}, (table) => ({
  quantityPositive: check('sale_items_quantity_positive_check', sql`${table.quantity} > 0`),
  moneyNonnegative: check('sale_items_money_nonnegative_check', sql`${table.unitPrice} >= 0 AND ${table.subtotal} >= 0`),
}));

// Storefront-only contact, address, and selected-capability data is kept in a
// one-to-one tenant-local record. The canonical request is never stored as an
// untyped blob and no card/payment instrument data is accepted.
export const storefrontOrderDetails = pgTable('storefront_order_details', {
  saleId: integer('sale_id').primaryKey().references(() => sales.id, { onDelete: 'cascade' }),
  currency: varchar('currency', { length: 3 }).$type<'EUR' | 'USD' | 'GBP' | 'CHF' | 'CAD' | 'AUD'>().notNull(),
  contactEmail: varchar('contact_email', { length: 254 }).notNull(),
  contactPhone: varchar('contact_phone', { length: 32 }),
  marketingOptIn: boolean('marketing_opt_in').default(false).notNull(),
  shippingAddress: jsonb('shipping_address').$type<Record<string, string>>().notNull(),
  billingAddress: jsonb('billing_address').$type<Record<string, string>>().notNull(),
  billingSameAsShipping: boolean('billing_same_as_shipping').default(false).notNull(),
  deliveryMethodId: varchar('delivery_method_id', { length: 50 }).notNull(),
  paymentMethodId: varchar('payment_method_id', { length: 50 }).notNull(),
  termsAcceptedAt: timestamp('terms_accepted_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  currencyCheck: check('storefront_order_details_currency_check', sql`${table.currency} IN ('EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD')`),
  addressObjectChecks: check('storefront_order_addresses_object_check', sql`jsonb_typeof(${table.shippingAddress}) = 'object' AND jsonb_typeof(${table.billingAddress}) = 'object'`),
  createdAtIdx: index('storefront_order_details_created_at_idx').on(table.createdAt),
}));

// Guest order capabilities are random per-order bearer values. Only a SHA-256
// digest is persisted; accessId is a random nonce used to re-derive the same
// keyed capability during a safe idempotent replay.
export const storefrontOrderAccess = pgTable('storefront_order_access', {
  accessId: uuid('access_id').primaryKey(),
  saleId: integer('sale_id').notNull().references(() => sales.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  saleUnique: uniqueIndex('storefront_order_access_sale_unique').on(table.saleId),
  tokenHashUnique: uniqueIndex('storefront_order_access_token_hash_unique').on(table.tokenHash),
  expiryIdx: index('storefront_order_access_expires_at_idx').on(table.expiresAt),
  tokenHashFormat: check('storefront_order_access_token_hash_check', sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
  expiryAfterCreation: check('storefront_order_access_expiry_check', sql`${table.expiresAt} > ${table.createdAt}`),
}));

// The scope and client key are stored only as digests. A customer scope is the
// exact tenant user id; a guest scope is the opaque server cart UUID. Email is
// never part of idempotency ownership.
export const storefrontCheckoutIdempotency = pgTable('storefront_checkout_idempotency', {
  scopeKind: varchar('scope_kind', { length: 16 }).notNull(),
  scopeHash: varchar('scope_hash', { length: 64 }).notNull(),
  idempotencyKeyHash: varchar('idempotency_key_hash', { length: 64 }).notNull(),
  requestHash: varchar('request_hash', { length: 64 }).notNull(),
  status: varchar('status', { length: 16 }).default('processing').notNull(),
  saleId: integer('sale_id').references(() => sales.id, { onDelete: 'cascade' }),
  responsePayload: jsonb('response_payload').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  pk: primaryKey({ columns: [table.scopeHash, table.idempotencyKeyHash] }),
  saleUnique: uniqueIndex('storefront_checkout_idempotency_sale_unique').on(table.saleId),
  createdAtIdx: index('storefront_checkout_idempotency_created_at_idx').on(table.createdAt),
  scopeKindCheck: check('storefront_checkout_idempotency_scope_kind_check', sql`${table.scopeKind} IN ('customer', 'guest')`),
  statusCheck: check('storefront_checkout_idempotency_status_check', sql`${table.status} IN ('processing', 'completed')`),
  hashFormatChecks: check('storefront_checkout_idempotency_hash_checks', sql`${table.scopeHash} ~ '^[0-9a-f]{64}$' AND ${table.idempotencyKeyHash} ~ '^[0-9a-f]{64}$' AND ${table.requestHash} ~ '^[0-9a-f]{64}$'`),
  completionCheck: check('storefront_checkout_idempotency_completion_check', sql`(${table.status} = 'processing' AND ${table.saleId} IS NULL AND ${table.responsePayload} IS NULL AND ${table.completedAt} IS NULL) OR (${table.status} = 'completed' AND ${table.saleId} IS NOT NULL AND jsonb_typeof(${table.responsePayload}) = 'object' AND ${table.completedAt} IS NOT NULL)`),
}));

// --- PURCHASES ---

export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const purchases = pgTable('purchases', {
  id: serial('id').primaryKey(),
  supplierId: integer('supplier_id').references(() => suppliers.id),
  warehouseId: integer('warehouse_id').references(() => warehouses.id),
  reference: varchar('reference', { length: 100 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  status: purchaseStatusEnum('status').default('Pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const purchaseItems = pgTable('purchase_items', {
  id: serial('id').primaryKey(),
  purchaseId: integer('purchase_id').references(() => purchases.id, { onDelete: 'cascade' }).notNull(),
  variantId: integer('variant_id').references(() => productVariants.id).notNull(),
  quantity: integer('quantity').notNull(),
  costPrice: decimal('cost_price', { precision: 12, scale: 2 }).notNull(),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
});

// --- HR & PAYROLL ---

export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  hodName: varchar('hod_name', { length: 255 }),
  description: text('description'),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const designations = pgTable('designations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  departmentId: integer('department_id').references(() => departments.id),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const shifts = pgTable('shifts', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  startTime: varchar('start_time', { length: 20 }),
  endTime: varchar('end_time', { length: 20 }),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  departmentId: integer('department_id').references(() => departments.id),
  designationId: integer('designation_id').references(() => designations.id),
  shiftId: integer('shift_id').references(() => shifts.id),
  firstName: varchar('first_name', { length: 255 }).notNull(),
  lastName: varchar('last_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  empCode: varchar('emp_code', { length: 100 }).notNull(),
  joiningDate: timestamp('joining_date'),
  salary: decimal('salary', { precision: 12, scale: 2 }),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  uniqueCode: uniqueIndex('unique_emp_code_per_company').on(table.empCode),
}));

export const attendanceRecords = pgTable('attendance_records', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  date: timestamp('date').notNull(),
  clockIn: varchar('clock_in', { length: 20 }),
  clockOut: varchar('clock_out', { length: 20 }),
  production: varchar('production', { length: 20 }),
  breakDuration: varchar('break_duration', { length: 20 }),
  overtime: varchar('overtime', { length: 20 }),
  totalHours: varchar('total_hours', { length: 20 }),
  status: varchar('status', { length: 20 }).default('Present'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const leaveTypes = pgTable('leave_types', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  leaveQuota: integer('leave_quota').default(0).notNull(),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const employeeLeaves = pgTable('employee_leaves', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  leaveTypeId: integer('leave_type_id').references(() => leaveTypes.id).notNull(),
  fromDate: timestamp('from_date').notNull(),
  toDate: timestamp('to_date').notNull(),
  reason: text('reason'),
  status: leaveStatusEnum('status').default('Applied').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const payrolls = pgTable('payrolls', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  payPeriod: varchar('pay_period', { length: 50 }).notNull(),
  netSalary: decimal('net_salary', { precision: 12, scale: 2 }).notNull(),
  status: payrollStatusEnum('status').default('Draft').notNull(),
  paidOn: timestamp('paid_on'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const holidays = pgTable('holidays', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  fromDate: timestamp('from_date').notNull(),
  toDate: timestamp('to_date').notNull(),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- FINANCE ---

export const bankAccountTypes = pgTable('bank_account_types', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const bankAccounts = pgTable('bank_accounts', {
  id: serial('id').primaryKey(),
  accountTypeId: integer('account_type_id').references(() => bankAccountTypes.id),
  accountHolderName: varchar('account_holder_name', { length: 255 }).notNull(),
  accountNo: varchar('account_no', { length: 100 }).notNull(),
  openingBalance: decimal('opening_balance', { precision: 12, scale: 2 }).default('0').notNull(),
  balance: decimal('balance', { precision: 12, scale: 2 }).default('0').notNull(),
  notes: text('notes'),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueAcc: uniqueIndex('unique_account_per_company').on(table.accountNo),
}));

export const moneyTransfers = pgTable('money_transfers', {
  id: serial('id').primaryKey(),
  referenceNumber: varchar('reference_number', { length: 100 }).notNull(),
  date: timestamp('date').defaultNow().notNull(),
  fromAccountId: integer('from_account_id').references(() => bankAccounts.id).notNull(),
  toAccountId: integer('to_account_id').references(() => bankAccounts.id).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }).default('Bank Transfer'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  category: varchar('category', { length: 100 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  reference: varchar('reference', { length: 100 }),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- MARKETING ---

export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 100 }).notNull(),
  discountType: discountTypeEnum('discount_type').default('Percentage').notNull(),
  discountValue: decimal('discount_value', { precision: 12, scale: 2 }).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  usageLimit: integer('usage_limit').default(0),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueCode: uniqueIndex('unique_coupon_per_company').on(table.code),
}));

export const giftCards = pgTable('gift_cards', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 100 }).notNull(),
  initialAmount: decimal('initial_amount', { precision: 12, scale: 2 }).notNull(),
  balance: decimal('balance', { precision: 12, scale: 2 }).notNull(),
  expiryDate: timestamp('expiry_date'),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueCode: uniqueIndex('unique_giftcard_per_company').on(table.code),
}));

export const productDiscounts = pgTable('product_discounts', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  discountType: discountTypeEnum('discount_type').default('Percentage').notNull(),
  discountValue: decimal('discount_value', { precision: 12, scale: 2 }).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  status: statusEnum('status').default('Active').notNull(),
});

export const categoryDiscounts = pgTable('category_discounts', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'cascade' }).notNull(),
  discountType: discountTypeEnum('discount_type').default('Percentage').notNull(),
  discountValue: decimal('discount_value', { precision: 12, scale: 2 }).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  status: statusEnum('status').default('Active').notNull(),
});

// --- CMS & BLOG ---

export const cmsPages = pgTable('cms_pages', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  content: text('content'),
  blocks: jsonb('blocks').default([]).$type<CmsBlock[]>(),
  pageType: varchar('page_type', { length: 30 }).default('page'),
  excerpt: text('excerpt'),
  featuredImage: text('featured_image'),
  metaTitle: varchar('meta_title', { length: 255 }),
  metaDescription: text('meta_description'),
  authorUserId: integer('author_user_id'),
  updatedBy: integer('updated_by'),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  uniqueSlugPerCompany: uniqueIndex('cms_page_company_slug_idx').on(table.slug),
}));

export const cmsCountries = pgTable('cms_countries', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 8 }).notNull(),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cmsStates = pgTable('cms_states', {
  id: serial('id').primaryKey(),
  countryId: integer('country_id').references(() => cmsCountries.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cmsCities = pgTable('cms_cities', {
  id: serial('id').primaryKey(),
  stateId: integer('state_id').references(() => cmsStates.id, { onDelete: 'cascade' }).notNull(),
  countryId: integer('country_id').references(() => cmsCountries.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cmsTestimonials = pgTable('cms_testimonials', {
  id: serial('id').primaryKey(),
  author: varchar('author', { length: 255 }).notNull(),
  role: varchar('role', { length: 255 }),
  content: text('content').notNull(),
  rating: integer('rating').default(5),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cmsFaqs = pgTable('cms_faqs', {
  id: serial('id').primaryKey(),
  category: varchar('category', { length: 255 }).notNull(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const blogCategories = pgTable('blog_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const blogTags = pgTable('blog_tags', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const blogPosts = pgTable('blog_posts', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => blogCategories.id),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  excerpt: varchar('excerpt', { length: 320 }).default(''),
  content: text('content'),
  coverImageUrl: text('cover_image_url'),
  authorName: varchar('author_name', { length: 255 }).notNull(),
  status: statusEnum('status').default('Active').notNull(),
  publishedAt: timestamp('published_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  uniqueSlugPerCompany: uniqueIndex('blog_post_company_slug_idx').on(table.slug),
  updatedAtIdx: index('blog_posts_updated_at_idx').on(table.updatedAt),
}));

export const blogPostTags = pgTable('blog_post_tags', {
  postId: integer('post_id').references(() => blogPosts.id, { onDelete: 'cascade' }).notNull(),
  tagId: integer('tag_id').references(() => blogTags.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.postId, table.tagId] }),
}));

export const blogComments = pgTable('blog_comments', {
  id: serial('id').primaryKey(),
  postId: integer('post_id').references(() => blogPosts.id, { onDelete: 'cascade' }).notNull(),
  commenterName: varchar('commenter_name', { length: 255 }).notNull(),
  comment: text('comment').notNull(),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Public contact-form submissions (migration 004). No raw IP is stored —
// ip_hash keeps a SHA-256 digest purely for abuse throttling.
export const contactMessages = pgTable('contact_messages', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  email: varchar('email', { length: 254 }).notNull(),
  subject: varchar('subject', { length: 200 }).notNull(),
  message: text('message').notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  ipHash: varchar('ip_hash', { length: 64 }),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index('contact_messages_created_at_idx').on(table.createdAt),
  unreadIdx: index('contact_messages_unread_idx').on(table.readAt, table.createdAt),
}));

// Signed-in shoppers' comparison lists (migration 005). Mirrors wishlist_items:
// guests stay browser-local, accounts persist here.
export const compareItems = pgTable('compare_items', {
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.productId] }),
  userCreatedIdx: index('compare_items_user_created_idx').on(table.userId, table.createdAt),
}));

// Saved billing/shipping address per signed-in shopper (migration 009).
export const customerAddresses = pgTable('customer_addresses', {
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  kind: varchar('kind', { length: 16 }).$type<'billing' | 'shipping'>().notNull(),
  address: jsonb('address').$type<Record<string, string>>().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.kind] }),
  kindCheck: check('customer_addresses_kind_check', sql`${table.kind} IN ('billing', 'shipping')`),
}));

// Public product reviews written by signed-in shoppers (migration 006). One
// row per (product, customer): re-submitting replaces that customer's own
// review instead of stacking duplicates. status defaults to 'approved'
// because submissions publish immediately; the column preserves the option
// of introducing moderation later without another additive migration.
export const productReviews = pgTable('product_reviews', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  authorName: varchar('author_name', { length: 120 }).notNull(),
  rating: integer('rating').notNull(),
  body: text('body').notNull(),
  status: varchar('status', { length: 16 }).$type<'pending' | 'approved' | 'rejected'>().default('approved').notNull(),
  verifiedPurchase: boolean('verified_purchase').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  ratingCheck: check('product_reviews_rating_check', sql`${table.rating} >= 1 AND ${table.rating} <= 5`),
  statusCheck: check('product_reviews_status_check', sql`${table.status} IN ('pending', 'approved', 'rejected')`),
  bodyLengthCheck: check('product_reviews_body_length_check', sql`char_length(btrim(${table.body})) >= 10`),
  productUserUnique: uniqueIndex('product_reviews_product_user_idx').on(table.productId, table.userId),
  productStatusIdx: index('product_reviews_product_status_idx').on(table.productId, table.status, table.createdAt),
}));

// --- SETTINGS ---

export const settingsStore = pgTable('settings_store', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 140 }).notNull(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  companyKeyIdx: uniqueIndex('company_key_idx').on(table.key),
}));

export const featureConfigurations = pgTable('feature_configurations', {
  id: serial('id').primaryKey(),
  featureGroup: varchar('feature_group', { length: 80 }).notNull(),
  featureKey: varchar('feature_key', { length: 80 }).notNull(),
  label: varchar('label', { length: 140 }).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  companyGroupKeyIdx: uniqueIndex('feature_cfg_company_group_key_idx').on(table.featureGroup, table.featureKey),
  companyGroupIdx: index('feature_cfg_company_group_idx').on(table.featureGroup),
}));

// --- RELATIONS ---

export const blogPostsRelations = relations(blogPosts, ({ one, many }) => ({
  category: one(blogCategories, {
    fields: [blogPosts.categoryId],
    references: [blogCategories.id],
  }),
  tagLinks: many(blogPostTags),
  comments: many(blogComments),
}));

export const blogCategoriesRelations = relations(blogCategories, ({ many }) => ({
  posts: many(blogPosts),
}));

export const blogPostTagsRelations = relations(blogPostTags, ({ one }) => ({
  post: one(blogPosts, {
    fields: [blogPostTags.postId],
    references: [blogPosts.id],
  }),
  tag: one(blogTags, {
    fields: [blogPostTags.tagId],
    references: [blogTags.id],
  }),
}));

export const blogTagsRelations = relations(blogTags, ({ many }) => ({
  tagLinks: many(blogPostTags),
}));

export const blogCommentsRelations = relations(blogComments, ({ one }) => ({
  post: one(blogPosts, {
    fields: [blogComments.postId],
    references: [blogPosts.id],
  }),
}));

export const tenantRoleRelations = relations(tenantRoles, ({ many }) => ({
  users: many(users),
  rolePermissions: many(tenantRolePermissions),
}));

export const tenantRolePermissionsRelations = relations(tenantRolePermissions, ({ one }) => ({
  tenantRole: one(tenantRoles, {
    fields: [tenantRolePermissions.tenantRoleId],
    references: [tenantRoles.id],
  }),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  variant: one(productVariants, {
    fields: [saleItems.variantId],
    references: [productVariants.id],
  }),
}));

export const storefrontOrderDetailsRelations = relations(storefrontOrderDetails, ({ one }) => ({
  sale: one(sales, {
    fields: [storefrontOrderDetails.saleId],
    references: [sales.id],
  }),
}));

export const storefrontOrderAccessRelations = relations(storefrontOrderAccess, ({ one }) => ({
  sale: one(sales, {
    fields: [storefrontOrderAccess.saleId],
    references: [sales.id],
  }),
}));

export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, {
    fields: [purchaseItems.purchaseId],
    references: [purchases.id],
  }),
  variant: one(productVariants, {
    fields: [purchaseItems.variantId],
    references: [productVariants.id],
  }),
}));

export const userRelations = relations(users, ({ one, many }) => ({
  store: one(stores, { fields: [users.storeId], references: [stores.id] }),
  tenantRole: one(tenantRoles, { fields: [users.tenantRoleId], references: [tenantRoles.id] }),
  sales: many(sales, { relationName: 'saleOperator' }),
  customerSales: many(sales, { relationName: 'saleCustomer' }),
  createdMessageThreads: many(messageThreads),
  messageParticipants: many(messageThreadParticipants),
  sentMessageEntries: many(messageEntries),
}));

export const messageThreadRelations = relations(messageThreads, ({ one, many }) => ({
  creator: one(users, { fields: [messageThreads.createdByUserId], references: [users.id] }),
  participants: many(messageThreadParticipants),
  entries: many(messageEntries),
}));

export const productRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  subCategory: one(subCategories, { fields: [products.subCategoryId], references: [subCategories.id] }),
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
  unit: one(units, { fields: [products.unitId], references: [units.id] }),
  store: one(stores, { fields: [products.storeId], references: [stores.id] }),
  warehouse: one(warehouses, { fields: [products.warehouseId], references: [warehouses.id] }),
  warranty: one(warranties, { fields: [products.warrantyId], references: [warranties.id] }),
  variants: many(productVariants),
  discounts: many(productDiscounts),
  attributeValues: many(productAttributeValues),
}));

export const categoryAttributeRelations = relations(categoryAttributes, ({ one, many }) => ({
  category: one(categories, { fields: [categoryAttributes.categoryId], references: [categories.id] }),
  values: many(productAttributeValues),
}));

export const productDiscountRelations = relations(productDiscounts, ({ one }) => ({
  product: one(products, { fields: [productDiscounts.productId], references: [products.id] }),
}));

export const categoryDiscountRelations = relations(categoryDiscounts, ({ one }) => ({
  category: one(categories, { fields: [categoryDiscounts.categoryId], references: [categories.id] }),
}));

export const productAttributeValueRelations = relations(productAttributeValues, ({ one }) => ({
  product: one(products, { fields: [productAttributeValues.productId], references: [products.id] }),
  attribute: one(categoryAttributes, { fields: [productAttributeValues.attributeId], references: [categoryAttributes.id] }),
}));

export const variantRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  stocks: many(productStocks),
  saleItems: many(saleItems),
  purchaseItems: many(purchaseItems),
}));

export const stockRelations = relations(productStocks, ({ one }) => ({
  warehouse: one(warehouses, { fields: [productStocks.warehouseId], references: [warehouses.id] }),
  variant: one(productVariants, { fields: [productStocks.variantId], references: [productVariants.id] }),
}));

export const departmentRelations = relations(departments, ({ many }) => ({
  designations: many(designations),
  employees: many(employees),
}));

export const employeeRelations = relations(employees, ({ one, many }) => ({
  department: one(departments, { fields: [employees.departmentId], references: [departments.id] }),
  designation: one(designations, { fields: [employees.designationId], references: [designations.id] }),
  shift: one(shifts, { fields: [employees.shiftId], references: [shifts.id] }),
  attendance: many(attendanceRecords),
  leaves: many(employeeLeaves),
  payrolls: many(payrolls),
}));

export const saleRelations = relations(sales, ({ many, one }) => ({
  // `customer` is the legacy CRM record and `user` is the legacy POS operator.
  customer: one(customers, { fields: [sales.customerId], references: [customers.id] }),
  user: one(users, {
    fields: [sales.userId],
    references: [users.id],
    relationName: 'saleOperator',
  }),
  customerUser: one(users, {
    fields: [sales.customerUserId],
    references: [users.id],
    relationName: 'saleCustomer',
  }),
  warehouse: one(warehouses, { fields: [sales.warehouseId], references: [warehouses.id] }),
  items: many(saleItems),
  storefrontDetails: one(storefrontOrderDetails, {
    fields: [sales.id],
    references: [storefrontOrderDetails.saleId],
  }),
}));

export const purchaseRelations = relations(purchases, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [purchases.supplierId], references: [suppliers.id] }),
  warehouse: one(warehouses, { fields: [purchases.warehouseId], references: [warehouses.id] }),
  items: many(purchaseItems),
}));

export const categoryRelations = relations(categories, ({ many }) => ({
  subCategories: many(subCategories),
  products: many(products),
  discounts: many(categoryDiscounts),
}));

export const cmsCountryRelations = relations(cmsCountries, ({ many }) => ({
  states: many(cmsStates),
  cities: many(cmsCities),
}));

export const cmsStateRelations = relations(cmsStates, ({ one, many }) => ({
  country: one(cmsCountries, { fields: [cmsStates.countryId], references: [cmsCountries.id] }),
  cities: many(cmsCities),
}));

export const cmsCityRelations = relations(cmsCities, ({ one }) => ({
  state: one(cmsStates, { fields: [cmsCities.stateId], references: [cmsStates.id] }),
  country: one(cmsCountries, { fields: [cmsCities.countryId], references: [cmsCountries.id] }),
}));

export const bankAccountRelations = relations(bankAccounts, ({ one, many }) => ({
  accountType: one(bankAccountTypes, { fields: [bankAccounts.accountTypeId], references: [bankAccountTypes.id] }),
  transfersFrom: many(moneyTransfers, { relationName: 'fromAccount' }),
  transfersTo: many(moneyTransfers, { relationName: 'toAccount' }),
}));

export const moneyTransfersRelations = relations(moneyTransfers, ({ one }) => ({
  fromAccount: one(bankAccounts, { fields: [moneyTransfers.fromAccountId], references: [bankAccounts.id], relationName: 'fromAccount' }),
  toAccount: one(bankAccounts, { fields: [moneyTransfers.toAccountId], references: [bankAccounts.id], relationName: 'toAccount' }),
}));

export const subCategoriesRelations = relations(subCategories, ({ one }) => ({
  category: one(categories, { fields: [subCategories.categoryId], references: [categories.id] }),
}));

export const warehouseRelations = relations(warehouses, ({ many }) => ({
  sales: many(sales),
  purchases: many(purchases),
  products: many(products),
  stocks: many(productStocks),
}));

export const brandRelations = relations(brands, ({ many }) => ({
  products: many(products),
}));

export const unitRelations = relations(units, ({ many }) => ({
  products: many(products),
}));

export const warrantyRelations = relations(warranties, ({ many }) => ({
  products: many(products),
}));

// ---------------------------------------------------------------------------
// Maryam CMS additions (drizzle/add_cms_tables.sql)
// ---------------------------------------------------------------------------

/** Page-builder payload: `{ id, type, props, children?, responsive? }`.
 *  `type` is a module (`heading`, …) or a layout node (`row`, `column`). */
export type CmsBlock = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: CmsBlock[];
  /** Per-breakpoint prop overrides keyed by desktop/tablet/mobile. */
  responsive?: Record<string, Record<string, unknown>>;
};

export const shippingZones = pgTable('shipping_zones', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  priority: integer('priority').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const shippingZoneLocations = pgTable('shipping_zone_locations', {
  id: serial('id').primaryKey(),
  zoneId: integer('zone_id').references(() => shippingZones.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  code: varchar('code', { length: 10 }).notNull(),
}, (table) => ({
  zoneIdx: index('shipping_zone_locations_zone_idx').on(table.zoneId),
}));

export const shippingMethods = pgTable('shipping_methods', {
  id: serial('id').primaryKey(),
  zoneId: integer('zone_id').references(() => shippingZones.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  cost: decimal('cost', { precision: 10, scale: 2 }).default('0').notNull(),
  minOrderAmount: decimal('min_order_amount', { precision: 10, scale: 2 }).default('0').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  instructions: text('instructions'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  zoneIdx: index('shipping_methods_zone_idx').on(table.zoneId),
}));

export const orderTracking = pgTable('order_tracking', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  trackingNumber: varchar('tracking_number', { length: 255 }),
  carrier: varchar('carrier', { length: 255 }),
  trackingUrl: text('tracking_url'),
  sentAt: timestamp('sent_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orderIdx: uniqueIndex('order_tracking_order_idx').on(table.orderId),
}));

export const orderNotes = pgTable('order_notes', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  body: text('body').notNull(),
  isCustomerNote: boolean('is_customer_note').default(false).notNull(),
  createdByUserId: integer('created_by_user_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orderIdx: index('order_notes_order_idx').on(table.orderId),
}));

export const customerNotes = pgTable('customer_notes', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull(),
  body: text('body').notNull(),
  createdByUserId: integer('created_by_user_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  customerIdx: index('customer_notes_customer_idx').on(table.customerId),
}));

export const themeSettings = pgTable('theme_settings', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull(),
  activeTheme: varchar('active_theme', { length: 100 }).default('minimal').notNull(),
  customizations: jsonb('customizations').default({}).notNull(),
  navMenu: jsonb('nav_menu').default([]).notNull(),
  navMenuLocation: varchar('nav_menu_location', { length: 50 }).default('primary').notNull(),
  footerConfig: jsonb('footer_config').default({}).notNull(),
  widgets: jsonb('widgets').default([]).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  companyIdx: uniqueIndex('theme_settings_company_idx').on(table.companyId),
}));

export const cmsMedia = pgTable('cms_media', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull(),
  filename: varchar('filename', { length: 500 }).notNull(),
  originalName: varchar('original_name', { length: 500 }),
  url: text('url').notNull(),
  publicId: text('public_id'),
  mimeType: varchar('mime_type', { length: 100 }),
  sizeBytes: integer('size_bytes'),
  width: integer('width'),
  height: integer('height'),
  altText: varchar('alt_text', { length: 500 }),
  folder: varchar('folder', { length: 255 }).default('/').notNull(),
  uploadedBy: integer('uploaded_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  companyIdx: index('cms_media_company_idx').on(table.companyId),
}));

export const taxRates = pgTable('tax_rates', {
  id: serial('id').primaryKey(),
  country: varchar('country', { length: 10 }).default('').notNull(),
  state: varchar('state', { length: 10 }).default('').notNull(),
  postcode: varchar('postcode', { length: 20 }).default('').notNull(),
  rate: decimal('rate', { precision: 8, scale: 4 }).default('0').notNull(),
  name: varchar('name', { length: 100 }).default('VAT').notNull(),
  shipping: boolean('shipping').default(false).notNull(),
  priority: integer('priority').default(1).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const shippingZoneRelations = relations(shippingZones, ({ many }) => ({
  locations: many(shippingZoneLocations),
  methods: many(shippingMethods),
}));

export const shippingZoneLocationRelations = relations(shippingZoneLocations, ({ one }) => ({
  zone: one(shippingZones, {
    fields: [shippingZoneLocations.zoneId],
    references: [shippingZones.id],
  }),
}));

export const shippingMethodRelations = relations(shippingMethods, ({ one }) => ({
  zone: one(shippingZones, {
    fields: [shippingMethods.zoneId],
    references: [shippingZones.id],
  }),
}));


