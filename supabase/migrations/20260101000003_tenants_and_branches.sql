-- =============================================================================
-- MIGRATION 003: Tenants and Branches
-- Run order: AFTER 002
-- Rollback: DROP TABLE IF EXISTS public.branches CASCADE;
--           DROP TABLE IF EXISTS public.tenants CASCADE;
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TENANTS
-- One row per paying customer (business entity).
-- Created by your internal onboarding function, never by end users.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.tenants (
  id              public.ulid     PRIMARY KEY,
  name            text            NOT NULL CHECK (length(trim(name)) > 0),
  slug            text            NOT NULL
                                  CONSTRAINT tenants_slug_format
                                  CHECK (slug ~ '^[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]$'),
  country_code    char(2)         NOT NULL DEFAULT 'TZ',
  currency_code   char(3)         NOT NULL DEFAULT 'TZS',
  timezone        text            NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  vat_rate        numeric(5,4)    NOT NULL DEFAULT 0.18
                                  CHECK (vat_rate >= 0 AND vat_rate < 1),
  status          text            NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'suspended', 'cancelled')),
  created_at      timestamptz     NOT NULL DEFAULT now(),
  updated_at      timestamptz     NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tenants_slug_idx ON public.tenants (slug);
CREATE INDEX tenants_status_idx      ON public.tenants (status) WHERE status = 'active';

-- updated_at maintenance trigger (applied to all tables below)
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS — tenants table is NOT end-user writable.
-- Only owners can read their own tenant row.
-- Inserts/updates happen via SECURITY DEFINER admin functions only.
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenants_select ON public.tenants
  FOR SELECT
  USING (id = auth.current_tenant());

-- No INSERT/UPDATE/DELETE policies — blocked by default.
-- Tenant provisioning happens via the admin Edge Function (service_role).

COMMENT ON TABLE public.tenants IS
  'One row per paying business. Created by internal onboarding only. '
  'status=suspended = read-only access, no new sales. '
  'status=cancelled = no access.';


-- ─────────────────────────────────────────────────────────────────────────────
-- BRANCHES
-- Physical locations within a tenant. Minimum: one branch per tenant.
-- Cashiers are assigned to exactly one branch.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.branches (
  id          public.ulid   PRIMARY KEY,
  tenant_id   public.ulid   NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  name        text          NOT NULL CHECK (length(trim(name)) > 0),
  code        text          NOT NULL CHECK (length(trim(code)) > 0),
  address     text,
  phone       text,
  is_active   boolean       NOT NULL DEFAULT true,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT branches_code_per_tenant UNIQUE (tenant_id, code)
);

CREATE INDEX branches_tenant_idx        ON public.branches (tenant_id);
CREATE INDEX branches_tenant_active_idx ON public.branches (tenant_id) WHERE is_active = true;

CREATE TRIGGER branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- All authenticated users in a tenant can see branches.
CREATE POLICY branches_select ON public.branches
  FOR SELECT
  USING (tenant_id = auth.current_tenant());

-- Only owner and manager can create/edit branches.
CREATE POLICY branches_insert ON public.branches
  FOR INSERT
  WITH CHECK (
    tenant_id = auth.current_tenant()
    AND auth.has_role('owner', 'manager')
  );

CREATE POLICY branches_update ON public.branches
  FOR UPDATE
  USING (tenant_id = auth.current_tenant())
  WITH CHECK (
    tenant_id = auth.current_tenant()
    AND auth.has_role('owner', 'manager')
  );

-- No DELETE policy — branches are deactivated, never deleted.
-- (Deleting a branch with historical sales would corrupt reports.)

COMMENT ON TABLE public.branches IS
  'Physical store locations. Cashiers are scoped to one branch. '
  'Deactivate with is_active=false. Never delete.';
