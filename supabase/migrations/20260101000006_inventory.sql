-- =============================================================================
-- MIGRATION 006: Inventory
-- Run order: AFTER 005
-- Rollback: DROP TABLE IF EXISTS public.stock_movements CASCADE;
--           DROP TABLE IF EXISTS public.stock_levels CASCADE;
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STOCK LEVELS
-- Current on-hand quantity per (branch, variant). This is the live number.
-- Modified exclusively by the adjust_stock() SECURITY DEFINER function
-- and the complete_sale() RPC — never by direct client UPDATE.
--
-- Primary key: (branch_id, variant_id)
-- Do NOT use a surrogate ID — the composite PK enables FOR UPDATE SKIP LOCKED
-- locking on exactly the rows we care about in concurrent sale processing.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.stock_levels (
  tenant_id     public.ulid   NOT NULL,
  branch_id     public.ulid   NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  variant_id    public.ulid   NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  on_hand       integer       NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reorder_point integer       NOT NULL DEFAULT 0 CHECK (reorder_point >= 0),
  updated_at    timestamptz   NOT NULL DEFAULT now(),

  PRIMARY KEY (branch_id, variant_id)
);

-- Tenant-scoped lookup for RLS and inventory reports
CREATE INDEX stock_levels_tenant_idx
  ON public.stock_levels (tenant_id);

-- Variant lookup across all branches (for stock-check feature)
CREATE INDEX stock_levels_variant_idx
  ON public.stock_levels (tenant_id, variant_id);

-- Low-stock alert query: WHERE on_hand <= reorder_point
CREATE INDEX stock_levels_low_stock_idx
  ON public.stock_levels (tenant_id, branch_id)
  WHERE on_hand <= reorder_point AND reorder_point > 0;

ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;

-- All roles can read stock (cashiers need it for availability display).
CREATE POLICY stock_levels_select ON public.stock_levels
  FOR SELECT
  USING (tenant_id = public.current_tenant());

-- Direct INSERT allowed for managers creating initial stock records.
-- Updates go through the adjust_stock() function (SECURITY DEFINER).
CREATE POLICY stock_levels_insert ON public.stock_levels
  FOR INSERT
  WITH CHECK (
    tenant_id = public.current_tenant()
    AND public.has_role('owner', 'manager')
  );

-- No direct UPDATE policy. All stock changes go through
-- the adjust_stock() SECURITY DEFINER function, which enforces
-- atomicity and always creates a corresponding stock_movement record.
-- Direct client updates to on_hand are blocked by design.

COMMENT ON TABLE public.stock_levels IS
  'Live on-hand quantity per (branch, variant). '
  'Never update on_hand directly — use adjust_stock() function. '
  'on_hand >= 0 enforced by CHECK constraint. '
  'Composite PK enables row-level locking in complete_sale().';

COMMENT ON COLUMN public.stock_levels.on_hand IS
  'Current quantity on hand. Never goes below 0 (CHECK constraint). '
  'Modified only by adjust_stock() and complete_sale() RPCs.';


-- ─────────────────────────────────────────────────────────────────────────────
-- STOCK MOVEMENTS
-- Immutable audit trail of every stock change.
-- One row per change. on_hand in stock_levels is the running sum.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.stock_movements (
  id              public.ulid   PRIMARY KEY,
  tenant_id       public.ulid   NOT NULL,
  branch_id       public.ulid   NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  variant_id      public.ulid   NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  delta           integer       NOT NULL,
  -- delta > 0 = stock in (restock, refund, adjustment up, count correction)
  -- delta < 0 = stock out (sale, damage, transfer out, count correction down)
  -- delta = 0 is explicitly rejected below

  reason          text          NOT NULL
                                CHECK (reason IN (
                                  'sale',
                                  'refund',
                                  'restock',
                                  'adjustment',
                                  'transfer_in',
                                  'transfer_out',
                                  'damage',
                                  'count_correction'
                                )),
  reference_type  text          CHECK (reference_type IN ('sale', 'manual')),
  reference_id    public.ulid,
  note            text,
  actor_id        uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT stock_movements_delta_nonzero CHECK (delta != 0)
);

-- Time-ordered movement history per branch (most common query)
CREATE INDEX stock_movements_branch_time_idx
  ON public.stock_movements (tenant_id, branch_id, created_at DESC);

-- Variant movement history (all branches)
CREATE INDEX stock_movements_variant_time_idx
  ON public.stock_movements (tenant_id, variant_id, created_at DESC);

-- Reference lookup (find movements linked to a specific sale)
CREATE INDEX stock_movements_reference_idx
  ON public.stock_movements (reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- Reason-based reporting (e.g. all damage movements)
CREATE INDEX stock_movements_reason_idx
  ON public.stock_movements (tenant_id, reason, created_at DESC);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- All roles read movement history.
CREATE POLICY stock_movements_select ON public.stock_movements
  FOR SELECT
  USING (tenant_id = public.current_tenant());

-- No direct INSERT policy.
-- All inserts happen via adjust_stock() and complete_sale() SECURITY DEFINER functions.
-- This enforces that every stock change has a corresponding stock_levels update.

COMMENT ON TABLE public.stock_movements IS
  'Immutable audit trail. One row per stock change. '
  'Never insert directly — use adjust_stock() or complete_sale(). '
  'delta > 0 = inflow, delta < 0 = outflow. delta = 0 rejected by CHECK.';


-- ─────────────────────────────────────────────────────────────────────────────
-- ADJUST STOCK — SECURITY DEFINER
-- The ONLY path for manual stock adjustments (restock, damage, corrections).
-- Used by managers. NOT used for sales (complete_sale handles those).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_branch_id     public.ulid,
  p_variant_id    public.ulid,
  p_delta         integer,
  p_reason        text,
  p_note          text DEFAULT NULL,
  p_movement_id   public.ulid DEFAULT NULL  -- client-generated ULID for idempotency
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_tenant_id     public.ulid;
  v_actor_id      uuid;
  v_movement_id   public.ulid;
  v_current_stock integer;
  v_new_on_hand   integer;
  v_actual_delta  integer;
BEGIN
  -- Auth checks
  v_tenant_id := public.current_tenant();
  v_actor_id  := public.current_user_id();

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'adjust_stock: unauthenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_role('owner', 'manager') THEN
    RAISE EXCEPTION 'adjust_stock: requires owner or manager role' USING ERRCODE = '42501';
  END IF;

  IF p_delta = 0 THEN
    RAISE EXCEPTION 'adjust_stock: delta cannot be zero' USING ERRCODE = '22023';
  END IF;

  -- Validate reason
  IF p_reason NOT IN ('restock','adjustment','transfer_in','transfer_out','damage','count_correction') THEN
    RAISE EXCEPTION 'adjust_stock: invalid reason %', p_reason USING ERRCODE = '22023';
  END IF;

  -- Verify branch belongs to tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.branches
    WHERE id = p_branch_id AND tenant_id = v_tenant_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'adjust_stock: branch % not found in tenant', p_branch_id
      USING ERRCODE = '23503';
  END IF;

  -- Verify variant belongs to tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.product_variants
    WHERE id = p_variant_id AND tenant_id = v_tenant_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'adjust_stock: variant % not found in tenant', p_variant_id
      USING ERRCODE = '23503';
  END IF;

  -- Idempotency: if movement_id already exists, return the existing result
  v_movement_id := COALESCE(p_movement_id, public.generate_ulid());

  IF EXISTS (SELECT 1 FROM public.stock_movements WHERE id = v_movement_id) THEN
    -- Idempotency: movement already exists. Return a marker.
    -- NOTE: We cannot safely return the original 'on_hand' as it may have changed again since.
    -- The client should receive the 'replayed' flag and re-fetch current state if needed.
    RETURN jsonb_build_object(
      'movement_id', v_movement_id,
      'replayed', true
    );
  END IF;

  -- Ensure row exists safely for concurrent transactions
  INSERT INTO public.stock_levels (tenant_id, branch_id, variant_id, on_hand, updated_at)
  VALUES (v_tenant_id, p_branch_id, p_variant_id, 0, now())
  ON CONFLICT (branch_id, variant_id) DO NOTHING;

  -- Lock the row and read current stock
  SELECT on_hand INTO v_current_stock
  FROM public.stock_levels
  WHERE branch_id = p_branch_id AND variant_id = p_variant_id
  FOR UPDATE;

  -- Calculate true bounded stock and the actual delta applied
  v_new_on_hand  := GREATEST(0, v_current_stock + p_delta);
  v_actual_delta := v_new_on_hand - v_current_stock;

  IF v_actual_delta = 0 AND p_delta != 0 THEN
    RAISE EXCEPTION 'adjust_stock: cannot reduce stock below zero (current stock: %)', v_current_stock USING ERRCODE = '22023';
  END IF;

  -- Update the stock level with the exact calculated value
  UPDATE public.stock_levels
  SET on_hand = v_new_on_hand,
      updated_at = now()
  WHERE branch_id = p_branch_id AND variant_id = p_variant_id;

  -- Record the movement using the actual delta
  INSERT INTO public.stock_movements (
    id, tenant_id, branch_id, variant_id,
    delta, reason, reference_type, note, actor_id
  ) VALUES (
    v_movement_id, v_tenant_id, p_branch_id, p_variant_id,
    v_actual_delta, p_reason, 'manual', p_note, v_actor_id
  );

  RETURN jsonb_build_object(
    'movement_id', v_movement_id,
    'on_hand',     v_new_on_hand,
    'delta',       v_actual_delta,
    'replayed',    false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_stock TO authenticated;

COMMENT ON FUNCTION public.adjust_stock IS
  'SECURITY DEFINER: atomic stock adjustment. '
  'Requires owner or manager role. Idempotent via p_movement_id. '
  'Always creates a stock_movements record. '
  'Use for: restock, damage write-offs, count corrections, transfers. '
  'NOT for sales — use complete_sale() instead.';
