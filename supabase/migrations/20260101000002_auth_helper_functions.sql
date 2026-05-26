-- =============================================================================
-- MIGRATION 002: Auth Helper Functions
-- Run order: AFTER 001 — policies in later migrations depend on these
-- Rollback: DROP FUNCTION IF EXISTS auth.current_tenant();
--           DROP FUNCTION IF EXISTS auth.current_role();
--           DROP FUNCTION IF EXISTS auth.current_branch();
--           DROP FUNCTION IF EXISTS auth.current_user_id();
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- DESIGN NOTES
-- ─────────────────────────────────────────────────────────────────────────────
-- All functions are STABLE (same JWT = same result within a transaction).
-- STABLE functions are cached by the planner — one evaluation per query,
-- not per row. This is critical for RLS performance on large tables.
--
-- SET search_path = '' forces fully-qualified references everywhere.
-- Without this, a malicious schema object with a colliding name can intercept
-- calls via search_path manipulation — a privilege escalation vector.
--
-- All claims are read from app_metadata (server-controlled), NEVER from
-- user_metadata (user-editable). This is the correct pattern.
-- ─────────────────────────────────────────────────────────────────────────────

-- Returns the current user's tenant_id from JWT app_metadata.
-- Returns NULL if no valid claim exists (anon requests).
CREATE OR REPLACE FUNCTION auth.current_tenant()
  RETURNS public.ulid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT NULLIF(
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id'),
    ''
  )::public.ulid;
$$;

COMMENT ON FUNCTION auth.current_tenant() IS
  'Extracts tenant_id from JWT app_metadata. STABLE = cached per query. '
  'Use in all RLS USING clauses. Returns NULL for anon requests.';

-- Returns the current user's role from JWT app_metadata.
-- One of: owner, manager, cashier, viewer
CREATE OR REPLACE FUNCTION auth.current_role()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT NULLIF(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    ''
  );
$$;

COMMENT ON FUNCTION auth.current_role() IS
  'Extracts role from JWT app_metadata. One of: owner, manager, cashier, viewer. '
  'Returns NULL for anon requests or missing claim.';

-- Returns the current user's branch_id from JWT app_metadata.
-- NULL is valid: owners and managers may not be branch-scoped.
CREATE OR REPLACE FUNCTION auth.current_branch()
  RETURNS public.ulid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT NULLIF(
    (auth.jwt() -> 'app_metadata' ->> 'branch_id'),
    ''
  )::public.ulid;
$$;

COMMENT ON FUNCTION auth.current_branch() IS
  'Extracts branch_id from JWT app_metadata. NULL = not branch-scoped (owner/manager). '
  'Cashiers must have a branch_id or all their writes will fail the WITH CHECK.';

-- Returns the current authenticated user's UUID.
-- Thin wrapper for consistency with the pattern above.
CREATE OR REPLACE FUNCTION auth.current_user_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT auth.uid();
$$;

COMMENT ON FUNCTION auth.current_user_id() IS
  'Returns auth.uid(). Thin wrapper for consistency with auth.current_* helpers.';

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLE CHECK HELPER
-- Used in WITH CHECK clauses for insert/update policies.
-- Avoids repeating the role list inline in every policy.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION auth.has_role(VARIADIC allowed_roles text[])
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT auth.current_role() = ANY(allowed_roles);
$$;

COMMENT ON FUNCTION auth.has_role(text[]) IS
  'Returns true if current JWT role matches any of the provided roles. '
  'Usage: auth.has_role(''owner'', ''manager'')';
