-- =============================================================================
-- MIGRATION 004: Profiles
-- Run order: AFTER 003
-- Rollback: DROP TABLE IF EXISTS public.profiles CASCADE;
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PROFILES
-- One row per auth.user. Created automatically on first sign-in via
-- the handle_new_user trigger below, then enriched by the admin.
--
-- tenant_id + role + branch_id are set by the JWT custom claims hook
-- (see jwt_claims_hook.ts). The profile row is the source of truth;
-- the JWT is a cached projection of it.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id          uuid          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   public.ulid   NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id   public.ulid   REFERENCES public.branches(id) ON DELETE SET NULL,
  full_name   text          NOT NULL CHECK (length(trim(full_name)) > 0),
  role        text          NOT NULL
                            CHECK (role IN ('owner', 'manager', 'cashier', 'viewer')),
  phone       text,
  pin_hash    text,         -- optional 4-6 digit cashier PIN, bcrypt hashed
  is_active   boolean       NOT NULL DEFAULT true,
  last_seen   timestamptz,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now(),

  -- Cashiers MUST have a branch assignment.
  -- Owners and managers MAY be branch-scoped but it's not required.
  CONSTRAINT cashier_requires_branch
    CHECK (role != 'cashier' OR branch_id IS NOT NULL)
);

CREATE INDEX profiles_tenant_idx           ON public.profiles (tenant_id);
CREATE INDEX profiles_tenant_branch_idx    ON public.profiles (tenant_id, branch_id);
CREATE INDEX profiles_tenant_role_idx      ON public.profiles (tenant_id, role)
  WHERE is_active = true;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- AUTO-CREATE PROFILE ON SIGN-UP
-- Called by Supabase auth hook "after_user_created".
-- Sets minimal defaults; tenant assignment happens in the onboarding Edge Function.
-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE: This trigger is NOT used in the multi-tenant flow.
-- Tenant provisioning happens via the admin Edge Function (service_role).
-- This trigger exists as a safeguard — it fires if someone signs up outside
-- the normal onboarding path, creating a detached profile row that ops can audit.
-- The trigger is intentionally minimal and does NOT assign a tenant.
-- ─────────────────────────────────────────────────────────────────────────────

-- RLS

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile row.
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- Owners and managers can read all profiles in their tenant.
CREATE POLICY profiles_select_tenant ON public.profiles
  FOR SELECT
  USING (
    tenant_id = public.current_tenant()
    AND public.has_role('owner', 'manager')
  );

-- Only owner can create new profiles (add staff).
CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT
  WITH CHECK (
    tenant_id = public.current_tenant()
    AND public.has_role('owner', 'manager')
  );

-- Owner/manager can update any profile in their tenant.
-- Users can update their own non-sensitive fields (last_seen, phone).
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_manager ON public.profiles
  FOR UPDATE
  USING (
    tenant_id = public.current_tenant()
    AND public.has_role('owner', 'manager')
  )
  WITH CHECK (
    tenant_id = public.current_tenant()
    AND public.has_role('owner', 'manager')
  );

-- No DELETE policy — profiles are deactivated, never deleted.
-- Deleting a profile would orphan historical sales cashier_id references.

COMMENT ON TABLE public.profiles IS
  'One row per auth.user. Role and tenant assignment owned by owner/manager. '
  'cashier role MUST have branch_id set. Deactivate with is_active=false.';

COMMENT ON COLUMN public.profiles.pin_hash IS
  'Optional cashier PIN for quick-switch in shared terminal mode. '
  'bcrypt hashed. Never returned to client — filter in API layer.';
