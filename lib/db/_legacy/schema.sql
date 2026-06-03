-- NEXPOS - Complete Multi-Tenant Database Schema
-- Execute this in Supabase SQL Editor for new project setup

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLES
-- =====================================================

-- 0. Tenants
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

CREATE INDEX idx_tenants_slug ON tenants(slug);

-- 1. Branches
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_branches_active ON branches(is_active);
CREATE INDEX idx_branches_tenant ON branches(tenant_id);

-- 2. Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'manager', 'cashier')),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_branch ON profiles(branch_id);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_tenant ON profiles(tenant_id);

-- 3. Product Categories
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_categories_tenant ON product_categories(tenant_id);

-- 4. Product Families (UI shows as "Products")
CREATE TABLE IF NOT EXISTS product_families (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(255),
  gender VARCHAR(20) CHECK (gender IN ('men', 'women', 'kids', 'unisex')),
  description TEXT,
  base_cost DECIMAL(10, 2) NOT NULL,
  base_price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'TZS',
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  public_image_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_product_families_category ON product_families(category_id);
CREATE INDEX idx_product_families_active ON product_families(is_active);
CREATE INDEX idx_product_families_public ON product_families(is_public);
CREATE INDEX idx_product_families_gender ON product_families(gender);
CREATE INDEX idx_product_families_tenant ON product_families(tenant_id);

-- 5. Product Variants
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES product_families(id) ON DELETE CASCADE,
  sku VARCHAR(100) UNIQUE NOT NULL,
  barcode VARCHAR(100) UNIQUE,
  size VARCHAR(50) NOT NULL,
  color VARCHAR(100),
  cost_price DECIMAL(10, 2),
  selling_price DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT true,
  low_stock_threshold INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_product_variants_family ON product_variants(family_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_variants_barcode ON product_variants(barcode);
CREATE INDEX idx_product_variants_active ON product_variants(is_active);
CREATE INDEX idx_product_variants_tenant ON product_variants(tenant_id);

-- 6. Inventory Movements (movement-based inventory)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN (
    'purchase_in', 'sale_out', 'return_in', 'adjustment_in', 
    'adjustment_out', 'damaged_out', 'transfer_in', 'transfer_out', 'opening_stock'
  )),
  quantity INTEGER NOT NULL,
  reference_id UUID,
  reference_type VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_inventory_movements_variant ON inventory_movements(variant_id);
CREATE INDEX idx_inventory_movements_branch ON inventory_movements(branch_id);
CREATE INDEX idx_inventory_movements_type ON inventory_movements(movement_type);
CREATE INDEX idx_inventory_movements_created ON inventory_movements(created_at);
CREATE INDEX idx_inventory_movements_tenant ON inventory_movements(tenant_id);

-- 7. Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_suppliers_active ON suppliers(is_active);
CREATE INDEX idx_suppliers_tenant ON suppliers(tenant_id);

-- 8. Purchases
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) CHECK (status IN ('draft', 'completed', 'cancelled')) DEFAULT 'draft',
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'TZS',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_purchases_branch ON purchases(branch_id);
CREATE INDEX idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX idx_purchases_date ON purchases(purchase_date);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE INDEX idx_purchases_tenant ON purchases(tenant_id);

-- 9. Purchase Items
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_cost DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  received_qty INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_variant ON purchase_items(variant_id);
CREATE INDEX idx_purchase_items_tenant ON purchase_items(tenant_id);

-- 10. Customers
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  customer_type VARCHAR(20) CHECK (customer_type IN ('cash', 'credit', 'wholesale')) DEFAULT 'cash',
  credit_limit DECIMAL(12, 2) DEFAULT 0,
  branch_id UUID REFERENCES branches(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_type ON customers(customer_type);
CREATE INDEX idx_customers_branch ON customers(branch_id);
CREATE INDEX idx_customers_tenant ON customers(tenant_id);

-- 11. Cash Sessions
CREATE TABLE IF NOT EXISTS cash_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES auth.users(id),
  closed_by UUID REFERENCES auth.users(id),
  opening_float DECIMAL(12, 2) NOT NULL,
  closing_float DECIMAL(12, 2),
  expected_cash DECIMAL(12, 2),
  variance DECIMAL(12, 2),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  status VARCHAR(20) CHECK (status IN ('open', 'closed')) DEFAULT 'open',
  notes TEXT
);

CREATE INDEX idx_cash_sessions_branch ON cash_sessions(branch_id);
CREATE INDEX idx_cash_sessions_status ON cash_sessions(status);
CREATE INDEX idx_cash_sessions_opened ON cash_sessions(opened_at);
CREATE INDEX idx_cash_sessions_tenant ON cash_sessions(tenant_id);

-- 12. Sales
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  cashier_id UUID NOT NULL REFERENCES auth.users(id),
  customer_id UUID REFERENCES customers(id),
  cash_session_id UUID REFERENCES cash_sessions(id),
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  sale_date TIMESTAMPTZ DEFAULT NOW(),
  subtotal DECIMAL(12, 2) NOT NULL,
  discount_amount DECIMAL(12, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL,
  amount_paid DECIMAL(12, 2) NOT NULL,
  balance_due DECIMAL(12, 2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'TZS',
  status VARCHAR(20) CHECK (status IN ('completed', 'partial', 'refunded', 'cancelled')) DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sales_branch ON sales(branch_id);
CREATE INDEX idx_sales_cashier ON sales(cashier_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_session ON sales(cash_session_id);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_receipt ON sales(receipt_number);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_tenant ON sales(tenant_id);

-- 13. Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  subtotal DECIMAL(10, 2) NOT NULL,
  cost_price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_variant ON sale_items(variant_id);
CREATE INDEX idx_sale_items_tenant ON sale_items(tenant_id);

-- 14. Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  payment_method VARCHAR(50) CHECK (payment_method IN ('cash', 'mobile_money', 'card', 'bank_transfer')) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'TZS',
  reference_code VARCHAR(100),
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  recorded_by UUID NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_payments_sale ON payments(sale_id);
CREATE INDEX idx_payments_branch ON payments(branch_id);
CREATE INDEX idx_payments_date ON payments(paid_at);
CREATE INDEX idx_payments_tenant ON payments(tenant_id);

-- 15. Credit Accounts
CREATE TABLE IF NOT EXISTS credit_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id),
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  principal_amount DECIMAL(12, 2) NOT NULL,
  amount_paid DECIMAL(12, 2) DEFAULT 0,
  balance_due DECIMAL(12, 2) NOT NULL,
  due_date DATE,
  status VARCHAR(20) CHECK (status IN ('active', 'paid', 'overdue', 'written_off')) DEFAULT 'active',
  follow_up_notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_accounts_customer ON credit_accounts(customer_id);
CREATE INDEX idx_credit_accounts_branch ON credit_accounts(branch_id);
CREATE INDEX idx_credit_accounts_status ON credit_accounts(status);
CREATE INDEX idx_credit_accounts_due_date ON credit_accounts(due_date);
CREATE INDEX idx_credit_accounts_tenant ON credit_accounts(tenant_id);

-- 16. Credit Account Items
CREATE TABLE IF NOT EXISTS credit_account_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  credit_account_id UUID NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL
);

CREATE INDEX idx_credit_account_items_credit ON credit_account_items(credit_account_id);
CREATE INDEX idx_credit_account_items_tenant ON credit_account_items(tenant_id);

-- 17. Credit Repayments
CREATE TABLE IF NOT EXISTS credit_repayments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  credit_account_id UUID NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id),
  amount DECIMAL(12, 2) NOT NULL,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  paid_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_repayments_credit ON credit_repayments(credit_account_id);
CREATE INDEX idx_credit_repayments_date ON credit_repayments(paid_at);
CREATE INDEX idx_credit_repayments_tenant ON credit_repayments(tenant_id);

-- 18. Credit Follow-ups
CREATE TABLE IF NOT EXISTS credit_followups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  credit_account_id UUID NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  contact_method VARCHAR(50) CHECK (contact_method IN ('phone', 'whatsapp', 'sms', 'visit', 'other')),
  outcome VARCHAR(50) CHECK (outcome IN ('promised_payment', 'dispute', 'no_answer', 'partial_payment', 'other')),
  promised_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_followups_credit ON credit_followups(credit_account_id);
CREATE INDEX idx_credit_followups_date ON credit_followups(created_at);
CREATE INDEX idx_credit_followups_tenant ON credit_followups(tenant_id);

-- 19. Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expense_categories_tenant ON expense_categories(tenant_id);

-- 20. Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  cash_session_id UUID REFERENCES cash_sessions(id),
  category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'TZS',
  description TEXT NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_ref VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_expenses_branch ON expenses(branch_id);
CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_tenant ON expenses(tenant_id);

-- 21. Returns
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  original_sale_id UUID REFERENCES sales(id),
  processed_by UUID NOT NULL REFERENCES auth.users(id),
  return_date TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT NOT NULL,
  outcome VARCHAR(50) CHECK (outcome IN ('refund', 'exchange', 'credit')) NOT NULL,
  total_refund DECIMAL(12, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_returns_branch ON returns(branch_id);
CREATE INDEX idx_returns_sale ON returns(original_sale_id);
CREATE INDEX idx_returns_date ON returns(return_date);
CREATE INDEX idx_returns_tenant ON returns(tenant_id);

-- 22. Return Items
CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  sale_item_id UUID REFERENCES sale_items(id),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  condition VARCHAR(50) CHECK (condition IN ('resaleable', 'damaged', 'defective')) NOT NULL
);

CREATE INDEX idx_return_items_return ON return_items(return_id);
CREATE INDEX idx_return_items_variant ON return_items(variant_id);
CREATE INDEX idx_return_items_tenant ON return_items(tenant_id);

-- 23. System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  PRIMARY KEY (tenant_id, key)
);

CREATE INDEX idx_system_settings_tenant ON system_settings(tenant_id);

-- 24. Import Batches
CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  filename VARCHAR(255) NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  valid_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  status VARCHAR(20) CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_import_batches_branch ON import_batches(branch_id);
CREATE INDEX idx_import_batches_status ON import_batches(status);
CREATE INDEX idx_import_batches_tenant ON import_batches(tenant_id);

-- 25. Import Batch Rows
CREATE TABLE IF NOT EXISTS import_batch_rows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_data JSONB NOT NULL,
  status VARCHAR(20) CHECK (status IN ('pending', 'valid', 'error')) DEFAULT 'pending',
  error_message TEXT,
  created_variant_id UUID REFERENCES product_variants(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_import_batch_rows_batch ON import_batch_rows(batch_id);
CREATE INDEX idx_import_batch_rows_tenant ON import_batch_rows(tenant_id);

-- 26. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  branch_id UUID REFERENCES branches(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);

-- =====================================================
-- VIEWS
-- =====================================================

-- Current stock levels per variant per branch
CREATE OR REPLACE VIEW current_stock AS
SELECT 
  variant_id,
  branch_id,
  tenant_id,
  SUM(CASE 
    WHEN movement_type IN ('purchase_in', 'return_in', 'adjustment_in', 'transfer_in', 'opening_stock') THEN quantity
    WHEN movement_type IN ('sale_out', 'adjustment_out', 'damaged_out', 'transfer_out') THEN -quantity
    ELSE 0
  END) AS current_quantity
FROM inventory_movements
GROUP BY variant_id, branch_id, tenant_id;

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to generate receipt number
CREATE OR REPLACE FUNCTION generate_receipt_number(branch_prefix VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  next_num INTEGER;
  receipt_num VARCHAR;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num 
  FROM sales 
  WHERE DATE(sale_date) = CURRENT_DATE;
  
  receipt_num := branch_prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN receipt_num;
END;
$$ LANGUAGE plpgsql;

-- Function to update credit account balance
CREATE OR REPLACE FUNCTION update_credit_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE credit_accounts
  SET 
    amount_paid = (
      SELECT COALESCE(SUM(amount), 0)
      FROM credit_repayments
      WHERE credit_account_id = NEW.credit_account_id
    ),
    balance_due = principal_amount - (
      SELECT COALESCE(SUM(amount), 0)
      FROM credit_repayments
      WHERE credit_account_id = NEW.credit_account_id
    ),
    status = CASE
      WHEN (principal_amount - (
        SELECT COALESCE(SUM(amount), 0)
        FROM credit_repayments
        WHERE credit_account_id = NEW.credit_account_id
      )) <= 0 THEN 'paid'
      WHEN due_date < CURRENT_DATE THEN 'overdue'
      ELSE 'active'
    END,
    updated_at = NOW()
  WHERE id = NEW.credit_account_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_update_credit_balance
AFTER INSERT ON credit_repayments
FOR EACH ROW
EXECUTE FUNCTION update_credit_balance();

-- Metadata synchronization trigger (profiles -> auth)
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

CREATE OR REPLACE TRIGGER trigger_sync_profile_to_auth_metadata
AFTER INSERT OR UPDATE OF tenant_id, role, branch_id ON profiles
FOR EACH ROW
EXECUTE FUNCTION sync_profile_to_auth_metadata();

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

CREATE OR REPLACE TRIGGER trigger_check_branch_limit
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

CREATE OR REPLACE TRIGGER trigger_check_staff_limit
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION check_staff_limit();
