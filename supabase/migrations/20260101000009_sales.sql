-- =============================================================================
-- MIGRATION 008: Sales and Sale Lines
-- Run order: AFTER 007
-- Rollback: DROP TABLE IF EXISTS public.sale_lines CASCADE;
--           DROP TABLE IF EXISTS public.sales CASCADE;
--           DROP SEQUENCE IF EXISTS public.receipt_seq CASCADE;
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- RECEIPT NUMBER SEQUENCE
-- One sequence per tenant is ideal but Postgres sequences are non-transactional —
-- gaps are expected and acceptable (voided session, server restart).
-- We use a global sequence prefixed with branch code for human readability.
-- Format: {BRANCH_CODE}-{DATE}-{SEQUENCE} e.g. "DAR-20260526-000042"
-- Generated inside complete_sale() SECURITY DEFINER — clients never call this directly.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.receipt_seq
  START 1
  INCREMENT 1
  NO CYCLE;

COMMENT ON SEQUENCE public.receipt_seq IS
  'Global receipt number sequence. Gaps are normal and acceptable. '
  'Used only inside complete_sale() — never called directly by clients.';


-- ─────────────────────────────────────────────────────────────────────────────
-- SALES
-- One row per completed transaction. Immutable after creation.
-- Voids and refunds create new rows with status='voided'/'refunded' and
-- reference the original via payment_meta.original_sale_id.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.sales (
  id              public.ulid   PRIMARY KEY,
  tenant_id       public.ulid   NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id       public.ulid   NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  cashier_id      uuid          NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  customer_id     public.ulid   REFERENCES public.customers(id) ON DELETE SET NULL,

  receipt_number  text          NOT NULL,
  status          text          NOT NULL DEFAULT 'completed'
                                CHECK (status IN ('completed', 'voided', 'refunded', 'partial_refund')),

  -- All monetary values stored as exact decimals. NO floats. NO integers.
  -- TZS has no sub-unit (no cents), but numeric(14,2) keeps future flexibility.
  subtotal        numeric(14,2) NOT NULL CHECK (subtotal >= 0),
  vat_amount      numeric(14,2) NOT NULL CHECK (vat_amount >= 0),
  discount_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total           numeric(14,2) NOT NULL CHECK (total >= 0),

  payment_method  text          NOT NULL
                                CHECK (payment_method IN (
                                  'cash', 'card', 'mpesa', 'airtel_money',
                                  'tigo_pesa', 'credit', 'mixed'
                                )),

  -- Payment provider response, change given, original_sale_id for voids, etc.
  -- Schema documented in TypeScript: SalePaymentMeta interface.
  payment_meta    jsonb         NOT NULL DEFAULT '{}'::jsonb,

  -- Client-generated ULID. Idempotency key. Prevents double-submit on retry.
  -- If client crashes after submit but before receiving response,
  -- it retries with the same client_id and gets the original sale back.
  client_id       public.ulid   NOT NULL,

  completed_at    timestamptz   NOT NULL DEFAULT now(),
  voided_at       timestamptz,

  CONSTRAINT sales_client_id_per_tenant UNIQUE (tenant_id, client_id),
  CONSTRAINT sales_receipt_per_branch   UNIQUE (tenant_id, branch_id, receipt_number),

  -- Voided sales must have voided_at set
  CONSTRAINT sales_void_consistency
    CHECK (status != 'voided' OR voided_at IS NOT NULL),

  -- Mathematical integrity: total = subtotal + vat - discount
  CONSTRAINT sales_total_integrity
    CHECK (
      abs(total - (subtotal + vat_amount - discount_amount)) < 0.01
    )
);

-- Primary dashboard query: tenant sales ordered by time
CREATE INDEX sales_tenant_time_idx
  ON public.sales (tenant_id, completed_at DESC);

-- Branch-level reporting
CREATE INDEX sales_branch_time_idx
  ON public.sales (tenant_id, branch_id, completed_at DESC);

-- Cashier performance reports
CREATE INDEX sales_cashier_time_idx
  ON public.sales (cashier_id, completed_at DESC);

-- Customer purchase history
CREATE INDEX sales_customer_time_idx
  ON public.sales (customer_id, completed_at DESC)
  WHERE customer_id IS NOT NULL;

-- Active (non-voided) sales only — used by KPI queries
CREATE INDEX sales_tenant_completed_idx
  ON public.sales (tenant_id, completed_at DESC)
  WHERE status = 'completed';

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Read: all roles in tenant
CREATE POLICY sales_select ON public.sales
  FOR SELECT
  USING (tenant_id = public.current_tenant());

-- No direct INSERT policy. All inserts go through complete_sale() SECURITY DEFINER.
-- This enforces atomicity: no sale without corresponding sale_lines and stock_movements.

-- No UPDATE policy. Sales are immutable.
-- Voids use complete_void_sale() which creates a new row.

COMMENT ON TABLE public.sales IS
  'Immutable transaction records. No direct INSERT or UPDATE from clients. '
  'Use complete_sale() for new transactions. '
  'Voids and refunds create new rows, never mutate existing ones. '
  'client_id is the idempotency key — safe to retry with same client_id.';

COMMENT ON COLUMN public.sales.client_id IS
  'Client-generated ULID. Idempotency key for the complete_sale() RPC. '
  'If the client retries after a network failure, same client_id returns the original sale.';

COMMENT ON COLUMN public.sales.payment_meta IS
  'Unstructured payment context. For cash: {cash_tendered, change_given}. '
  'For M-Pesa: {transaction_id, phone_number, timestamp}. '
  'For voids: {original_sale_id, void_reason, authorized_by}.';


-- ─────────────────────────────────────────────────────────────────────────────
-- SALE LINES
-- One row per variant in a sale. Immutable after creation.
-- unit_cost is snapshotted from product_variants.cost_price at time of sale.
-- This is critical: changing a product's cost_price must NOT affect past gross profit.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.sale_lines (
  id              public.ulid   PRIMARY KEY,
  sale_id         public.ulid   NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  tenant_id       public.ulid   NOT NULL,
  -- tenant_id denormalized for RLS performance (avoids JOIN to sales)

  variant_id      public.ulid   NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity        integer       NOT NULL CHECK (quantity > 0),
  unit_price      numeric(14,2) NOT NULL CHECK (unit_price >= 0),
  unit_cost       numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  -- unit_cost is SNAPSHOTTED from product_variants.cost_price at time of sale.
  -- Never updated retroactively.
  line_discount   numeric(14,2) NOT NULL DEFAULT 0 CHECK (line_discount >= 0),
  line_total      numeric(14,2) NOT NULL CHECK (line_total >= 0),

  -- Mathematical integrity
  CONSTRAINT sale_lines_total_integrity
    CHECK (
      abs(line_total - (unit_price * quantity - line_discount)) < 0.01
    )
);

-- Primary lookup: all lines for a sale (JOIN in receipt rendering)
CREATE INDEX sale_lines_sale_idx
  ON public.sale_lines (sale_id);

-- Product performance reports: which variants sell most
CREATE INDEX sale_lines_variant_time_idx
  ON public.sale_lines (tenant_id, variant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- DENORMALIZATION ENFORCEMENT
-- Ensures sale_lines.tenant_id always matches its parent sale's tenant_id.
-- Runs on INSERT and UPDATE. Prevents data cross-contamination from a bug.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_sale_line_tenant()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_sale_tenant public.ulid;
BEGIN
  SELECT tenant_id INTO v_sale_tenant
  FROM public.sales
  WHERE id = NEW.sale_id;

  IF v_sale_tenant IS NULL THEN
    RAISE EXCEPTION 'sale % does not exist', NEW.sale_id;
  END IF;

  IF NEW.tenant_id != v_sale_tenant THEN
    RAISE EXCEPTION
      'sale_line tenant_id % does not match sale tenant_id %',
      NEW.tenant_id, v_sale_tenant;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sale_lines_enforce_tenant
  BEFORE INSERT OR UPDATE OF sale_id, tenant_id ON public.sale_lines
  FOR EACH ROW EXECUTE FUNCTION public.enforce_sale_line_tenant();

ALTER TABLE public.sale_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY sale_lines_select ON public.sale_lines
  FOR SELECT
  USING (tenant_id = public.current_tenant());

-- No direct INSERT policy. All inserts via complete_sale() SECURITY DEFINER.

COMMENT ON TABLE public.sale_lines IS
  'Immutable. One row per variant per sale. '
  'unit_cost is snapshotted — never reflects future price changes. '
  'No direct INSERT from clients. Use complete_sale().';
