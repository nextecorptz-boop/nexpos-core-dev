-- =============================================================================
-- MIGRATION 016: Fix POS RPC Integrity
-- Reason: Formalize fixes for generate_ulid and complete_sale that were omitted
-- from historical migrations to avoid schema drift.
-- Fixes:
-- 1. generate_ulid: Prefix gen_random_bytes with extensions schema.
-- 2. complete_sale: Fix jsonb_array_elements loop alias parsing error.
-- =============================================================================

-- Fix 1: generate_ulid
CREATE OR REPLACE FUNCTION public.generate_ulid()
  RETURNS public.ulid
  LANGUAGE plpgsql
  VOLATILE
  SET search_path = ''
AS $$
DECLARE
  v_timestamp   bigint;
  v_random      bytea;
  v_chars       text  := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_result      text  := '';
  v_byte        int;
  v_timestamp_r bigint;
  i             int;
BEGIN
  -- 48-bit millisecond timestamp
  v_timestamp := (extract(epoch from clock_timestamp()) * 1000)::bigint;

  -- Encode timestamp (10 chars)
  v_timestamp_r := v_timestamp;
  FOR i IN 1..10 LOOP
    v_result := substr(v_chars, (v_timestamp_r % 32)::int + 1, 1) || v_result;
    v_timestamp_r := v_timestamp_r / 32;
  END LOOP;

  -- 80 bits of randomness (16 chars)
  v_random := extensions.gen_random_bytes(10);
  FOR i IN 0..9 LOOP
    -- Extract each byte, use modulo 32 for character selection
    v_byte := get_byte(v_random, i);
    v_result := v_result || substr(v_chars, (v_byte % 32) + 1, 1);
    -- Use high bits too for second character from each byte
    IF i < 6 THEN  -- 16 chars total from 10 bytes
      v_result := v_result || substr(v_chars, (v_byte / 8 % 32) + 1, 1);
    END IF;
  END LOOP;

  RETURN substr(v_result, 1, 26);
END;
$$;


-- Fix 2: complete_sale
CREATE OR REPLACE FUNCTION public.complete_sale(p_input jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  -- Auth context
  v_tenant_id       public.ulid;
  v_actor_id        uuid;

  -- Input extraction
  v_client_id       public.ulid;
  v_branch_id       public.ulid;
  v_customer_id     public.ulid;
  v_payment_method  text;
  v_payment_meta    jsonb;
  v_order_discount  numeric(14,2);
  v_lines           jsonb;

  -- Computed values
  v_sale_id         public.ulid;
  v_receipt_number  text;
  v_branch_code     text;
  v_vat_rate        numeric(5,4);
  v_subtotal        numeric(14,2) := 0;
  v_vat_amount      numeric(14,2);
  v_total           numeric(14,2);

  -- Loop vars
  v_line            jsonb;
  v_line_id         public.ulid;
  v_variant_id      public.ulid;
  v_quantity        integer;
  v_unit_price      numeric(14,2);
  v_unit_cost       numeric(14,2);
  v_line_discount   numeric(14,2);
  v_line_total      numeric(14,2);
  v_current_stock   integer;
  v_movement_id     public.ulid;
BEGIN

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 1: AUTH VALIDATION
  -- ─────────────────────────────────────────────────────────────────────────

  v_tenant_id := public.current_tenant();
  v_actor_id  := public.current_user_id();

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'complete_sale: unauthenticated'
      USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_role('owner', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'complete_sale: role % cannot create sales', public.current_role()
      USING ERRCODE = '42501';
  END IF;


  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 2: INPUT EXTRACTION AND VALIDATION
  -- ─────────────────────────────────────────────────────────────────────────

  v_client_id      := (p_input ->> 'client_id')::public.ulid;
  v_branch_id      := (p_input ->> 'branch_id')::public.ulid;
  v_customer_id    := NULLIF(p_input ->> 'customer_id', '')::public.ulid;
  v_payment_method := p_input ->> 'payment_method';
  v_payment_meta   := COALESCE(p_input -> 'payment_meta', '{}'::jsonb);
  v_order_discount := COALESCE((p_input ->> 'discount_amount')::numeric(14,2), 0);
  v_lines          := p_input -> 'lines';

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'complete_sale: client_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'complete_sale: branch_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF v_lines IS NULL OR jsonb_array_length(v_lines) = 0 THEN
    RAISE EXCEPTION 'complete_sale: at least one line item is required'
      USING ERRCODE = '22023';
  END IF;

  IF v_payment_method NOT IN ('cash','card','mpesa','airtel_money','tigo_pesa','credit','mixed') THEN
    RAISE EXCEPTION 'complete_sale: invalid payment_method %', v_payment_method
      USING ERRCODE = '22023';
  END IF;

  IF v_order_discount < 0 THEN
    RAISE EXCEPTION 'complete_sale: discount_amount cannot be negative'
      USING ERRCODE = '22023';
  END IF;


  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 3: IDEMPOTENCY CHECK
  -- ─────────────────────────────────────────────────────────────────────────

  IF EXISTS (
    SELECT 1 FROM public.sales
    WHERE tenant_id = v_tenant_id AND client_id = v_client_id
  ) THEN
    RETURN (
      SELECT jsonb_build_object(
        'sale_id',        id,
        'receipt_number', receipt_number,
        'total',          total,
        'status',         status,
        'completed_at',   completed_at,
        'replayed',       true
      )
      FROM public.sales
      WHERE tenant_id = v_tenant_id AND client_id = v_client_id
    );
  END IF;


  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 4: BRANCH AND TENANT VALIDATION
  -- ─────────────────────────────────────────────────────────────────────────

  SELECT code INTO v_branch_code
  FROM public.branches
  WHERE id = v_branch_id AND tenant_id = v_tenant_id AND is_active = true;

  IF v_branch_code IS NULL THEN
    RAISE EXCEPTION 'complete_sale: branch % not found or inactive', v_branch_id
      USING ERRCODE = '23503';
  END IF;

  -- Cashiers can only sell in their assigned branch
  IF public.current_role() = 'cashier' AND public.current_branch() != v_branch_id THEN
    RAISE EXCEPTION 'complete_sale: cashier not assigned to branch %', v_branch_id
      USING ERRCODE = '42501';
  END IF;

  -- Validate customer belongs to this tenant
  IF v_customer_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.customers
      WHERE id = v_customer_id AND tenant_id = v_tenant_id
    ) THEN
      RAISE EXCEPTION 'complete_sale: customer % not found in tenant', v_customer_id
        USING ERRCODE = '23503';
    END IF;
  END IF;

  SELECT vat_rate INTO v_vat_rate
  FROM public.tenants
  WHERE id = v_tenant_id;


  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 5: STOCK VALIDATION AND LOCKING
  -- ─────────────────────────────────────────────────────────────────────────

  FOR v_line IN
    SELECT value
    FROM jsonb_array_elements(v_lines)
    ORDER BY value ->> 'variant_id'
  LOOP
    v_variant_id  := (v_line ->> 'variant_id')::public.ulid;
    v_quantity    := (v_line ->> 'quantity')::integer;
    v_unit_price  := (v_line ->> 'unit_price')::numeric(14,2);
    v_line_discount := COALESCE((v_line ->> 'line_discount')::numeric(14,2), 0);

    IF v_variant_id IS NULL THEN
      RAISE EXCEPTION 'complete_sale: line missing variant_id'
        USING ERRCODE = '22023';
    END IF;

    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'complete_sale: variant % quantity must be > 0', v_variant_id
        USING ERRCODE = '22023';
    END IF;

    IF v_unit_price IS NULL OR v_unit_price < 0 THEN
      RAISE EXCEPTION 'complete_sale: variant % unit_price must be >= 0', v_variant_id
        USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.product_variants
      WHERE id = v_variant_id AND tenant_id = v_tenant_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'complete_sale: variant % not found in tenant or inactive', v_variant_id
        USING ERRCODE = '23503';
    END IF;

    SELECT on_hand INTO v_current_stock
    FROM public.stock_levels
    WHERE branch_id = v_branch_id AND variant_id = v_variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_current_stock := 0;
    END IF;

    IF v_current_stock < v_quantity THEN
      RAISE EXCEPTION
        'complete_sale: insufficient stock for variant %. available=%, requested=%',
        v_variant_id, v_current_stock, v_quantity
        USING ERRCODE = '55000';
    END IF;
  END LOOP;


  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 6: GENERATE IDS AND RECEIPT NUMBER
  -- ─────────────────────────────────────────────────────────────────────────

  v_sale_id := public.generate_ulid();

  v_receipt_number := upper(v_branch_code)
    || '-' || to_char(now(), 'YYYYMMDD')
    || '-' || lpad(nextval('public.receipt_seq')::text, 6, '0');


  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 7: COMPUTE SERVER-SIDE TOTALS
  -- ─────────────────────────────────────────────────────────────────────────

  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
    v_unit_price    := (v_line ->> 'unit_price')::numeric(14,2);
    v_quantity      := (v_line ->> 'quantity')::integer;
    v_line_discount := COALESCE((v_line ->> 'line_discount')::numeric(14,2), 0);

    v_line_total := (v_unit_price * v_quantity) - v_line_discount;
    v_subtotal   := v_subtotal + v_line_total;
  END LOOP;

  v_vat_amount := round(GREATEST(0, v_subtotal - v_order_discount) * v_vat_rate, 2);
  v_total      := GREATEST(0, v_subtotal - v_order_discount) + v_vat_amount;

  IF v_total < 0 THEN
    RAISE EXCEPTION 'complete_sale: computed total is negative'
      USING ERRCODE = '22023';
  END IF;


  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 8: INSERT SALE HEADER
  -- ─────────────────────────────────────────────────────────────────────────

  INSERT INTO public.sales (
    id, tenant_id, branch_id, cashier_id, customer_id,
    receipt_number, status,
    subtotal, vat_amount, discount_amount, total,
    payment_method, payment_meta,
    client_id, completed_at
  ) VALUES (
    v_sale_id, v_tenant_id, v_branch_id, v_actor_id, v_customer_id,
    v_receipt_number, 'completed',
    v_subtotal, v_vat_amount, v_order_discount, v_total,
    v_payment_method, v_payment_meta,
    v_client_id, now()
  );


  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 9: INSERT SALE LINES, DECREMENT STOCK, CREATE MOVEMENTS
  -- ─────────────────────────────────────────────────────────────────────────

  FOR v_line IN
    SELECT value
    FROM jsonb_array_elements(v_lines)
    ORDER BY value ->> 'variant_id'
  LOOP
    v_variant_id    := (v_line ->> 'variant_id')::public.ulid;
    v_quantity      := (v_line ->> 'quantity')::integer;
    v_unit_price    := (v_line ->> 'unit_price')::numeric(14,2);
    v_line_discount := COALESCE((v_line ->> 'line_discount')::numeric(14,2), 0);
    v_line_total    := (v_unit_price * v_quantity) - v_line_discount;

    v_line_id     := public.generate_ulid();
    v_movement_id := public.generate_ulid();

    SELECT cost_price INTO v_unit_cost
    FROM public.product_variants
    WHERE id = v_variant_id;

    INSERT INTO public.sale_lines (
      id, sale_id, tenant_id, variant_id,
      quantity, unit_price, unit_cost, line_discount, line_total
    ) VALUES (
      v_line_id, v_sale_id, v_tenant_id, v_variant_id,
      v_quantity, v_unit_price, v_unit_cost, v_line_discount, v_line_total
    );

    UPDATE public.stock_levels
      SET on_hand    = on_hand - v_quantity,
          updated_at = now()
    WHERE branch_id = v_branch_id AND variant_id = v_variant_id;

    INSERT INTO public.stock_movements (
      id, tenant_id, branch_id, variant_id,
      delta, reason, reference_type, reference_id, actor_id
    ) VALUES (
      v_movement_id, v_tenant_id, v_branch_id, v_variant_id,
      -v_quantity, 'sale', 'sale', v_sale_id, v_actor_id
    );

  END LOOP;


  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 10: AUDIT LOG
  -- ─────────────────────────────────────────────────────────────────────────

  PERFORM public.write_audit_log(
    p_tenant_id   := v_tenant_id,
    p_actor_id    := v_actor_id,
    p_action      := 'sale.completed',
    p_entity_type := 'sale',
    p_entity_id   := v_sale_id::text,
    p_metadata    := jsonb_build_object(
      'receipt_number',  v_receipt_number,
      'total',           v_total,
      'payment_method',  v_payment_method,
      'line_count',      jsonb_array_length(v_lines),
      'branch_id',       v_branch_id
    )
  );

  RETURN jsonb_build_object(
    'sale_id',        v_sale_id,
    'receipt_number', v_receipt_number,
    'subtotal',       v_subtotal,
    'vat_amount',     v_vat_amount,
    'discount_amount',v_order_discount,
    'total',          v_total,
    'status',         'completed',
    'completed_at',   now(),
    'replayed',       false
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'complete_sale failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;
