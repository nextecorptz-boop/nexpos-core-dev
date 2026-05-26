-- =============================================================================
-- SEED: Local Development Data
-- File: supabase/seed/001_dev_seed.sql
-- Run: supabase db reset (auto-applied) OR psql < supabase/seed/001_dev_seed.sql
-- DO NOT run in production.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TENANTS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.tenants (id, name, slug, country_code, currency_code, timezone, vat_rate, status)
VALUES
  ('01HZDEV00000000000000TENANT1', 'Kariakoo Footwear Ltd',  'kariakoo-footwear', 'TZ', 'TZS', 'Africa/Dar_es_Salaam', 0.18, 'active'),
  ('01HZDEV00000000000000TENANT2', 'Zanzibar Boutique SARL', 'zanzibar-boutique', 'TZ', 'TZS', 'Africa/Dar_es_Salaam', 0.18, 'active');


-- ─────────────────────────────────────────────────────────────────────────────
-- BRANCHES
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.branches (id, tenant_id, name, code, address, phone, is_active)
VALUES
  -- Tenant 1 branches
  ('01HZDEV00000000000000BRANCH1', '01HZDEV00000000000000TENANT1', 'Main Street Store', 'MSS', 'Kariakoo Market, Dar es Salaam', '+255 22 123 4567', true),
  ('01HZDEV00000000000000BRANCH2', '01HZDEV00000000000000TENANT1', 'Mlimani City Branch', 'MCB', 'Mlimani City Mall, Sam Nujoma Rd', '+255 22 765 4321', true),
  -- Tenant 2 branches
  ('01HZDEV00000000000000BRANCH3', '01HZDEV00000000000000TENANT2', 'Stone Town Store', 'STS', 'Stone Town, Zanzibar City', '+255 24 223 1234', true);


-- ─────────────────────────────────────────────────────────────────────────────
-- AUTH USERS (Supabase manages auth.users; we insert test profiles directly)
-- In local dev, create users via `supabase auth admin create-user` or dashboard,
-- then insert profile rows using the UUID Supabase assigns.
--
-- PLACEHOLDER UUIDs below — replace with actual UUIDs from your local auth.users.
-- Run: SELECT id, email FROM auth.users; after creating users in the dashboard.
-- ─────────────────────────────────────────────────────────────────────────────

-- Real UUIDs from auth.users (verified 2026-05-26 via Supabase Dashboard)
-- owner@nexpos.com   → 59bac885-f42d-4bee-9f3b-a15a3f6427c4
-- manager@nexpos.com → e4f2083e-55e9-4ad2-925a-aa4b5d8d5dea
-- cashier@nexpos.com → 2442aa5a-e4d7-409e-b91e-7addb5c2db21
-- TODO: grace@nexpos.com  → replace '00000000-0000-0000-0000-000000000004' (not in auth.users yet)
-- TODO: fatima@nexpos.com → replace '00000000-0000-0000-0000-000000000005' (not in auth.users yet)

INSERT INTO public.profiles (id, tenant_id, branch_id, full_name, role, phone, is_active)
VALUES
  ('59bac885-f42d-4bee-9f3b-a15a3f6427c4', '01HZDEV00000000000000TENANT1', NULL,                          'James Kimani',  'owner',   '+255 712 111 001', true),
  ('e4f2083e-55e9-4ad2-925a-aa4b5d8d5dea', '01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH1', 'Amina Hassan',  'manager', '+255 712 111 002', true),
  ('2442aa5a-e4d7-409e-b91e-7addb5c2db21', '01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH1', 'Peter Mwangi',  'cashier', '+255 712 111 003', true),
  -- TODO: Create grace@nexpos.com in auth.users, then replace the UUID below
  ('00000000-0000-0000-0000-000000000004', '01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH2', 'Grace Odhiambo','cashier', '+255 712 111 004', true),
  -- Tenant 2 — TODO: Create fatima@nexpos.com in auth.users, then replace the UUID below
  ('00000000-0000-0000-0000-000000000005', '01HZDEV00000000000000TENANT2', NULL,                          'Fatima Said',   'owner',   '+255 777 222 001', true);


-- ─────────────────────────────────────────────────────────────────────────────
-- PRODUCT FAMILIES
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.product_families (id, tenant_id, name, brand, category, description, attributes, is_active)
VALUES
  ('01HZDEV0000000000000FAMILY01', '01HZDEV00000000000000TENANT1', 'Air Force 1 White',      'Nike',   'Running',  'Classic white low-top sneaker', '{"gender": "unisex", "closure": "lace-up"}'::jsonb, true),
  ('01HZDEV0000000000000FAMILY02', '01HZDEV00000000000000TENANT1', 'Classic Leather Oxford', 'Clarks', 'Formal',   'Formal leather shoe for business', '{"gender": "male", "material": "genuine leather"}'::jsonb, true),
  ('01HZDEV0000000000000FAMILY03', '01HZDEV00000000000000TENANT1', 'Stan Smith Green',       'Adidas', 'Casual',   'Iconic tennis-style shoe', '{"gender": "unisex", "closure": "lace-up"}'::jsonb, true),
  ('01HZDEV0000000000000FAMILY04', '01HZDEV00000000000000TENANT1', 'Timberland 6-Inch Boot', 'Timberland', 'Boots', 'Waterproof nubuck leather boot', '{"gender": "male", "waterproof": true}'::jsonb, true),
  ('01HZDEV0000000000000FAMILY05', '01HZDEV00000000000000TENANT1', 'Pegasus Trail Runner',   'Nike',   'Sport',    'Trail running shoe with grip', '{"gender": "unisex", "terrain": "trail"}'::jsonb, true),
  -- Tenant 2 products (completely separate)
  ('01HZDEV0000000000000FAMILY06', '01HZDEV00000000000000TENANT2', 'Maasai Sandal Classic',  'Handcraft', 'Casual', 'Hand-stitched leather sandal', '{"gender": "unisex", "made_in": "Tanzania"}'::jsonb, true);


-- ─────────────────────────────────────────────────────────────────────────────
-- PRODUCT VARIANTS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.product_variants (id, family_id, tenant_id, sku, size, color, cost_price, sell_price, is_active)
VALUES
  -- Air Force 1 White — sizes 39-44
  ('01HZDEV000000000000VARIANT01', '01HZDEV0000000000000FAMILY01', '01HZDEV00000000000000TENANT1', 'NK-AF1-W-39', '39', 'White', 65000, 120000, true),
  ('01HZDEV000000000000VARIANT02', '01HZDEV0000000000000FAMILY01', '01HZDEV00000000000000TENANT1', 'NK-AF1-W-40', '40', 'White', 65000, 120000, true),
  ('01HZDEV000000000000VARIANT03', '01HZDEV0000000000000FAMILY01', '01HZDEV00000000000000TENANT1', 'NK-AF1-W-41', '41', 'White', 65000, 120000, true),
  ('01HZDEV000000000000VARIANT04', '01HZDEV0000000000000FAMILY01', '01HZDEV00000000000000TENANT1', 'NK-AF1-W-42', '42', 'White', 65000, 120000, true),
  ('01HZDEV000000000000VARIANT05', '01HZDEV0000000000000FAMILY01', '01HZDEV00000000000000TENANT1', 'NK-AF1-W-43', '43', 'White', 65000, 120000, true),
  ('01HZDEV000000000000VARIANT06', '01HZDEV0000000000000FAMILY01', '01HZDEV00000000000000TENANT1', 'NK-AF1-W-44', '44', 'White', 65000, 120000, true),
  -- Clarks Oxford — sizes 40-45
  ('01HZDEV000000000000VARIANT07', '01HZDEV0000000000000FAMILY02', '01HZDEV00000000000000TENANT1', 'CL-OXF-B-40', '40', 'Black', 85000, 189000, true),
  ('01HZDEV000000000000VARIANT08', '01HZDEV0000000000000FAMILY02', '01HZDEV00000000000000TENANT1', 'CL-OXF-B-41', '41', 'Black', 85000, 189000, true),
  ('01HZDEV000000000000VARIANT09', '01HZDEV0000000000000FAMILY02', '01HZDEV00000000000000TENANT1', 'CL-OXF-B-42', '42', 'Black', 85000, 189000, true),
  ('01HZDEV000000000000VARIANT10', '01HZDEV0000000000000FAMILY02', '01HZDEV00000000000000TENANT1', 'CL-OXF-T-42', '42', 'Tan',   85000, 189000, true),
  -- Stan Smith — sizes 39-44
  ('01HZDEV000000000000VARIANT11', '01HZDEV0000000000000FAMILY03', '01HZDEV00000000000000TENANT1', 'AD-SS-G-40', '40', 'White/Green', 55000, 95000, true),
  ('01HZDEV000000000000VARIANT12', '01HZDEV0000000000000FAMILY03', '01HZDEV00000000000000TENANT1', 'AD-SS-G-42', '42', 'White/Green', 55000, 95000, true),
  -- Timberland Boots
  ('01HZDEV000000000000VARIANT13', '01HZDEV0000000000000FAMILY04', '01HZDEV00000000000000TENANT1', 'TB-6IN-W-41', '41', 'Wheat', 130000, 245000, true),
  ('01HZDEV000000000000VARIANT14', '01HZDEV0000000000000FAMILY04', '01HZDEV00000000000000TENANT1', 'TB-6IN-W-42', '42', 'Wheat', 130000, 245000, true),
  -- Nike Pegasus
  ('01HZDEV000000000000VARIANT15', '01HZDEV0000000000000FAMILY05', '01HZDEV00000000000000TENANT1', 'NK-PEG-B-41', '41', 'Black/Red', 90000, 165000, true),
  ('01HZDEV000000000000VARIANT16', '01HZDEV0000000000000FAMILY05', '01HZDEV00000000000000TENANT1', 'NK-PEG-B-42', '42', 'Black/Red', 90000, 165000, true),
  -- Tenant 2 variants
  ('01HZDEV000000000000VARIANT17', '01HZDEV0000000000000FAMILY06', '01HZDEV00000000000000TENANT2', 'HND-MSS-BR-38', '38', 'Brown', 15000, 35000, true),
  ('01HZDEV000000000000VARIANT18', '01HZDEV0000000000000FAMILY06', '01HZDEV00000000000000TENANT2', 'HND-MSS-BR-40', '40', 'Brown', 15000, 35000, true);


-- ─────────────────────────────────────────────────────────────────────────────
-- STOCK LEVELS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.stock_levels (tenant_id, branch_id, variant_id, on_hand, reorder_point)
VALUES
  -- Branch 1 (Main Street) — Tenant 1
  ('01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT01', 12, 3),
  ('01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT02', 8,  3),
  ('01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT03', 15, 3),
  ('01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT04', 6,  3),
  ('01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT05', 2,  3),  -- low stock
  ('01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT06', 0,  3),  -- out of stock
  ('01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT07', 5,  2),
  ('01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT08', 4,  2),
  ('01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT09', 3,  2),
  ('01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT10', 2,  2),
  ('01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT11', 10, 3),
  ('01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT12', 7,  3),
  ('01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT13', 4,  2),
  ('01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT14', 3,  2),
  ('01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT15', 8,  3),
  ('01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT16', 5,  3),
  -- Branch 2 (Mlimani City) — Tenant 1
  ('01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH2', '01HZDEV000000000000VARIANT01', 6,  3),
  ('01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH2', '01HZDEV000000000000VARIANT03', 9,  3),
  ('01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH2', '01HZDEV000000000000VARIANT04', 4,  3),
  -- Branch 3 (Stone Town) — Tenant 2
  ('01HZDEV00000000000000TENANT2', '01HZDEV00000000000000BRANCH3', '01HZDEV000000000000VARIANT17', 20, 5),
  ('01HZDEV00000000000000TENANT2', '01HZDEV00000000000000BRANCH3', '01HZDEV000000000000VARIANT18', 15, 5);


-- ─────────────────────────────────────────────────────────────────────────────
-- CUSTOMERS (sample)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.customers (id, tenant_id, full_name, phone, email, is_active)
VALUES
  ('01HZDEV0000000000000CUSTMR1', '01HZDEV00000000000000TENANT1', 'Mohamed Ally',    '+255 712 555 001', NULL,                     true),
  ('01HZDEV0000000000000CUSTMR2', '01HZDEV00000000000000TENANT1', 'Zainab Ibrahim',  '+255 754 555 002', 'zainab@example.com',     true),
  ('01HZDEV0000000000000CUSTMR3', '01HZDEV00000000000000TENANT1', 'David Mutua',     '+255 789 555 003', NULL,                     true),
  ('01HZDEV0000000000000CUSTMR4', '01HZDEV00000000000000TENANT2', 'Aisha Khamis',    '+255 777 666 001', 'aisha@zanzibarboutique.co.tz', true);
