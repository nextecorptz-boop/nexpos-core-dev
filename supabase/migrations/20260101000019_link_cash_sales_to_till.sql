-- =============================================================================
-- MIGRATION 019: Link Cash Sales to Till Sessions (Phase G1.2)
-- Run order: AFTER 018
-- =============================================================================

-- 1. Add till_session_id to sales
ALTER TABLE public.sales
  ADD COLUMN till_session_id public.ulid REFERENCES public.till_sessions(id) ON DELETE RESTRICT;

-- 2. Add useful index
CREATE INDEX IF NOT EXISTS sales_till_session_completed_idx
  ON public.sales (till_session_id, completed_at DESC);

-- 3. Add tenant/branch integrity guard
CREATE OR REPLACE FUNCTION public.enforce_sale_till_match()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_till_tenant public.ulid;
  v_till_branch public.ulid;
BEGIN
  IF NEW.till_session_id IS NOT NULL THEN
    SELECT tenant_id, branch_id INTO v_till_tenant, v_till_branch
    FROM public.till_sessions
    WHERE id = NEW.till_session_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'sale % linked to non-existent till session %', NEW.id, NEW.till_session_id;
    END IF;

    IF NEW.tenant_id != v_till_tenant OR NEW.branch_id != v_till_branch THEN
      RAISE EXCEPTION 'sale tenant_id/branch_id does not match linked till session';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_enforce_till_match ON public.sales;
CREATE TRIGGER sales_enforce_till_match
  BEFORE INSERT OR UPDATE OF till_session_id, tenant_id, branch_id ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.enforce_sale_till_match();

-- 4. Extend close_till_session RPC
CREATE OR REPLACE FUNCTION public.close_till_session(
  p_session_id          public.ulid,
  p_actual_cash_counted numeric(14,2),
  p_close_mode          text,
  p_notes               text
)
  RETURNS public.till_sessions
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_tenant_id     public.ulid;
  v_actor_id      uuid;
  v_role          text;
  v_session       public.till_sessions;
  v_linked_cash   numeric(14,2) := 0;
  v_expected      numeric(14,2);
  v_variance      numeric(14,2);
  v_new_status    text;
BEGIN
  v_tenant_id := public.current_tenant();
  v_actor_id  := public.current_user_id();
  v_role      := public.current_role();

  IF v_tenant_id IS NULL OR v_actor_id IS NULL THEN
    RAISE EXCEPTION 'close_till_session: unauthenticated' USING ERRCODE = '28000';
  END IF;

  IF p_actual_cash_counted IS NULL OR p_actual_cash_counted < 0 THEN
    RAISE EXCEPTION 'close_till_session: actual_cash_counted must be >= 0' USING ERRCODE = '22023';
  END IF;

  IF p_close_mode IS NOT NULL AND p_close_mode NOT IN ('normal', 'blind') THEN
    RAISE EXCEPTION 'close_till_session: invalid close_mode %', p_close_mode USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_session
  FROM public.till_sessions
  WHERE id = p_session_id
    AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'close_till_session: session % not found in tenant', p_session_id
      USING ERRCODE = '23503';
  END IF;

  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'close_till_session: session % is not open (status=%)',
      p_session_id, v_session.status
      USING ERRCODE = '22023';
  END IF;

  IF v_role = 'cashier' AND v_session.cashier_id <> v_actor_id THEN
    RAISE EXCEPTION 'close_till_session: cashier may only close own till session'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(
    CASE 
      WHEN payment_method = 'cash' THEN total
      WHEN payment_method = 'mixed' THEN COALESCE((payment_meta->>'cash_amount')::numeric, 0)
      ELSE 0
    END
  ), 0) INTO v_linked_cash
  FROM public.sales
  WHERE till_session_id = p_session_id AND status = 'completed';

  -- TODO(G1.3): Subtract linked cash refunds from v_linked_cash

  v_expected := v_session.opening_float + v_linked_cash;
  v_variance := p_actual_cash_counted - v_expected;

  IF v_variance = 0 THEN
    v_new_status := 'closed';
  ELSE
    v_new_status := 'disputed';
  END IF;

  UPDATE public.till_sessions
  SET actual_cash_counted = p_actual_cash_counted,
      expected_cash       = v_expected,
      variance            = v_variance,
      status              = v_new_status,
      close_mode          = COALESCE(p_close_mode, 'normal'),
      notes               = p_notes,
      closed_at           = now()
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  PERFORM public.write_audit_log(
    v_tenant_id,
    v_actor_id,
    CASE WHEN v_new_status = 'disputed' THEN 'till.disputed' ELSE 'till.closed' END,
    'till_session',
    v_session.id::text,
    jsonb_build_object(
      'branch_id',           v_session.branch_id,
      'opening_float',       v_session.opening_float,
      'expected_cash',       v_expected,
      'actual_cash_counted', p_actual_cash_counted,
      'variance',            v_variance,
      'close_mode',          COALESCE(p_close_mode, 'normal'),
      'linked_cash_sales',   v_linked_cash
    )
  );

  RETURN v_session;
END;
$$;
GRANT EXECUTE ON FUNCTION public.close_till_session(public.ulid, numeric, text, text) TO authenticated;

-- 5. Add pending_cash_summary RPC
CREATE OR REPLACE FUNCTION public.pending_cash_summary(p_session_id public.ulid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_tenant_id public.ulid;
  v_session   public.till_sessions;
  v_linked_cash_sales numeric(14,2) := 0;
  v_transaction_count integer := 0;
BEGIN
  v_tenant_id := public.current_tenant();

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'pending_cash_summary: unauthenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_session
  FROM public.till_sessions
  WHERE id = p_session_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pending_cash_summary: session not found' USING ERRCODE = '23503';
  END IF;

  IF NOT public.has_role('owner', 'manager') AND v_session.cashier_id != public.current_user_id() THEN
    RAISE EXCEPTION 'pending_cash_summary: forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN payment_method = 'cash' THEN total
        WHEN payment_method = 'mixed' THEN COALESCE((payment_meta->>'cash_amount')::numeric, 0)
        ELSE 0
      END
    ), 0),
    COUNT(*)
  INTO v_linked_cash_sales, v_transaction_count
  FROM public.sales
  WHERE till_session_id = p_session_id AND status = 'completed' AND payment_method IN ('cash', 'mixed');

  RETURN jsonb_build_object(
    'opening_float', v_session.opening_float,
    'cash_sales_total', v_linked_cash_sales,
    'expected_cash', v_session.opening_float + v_linked_cash_sales,
    'transaction_count', v_transaction_count
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.pending_cash_summary(public.ulid) TO authenticated;

-- 6. Extend complete_sale RPC
CREATE OR REPLACE FUNCTION public.complete_sale(p_input jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_tenant_id       public.ulid;
  v_actor_id        uuid;
  v_client_id       public.ulid;
  v_branch_id       public.ulid;
  v_customer_id     public.ulid;
  v_payment_method  text;
  v_payment_meta    jsonb;
  v_order_discount  numeric(14,2);
  v_lines           jsonb;
  v_sale_id         public.ulid;
  v_receipt_number  text;
  v_branch_code     text;
  v_vat_rate        numeric(5,4);
  v_subtotal        numeric(14,2) := 0;
  v_vat_amount      numeric(14,2);
  v_total           numeric(14,2);
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
  v_till_session_id public.ulid := NULL;
  v_cash_portion    numeric(14,2) := 0;
BEGIN

  -- 1. AUTH VALIDATION
  v_tenant_id := public.current_tenant();
  v_actor_id  := public.current_user_id();

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'complete_sale: unauthenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_role('owner', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'complete_sale: role % cannot create sales', public.current_role() USING ERRCODE = '42501';
  END IF;

  -- 2. INPUT EXTRACTION AND VALIDATION
  v_client_id      := (p_input ->> 'client_id')::public.ulid;
  v_branch_id      := (p_input ->> 'branch_id')::public.ulid;
  v_customer_id    := NULLIF(p_input ->> 'customer_id', '')::public.ulid;
  v_payment_method := p_input ->> 'payment_method';
  v_payment_meta   := COALESCE(p_input -> 'payment_meta', '{}'::jsonb);
  v_order_discount := COALESCE((p_input ->> 'discount_amount')::numeric(14,2), 0);
  v_lines          := p_input -> 'lines';

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'complete_sale: client_id is required' USING ERRCODE = '22023'; END IF;
  IF v_branch_id IS NULL THEN RAISE EXCEPTION 'complete_sale: branch_id is required' USING ERRCODE = '22023'; END IF;
  IF v_lines IS NULL OR jsonb_array_length(v_lines) = 0 THEN RAISE EXCEPTION 'complete_sale: at least one line item is required' USING ERRCODE = '22023'; END IF;
  IF v_payment_method NOT IN ('cash','card','mpesa','airtel_money','tigo_pesa','credit','mixed') THEN RAISE EXCEPTION 'complete_sale: invalid payment_method %', v_payment_method USING ERRCODE = '22023'; END IF;
  IF v_order_discount < 0 THEN RAISE EXCEPTION 'complete_sale: discount_amount cannot be negative' USING ERRCODE = '22023'; END IF;

  -- 3. IDEMPOTENCY CHECK
  IF EXISTS (SELECT 1 FROM public.sales WHERE tenant_id = v_tenant_id AND client_id = v_client_id) THEN
    RETURN (
      SELECT jsonb_build_object('sale_id', id, 'receipt_number', receipt_number, 'total', total, 'status', status, 'completed_at', completed_at, 'replayed', true)
      FROM public.sales WHERE tenant_id = v_tenant_id AND client_id = v_client_id
    );
  END IF;

  -- 4. BRANCH AND TENANT VALIDATION
  SELECT code INTO v_branch_code FROM public.branches WHERE id = v_branch_id AND tenant_id = v_tenant_id AND is_active = true;
  IF v_branch_code IS NULL THEN RAISE EXCEPTION 'complete_sale: branch % not found or inactive', v_branch_id USING ERRCODE = '23503'; END IF;
  IF public.current_role() = 'cashier' AND public.current_branch() != v_branch_id THEN RAISE EXCEPTION 'complete_sale: cashier not assigned to branch %', v_branch_id USING ERRCODE = '42501'; END IF;
  IF v_customer_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_customer_id AND tenant_id = v_tenant_id) THEN RAISE EXCEPTION 'complete_sale: customer % not found in tenant', v_customer_id USING ERRCODE = '23503'; END IF;
  END IF;
  SELECT vat_rate INTO v_vat_rate FROM public.tenants WHERE id = v_tenant_id;

  -- 4.5. OPEN TILL CHECK FOR CASH SALES (G1.2)
  IF v_payment_method = 'mixed' THEN
    IF NOT (v_payment_meta ? 'cash_amount') THEN
      RAISE EXCEPTION 'complete_sale: mixed payment requires payment_meta.cash_amount' USING ERRCODE = '22023';
    END IF;
    
    BEGIN
      v_cash_portion := (v_payment_meta->>'cash_amount')::numeric;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'complete_sale: mixed payment cash_amount must be numeric' USING ERRCODE = '22023';
    END;

    IF v_cash_portion IS NULL OR v_cash_portion < 0 THEN
      RAISE EXCEPTION 'complete_sale: mixed payment cash_amount must be >= 0' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_payment_method = 'cash' OR (v_payment_method = 'mixed' AND v_cash_portion > 0) THEN
    SELECT id INTO v_till_session_id
    FROM public.till_sessions
    WHERE branch_id = v_branch_id
      AND cashier_id = v_actor_id
      AND status = 'open'
      AND tenant_id = v_tenant_id;

    IF v_till_session_id IS NULL THEN
      RAISE EXCEPTION 'complete_sale: open till session required for cash payments' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 5. STOCK VALIDATION AND LOCKING
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) ORDER BY value ->> 'variant_id' LOOP
    v_variant_id  := (v_line ->> 'variant_id')::public.ulid;
    v_quantity    := (v_line ->> 'quantity')::integer;
    v_unit_price  := (v_line ->> 'unit_price')::numeric(14,2);
    v_line_discount := COALESCE((v_line ->> 'line_discount')::numeric(14,2), 0);

    IF v_variant_id IS NULL THEN RAISE EXCEPTION 'complete_sale: line missing variant_id' USING ERRCODE = '22023'; END IF;
    IF v_quantity IS NULL OR v_quantity <= 0 THEN RAISE EXCEPTION 'complete_sale: variant % quantity must be > 0', v_variant_id USING ERRCODE = '22023'; END IF;
    IF v_unit_price IS NULL OR v_unit_price < 0 THEN RAISE EXCEPTION 'complete_sale: variant % unit_price must be >= 0', v_variant_id USING ERRCODE = '22023'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = v_variant_id AND tenant_id = v_tenant_id AND is_active = true) THEN RAISE EXCEPTION 'complete_sale: variant % not found in tenant or inactive', v_variant_id USING ERRCODE = '23503'; END IF;

    SELECT on_hand INTO v_current_stock FROM public.stock_levels WHERE branch_id = v_branch_id AND variant_id = v_variant_id FOR UPDATE;
    IF NOT FOUND THEN v_current_stock := 0; END IF;
    IF v_current_stock < v_quantity THEN RAISE EXCEPTION 'complete_sale: insufficient stock for variant %. available=%, requested=%', v_variant_id, v_current_stock, v_quantity USING ERRCODE = '55000'; END IF;
  END LOOP;

  -- 6. GENERATE IDS AND RECEIPT NUMBER
  v_sale_id := public.generate_ulid();
  v_receipt_number := upper(v_branch_code) || '-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.receipt_seq')::text, 6, '0');

  -- 7. COMPUTE SERVER-SIDE TOTALS
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
    v_unit_price    := (v_line ->> 'unit_price')::numeric(14,2);
    v_quantity      := (v_line ->> 'quantity')::integer;
    v_line_discount := COALESCE((v_line ->> 'line_discount')::numeric(14,2), 0);
    v_line_total := (v_unit_price * v_quantity) - v_line_discount;
    v_subtotal   := v_subtotal + v_line_total;
  END LOOP;

  v_vat_amount := round(GREATEST(0, v_subtotal - v_order_discount) * v_vat_rate, 2);
  v_total      := GREATEST(0, v_subtotal - v_order_discount) + v_vat_amount;
  IF v_total < 0 THEN RAISE EXCEPTION 'complete_sale: computed total is negative (discount exceeds subtotal)' USING ERRCODE = '22023'; END IF;

  -- 8. INSERT SALE HEADER
  INSERT INTO public.sales (
    id, tenant_id, branch_id, cashier_id, customer_id,
    receipt_number, status, subtotal, vat_amount, discount_amount, total,
    payment_method, payment_meta, client_id, completed_at, till_session_id
  ) VALUES (
    v_sale_id, v_tenant_id, v_branch_id, v_actor_id, v_customer_id,
    v_receipt_number, 'completed', v_subtotal, v_vat_amount, v_order_discount, v_total,
    v_payment_method, v_payment_meta, v_client_id, now(), v_till_session_id
  );

  -- 9. INSERT SALE LINES, DECREMENT STOCK, CREATE MOVEMENTS
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) ORDER BY value ->> 'variant_id' LOOP
    v_variant_id    := (v_line ->> 'variant_id')::public.ulid;
    v_quantity      := (v_line ->> 'quantity')::integer;
    v_unit_price    := (v_line ->> 'unit_price')::numeric(14,2);
    v_line_discount := COALESCE((v_line ->> 'line_discount')::numeric(14,2), 0);
    v_line_total    := (v_unit_price * v_quantity) - v_line_discount;
    v_line_id       := public.generate_ulid();
    v_movement_id   := public.generate_ulid();

    SELECT cost_price INTO v_unit_cost FROM public.product_variants WHERE id = v_variant_id;

    INSERT INTO public.sale_lines (id, sale_id, tenant_id, variant_id, quantity, unit_price, unit_cost, line_discount, line_total)
    VALUES (v_line_id, v_sale_id, v_tenant_id, v_variant_id, v_quantity, v_unit_price, v_unit_cost, v_line_discount, v_line_total);

    UPDATE public.stock_levels SET on_hand = on_hand - v_quantity, updated_at = now() WHERE branch_id = v_branch_id AND variant_id = v_variant_id;

    INSERT INTO public.stock_movements (id, tenant_id, branch_id, variant_id, delta, reason, reference_type, reference_id, actor_id)
    VALUES (v_movement_id, v_tenant_id, v_branch_id, v_variant_id, -v_quantity, 'sale', 'sale', v_sale_id, v_actor_id);
  END LOOP;

  -- 10. AUDIT LOG
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
      'branch_id',       v_branch_id,
      'till_session_id', v_till_session_id
    )
  );

  -- 11. RETURN RESULT
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
GRANT EXECUTE ON FUNCTION public.complete_sale(jsonb) TO authenticated;
