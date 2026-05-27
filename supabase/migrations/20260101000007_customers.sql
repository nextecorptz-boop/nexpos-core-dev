-- =============================================================================
-- MIGRATION 007: Customers
-- Run order: AFTER 006
-- Rollback: DROP TABLE IF EXISTS public.customers CASCADE;
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- CUSTOMERS
-- Optional linkage on sales. Walk-in sales (customer_id IS NULL) are normal.
-- Phone is the primary identifier in East Africa — email is optional.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.customers (
  id          public.ulid   PRIMARY KEY,
  tenant_id   public.ulid   NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  full_name   text          NOT NULL CHECK (length(trim(full_name)) > 0),
  phone       text,
  email       text,
  notes       text,
  is_active   boolean       NOT NULL DEFAULT true,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now(),

  -- Phone unique per tenant. NULL is allowed (not all customers provide phone).
  CONSTRAINT customers_phone_per_tenant UNIQUE NULLS NOT DISTINCT (tenant_id, phone)
);

CREATE INDEX customers_tenant_idx
  ON public.customers (tenant_id)
  WHERE is_active = true;

CREATE INDEX customers_phone_idx
  ON public.customers (tenant_id, phone)
  WHERE phone IS NOT NULL;

-- Full-text search on name + phone (POS customer lookup)
CREATE INDEX customers_fts_idx
  ON public.customers
  USING GIN (
    to_tsvector('simple',
      unaccent(coalesce(full_name, '')) || ' ' || coalesce(phone, '')
    )
  );

CREATE INDEX customers_name_trgm_idx
  ON public.customers
  USING GIN (full_name gin_trgm_ops);

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY customers_select ON public.customers
  FOR SELECT
  USING (tenant_id = public.current_tenant());

-- All POS-facing roles can create customers (cashier adds new customer at checkout).
CREATE POLICY customers_insert ON public.customers
  FOR INSERT
  WITH CHECK (
    tenant_id = public.current_tenant()
    AND public.has_role('owner', 'manager', 'cashier')
  );

CREATE POLICY customers_update ON public.customers
  FOR UPDATE
  USING (tenant_id = public.current_tenant())
  WITH CHECK (
    tenant_id = public.current_tenant()
    AND public.has_role('owner', 'manager', 'cashier')
  );

COMMENT ON TABLE public.customers IS
  'Optional customer profile. Walk-in sales use customer_id = NULL. '
  'Phone is primary identifier. Email optional. '
  'UNIQUE (tenant_id, phone) NULLS NOT DISTINCT prevents duplicate phone registrations.';
