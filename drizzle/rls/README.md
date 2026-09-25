# Tenant RLS Scaffold

This directory contains a baseline PostgreSQL row-level security script for multi-tenant isolation.

## Files

- `tenant-rls-scaffold.sql`: Enables RLS for all `public` tables with a `company_id` column and creates a standard tenant policy.

## Runtime Context

The application should set these PostgreSQL session variables per request or per transaction:

- `app.current_company_id`: tenant company id
- `app.current_platform_role`: platform role (for example `admin`, `super_admin`)

The policy allows access when either condition is true:

- Role is `super_admin`
- Row `company_id` matches `app.current_company_id`

## Apply

Run once per environment:

```sql
\i drizzle/rls/tenant-rls-scaffold.sql
```

Or with CLI:

```bash
psql "$DATABASE_URL" -f drizzle/rls/tenant-rls-scaffold.sql
```

## Follow-up

Add custom RLS policies for tables that do not contain `company_id` directly (for example relation tables that inherit tenant scope from parent rows).
