import { pgTable, serial, text, decimal, integer, timestamp, varchar, boolean, pgEnum, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- SHARED ENUMS ---
export const statusEnum = pgEnum('status', ['Active', 'Inactive', 'Archived', 'Pending', 'Suspended']);

// --- GLOBAL TABLES ---

export const platformRoles = pgTable('platform_roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(), // super_admin, admin, customer
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const packages = pgTable('packages', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  userLimit: integer('user_limit').notNull(),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  subdomain: varchar('subdomain', { length: 255 }).unique().notNull(), // Added for routing
  dbConnectionString: text('db_connection_string').notNull(),        // Added for dynamic connection
  dbSchema: varchar('db_schema', { length: 255 }).default('public').notNull(), // Added for schema-level isolation
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  logoUrl: text('logo_url'),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  packageId: integer('package_id').references(() => packages.id).notNull(),
  startDate: timestamp('start_date').defaultNow().notNull(),
  expiryDate: timestamp('expiry_date').notNull(),
  status: statusEnum('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  companyIdx: index('sub_company_idx').on(table.companyId),
}));

export const permissionDefinitions = pgTable('permission_definitions', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 140 }).notNull().unique(),
  groupKey: varchar('group_key', { length: 80 }).notNull(),
  groupLabel: varchar('group_label', { length: 255 }).notNull(),
  label: varchar('label', { length: 255 }).notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const companyFeatureConfigurations = pgTable('company_feature_configurations', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  featureGroup: varchar('feature_group', { length: 80 }).notNull(),
  featureKey: varchar('feature_key', { length: 80 }).notNull(),
  label: varchar('label', { length: 140 }).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  companyFeatureKeyIdx: uniqueIndex('master_feature_cfg_company_group_key_idx').on(table.companyId, table.featureGroup, table.featureKey),
  companyFeatureGroupIdx: index('master_feature_cfg_company_group_idx').on(table.companyId, table.featureGroup),
}));

export const packageFeatureEntitlements = pgTable('package_feature_entitlements', {
  id: serial('id').primaryKey(),
  packageId: integer('package_id').references(() => packages.id, { onDelete: 'cascade' }).notNull(),
  featureKey: varchar('feature_key', { length: 80 }).notNull(),
  enabled: boolean('enabled').default(false).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  packageFeatureKeyIdx: uniqueIndex('package_feature_entitlements_package_key_idx').on(table.packageId, table.featureKey),
  packageFeaturePackageIdx: index('package_feature_entitlements_package_idx').on(table.packageId),
}));

export const companyRolePermissions = pgTable('company_role_permissions', {
  companyId: integer('company_id').references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  roleName: varchar('role_name', { length: 255 }).notNull(),
  permissionId: integer('permission_id').references(() => permissionDefinitions.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.companyId, table.roleName, table.permissionId] }),
  companyRoleIdx: index('company_role_permissions_company_role_idx').on(table.companyId, table.roleName),
}));

export const platformUsers = pgTable('platform_users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  platformRoleId: integer('platform_role_id').references(() => platformRoles.id),
  status: statusEnum('status').default('Active').notNull(),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

// --- RELATIONS ---

export const platformUserRelations = relations(platformUsers, ({ one }) => ({
  role: one(platformRoles, {
    fields: [platformUsers.platformRoleId],
    references: [platformRoles.id],
  }),
}));

export const companyRelations = relations(companies, ({ one }) => ({
  subscription: one(subscriptions, { fields: [companies.id], references: [subscriptions.companyId] }),
}));

export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  company: one(companies, { fields: [subscriptions.companyId], references: [companies.id] }),
  package: one(packages, { fields: [subscriptions.packageId], references: [packages.id] }),
}));

export const packageRelations = relations(packages, ({ many }) => ({
  subscriptions: many(subscriptions),
}));
