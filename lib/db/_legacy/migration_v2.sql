-- NEXPOS - SaaS Multi-Tenancy Migration Script (v1 to v2)
-- Execute this in the Supabase SQL Editor to upgrade the existing MVP database.

-- =====================================================
-- 1. CREATE TENANTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trialing')),
  plan_id VARCHAR(50) DEFAULT 'basic' CHECK (plan_id IN ('basic', 'pro', 'enterprise')),
  paypal_payer_id VARCHAR(255) UNIQUE,
  paypal_subscription_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on slug
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- Create a default tenant for existing MVP data
INSERT INTO tenants (id, name, slug, status, plan_id)
VALUES (
  'd0000000-0000-0000-0000-000000000000',
  'NEXPOS (Default)',
  'nexpos',
  'active',
  'pro'
) ON CONFLICT DO NOTHING;

-- =====================================================
-- 2. ADD tenant_id TO ALL OPERATIONAL TABLES
-- =====================================================

-- For system_settings, we need to transition from a single primary key to a composite primary key (tenant_id, key)
ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS system_settings_pkey;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE system_settings SET tenant_id = 'd0000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
ALTER TABLE system_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE system_settings ADD PRIMARY KEY (tenant_id, key);

-- Add tenant_id to other tables, defaulting to the default tenant ID for existing records, then make it NOT NULL
DO $$
DECLARE
  t_name RECORD;
  tables_to_migrate TEXT[] := ARRAY[
    'branches', 'profiles', 'product_categories', 'product_families', 'product_variants', 
    'inventory_movements', 'suppliers', 'purchases', 'purchase_items', 'customers', 
    'cash_sessions', 'sales', 'sale_items', 'payments', 'credit_accounts', 
    'credit_account_items', 'credit_repayments', 'credit_followups', 'expense_categories', 
    'expenses', 'returns', 'return_items', 'import_batches', 'import_batch_rows', 'audit_logs'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tables_to_migrate LOOP
    -- Add column if not exists
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE', tbl);
    
    -- Update existing records to link to the default tenant
    EXECUTE format('UPDATE %I SET tenant_id = ''d0000000-0000-0000-0000-000000000000'' WHERE tenant_id IS NULL', tbl);
    
    -- Alter column to NOT NULL
    EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET NOT NULL', tbl);
    
    -- Create index for performance
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(tenant_id)', 'idx_' || tbl || '_tenant', tbl);
  END LOOP;
END $$;

-- =====================================================
-- 3. METADATA SYNCHRONIZATION TRIGGER (PROFILES -> AUTH)
-- =====================================================
CREATE OR REPLACE FUNCTION sync_profile_to_auth_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('tenant_id', NEW.tenant_id, 'role', NEW.role, 'branch_id', NEW.branch_id)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_profile_to_auth_metadata ON profiles;
CREATE TRIGGER trigger_sync_profile_to_auth_metadata
AFTER INSERT OR UPDATE OF tenant_id, role, branch_id ON profiles
FOR EACH ROW
EXECUTE FUNCTION sync_profile_to_auth_metadata();

-- Sync existing profiles to auth metadata
UPDATE profiles SET role = role; -- Triggers the update trigger for all existing records

-- =====================================================
-- 4. SUBSCRIPTION LIMITS TRIGGERS
-- =====================================================

-- Branch limit trigger
CREATE OR REPLACE FUNCTION check_branch_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_branch_count INTEGER;
  tenant_plan VARCHAR;
BEGIN
  SELECT COUNT(*) INTO current_branch_count FROM branches WHERE tenant_id = NEW.tenant_id;
  SELECT plan_id INTO tenant_plan FROM tenants WHERE id = NEW.tenant_id;
  
  IF tenant_plan = 'basic' AND current_branch_count >= 2 THEN
    RAISE EXCEPTION 'Branch limit reached for Basic plan (max 2 branches).';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_branch_limit ON branches;
CREATE TRIGGER trigger_check_branch_limit
BEFORE INSERT ON branches
FOR EACH ROW
EXECUTE FUNCTION check_branch_limit();

-- Staff limit trigger
CREATE OR REPLACE FUNCTION check_staff_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_staff_count INTEGER;
  tenant_plan VARCHAR;
BEGIN
  SELECT COUNT(*) INTO current_staff_count FROM profiles 
  WHERE tenant_id = NEW.tenant_id AND role != 'owner';
  SELECT plan_id INTO tenant_plan FROM tenants WHERE id = NEW.tenant_id;
  
  IF tenant_plan = 'basic' AND current_staff_count >= 5 THEN
    RAISE EXCEPTION 'Staff account limit reached for Basic plan (max 5 accounts).';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_staff_limit ON profiles;
CREATE TRIGGER trigger_check_staff_limit
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION check_staff_limit();
