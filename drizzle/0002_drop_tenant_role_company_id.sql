ALTER TABLE "tenant_roles" DROP CONSTRAINT IF EXISTS "tenant_roles_company_id_companies_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "tenant_role_company_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "unique_role_per_company";--> statement-breakpoint
ALTER TABLE "tenant_roles" DROP COLUMN IF EXISTS "company_id";--> statement-breakpoint
CREATE UNIQUE INDEX "unique_role_per_company" ON "tenant_roles" USING btree ("name");--> statement-breakpoint
