# NEXPOS Database Migration Runbook

## Migration Execution Order

Strict dependency chain. Apply in this exact order. Never skip.

```
001_init_schemas_and_types.sql        → ULID domain, extensions, audit schema
002_auth_helper_functions.sql         → auth.current_tenant/role/branch (all RLS depends on these)
003_tenants_and_branches.sql          → tenants, branches, set_updated_at trigger
004_profiles.sql                      → profiles (depends on tenants, branches, auth.users)
005_product_catalog.sql               → product_families, product_variants (depends on tenants)
006_inventory.sql                     → stock_levels, stock_movements, adjust_stock() (depends on variants)
007_customers.sql                     → customers (depends on tenants)
008_sales.sql                         → sales, sale_lines, receipt_seq (depends on customers, branches)
009_audit_log.sql                     → audit.activity_log, write_audit_log() (depends on audit schema)
010_ulid_and_complete_sale.sql        → generate_ulid(), complete_sale() (depends on everything above)
011_security_hardening.sql            → current_stock view fix, REVOKE defaults, rate_limit_buckets
```

## Apply Command

```bash
# Local dev
supabase db reset  # applies migrations + seed in order

# Production (one migration at a time)
supabase db push

# Manual (if supabase CLI not available)
psql $DATABASE_URL -f supabase/migrations/20260101000001_init_schemas_and_types.sql
psql $DATABASE_URL -f supabase/migrations/20260101000002_auth_helper_functions.sql
# ... continue in order
```

## Pre-Apply Verification Checklist

Run these BEFORE applying any migration to production:

```sql
-- 1. Verify extensions available
SELECT name, default_version FROM pg_available_extensions
WHERE name IN ('uuid-ossp', 'pg_trgm', 'unaccent', 'pgcrypto');

-- 2. Verify pgTAP available for tests
SELECT extname FROM pg_extension WHERE extname = 'pgtap';

-- 3. Verify Supabase version (need 15+ for security_invoker views)
SELECT version();

-- 4. Check existing objects won't conflict
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
AND tablename IN ('tenants','branches','profiles','product_families','product_variants',
                  'stock_levels','stock_movements','customers','sales','sale_lines');
-- If any rows returned: you have existing tables. Review before applying.
```

## Rollback Strategy

**Principle: Rollback is a new forward migration, not a reversal.**

Never run ROLLBACK on a production migration that has already modified data. Write a corrective migration instead.

### Safe rollback (no data written yet — schema only):
```sql
-- Safe if applied to empty tables with no dependent objects
DROP TABLE IF EXISTS public.sale_lines CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP SEQUENCE IF EXISTS public.receipt_seq;
-- Continue in reverse dependency order
```

### Production rollback procedure:
```bash
# 1. Identify the broken migration
supabase migration list

# 2. Write a corrective migration
# supabase/migrations/20260101000012_rollback_011.sql

# 3. Apply the corrective migration
supabase db push

# 4. Never use supabase migration repair --status reverted on production
#    without a verified backup restore tested in staging first
```

### Per-migration rollback SQL (for schema-only rollbacks in dev):

**Rollback 011:**
```sql
DROP VIEW IF EXISTS public.current_stock;
DROP TABLE IF EXISTS public.rate_limit_buckets;
-- Restore DEFAULT PRIVILEGES to previous state (no-op if not changed)
```

**Rollback 010:**
```sql
DROP FUNCTION IF EXISTS public.complete_sale(jsonb);
DROP FUNCTION IF EXISTS public.generate_ulid();
DROP EXTENSION IF EXISTS pgcrypto;
```

**Rollback 009:**
```sql
DROP FUNCTION IF EXISTS public.write_audit_log(public.ulid, uuid, text, text, text, jsonb, inet);
DROP TABLE IF EXISTS audit.activity_log;
```

**Rollback 008:**
```sql
DROP TABLE IF EXISTS public.sale_lines CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP SEQUENCE IF EXISTS public.receipt_seq;
```

**Rollback 007:**
```sql
DROP TABLE IF EXISTS public.customers CASCADE;
```

**Rollback 006:**
```sql
DROP FUNCTION IF EXISTS public.adjust_stock(public.ulid, public.ulid, integer, text, text, public.ulid);
DROP TABLE IF EXISTS public.stock_movements CASCADE;
DROP TABLE IF EXISTS public.stock_levels CASCADE;
```

**Rollback 005:**
```sql
DROP TABLE IF EXISTS public.product_variants CASCADE;
DROP TABLE IF EXISTS public.product_families CASCADE;
```

**Rollback 004:**
```sql
DROP TABLE IF EXISTS public.profiles CASCADE;
```

**Rollback 003:**
```sql
DROP FUNCTION IF EXISTS public.set_updated_at();
DROP TABLE IF EXISTS public.branches CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;
```

**Rollback 002:**
```sql
DROP FUNCTION IF EXISTS auth.has_role(text[]);
DROP FUNCTION IF EXISTS auth.current_user_id();
DROP FUNCTION IF EXISTS auth.current_branch();
DROP FUNCTION IF EXISTS auth.current_role();
DROP FUNCTION IF EXISTS auth.current_tenant();
```

**Rollback 001:**
```sql
DROP SCHEMA IF EXISTS audit CASCADE;
DROP DOMAIN IF EXISTS public.ulid;
```

## Post-Apply Verification

Run after every migration in production:

```sql
-- 1. RLS enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = false
AND tablename NOT IN ('rate_limit_buckets');
-- Should return 0 rows (rate_limit_buckets is intentionally policy-less)

-- 2. All SECURITY DEFINER functions have search_path set
SELECT proname, proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
AND p.prosecdef = true
AND (p.proconfig IS NULL OR NOT p.proconfig @> ARRAY['search_path='])
ORDER BY proname;
-- Should return 0 rows

-- 3. No policies on audit.activity_log that could leak data
SELECT polname FROM pg_policy
WHERE polrelid = 'audit.activity_log'::regclass;
-- Should return 0 rows

-- 4. current_stock view is security_invoker (not security_definer)
SELECT relname, reloptions
FROM pg_class
WHERE relname = 'current_stock';
-- reloptions should contain 'security_invoker=true'

-- 5. complete_sale function is executable by authenticated
SELECT has_function_privilege('authenticated', 'public.complete_sale(jsonb)', 'EXECUTE');
-- Should return true
```

## Emergency Procedures

### If JWT claims hook crashes (all users locked out):
```bash
# 1. Disable the hook in Supabase Dashboard immediately
#    Authentication → Hooks → Custom Access Token → Disable

# 2. Users can now log in without custom claims (RLS will block all data access)
# 3. Fix the hook
# 4. Re-enable
# 5. Ask all users to log out and log back in (forces token refresh)
```

### If complete_sale() has a bug causing failures:
```sql
-- 1. The function can be replaced without downtime (CREATE OR REPLACE)
-- 2. No migration file needed for function-only fixes in emergency
-- 3. Apply directly to production, then write the migration file for the record:
CREATE OR REPLACE FUNCTION public.complete_sale(p_input jsonb) ...

-- 4. Verify via test:
SELECT public.complete_sale('{"client_id": "TEST123...", ...}'::jsonb);
```

### If current_stock data leak is discovered in production:
```sql
-- Already fixed in migration 011. If somehow reverted:
DROP VIEW IF EXISTS public.current_stock CASCADE;
CREATE VIEW public.current_stock WITH (security_invoker = true) AS
  SELECT sl.*, pv.sku, pv.size, pf.name AS product_name, b.name AS branch_name
  FROM public.stock_levels sl
  JOIN public.product_variants pv ON pv.id = sl.variant_id
  JOIN public.product_families pf ON pf.id = pv.family_id
  JOIN public.branches b ON b.id = sl.branch_id;
-- Apply immediately. Zero downtime.
```
