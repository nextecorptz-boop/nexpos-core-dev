-- NEXPOS - Hardening Phase 2 Database Hardening and Optimization Script
-- Execute this script in the Supabase SQL Editor to apply security, RLS optimization, and performance indexes.

-- =====================================================
-- 1. HARDEN current_stock VIEW (security_invoker + tenant-safe grouping)
-- =====================================================
DROP VIEW IF EXISTS public.current_stock;

CREATE VIEW public.current_stock WITH (security_invoker = true) AS
SELECT 
  variant_id,
  branch_id,
  tenant_id,
  SUM(CASE 
    WHEN movement_type IN ('purchase_in', 'return_in', 'adjustment_in', 'transfer_in', 'opening_stock') THEN quantity
    WHEN movement_type IN ('sale_out', 'adjustment_out', 'damaged_out', 'transfer_out') THEN -quantity
    ELSE 0
  END) AS current_quantity
FROM public.inventory_movements
GROUP BY variant_id, branch_id, tenant_id;

-- =====================================================
-- 2. HARDEN ALL 13 SECURITY DEFINER FUNCTIONS (SET search_path = '' and qualify references)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_jwt_tenant_id()
 RETURNS pg_catalog.uuid
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT pg_catalog.nullif(pg_catalog.current_setting('request.jwt.claims', true)::pg_catalog.json->'app_metadata'->>'tenant_id', '')::pg_catalog.uuid;
$function$;

CREATE OR REPLACE FUNCTION public.get_jwt_user_role()
 RETURNS pg_catalog.varchar
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT pg_catalog.nullif(pg_catalog.current_setting('request.jwt.claims', true)::pg_catalog.json->'app_metadata'->>'role', '')::pg_catalog.text;
$function$;

CREATE OR REPLACE FUNCTION public.get_jwt_branch_id()
 RETURNS pg_catalog.uuid
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT pg_catalog.nullif(pg_catalog.current_setting('request.jwt.claims', true)::pg_catalog.json->'app_metadata'->>'branch_id', '')::pg_catalog.uuid;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role()
 RETURNS pg_catalog.varchar
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_user_branch()
 RETURNS pg_catalog.uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT branch_id FROM public.profiles WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.is_owner()
 RETURNS pg_catalog.boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT pg_catalog.exists(
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'owner'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_manager_or_owner()
 RETURNS pg_catalog.boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT pg_catalog.exists(
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('owner', 'manager')
  );
$function$;

CREATE OR REPLACE FUNCTION public.sync_profile_to_auth_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = 
    pg_catalog.coalesce(raw_app_meta_data, '{}'::pg_catalog.jsonb) || 
    pg_catalog.jsonb_build_object('tenant_id', NEW.tenant_id, 'role', NEW.role, 'branch_id', NEW.branch_id)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_sale_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_branch_id pg_catalog.uuid;
  v_cashier_id pg_catalog.uuid;
BEGIN
  -- Retrieve branch_id and cashier_id from the parent sales record
  SELECT branch_id, cashier_id INTO v_branch_id, v_cashier_id
  FROM public.sales
  WHERE id = NEW.sale_id;

  INSERT INTO public.inventory_movements (
    tenant_id,
    variant_id,
    branch_id,
    movement_type,
    quantity,
    reference_id,
    reference_type,
    notes,
    created_by
  ) VALUES (
    NEW.tenant_id,
    NEW.variant_id,
    v_branch_id,
    'sale_out',
    NEW.quantity,
    NEW.sale_id,
    'sale',
    'POS sale item stock deduction',
    v_cashier_id
  );
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dispatch_transfer_atomic(p_transfer_id pg_catalog.uuid, p_actor_id pg_catalog.uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_tenant_id pg_catalog.uuid;
  v_from_branch_id pg_catalog.uuid;
  v_to_branch_id pg_catalog.uuid;
  v_status pg_catalog.varchar;
  r_item RECORD;
  v_current pg_catalog.integer;
  v_reserved pg_catalog.integer;
  v_available pg_catalog.integer;
BEGIN
  -- 1. Lock the transfer row
  SELECT tenant_id, from_branch_id, to_branch_id, status
  INTO v_tenant_id, v_from_branch_id, v_to_branch_id, v_status
  FROM public.transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer record not found.';
  END IF;

  -- 1b. Tenant, Actor, and Role validation guards
  IF public.get_jwt_tenant_id() IS NOT NULL AND v_tenant_id != public.get_jwt_tenant_id() THEN
    RAISE EXCEPTION 'Cross-tenant access denied.';
  END IF;
  
  IF auth.uid() IS NOT NULL AND p_actor_id != auth.uid() THEN
    RAISE EXCEPTION 'Actor ID mismatch.';
  END IF;

  IF public.get_jwt_user_role() IS NOT NULL AND public.get_jwt_user_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized role.';
  END IF;

  IF public.get_jwt_user_role() IS NOT NULL AND public.get_jwt_user_role() = 'manager' AND public.get_jwt_branch_id() != v_from_branch_id THEN
    RAISE EXCEPTION 'Unauthorized branch access.';
  END IF;

  IF v_status != 'draft' THEN
    RAISE EXCEPTION 'Transfer cannot be dispatched. Current status is %', v_status;
  END IF;

  -- 2. Verify stock availability for each item
  FOR r_item IN 
    SELECT variant_id, quantity 
    FROM public.transfer_items 
    WHERE transfer_id = p_transfer_id
  LOOP
    -- Get current quantity
    SELECT pg_catalog.coalesce(current_quantity, 0)
    INTO v_current
    FROM public.current_stock
    WHERE variant_id = r_item.variant_id AND branch_id = v_from_branch_id;

    -- Get active reservations
    SELECT pg_catalog.coalesce(pg_catalog.sum(quantity), 0)
    INTO v_reserved
    FROM public.inventory_reservations
    WHERE variant_id = r_item.variant_id AND branch_id = v_from_branch_id;

    -- Calculate available
    v_available := v_current - v_reserved;

    IF v_available < r_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock. Variant % has only % available, but % was requested.', 
        r_item.variant_id, v_available, r_item.quantity;
    END IF;
  END LOOP;

  -- 3. Perform stock deduction (movements) and write reservations
  FOR r_item IN 
    SELECT variant_id, quantity 
    FROM public.transfer_items 
    WHERE transfer_id = p_transfer_id
  LOOP
    -- Deduct from source branch
    INSERT INTO public.inventory_movements (
      tenant_id, variant_id, branch_id, movement_type, quantity, 
      reference_id, reference_type, notes, created_by
    ) VALUES (
      v_tenant_id, r_item.variant_id, v_from_branch_id, 'transfer_out', r_item.quantity,
      p_transfer_id, 'transfer', 'Inter-branch transfer dispatch', p_actor_id
    );

    -- Create reservation
    INSERT INTO public.inventory_reservations (
      tenant_id, branch_id, variant_id, quantity, reference_id, reference_type
    ) VALUES (
      v_tenant_id, v_from_branch_id, r_item.variant_id, r_item.quantity,
      p_transfer_id, 'transfer'
    );
  END LOOP;

  -- 4. Update status to dispatched
  UPDATE public.transfers
  SET 
    status = 'dispatched',
    dispatched_at = pg_catalog.now(),
    dispatched_by = p_actor_id
  WHERE id = p_transfer_id;

END;
$function$;

CREATE OR REPLACE FUNCTION public.receive_transfer_atomic(p_transfer_id pg_catalog.uuid, p_actor_id pg_catalog.uuid, p_received_qtys pg_catalog.jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_tenant_id pg_catalog.uuid;
  v_from_branch_id pg_catalog.uuid;
  v_to_branch_id pg_catalog.uuid;
  v_status pg_catalog.varchar;
  r_item RECORD;
  v_item_recv_qty pg_catalog.integer;
BEGIN
  -- 1. Lock the transfer row
  SELECT tenant_id, from_branch_id, to_branch_id, status
  INTO v_tenant_id, v_from_branch_id, v_to_branch_id, v_status
  FROM public.transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer record not found.';
  END IF;

  -- 1b. Tenant, Actor, and Role validation guards
  IF public.get_jwt_tenant_id() IS NOT NULL AND v_tenant_id != public.get_jwt_tenant_id() THEN
    RAISE EXCEPTION 'Cross-tenant access denied.';
  END IF;
  
  IF auth.uid() IS NOT NULL AND p_actor_id != auth.uid() THEN
    RAISE EXCEPTION 'Actor ID mismatch.';
  END IF;

  IF public.get_jwt_user_role() IS NOT NULL AND public.get_jwt_user_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized role.';
  END IF;

  IF public.get_jwt_user_role() IS NOT NULL AND public.get_jwt_user_role() = 'manager' AND public.get_jwt_branch_id() != v_to_branch_id THEN
    RAISE EXCEPTION 'Unauthorized branch access.';
  END IF;

  IF v_status != 'dispatched' THEN
    RAISE EXCEPTION 'Transfer cannot be received. Current status is %', v_status;
  END IF;

  -- 2. Process each item
  FOR r_item IN 
    SELECT id, variant_id, quantity 
    FROM public.transfer_items 
    WHERE transfer_id = p_transfer_id
  LOOP
    v_item_recv_qty := pg_catalog.coalesce((p_received_qtys->>(r_item.id::pg_catalog.text))::pg_catalog.integer, r_item.quantity);

    -- Update received quantity in item record
    UPDATE public.transfer_items
    SET received_qty = v_item_recv_qty
    WHERE id = r_item.id;

    -- Add to destination branch stock
    INSERT INTO public.inventory_movements (
      tenant_id, variant_id, branch_id, movement_type, quantity, 
      reference_id, reference_type, notes, created_by
    ) VALUES (
      v_tenant_id, r_item.variant_id, v_to_branch_id, 'transfer_in', v_item_recv_qty,
      p_transfer_id, 'transfer', 'Inter-branch transfer receive', p_actor_id
    );

    -- If there's a discrepancy (dispatched > received), return the difference to source branch
    IF r_item.quantity > v_item_recv_qty THEN
      INSERT INTO public.inventory_movements (
        tenant_id, variant_id, branch_id, movement_type, quantity, 
        reference_id, reference_type, notes, created_by
      ) VALUES (
        v_tenant_id, r_item.variant_id, v_from_branch_id, 'transfer_in', (r_item.quantity - v_item_recv_qty),
        p_transfer_id, 'transfer', 'Inter-branch transfer discrepancy return', p_actor_id
      );
    END IF;
  END LOOP;

  -- 3. Clear/delete reservations
  DELETE FROM public.inventory_reservations
  WHERE reference_id = p_transfer_id AND reference_type = 'transfer';

  -- 4. Update transfer status
  UPDATE public.transfers
  SET 
    status = 'received',
    received_at = pg_catalog.now(),
    received_by = p_actor_id
  WHERE id = p_transfer_id;

END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_transfer_atomic(p_transfer_id pg_catalog.uuid, p_actor_id pg_catalog.uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_tenant_id pg_catalog.uuid;
  v_from_branch_id pg_catalog.uuid;
  v_status pg_catalog.varchar;
  r_item RECORD;
BEGIN
  -- 1. Lock the transfer row
  SELECT tenant_id, from_branch_id, status
  INTO v_tenant_id, v_from_branch_id, v_status
  FROM public.transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer record not found.';
  END IF;

  -- 1b. Tenant, Actor, and Role validation guards
  IF public.get_jwt_tenant_id() IS NOT NULL AND v_tenant_id != public.get_jwt_tenant_id() THEN
    RAISE EXCEPTION 'Cross-tenant access denied.';
  END IF;
  
  IF auth.uid() IS NOT NULL AND p_actor_id != auth.uid() THEN
    RAISE EXCEPTION 'Actor ID mismatch.';
  END IF;

  IF public.get_jwt_user_role() IS NOT NULL AND public.get_jwt_user_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized role.';
  END IF;

  IF public.get_jwt_user_role() IS NOT NULL AND public.get_jwt_user_role() = 'manager' AND public.get_jwt_branch_id() != v_from_branch_id THEN
    RAISE EXCEPTION 'Unauthorized branch access.';
  END IF;

  IF v_status NOT IN ('draft', 'dispatched') THEN
    RAISE EXCEPTION 'Transfer cannot be cancelled. Current status is %', v_status;
  END IF;

  -- 2. If status was dispatched, we need to return the stock back to the source branch
  IF v_status = 'dispatched' THEN
    FOR r_item IN 
      SELECT variant_id, quantity 
      FROM public.transfer_items 
      WHERE transfer_id = p_transfer_id
    LOOP
      -- Return stock to source branch
      INSERT INTO public.inventory_movements (
        tenant_id, variant_id, branch_id, movement_type, quantity, 
        reference_id, reference_type, notes, created_by
      ) VALUES (
        v_tenant_id, r_item.variant_id, v_from_branch_id, 'transfer_in', r_item.quantity,
        p_transfer_id, 'transfer', 'Inter-branch transfer cancellation return', p_actor_id
      );
    END LOOP;

    -- Clear/delete reservations
    DELETE FROM public.inventory_reservations
    WHERE reference_id = p_transfer_id AND reference_type = 'transfer';
  END IF;

  -- 3. Update transfer status to cancelled
  UPDATE public.transfers
  SET 
    status = 'cancelled'
  WHERE id = p_transfer_id;

END;
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_catalog.pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE pg_catalog.format('alter table if exists public.%I enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on public.%I', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on public.%I', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

-- =====================================================
-- 3. RLS OPTIMIZATION: CONVERT FOR ALL -> INDIVIDUAL WRITE POLICIES
-- =====================================================

-- profiles
DROP POLICY IF EXISTS "Tenant owners can manage profiles" ON public.profiles;
CREATE POLICY "Tenant owners can insert profiles" ON public.profiles FOR INSERT
WITH CHECK (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() = 'owner');
CREATE POLICY "Tenant owners can update profiles" ON public.profiles FOR UPDATE
USING (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() = 'owner')
WITH CHECK (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() = 'owner');
CREATE POLICY "Tenant owners can delete profiles" ON public.profiles FOR DELETE
USING (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() = 'owner');

-- branches
DROP POLICY IF EXISTS "Tenant owners can manage branches" ON public.branches;
CREATE POLICY "Tenant owners can insert branches" ON public.branches FOR INSERT
WITH CHECK (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() = 'owner');
CREATE POLICY "Tenant owners can update branches" ON public.branches FOR UPDATE
USING (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() = 'owner')
WITH CHECK (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() = 'owner');
CREATE POLICY "Tenant owners can delete branches" ON public.branches FOR DELETE
USING (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() = 'owner');

-- product_categories
DROP POLICY IF EXISTS "Tenant managers can manage categories" ON public.product_categories;
CREATE POLICY "Tenant managers can insert categories" ON public.product_categories FOR INSERT
WITH CHECK (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager'));
CREATE POLICY "Tenant managers can update categories" ON public.product_categories FOR UPDATE
USING (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager'))
WITH CHECK (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager'));
CREATE POLICY "Tenant managers can delete categories" ON public.product_categories FOR DELETE
USING (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager'));

-- product_families
DROP POLICY IF EXISTS "Tenant managers can manage products" ON public.product_families;
CREATE POLICY "Tenant managers can insert products" ON public.product_families FOR INSERT
WITH CHECK (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager'));
CREATE POLICY "Tenant managers can update products" ON public.product_families FOR UPDATE
USING (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager'))
WITH CHECK (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager'));
CREATE POLICY "Tenant managers can delete products" ON public.product_families FOR DELETE
USING (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager'));

-- product_variants
DROP POLICY IF EXISTS "Tenant managers can manage variants" ON public.product_variants;
CREATE POLICY "Tenant managers can insert variants" ON public.product_variants FOR INSERT
WITH CHECK (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager'));
CREATE POLICY "Tenant managers can update variants" ON public.product_variants FOR UPDATE
USING (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager'))
WITH CHECK (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager'));
CREATE POLICY "Tenant managers can delete variants" ON public.product_variants FOR DELETE
USING (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager'));

-- inventory_reservations
DROP POLICY IF EXISTS "Tenant managers can manage reservations" ON public.inventory_reservations;
CREATE POLICY "Tenant managers can insert reservations" ON public.inventory_reservations FOR INSERT
WITH CHECK (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager') AND (public.get_jwt_user_role() = 'owner' OR branch_id = public.get_jwt_branch_id()));
CREATE POLICY "Tenant managers can update reservations" ON public.inventory_reservations FOR UPDATE
USING (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager') AND (public.get_jwt_user_role() = 'owner' OR branch_id = public.get_jwt_branch_id()))
WITH CHECK (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager') AND (public.get_jwt_user_role() = 'owner' OR branch_id = public.get_jwt_branch_id()));
CREATE POLICY "Tenant managers can delete reservations" ON public.inventory_reservations FOR DELETE
USING (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager') AND (public.get_jwt_user_role() = 'owner' OR branch_id = public.get_jwt_branch_id()));

-- system_settings
DROP POLICY IF EXISTS "Tenant owners manage settings" ON public.system_settings;
CREATE POLICY "Tenant owners can insert settings" ON public.system_settings FOR INSERT
WITH CHECK (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() = 'owner');
CREATE POLICY "Tenant owners can update settings" ON public.system_settings FOR UPDATE
USING (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() = 'owner')
WITH CHECK (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() = 'owner');
CREATE POLICY "Tenant owners can delete settings" ON public.system_settings FOR DELETE
USING (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() = 'owner');

-- transfers
DROP POLICY IF EXISTS "Tenant managers can manage transfers" ON public.transfers;
CREATE POLICY "Tenant managers can insert transfers" ON public.transfers FOR INSERT
WITH CHECK (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager') AND (public.get_jwt_user_role() = 'owner' OR from_branch_id = public.get_jwt_branch_id() OR to_branch_id = public.get_jwt_branch_id()));
CREATE POLICY "Tenant managers can update transfers" ON public.transfers FOR UPDATE
USING (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager') AND (public.get_jwt_user_role() = 'owner' OR from_branch_id = public.get_jwt_branch_id() OR to_branch_id = public.get_jwt_branch_id()))
WITH CHECK (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager') AND (public.get_jwt_user_role() = 'owner' OR from_branch_id = public.get_jwt_branch_id() OR to_branch_id = public.get_jwt_branch_id()));
CREATE POLICY "Tenant managers can delete transfers" ON public.transfers FOR DELETE
USING (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager') AND (public.get_jwt_user_role() = 'owner' OR from_branch_id = public.get_jwt_branch_id() OR to_branch_id = public.get_jwt_branch_id()));

-- transfer_items
DROP POLICY IF EXISTS "Tenant managers can manage transfer items" ON public.transfer_items;
CREATE POLICY "Tenant managers can insert transfer items" ON public.transfer_items FOR INSERT
WITH CHECK (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager') AND (public.get_jwt_user_role() = 'owner' OR EXISTS (SELECT 1 FROM public.transfers t WHERE t.id = transfer_id AND (t.from_branch_id = public.get_jwt_branch_id() OR t.to_branch_id = public.get_jwt_branch_id()))));
CREATE POLICY "Tenant managers can update transfer items" ON public.transfer_items FOR UPDATE
USING (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager') AND (public.get_jwt_user_role() = 'owner' OR EXISTS (SELECT 1 FROM public.transfers t WHERE t.id = transfer_id AND (t.from_branch_id = public.get_jwt_branch_id() OR t.to_branch_id = public.get_jwt_branch_id()))))
WITH CHECK (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager') AND (public.get_jwt_user_role() = 'owner' OR EXISTS (SELECT 1 FROM public.transfers t WHERE t.id = transfer_id AND (t.from_branch_id = public.get_jwt_branch_id() OR t.to_branch_id = public.get_jwt_branch_id()))));
CREATE POLICY "Tenant managers can delete transfer items" ON public.transfer_items FOR DELETE
USING (tenant_id = public.get_jwt_tenant_id() AND public.get_jwt_user_role() IN ('owner', 'manager') AND (public.get_jwt_user_role() = 'owner' OR EXISTS (SELECT 1 FROM public.transfers t WHERE t.id = transfer_id AND (t.from_branch_id = public.get_jwt_branch_id() OR t.to_branch_id = public.get_jwt_branch_id()))));

-- =====================================================
-- 4. PERFORMANCE TUNING: CREATE MISSING FOREIGN KEY INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_branch ON public.audit_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_closed_by ON public.cash_sessions(closed_by);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_by ON public.cash_sessions(opened_by);
CREATE INDEX IF NOT EXISTS idx_credit_account_items_variant ON public.credit_account_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_credit_accounts_recorded_by ON public.credit_accounts(recorded_by);
CREATE INDEX IF NOT EXISTS idx_credit_accounts_sale ON public.credit_accounts(sale_id);
CREATE INDEX IF NOT EXISTS idx_credit_followups_recorded_by ON public.credit_followups(recorded_by);
CREATE INDEX IF NOT EXISTS idx_credit_repayments_payment ON public.credit_repayments(payment_id);
CREATE INDEX IF NOT EXISTS idx_credit_repayments_recorded_by ON public.credit_repayments(recorded_by);
CREATE INDEX IF NOT EXISTS idx_customers_created_by ON public.customers(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_cash_session ON public.expenses(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON public.expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_import_batch_rows_created_variant ON public.import_batch_rows(created_variant_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_uploaded_by ON public.import_batches(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_by ON public.inventory_movements(created_by);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_by ON public.payments(recorded_by);
CREATE INDEX IF NOT EXISTS idx_product_families_created_by ON public.product_families(created_by);
CREATE INDEX IF NOT EXISTS idx_product_variants_created_by ON public.product_variants(created_by);
CREATE INDEX IF NOT EXISTS idx_profiles_created_by ON public.profiles(created_by);
CREATE INDEX IF NOT EXISTS idx_purchases_created_by ON public.purchases(created_by);
CREATE INDEX IF NOT EXISTS idx_return_items_sale_item ON public.return_items(sale_item_id);
CREATE INDEX IF NOT EXISTS idx_returns_processed_by ON public.returns(processed_by);
CREATE INDEX IF NOT EXISTS idx_suppliers_created_by ON public.suppliers(created_by);
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_by ON public.system_settings(updated_by);
CREATE INDEX IF NOT EXISTS idx_transfers_created_by ON public.transfers(created_by);
CREATE INDEX IF NOT EXISTS idx_transfers_dispatched_by ON public.transfers(dispatched_by);
CREATE INDEX IF NOT EXISTS idx_transfers_received_by ON public.transfers(received_by);
