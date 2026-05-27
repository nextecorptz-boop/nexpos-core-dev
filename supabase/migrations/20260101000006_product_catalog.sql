-- =============================================================================
-- MIGRATION 005: Product Catalog
-- Run order: AFTER 004
-- Rollback: DROP TABLE IF EXISTS public.product_variants CASCADE;
--           DROP TABLE IF EXISTS public.product_families CASCADE;
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PRODUCT FAMILIES
-- The "parent" product. E.g. "Nike Air Force 1 - White".
-- A family has many variants (sizes, colors).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.product_families (
  id          public.ulid   PRIMARY KEY,
  tenant_id   public.ulid   NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  name        text          NOT NULL CHECK (length(trim(name)) > 0),
  brand       text,
  category    text,
  description text,
  -- Flexible attributes per category: {"gender": "unisex", "material": "leather"}
  -- RULE: Never store queryable business data in attributes.
  -- If you filter/aggregate by it, it becomes a column.
  attributes  jsonb         NOT NULL DEFAULT '{}'::jsonb,
  is_active   boolean       NOT NULL DEFAULT true,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now()
);

-- Tenant-scoped active catalog lookup
CREATE INDEX product_families_tenant_active_idx
  ON public.product_families (tenant_id)
  WHERE is_active = true;

-- Category filtering (sidebar/POS category bar)
CREATE INDEX product_families_tenant_category_idx
  ON public.product_families (tenant_id, category)
  WHERE is_active = true;

-- Full-text search: name + brand (POS search bar)
-- unaccent() handles accented characters in Swahili product names
CREATE INDEX product_families_fts_idx
  ON public.product_families
  USING GIN (
    to_tsvector('simple',
      public.f_unaccent(coalesce(name, '')) || ' ' || public.f_unaccent(coalesce(brand, ''))
    )
  );

-- Trigram index for fast ILIKE search (partial string matching)
CREATE INDEX product_families_name_trgm_idx
  ON public.product_families
  USING GIN (name extensions.gin_trgm_ops);

CREATE TRIGGER product_families_updated_at
  BEFORE UPDATE ON public.product_families
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.product_families ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_families_select ON public.product_families
  FOR SELECT
  USING (tenant_id = public.current_tenant() AND is_active = true);

-- Owners and managers see inactive products too (for catalog management)
CREATE POLICY product_families_select_all ON public.product_families
  FOR SELECT
  USING (
    tenant_id = public.current_tenant()
    AND public.has_role('owner', 'manager')
  );

CREATE POLICY product_families_insert ON public.product_families
  FOR INSERT
  WITH CHECK (
    tenant_id = public.current_tenant()
    AND public.has_role('owner', 'manager')
  );

CREATE POLICY product_families_update ON public.product_families
  FOR UPDATE
  USING (tenant_id = public.current_tenant())
  WITH CHECK (
    tenant_id = public.current_tenant()
    AND public.has_role('owner', 'manager')
  );

COMMENT ON TABLE public.product_families IS
  'Parent product grouping. Variants hang off families. '
  'Soft-delete via is_active=false. Never hard-delete if sales exist.';


-- ─────────────────────────────────────────────────────────────────────────────
-- PRODUCT VARIANTS
-- The sellable unit. E.g. "Nike Air Force 1 - White - Size 42".
-- tenant_id is DENORMALIZED here for RLS performance.
-- Without it, every RLS check joins back to product_families — expensive.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.product_variants (
  id          public.ulid   PRIMARY KEY,
  family_id   public.ulid   NOT NULL REFERENCES public.product_families(id) ON DELETE RESTRICT,
  tenant_id   public.ulid   NOT NULL,
  -- tenant_id denormalized. Enforced by trigger below.

  sku         text          NOT NULL CHECK (length(trim(sku)) > 0),
  size        text,
  color       text,
  barcode     text,
  cost_price  numeric(14,2) NOT NULL DEFAULT 0
                            CHECK (cost_price >= 0),
  sell_price  numeric(14,2) NOT NULL
                            CHECK (sell_price >= 0),
  is_active   boolean       NOT NULL DEFAULT true,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT variants_sku_per_tenant UNIQUE (tenant_id, sku)
);

CREATE INDEX product_variants_family_idx
  ON public.product_variants (family_id);

CREATE INDEX product_variants_tenant_active_idx
  ON public.product_variants (tenant_id)
  WHERE is_active = true;

CREATE INDEX product_variants_barcode_idx
  ON public.product_variants (tenant_id, barcode)
  WHERE barcode IS NOT NULL AND is_active = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- DENORMALIZATION ENFORCEMENT
-- Ensures product_variants.tenant_id always matches its parent family's tenant_id.
-- Runs on INSERT and UPDATE. Prevents data cross-contamination from a bug.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_variant_tenant()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_family_tenant public.ulid;
BEGIN
  SELECT tenant_id INTO v_family_tenant
  FROM public.product_families
  WHERE id = NEW.family_id;

  IF v_family_tenant IS NULL THEN
    RAISE EXCEPTION 'product_family % does not exist', NEW.family_id;
  END IF;

  IF NEW.tenant_id != v_family_tenant THEN
    RAISE EXCEPTION
      'variant tenant_id % does not match family tenant_id %',
      NEW.tenant_id, v_family_tenant;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER product_variants_enforce_tenant
  BEFORE INSERT OR UPDATE OF family_id, tenant_id ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_variant_tenant();

CREATE TRIGGER product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Cashiers see only active variants; managers see all.
CREATE POLICY product_variants_select_active ON public.product_variants
  FOR SELECT
  USING (tenant_id = public.current_tenant() AND is_active = true);

CREATE POLICY product_variants_select_all ON public.product_variants
  FOR SELECT
  USING (
    tenant_id = public.current_tenant()
    AND public.has_role('owner', 'manager')
  );

CREATE POLICY product_variants_insert ON public.product_variants
  FOR INSERT
  WITH CHECK (
    tenant_id = public.current_tenant()
    AND public.has_role('owner', 'manager')
  );

CREATE POLICY product_variants_update ON public.product_variants
  FOR UPDATE
  USING (tenant_id = public.current_tenant())
  WITH CHECK (
    tenant_id = public.current_tenant()
    AND public.has_role('owner', 'manager')
  );

COMMENT ON TABLE public.product_variants IS
  'Sellable unit. SKU must be unique per tenant. '
  'tenant_id denormalized from product_families for RLS performance. '
  'Enforced by enforce_variant_tenant trigger.';

COMMENT ON COLUMN public.product_variants.cost_price IS
  'Snapshot at time of purchase. Used for gross profit calculation. '
  'Changing this does NOT retroactively affect sale_lines.unit_cost.';
