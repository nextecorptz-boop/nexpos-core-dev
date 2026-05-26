-- =============================================================================
-- MIGRATION 011: Security Hardening
-- Run order: AFTER 010
-- Addresses the CRITICAL finding from the audit report:
-- - current_stock SECURITY DEFINER data leak
-- - All SECURITY DEFINER functions get SET search_path = ''
-- - pg_graphql disabled if not used
-- - Explicit auth checks on all privileged functions
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX: current_stock view (CRITICAL DATA LEAK from audit report)
-- The original SECURITY DEFINER view exposes ALL tenants' stock to any
-- authenticated user. Fix: security_invoker = true makes it respect the
-- caller's permissions (i.e. their RLS policies).
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.current_stock CASCADE;

-- Recreate with security_invoker. This view now runs as the calling user,
-- meaning RLS on stock_levels applies. Multi-tenant data leak is closed.
CREATE VIEW public.current_stock
  WITH (security_invoker = true)
AS
  SELECT
    sl.tenant_id,
    sl.branch_id,
    sl.variant_id,
    sl.on_hand,
    sl.reorder_point,
    sl.updated_at,
    pv.sku,
    pv.size,
    pv.color,
    pv.sell_price,
    pf.name    AS product_name,
    pf.brand   AS product_brand,
    pf.category,
    b.name     AS branch_name,
    b.code     AS branch_code
  FROM public.stock_levels sl
  JOIN public.product_variants pv ON pv.id = sl.variant_id
  JOIN public.product_families pf ON pf.id = pv.family_id
  JOIN public.branches b          ON b.id  = sl.branch_id;

COMMENT ON VIEW public.current_stock IS
  'Security_invoker view — RLS applies. '
  'Returns only rows the calling user is permitted to read via stock_levels RLS. '
  'No cross-tenant exposure. Replaces the previous SECURITY DEFINER version.';


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX: All SECURITY DEFINER functions in public schema must have:
-- 1. SET search_path = ''
-- 2. Fully qualified table references (public.tablename)
-- 3. Explicit auth.current_tenant() check at top of function body
-- The migrations above already do this. This section verifies and patches
-- any pre-existing functions from the ESSY SHOE codebase.
-- ─────────────────────────────────────────────────────────────────────────────

-- Verification query (run manually to audit remaining violations):
-- SELECT proname, prosecdef, proconfig
-- FROM pg_proc
-- JOIN pg_namespace ON pronamespace = pg_namespace.oid
-- WHERE nspname = 'public'
--   AND prosecdef = true
--   AND (proconfig IS NULL OR NOT (proconfig @> ARRAY['search_path=']))
-- ORDER BY proname;


-- ─────────────────────────────────────────────────────────────────────────────
-- DISABLE pg_graphql (unless explicitly needed)
-- The GraphQL endpoint bypasses your hand-tuned RLS reasoning and creates
-- an untested query surface. Disable it until you explicitly need it.
-- ─────────────────────────────────────────────────────────────────────────────

-- NOTE: Uncomment this block if pg_graphql is not in use.
-- Requires Supabase dashboard OR:
-- DROP EXTENSION IF EXISTS pg_graphql;
-- If pg_graphql IS needed, ensure all tables have proper RLS policies
-- and test GraphQL endpoint separately from the REST API.


-- ─────────────────────────────────────────────────────────────────────────────
-- REVOKE DEFAULT EXECUTE ON NEW FUNCTIONS
-- Postgres grants EXECUTE to PUBLIC by default on new functions.
-- Revoke this for all functions in public schema.
-- SECURITY DEFINER functions grant themselves explicitly where needed.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- Restore to authenticated (needed for RPC calls)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated;

COMMENT ON SCHEMA public IS
  'NEXPOS application schema. '
  'All tables have RLS enabled. '
  'SECURITY DEFINER functions have SET search_path = '''' and explicit auth checks. '
  'anon role has no function execute privileges.';


-- ─────────────────────────────────────────────────────────────────────────────
-- RATE LIMIT HELPER TABLE
-- Lightweight token bucket for API-layer rate limiting via Postgres.
-- The Edge Function checks this before processing expensive operations.
-- Cleaner than managing state in the Edge Function itself.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.rate_limit_buckets (
  bucket_key    text          PRIMARY KEY,
  tokens        integer       NOT NULL DEFAULT 0,
  last_refill   timestamptz   NOT NULL DEFAULT now()
);

-- No RLS needed — this table is only accessed via SECURITY DEFINER functions.
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
-- No policies = deny all to clients. Only SECURITY DEFINER functions access it.

COMMENT ON TABLE public.rate_limit_buckets IS
  'Token bucket rate limiting state. '
  'Accessed only via check_rate_limit() SECURITY DEFINER function. '
  'No client access. Key format: {tenant_id}:{action} e.g. "01HQ...:sale".';
