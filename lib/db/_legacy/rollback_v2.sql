-- NEXPOS - Hardening Phase Rollback Script
-- Execute this script in the Supabase SQL Editor to revert the updates applied in hardening_v2.sql

-- =====================================================
-- 1. RESTORE ORIGINAL current_stock VIEW
-- =====================================================
DROP VIEW IF EXISTS current_stock;

CREATE OR REPLACE VIEW current_stock AS
SELECT 
  variant_id,
  branch_id,
  SUM(CASE 
    WHEN movement_type IN ('purchase_in', 'return_in', 'adjustment_in', 'transfer_in', 'opening_stock') THEN quantity
    WHEN movement_type IN ('sale_out', 'adjustment_out', 'damaged_out', 'transfer_out') THEN -quantity
    ELSE 0
  END) AS current_quantity
FROM inventory_movements
GROUP BY variant_id, branch_id;

-- =====================================================
-- 2. DROP NEWLY CREATED FOREIGN KEY INDEXES
-- =====================================================
DROP INDEX IF EXISTS idx_audit_logs_branch;
DROP INDEX IF EXISTS idx_cash_sessions_closed_by;
DROP INDEX IF EXISTS idx_cash_sessions_opened_by;
DROP INDEX IF EXISTS idx_credit_account_items_variant;
DROP INDEX IF EXISTS idx_credit_accounts_recorded_by;
DROP INDEX IF EXISTS idx_credit_accounts_sale;
DROP INDEX IF EXISTS idx_credit_followups_recorded_by;
DROP INDEX IF EXISTS idx_credit_repayments_payment;
DROP INDEX IF EXISTS idx_credit_repayments_recorded_by;
DROP INDEX IF EXISTS idx_customers_created_by;
DROP INDEX IF EXISTS idx_expenses_cash_session;
DROP INDEX IF EXISTS idx_expenses_created_by;
DROP INDEX IF EXISTS idx_import_batch_rows_created_variant;
DROP INDEX IF EXISTS idx_import_batches_uploaded_by;
DROP INDEX IF EXISTS idx_inventory_movements_created_by;
DROP INDEX IF EXISTS idx_payments_recorded_by;
DROP INDEX IF EXISTS idx_product_families_created_by;
DROP INDEX IF EXISTS idx_product_variants_created_by;
DROP INDEX IF EXISTS idx_profiles_created_by;
DROP INDEX IF EXISTS idx_purchases_created_by;
DROP INDEX IF EXISTS idx_return_items_sale_item;
DROP INDEX IF EXISTS idx_returns_processed_by;
DROP INDEX IF EXISTS idx_suppliers_created_by;
DROP INDEX IF EXISTS idx_system_settings_updated_by;
DROP INDEX IF EXISTS idx_transfers_created_by;
DROP INDEX IF EXISTS idx_transfers_dispatched_by;
DROP INDEX IF EXISTS idx_transfers_received_by;

-- =====================================================
-- 3. RESTORE ORIGINAL RLS POLICIES FOR OVERLAPPING CASES
-- =====================================================

-- profiles
DROP POLICY IF EXISTS "Tenant owners can manage profiles" ON profiles;
CREATE POLICY "Tenant owners can manage profiles"
ON profiles FOR ALL
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() = 'owner')
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() = 'owner');

-- branches
DROP POLICY IF EXISTS "Tenant owners can manage branches" ON branches;
CREATE POLICY "Tenant owners can manage branches"
ON branches FOR ALL
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() = 'owner')
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() = 'owner');

-- product_categories
DROP POLICY IF EXISTS "Tenant managers can manage categories" ON product_categories;
CREATE POLICY "Tenant managers can manage categories"
ON product_categories FOR ALL
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager'))
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager'));

-- product_families
DROP POLICY IF EXISTS "Tenant managers can manage products" ON product_families;
CREATE POLICY "Tenant managers can manage products"
ON product_families FOR ALL
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager'))
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager'));

-- product_variants
DROP POLICY IF EXISTS "Tenant managers can manage variants" ON product_variants;
CREATE POLICY "Tenant managers can manage variants"
ON product_variants FOR ALL
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager'))
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager'));

-- inventory_reservations
DROP POLICY IF EXISTS "Tenant managers can manage reservations" ON inventory_reservations;
CREATE POLICY "Tenant managers can manage reservations"
ON inventory_reservations FOR ALL
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager') AND (get_jwt_user_role() = 'owner' OR branch_id = get_jwt_branch_id())) 
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager') AND (get_jwt_user_role() = 'owner' OR branch_id = get_jwt_branch_id()));

-- system_settings
DROP POLICY IF EXISTS "Tenant owners manage settings" ON system_settings;
CREATE POLICY "Tenant owners manage settings" ON system_settings FOR ALL
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() = 'owner')
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() = 'owner');

-- transfers
DROP POLICY IF EXISTS "Tenant managers can manage transfers" ON transfers;
CREATE POLICY "Tenant managers can manage transfers" ON transfers FOR ALL 
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager') AND (get_jwt_user_role() = 'owner' OR from_branch_id = get_jwt_branch_id() OR to_branch_id = get_jwt_branch_id())) 
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager') AND (get_jwt_user_role() = 'owner' OR from_branch_id = get_jwt_branch_id() OR to_branch_id = get_jwt_branch_id()));

-- transfer_items
DROP POLICY IF EXISTS "Tenant managers can manage transfer items" ON transfer_items;
CREATE POLICY "Tenant managers can manage transfer items" ON transfer_items FOR ALL 
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager') AND (get_jwt_user_role() = 'owner' OR EXISTS (SELECT 1 FROM transfers t WHERE t.id = transfer_id AND (t.from_branch_id = get_jwt_branch_id() OR t.to_branch_id = get_jwt_branch_id())))) 
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager') AND (get_jwt_user_role() = 'owner' OR EXISTS (SELECT 1 FROM transfers t WHERE t.id = transfer_id AND (t.from_branch_id = get_jwt_branch_id() OR t.to_branch_id = get_jwt_branch_id()))));


-- =====================================================
-- 4. RESTORE ORIGINAL FUNCTIONS (WITHOUT search_path & QUALIFICATIONS)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_jwt_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
AS $function$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->'app_metadata'->>'tenant_id', '')::uuid;
$function$;

CREATE OR REPLACE FUNCTION public.get_jwt_user_role()
 RETURNS character varying
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
AS $function$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role', '')::text;
$function$;

CREATE OR REPLACE FUNCTION public.get_jwt_branch_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
AS $function$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->'app_metadata'->>'branch_id', '')::uuid;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role()
 RETURNS character varying
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT role FROM profiles WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_user_branch()
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT branch_id FROM profiles WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.is_owner()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT EXISTS(
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'owner'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_manager_or_owner()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT EXISTS(
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('owner', 'manager')
  );
$function$;

CREATE OR REPLACE FUNCTION public.sync_profile_to_auth_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('tenant_id', NEW.tenant_id, 'role', NEW.role, 'branch_id', NEW.branch_id)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_sale_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_branch_id UUID;
  v_cashier_id UUID;
BEGIN
  -- Retrieve branch_id and cashier_id from the parent sales record
  SELECT branch_id, cashier_id INTO v_branch_id, v_cashier_id
  FROM sales
  WHERE id = NEW.sale_id;

  INSERT INTO inventory_movements (
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

CREATE OR REPLACE FUNCTION public.dispatch_transfer_atomic(p_transfer_id uuid, p_actor_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_tenant_id UUID;
  v_from_branch_id UUID;
  v_to_branch_id UUID;
  v_status VARCHAR;
  r_item RECORD;
  v_current INTEGER;
  v_reserved INTEGER;
  v_available INTEGER;
BEGIN
  -- 1. Lock the transfer row
  SELECT tenant_id, from_branch_id, to_branch_id, status
  INTO v_tenant_id, v_from_branch_id, v_to_branch_id, v_status
  FROM transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer record not found.';
  END IF;

  -- 1b. Tenant, Actor, and Role validation guards
  IF get_jwt_tenant_id() IS NOT NULL AND v_tenant_id != get_jwt_tenant_id() THEN
    RAISE EXCEPTION 'Cross-tenant access denied.';
  END IF;
  
  IF auth.uid() IS NOT NULL AND p_actor_id != auth.uid() THEN
    RAISE EXCEPTION 'Actor ID mismatch.';
  END IF;

  IF get_jwt_user_role() IS NOT NULL AND get_jwt_user_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized role.';
  END IF;

  IF get_jwt_user_role() IS NOT NULL AND get_jwt_user_role() = 'manager' AND get_jwt_branch_id() != v_from_branch_id THEN
    RAISE EXCEPTION 'Unauthorized branch access.';
  END IF;

  IF v_status != 'draft' THEN
    RAISE EXCEPTION 'Transfer cannot be dispatched. Current status is %', v_status;
  END IF;

  -- 2. Verify stock availability for each item
  FOR r_item IN 
    SELECT variant_id, quantity 
    FROM transfer_items 
    WHERE transfer_id = p_transfer_id
  LOOP
    -- Get current quantity
    SELECT COALESCE(current_quantity, 0)
    INTO v_current
    FROM current_stock
    WHERE variant_id = r_item.variant_id AND branch_id = v_from_branch_id;

    -- Get active reservations
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_reserved
    FROM inventory_reservations
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
    FROM transfer_items 
    WHERE transfer_id = p_transfer_id
  LOOP
    -- Deduct from source branch
    INSERT INTO inventory_movements (
      tenant_id, variant_id, branch_id, movement_type, quantity, 
      reference_id, reference_type, notes, created_by
    ) VALUES (
      v_tenant_id, r_item.variant_id, v_from_branch_id, 'transfer_out', r_item.quantity,
      p_transfer_id, 'transfer', 'Inter-branch transfer dispatch', p_actor_id
    );

    -- Create reservation
    INSERT INTO inventory_reservations (
      tenant_id, branch_id, variant_id, quantity, reference_id, reference_type
    ) VALUES (
      v_tenant_id, v_from_branch_id, r_item.variant_id, r_item.quantity,
      p_transfer_id, 'transfer'
    );
  END LOOP;

  -- 4. Update status to dispatched
  UPDATE transfers
  SET 
    status = 'dispatched',
    dispatched_at = NOW(),
    dispatched_by = p_actor_id
  WHERE id = p_transfer_id;

END;
$function$;

CREATE OR REPLACE FUNCTION public.receive_transfer_atomic(p_transfer_id uuid, p_actor_id uuid, p_received_qtys jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_tenant_id UUID;
  v_from_branch_id UUID;
  v_to_branch_id UUID;
  v_status VARCHAR;
  r_item RECORD;
  v_item_recv_qty INTEGER;
BEGIN
  -- 1. Lock the transfer row
  SELECT tenant_id, from_branch_id, to_branch_id, status
  INTO v_tenant_id, v_from_branch_id, v_to_branch_id, v_status
  FROM transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer record not found.';
  END IF;

  -- 1b. Tenant, Actor, and Role validation guards
  IF get_jwt_tenant_id() IS NOT NULL AND v_tenant_id != get_jwt_tenant_id() THEN
    RAISE EXCEPTION 'Cross-tenant access denied.';
  END IF;
  
  IF auth.uid() IS NOT NULL AND p_actor_id != auth.uid() THEN
    RAISE EXCEPTION 'Actor ID mismatch.';
  END IF;

  IF get_jwt_user_role() IS NOT NULL AND get_jwt_user_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized role.';
  END IF;

  IF get_jwt_user_role() IS NOT NULL AND get_jwt_user_role() = 'manager' AND get_jwt_branch_id() != v_to_branch_id THEN
    RAISE EXCEPTION 'Unauthorized branch access.';
  END IF;

  IF v_status != 'dispatched' THEN
    RAISE EXCEPTION 'Transfer cannot be received. Current status is %', v_status;
  END IF;

  -- 2. Process each item
  FOR r_item IN 
    SELECT id, variant_id, quantity 
    FROM transfer_items 
    WHERE transfer_id = p_transfer_id
  LOOP
    v_item_recv_qty := COALESCE((p_received_qtys->>(r_item.id::TEXT))::INTEGER, r_item.quantity);

    -- Update received quantity in item record
    UPDATE transfer_items
    SET received_qty = v_item_recv_qty
    WHERE id = r_item.id;

    -- Add to destination branch stock
    INSERT INTO inventory_movements (
      tenant_id, variant_id, branch_id, movement_type, quantity, 
      reference_id, reference_type, notes, created_by
    ) VALUES (
      v_tenant_id, r_item.variant_id, v_to_branch_id, 'transfer_in', v_item_recv_qty,
      p_transfer_id, 'transfer', 'Inter-branch transfer receive', p_actor_id
    );

    -- If there's a discrepancy (dispatched > received), return the difference to source branch
    IF r_item.quantity > v_item_recv_qty THEN
      INSERT INTO inventory_movements (
        tenant_id, variant_id, branch_id, movement_type, quantity, 
        reference_id, reference_type, notes, created_by
      ) VALUES (
        v_tenant_id, r_item.variant_id, v_from_branch_id, 'transfer_in', (r_item.quantity - v_item_recv_qty),
        p_transfer_id, 'transfer', 'Inter-branch transfer discrepancy return', p_actor_id
      );
    END IF;
  END LOOP;

  -- 3. Clear/delete reservations
  DELETE FROM inventory_reservations
  WHERE reference_id = p_transfer_id AND reference_type = 'transfer';

  -- 4. Update transfer status
  UPDATE transfers
  SET 
    status = 'received',
    received_at = NOW(),
    received_by = p_actor_id
  WHERE id = p_transfer_id;

END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_transfer_atomic(p_transfer_id uuid, p_actor_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_tenant_id UUID;
  v_from_branch_id UUID;
  v_status VARCHAR;
  r_item RECORD;
BEGIN
  -- 1. Lock the transfer row
  SELECT tenant_id, from_branch_id, status
  INTO v_tenant_id, v_from_branch_id, v_status
  FROM transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer record not found.';
  END IF;

  -- 1b. Tenant, Actor, and Role validation guards
  IF get_jwt_tenant_id() IS NOT NULL AND v_tenant_id != get_jwt_tenant_id() THEN
    RAISE EXCEPTION 'Cross-tenant access denied.';
  END IF;
  
  IF auth.uid() IS NOT NULL AND p_actor_id != auth.uid() THEN
    RAISE EXCEPTION 'Actor ID mismatch.';
  END IF;

  IF get_jwt_user_role() IS NOT NULL AND get_jwt_user_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized role.';
  END IF;

  IF get_jwt_user_role() IS NOT NULL AND get_jwt_user_role() = 'manager' AND get_jwt_branch_id() != v_from_branch_id THEN
    RAISE EXCEPTION 'Unauthorized branch access.';
  END IF;

  IF v_status NOT IN ('draft', 'dispatched') THEN
    RAISE EXCEPTION 'Transfer cannot be cancelled. Current status is %', v_status;
  END IF;

  -- 2. If status was dispatched, we need to return the stock back to the source branch
  IF v_status = 'dispatched' THEN
    FOR r_item IN 
      SELECT variant_id, quantity 
      FROM transfer_items 
      WHERE transfer_id = p_transfer_id
    LOOP
      -- Return stock to source branch
      INSERT INTO inventory_movements (
        tenant_id, variant_id, branch_id, movement_type, quantity, 
        reference_id, reference_type, notes, created_by
      ) VALUES (
        v_tenant_id, r_item.variant_id, v_from_branch_id, 'transfer_in', r_item.quantity,
        p_transfer_id, 'transfer', 'Inter-branch transfer cancellation return', p_actor_id
      );
    END LOOP;

    -- Clear/delete reservations
    DELETE FROM inventory_reservations
    WHERE reference_id = p_transfer_id AND reference_type = 'transfer';
  END IF;

  -- 3. Update transfer status to cancelled
  UPDATE transfers
  SET 
    status = 'cancelled'
  WHERE id = p_transfer_id;

END;
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;
