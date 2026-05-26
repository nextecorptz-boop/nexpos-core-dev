-- NEXPOS - Database Hardening and Optimization Script
-- Execute this script in the Supabase SQL Editor to apply RLS improvements, trigger automation, validation guards, and missing indexes.

-- =====================================================
-- 1. CREATE MISSING B-TREE INDEXES FOR TRANSFERS, ITEMS, & RESERVATIONS
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_transfers_tenant ON transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from_branch ON transfers(from_branch_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_branch ON transfers(to_branch_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);

CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_variant ON transfer_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_tenant ON transfer_items(tenant_id);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_tenant ON inventory_reservations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_branch ON inventory_reservations(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_variant ON inventory_reservations(variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_reference ON inventory_reservations(reference_id, reference_type);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference ON inventory_movements(reference_id, reference_type);


-- =====================================================
-- 2. AUTOMATIC INVENTORY MOVEMENT TRIGGER FOR POS SALES
-- =====================================================
CREATE OR REPLACE FUNCTION log_sale_movement()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_sale_movement ON sale_items;
CREATE TRIGGER trigger_log_sale_movement
AFTER INSERT ON sale_items
FOR EACH ROW
EXECUTE FUNCTION log_sale_movement();


-- =====================================================
-- 3. HARDEN RLS POLICIES FOR FINANCIAL & SECURITY INTEGRITY
-- =====================================================

-- sales table (Separate SELECT, INSERT, and UPDATE policies to prevent cashier update/delete bypass)
DROP POLICY IF EXISTS "Tenant sales policy" ON sales;
CREATE POLICY "Tenant sales select policy" ON sales FOR SELECT 
USING (tenant_id = get_jwt_tenant_id() AND (get_jwt_user_role() = 'owner' OR branch_id = get_jwt_branch_id()));

CREATE POLICY "Tenant sales insert policy" ON sales FOR INSERT 
WITH CHECK (tenant_id = get_jwt_tenant_id() AND (get_jwt_user_role() = 'owner' OR branch_id = get_jwt_branch_id()));

CREATE POLICY "Tenant owners manage sales" ON sales FOR UPDATE 
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() = 'owner') 
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() = 'owner');

-- sale_items table
DROP POLICY IF EXISTS "Tenant sale items policy" ON sale_items;
CREATE POLICY "Tenant sale items select policy" ON sale_items FOR SELECT 
USING (tenant_id = get_jwt_tenant_id() AND (get_jwt_user_role() = 'owner' OR EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_id AND s.branch_id = get_jwt_branch_id())));

CREATE POLICY "Tenant sale items insert policy" ON sale_items FOR INSERT 
WITH CHECK (tenant_id = get_jwt_tenant_id() AND (get_jwt_user_role() = 'owner' OR EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_id AND s.branch_id = get_jwt_branch_id())));

CREATE POLICY "Tenant owners manage sale items" ON sale_items FOR UPDATE 
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() = 'owner') 
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() = 'owner');

-- payments table
DROP POLICY IF EXISTS "Tenant payments policy" ON payments;
CREATE POLICY "Tenant payments select policy" ON payments FOR SELECT 
USING (tenant_id = get_jwt_tenant_id() AND (get_jwt_user_role() = 'owner' OR branch_id = get_jwt_branch_id()));

CREATE POLICY "Tenant payments insert policy" ON payments FOR INSERT 
WITH CHECK (tenant_id = get_jwt_tenant_id() AND (get_jwt_user_role() = 'owner' OR branch_id = get_jwt_branch_id()));

CREATE POLICY "Tenant owners manage payments" ON payments FOR UPDATE 
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() = 'owner') 
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() = 'owner');

-- transfers table (Enforce owner/manager write permissions)
DROP POLICY IF EXISTS "Tenant transfers policy" ON transfers;
CREATE POLICY "Tenant transfers select policy" ON transfers FOR SELECT 
USING (tenant_id = get_jwt_tenant_id() AND (get_jwt_user_role() = 'owner' OR from_branch_id = get_jwt_branch_id() OR to_branch_id = get_jwt_branch_id()));

CREATE POLICY "Tenant managers can manage transfers" ON transfers FOR ALL 
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager') AND (get_jwt_user_role() = 'owner' OR from_branch_id = get_jwt_branch_id() OR to_branch_id = get_jwt_branch_id())) 
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager') AND (get_jwt_user_role() = 'owner' OR from_branch_id = get_jwt_branch_id() OR to_branch_id = get_jwt_branch_id()));

-- transfer_items table
DROP POLICY IF EXISTS "Tenant transfer items policy" ON transfer_items;
CREATE POLICY "Tenant transfer items select policy" ON transfer_items FOR SELECT 
USING (tenant_id = get_jwt_tenant_id() AND (get_jwt_user_role() = 'owner' OR EXISTS (SELECT 1 FROM transfers t WHERE t.id = transfer_id AND (t.from_branch_id = get_jwt_branch_id() OR t.to_branch_id = get_jwt_branch_id()))));

CREATE POLICY "Tenant managers can manage transfer items" ON transfer_items FOR ALL 
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager') AND (get_jwt_user_role() = 'owner' OR EXISTS (SELECT 1 FROM transfers t WHERE t.id = transfer_id AND (t.from_branch_id = get_jwt_branch_id() OR t.to_branch_id = get_jwt_branch_id())))) 
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager') AND (get_jwt_user_role() = 'owner' OR EXISTS (SELECT 1 FROM transfers t WHERE t.id = transfer_id AND (t.from_branch_id = get_jwt_branch_id() OR t.to_branch_id = get_jwt_branch_id()))));

-- inventory_reservations table
DROP POLICY IF EXISTS "Tenant inventory reservations policy" ON inventory_reservations;
CREATE POLICY "Tenant inventory reservations select policy" ON inventory_reservations FOR SELECT 
USING (tenant_id = get_jwt_tenant_id() AND (get_jwt_user_role() = 'owner' OR branch_id = get_jwt_branch_id()));

CREATE POLICY "Tenant managers can manage reservations" ON inventory_reservations FOR ALL 
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager') AND (get_jwt_user_role() = 'owner' OR branch_id = get_jwt_branch_id())) 
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager') AND (get_jwt_user_role() = 'owner' OR branch_id = get_jwt_branch_id()));


-- =====================================================
-- 4. RECREATE TRANSFER RPCs WITH USER, TENANT, AND ROLE GUARDS
-- =====================================================

-- dispatch_transfer_atomic
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

-- receive_transfer_atomic
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

-- cancel_transfer_atomic
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


-- =====================================================
-- 5. RESOLVE LEGACY CONFIGURATIONS IN SYSTEM SETTINGS
-- =====================================================
UPDATE system_settings 
SET value = '"NEXPOS Retail Operating System"'::jsonb 
WHERE key = 'business_name' AND tenant_id = 'd0000000-0000-0000-0000-000000000000';
