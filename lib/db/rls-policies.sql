-- NEXPOS - SaaS Multi-Tenant Row Level Security Policies
-- Execute this AFTER running schema.sql

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_account_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batch_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- FAST JWT HELPER FUNCTIONS (No DB lookups)
-- =====================================================

CREATE OR REPLACE FUNCTION get_jwt_tenant_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->'app_metadata'->>'tenant_id', '')::uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_jwt_user_role()
RETURNS VARCHAR AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role', '')::text;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_jwt_branch_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->'app_metadata'->>'branch_id', '')::uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =====================================================
-- TENANTS POLICIES
-- =====================================================

CREATE POLICY "Users can view own tenant details"
ON tenants FOR SELECT
USING (id = get_jwt_tenant_id());

CREATE POLICY "Tenant owners can update details"
ON tenants FOR UPDATE
USING (id = get_jwt_tenant_id() AND get_jwt_user_role() = 'owner');

-- =====================================================
-- PROFILES POLICIES
-- =====================================================

CREATE POLICY "Tenant users can view profiles in tenant"
ON profiles FOR SELECT
USING (tenant_id = get_jwt_tenant_id());

CREATE POLICY "Tenant owners can manage profiles"
ON profiles FOR ALL
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() = 'owner')
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() = 'owner');

-- =====================================================
-- BRANCHES POLICIES
-- =====================================================

CREATE POLICY "Tenant users can view branches"
ON branches FOR SELECT
USING (tenant_id = get_jwt_tenant_id());

CREATE POLICY "Tenant owners can manage branches"
ON branches FOR ALL
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() = 'owner')
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() = 'owner');

-- =====================================================
-- PRODUCT POLICIES
-- =====================================================

-- Categories
CREATE POLICY "Tenant users or public can view categories"
ON product_categories FOR SELECT
USING (
  tenant_id = get_jwt_tenant_id() OR (
    get_jwt_tenant_id() IS NULL AND EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = tenant_id AND t.status IN ('active', 'trialing')
    )
  )
);

CREATE POLICY "Tenant managers can manage categories"
ON product_categories FOR ALL
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager'))
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager'));

-- Product Families (Catalog access allowed for active public pages)
CREATE POLICY "Tenant users or public can view products"
ON product_families FOR SELECT
USING (
  tenant_id = get_jwt_tenant_id() OR (
    is_public = true AND EXISTS (
      SELECT 1 FROM tenants t 
      WHERE t.id = tenant_id AND t.status IN ('active', 'trialing')
    )
  )
);

CREATE POLICY "Tenant managers can manage products"
ON product_families FOR ALL
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager'))
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager'));

-- Product Variants
CREATE POLICY "Tenant users or public can view variants"
ON product_variants FOR SELECT
USING (
  tenant_id = get_jwt_tenant_id() OR EXISTS (
    SELECT 1 FROM product_families f
    JOIN tenants t ON t.id = f.tenant_id
    WHERE f.id = family_id AND f.is_public = true AND t.status IN ('active', 'trialing')
  )
);

CREATE POLICY "Tenant managers can manage variants"
ON product_variants FOR ALL
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager'))
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager'));

-- =====================================================
-- INVENTORY POLICIES
-- =====================================================

CREATE POLICY "Tenant users can view branch inventory"
ON inventory_movements FOR SELECT
USING (
  tenant_id = get_jwt_tenant_id() AND (
    get_jwt_user_role() = 'owner' OR 
    branch_id = get_jwt_branch_id()
  )
);

CREATE POLICY "Tenant managers can create inventory movements"
ON inventory_movements FOR INSERT
WITH CHECK (
  tenant_id = get_jwt_tenant_id() AND 
  get_jwt_user_role() IN ('owner', 'manager') AND (
    get_jwt_user_role() = 'owner' OR 
    branch_id = get_jwt_branch_id()
  )
);

-- =====================================================
-- CUSTOMER POLICIES
-- =====================================================

CREATE POLICY "Tenant users can view customers"
ON customers FOR SELECT
USING (
  tenant_id = get_jwt_tenant_id() AND (
    get_jwt_user_role() = 'owner' OR 
    branch_id = get_jwt_branch_id() OR 
    branch_id IS NULL
  )
);

CREATE POLICY "Tenant staff can create customers"
ON customers FOR INSERT
WITH CHECK (tenant_id = get_jwt_tenant_id());

CREATE POLICY "Tenant managers can update customers"
ON customers FOR UPDATE
USING (
  tenant_id = get_jwt_tenant_id() AND
  get_jwt_user_role() IN ('owner', 'manager') AND
  (get_jwt_user_role() = 'owner' OR branch_id = get_jwt_branch_id())
);

-- =====================================================
-- TRANSACTIONAL POLICIES (Sales, Payments, Till Sessions, Cash Sessions, Returns, Expenses, Credit)
-- =====================================================

-- Helper macro for standard operational tables
-- Enforces:
-- 1. Must belong to current user's tenant_id
-- 2. Owner has access to all branches of tenant, cashier/manager restricted to their branch_id

-- Sales
CREATE POLICY "Tenant sales policy" ON sales FOR ALL
USING (
  tenant_id = get_jwt_tenant_id() AND (
    get_jwt_user_role() = 'owner' OR 
    branch_id = get_jwt_branch_id()
  )
)
WITH CHECK (
  tenant_id = get_jwt_tenant_id() AND (
    get_jwt_user_role() = 'owner' OR 
    branch_id = get_jwt_branch_id()
  )
);

-- Sale Items
CREATE POLICY "Tenant sale items policy" ON sale_items FOR ALL
USING (
  tenant_id = get_jwt_tenant_id() AND (
    get_jwt_user_role() = 'owner' OR 
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_id AND s.branch_id = get_jwt_branch_id()
    )
  )
)
WITH CHECK (
  tenant_id = get_jwt_tenant_id() AND (
    get_jwt_user_role() = 'owner' OR 
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_id AND s.branch_id = get_jwt_branch_id()
    )
  )
);

-- Payments
CREATE POLICY "Tenant payments policy" ON payments FOR ALL
USING (
  tenant_id = get_jwt_tenant_id() AND (
    get_jwt_user_role() = 'owner' OR 
    branch_id = get_jwt_branch_id()
  )
)
WITH CHECK (
  tenant_id = get_jwt_tenant_id() AND (
    get_jwt_user_role() = 'owner' OR 
    branch_id = get_jwt_branch_id()
  )
);

-- Cash Sessions
CREATE POLICY "Tenant cash sessions policy" ON cash_sessions FOR ALL
USING (
  tenant_id = get_jwt_tenant_id() AND (
    get_jwt_user_role() = 'owner' OR 
    branch_id = get_jwt_branch_id()
  )
)
WITH CHECK (
  tenant_id = get_jwt_tenant_id() AND (
    get_jwt_user_role() = 'owner' OR 
    branch_id = get_jwt_branch_id()
  )
);

-- Credit Accounts
CREATE POLICY "Tenant credit accounts policy" ON credit_accounts FOR ALL
USING (
  tenant_id = get_jwt_tenant_id() AND 
  get_jwt_user_role() IN ('owner', 'manager') AND (
    get_jwt_user_role() = 'owner' OR 
    branch_id = get_jwt_branch_id()
  )
);

-- Credit Account Items
CREATE POLICY "Tenant credit items policy" ON credit_account_items FOR ALL
USING (
  tenant_id = get_jwt_tenant_id() AND 
  get_jwt_user_role() IN ('owner', 'manager') AND (
    get_jwt_user_role() = 'owner' OR 
    EXISTS (
      SELECT 1 FROM credit_accounts ca
      WHERE ca.id = credit_account_id AND ca.branch_id = get_jwt_branch_id()
    )
  )
);

-- Credit Repayments
CREATE POLICY "Tenant credit repayments policy" ON credit_repayments FOR ALL
USING (
  tenant_id = get_jwt_tenant_id() AND 
  get_jwt_user_role() IN ('owner', 'manager')
);

-- Credit Follow-ups
CREATE POLICY "Tenant credit followups policy" ON credit_followups FOR ALL
USING (
  tenant_id = get_jwt_tenant_id() AND 
  get_jwt_user_role() IN ('owner', 'manager')
);

-- Expenses Categories
CREATE POLICY "Tenant expense categories policy" ON expense_categories FOR SELECT
USING (tenant_id = get_jwt_tenant_id());

CREATE POLICY "Tenant manage expense categories" ON expense_categories FOR ALL
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager'));

-- Expenses
CREATE POLICY "Tenant expenses policy" ON expenses FOR ALL
USING (
  tenant_id = get_jwt_tenant_id() AND 
  get_jwt_user_role() IN ('owner', 'manager') AND (
    get_jwt_user_role() = 'owner' OR 
    branch_id = get_jwt_branch_id()
  )
);

-- Returns
CREATE POLICY "Tenant returns policy" ON returns FOR ALL
USING (
  tenant_id = get_jwt_tenant_id() AND (
    get_jwt_user_role() = 'owner' OR 
    branch_id = get_jwt_branch_id()
  )
)
WITH CHECK (
  tenant_id = get_jwt_tenant_id() AND (
    get_jwt_user_role() = 'owner' OR 
    branch_id = get_jwt_branch_id()
  )
);

-- Return Items
CREATE POLICY "Tenant return items policy" ON return_items FOR ALL
USING (
  tenant_id = get_jwt_tenant_id() AND (
    get_jwt_user_role() = 'owner' OR 
    EXISTS (
      SELECT 1 FROM returns r
      WHERE r.id = return_id AND r.branch_id = get_jwt_branch_id()
    )
  )
);

-- =====================================================
-- SUPPLIER & PURCHASE POLICIES
-- =====================================================

-- Suppliers
CREATE POLICY "Tenant suppliers policy" ON suppliers FOR ALL
USING (tenant_id = get_jwt_tenant_id());

-- Purchases
CREATE POLICY "Tenant purchases policy" ON purchases FOR ALL
USING (
  tenant_id = get_jwt_tenant_id() AND 
  get_jwt_user_role() IN ('owner', 'manager') AND (
    get_jwt_user_role() = 'owner' OR 
    branch_id = get_jwt_branch_id()
  )
);

-- Purchase Items
CREATE POLICY "Tenant purchase items policy" ON purchase_items FOR ALL
USING (
  tenant_id = get_jwt_tenant_id() AND 
  get_jwt_user_role() IN ('owner', 'manager') AND (
    get_jwt_user_role() = 'owner' OR 
    EXISTS (
      SELECT 1 FROM purchases p
      WHERE p.id = purchase_id AND p.branch_id = get_jwt_branch_id()
    )
  )
);

-- =====================================================
-- SYSTEM SETTINGS POLICIES
-- =====================================================

CREATE POLICY "Tenant settings read policy" ON system_settings FOR SELECT
USING (tenant_id = get_jwt_tenant_id());

CREATE POLICY "Tenant owners manage settings" ON system_settings FOR ALL
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() = 'owner')
WITH CHECK (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() = 'owner');

-- =====================================================
-- IMPORT & AUDIT LOG POLICIES
-- =====================================================

-- Import Batches
CREATE POLICY "Tenant import batches policy" ON import_batches FOR ALL
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager'));

-- Import Batch Rows
CREATE POLICY "Tenant import rows policy" ON import_batch_rows FOR ALL
USING (tenant_id = get_jwt_tenant_id() AND get_jwt_user_role() IN ('owner', 'manager'));

-- Audit Logs
CREATE POLICY "Tenant audit logs select policy" ON audit_logs FOR SELECT
USING (
  tenant_id = get_jwt_tenant_id() AND (
    get_jwt_user_role() = 'owner' OR 
    user_id = auth.uid()
  )
);

CREATE POLICY "Tenant audit logs insert policy" ON audit_logs FOR INSERT
WITH CHECK (tenant_id = get_jwt_tenant_id());
