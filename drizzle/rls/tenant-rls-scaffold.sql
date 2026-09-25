-- Tenant RLS scaffold for PostgreSQL
--
-- This script enables row-level security for all public tables that have a
-- `company_id` column and creates a standard tenant isolation policy.
--
-- Runtime expectations:
--   set_config('app.current_company_id', '<id>', true)
--   set_config('app.current_platform_role', '<role>', true)
--
-- Notes:
-- - Use this as a baseline, then add table-specific policies where needed.
-- - Join tables without `company_id` (for example `message_thread_participants`)
--   should get explicit custom policies tied to their parent tables.

BEGIN;

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_company_id()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_company_id', true), '')::integer;
$$;

CREATE OR REPLACE FUNCTION app.current_platform_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_platform_role', true), '');
$$;

CREATE OR REPLACE FUNCTION app.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app.current_platform_role() = 'super_admin';
$$;

DO $$
DECLARE
  rec record;
  policy_name text;
BEGIN
  FOR rec IN
    SELECT c.table_schema, c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'company_id'
      AND c.table_name <> '_prisma_migrations'
  LOOP
    policy_name := rec.table_name || '_tenant_isolation';

    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', rec.table_schema, rec.table_name);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', rec.table_schema, rec.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', policy_name, rec.table_schema, rec.table_name);

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR ALL USING (app.is_super_admin() OR company_id = app.current_company_id()) WITH CHECK (app.is_super_admin() OR company_id = app.current_company_id())',
      policy_name,
      rec.table_schema,
      rec.table_name
    );
  END LOOP;
END $$;

-- Example custom policy for a table without direct company_id.
ALTER TABLE public.delete_account_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delete_account_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS delete_account_requests_tenant_isolation ON public.delete_account_requests;
CREATE POLICY delete_account_requests_tenant_isolation
ON public.delete_account_requests
FOR ALL
USING (
  app.is_super_admin() OR EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = delete_account_requests.user_id
      AND u.company_id = app.current_company_id()
  )
)
WITH CHECK (
  app.is_super_admin() OR EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = delete_account_requests.user_id
      AND u.company_id = app.current_company_id()
  )
);

COMMIT;
