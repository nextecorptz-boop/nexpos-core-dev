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
  ('01HZDEV00000000000TENANT01', 'Kariakoo Footwear Ltd',  'kariakoo-footwear', 'TZ', 'TZS', 'Africa/Dar_es_Salaam', 0.18, 'active'),
  ('01HZDEV00000000000TENANT02', 'Zanzibar Boutique SARL', 'zanzibar-boutique', 'TZ', 'TZS', 'Africa/Dar_es_Salaam', 0.18, 'active');


-- ─────────────────────────────────────────────────────────────────────────────
-- BRANCHES
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.branches (id, tenant_id, name, code, address, phone, is_active)
VALUES
  -- Tenant 1 branches
  ('01HZDEV00000000000BRANCH01', '01HZDEV00000000000TENANT01', 'Main Street Store', 'MSS', 'Kariakoo Market, Dar es Salaam', '+255 22 123 4567', true),
  ('01HZDEV00000000000BRANCH02', '01HZDEV00000000000TENANT01', 'Mlimani City Branch', 'MCB', 'Mlimani City Mall, Sam Nujoma Rd', '+255 22 765 4321', true),
  -- Tenant 2 branches
  ('01HZDEV00000000000BRANCH03', '01HZDEV00000000000TENANT02', 'Stone Town Store', 'STS', 'Stone Town, Zanzibar City', '+255 24 223 1234', true);


-- ─────────────────────────────────────────────────────────────────────────────
-- AUTH USERS + PROFILES
-- Dev users and profiles are seeded via `supabase/seed-users.ts` using the
-- Supabase Admin API.  DO NOT INSERT directly into auth.users or
-- auth.identities — that pattern caused GoTrue schema drift and is the
-- reason the previous project was abandoned.
-- Run:  npx tsx supabase/seed-users.ts
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- PRODUCT FAMILIES
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.product_families (id, tenant_id, name, brand, category, description, attributes, is_active)
VALUES
  ('01HZDEV00000000000FAMPD001', '01HZDEV00000000000TENANT01', 'Air Force 1 White',      'Nike',   'Running',  'Classic white low-top sneaker', '{"gender": "unisex", "closure": "lace-up"}'::jsonb, true),
  ('01HZDEV00000000000FAMPD002', '01HZDEV00000000000TENANT01', 'Classic Leather Oxford', 'Clarks', 'Formal',   'Formal leather shoe for business', '{"gender": "male", "material": "genuine leather"}'::jsonb, true),
  ('01HZDEV00000000000FAMPD003', '01HZDEV00000000000TENANT01', 'Stan Smith Green',       'Adidas', 'Casual',   'Iconic tennis-style shoe', '{"gender": "unisex", "closure": "lace-up"}'::jsonb, true),
  ('01HZDEV00000000000FAMPD004', '01HZDEV00000000000TENANT01', 'Timberland 6-Inch Boot', 'Timberland', 'Boots', 'Waterproof nubuck leather boot', '{"gender": "male", "waterproof": true}'::jsonb, true),
  ('01HZDEV00000000000FAMPD005', '01HZDEV00000000000TENANT01', 'Pegasus Trail Runner',   'Nike',   'Sport',    'Trail running shoe with grip', '{"gender": "unisex", "terrain": "trail"}'::jsonb, true),
  -- Tenant 2 products (completely separate)
  ('01HZDEV00000000000FAMPD006', '01HZDEV00000000000TENANT02', 'Maasai Sandal Classic',  'Handcraft', 'Casual', 'Hand-stitched leather sandal', '{"gender": "unisex", "made_in": "Tanzania"}'::jsonb, true);


-- ─────────────────────────────────────────────────────────────────────────────
-- PRODUCT VARNT0TS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.product_variants (id, family_id, tenant_id, sku, size, color, cost_price, sell_price, is_active)
VALUES
  -- Air Force 1 White — sizes 39-44
  ('01HZDEV00000000000VARNT001', '01HZDEV00000000000FAMPD001', '01HZDEV00000000000TENANT01', 'NK-AF1-W-39', '39', 'White', 65000, 120000, true),
  ('01HZDEV00000000000VARNT002', '01HZDEV00000000000FAMPD001', '01HZDEV00000000000TENANT01', 'NK-AF1-W-40', '40', 'White', 65000, 120000, true),
  ('01HZDEV00000000000VARNT003', '01HZDEV00000000000FAMPD001', '01HZDEV00000000000TENANT01', 'NK-AF1-W-41', '41', 'White', 65000, 120000, true),
  ('01HZDEV00000000000VARNT004', '01HZDEV00000000000FAMPD001', '01HZDEV00000000000TENANT01', 'NK-AF1-W-42', '42', 'White', 65000, 120000, true),
  ('01HZDEV00000000000VARNT005', '01HZDEV00000000000FAMPD001', '01HZDEV00000000000TENANT01', 'NK-AF1-W-43', '43', 'White', 65000, 120000, true),
  ('01HZDEV00000000000VARNT006', '01HZDEV00000000000FAMPD001', '01HZDEV00000000000TENANT01', 'NK-AF1-W-44', '44', 'White', 65000, 120000, true),
  -- Clarks Oxford — sizes 40-45
  ('01HZDEV00000000000VARNT007', '01HZDEV00000000000FAMPD002', '01HZDEV00000000000TENANT01', 'CL-OXF-B-40', '40', 'Black', 85000, 189000, true),
  ('01HZDEV00000000000VARNT008', '01HZDEV00000000000FAMPD002', '01HZDEV00000000000TENANT01', 'CL-OXF-B-41', '41', 'Black', 85000, 189000, true),
  ('01HZDEV00000000000VARNT009', '01HZDEV00000000000FAMPD002', '01HZDEV00000000000TENANT01', 'CL-OXF-B-42', '42', 'Black', 85000, 189000, true),
  ('01HZDEV00000000000VARNT010', '01HZDEV00000000000FAMPD002', '01HZDEV00000000000TENANT01', 'CL-OXF-T-42', '42', 'Tan',   85000, 189000, true),
  -- Stan Smith — sizes 39-44
  ('01HZDEV00000000000VARNT011', '01HZDEV00000000000FAMPD003', '01HZDEV00000000000TENANT01', 'AD-SS-G-40', '40', 'White/Green', 55000, 95000, true),
  ('01HZDEV00000000000VARNT012', '01HZDEV00000000000FAMPD003', '01HZDEV00000000000TENANT01', 'AD-SS-G-42', '42', 'White/Green', 55000, 95000, true),
  -- Timberland Boots
  ('01HZDEV00000000000VARNT013', '01HZDEV00000000000FAMPD004', '01HZDEV00000000000TENANT01', 'TB-6IN-W-41', '41', 'Wheat', 130000, 245000, true),
  ('01HZDEV00000000000VARNT014', '01HZDEV00000000000FAMPD004', '01HZDEV00000000000TENANT01', 'TB-6IN-W-42', '42', 'Wheat', 130000, 245000, true),
  -- Nike Pegasus
  ('01HZDEV00000000000VARNT015', '01HZDEV00000000000FAMPD005', '01HZDEV00000000000TENANT01', 'NK-PEG-B-41', '41', 'Black/Red', 90000, 165000, true),
  ('01HZDEV00000000000VARNT016', '01HZDEV00000000000FAMPD005', '01HZDEV00000000000TENANT01', 'NK-PEG-B-42', '42', 'Black/Red', 90000, 165000, true),
  -- Tenant 2 variants
  ('01HZDEV00000000000VARNT017', '01HZDEV00000000000FAMPD006', '01HZDEV00000000000TENANT02', 'HND-MSS-BR-38', '38', 'Brown', 15000, 35000, true),
  ('01HZDEV00000000000VARNT018', '01HZDEV00000000000FAMPD006', '01HZDEV00000000000TENANT02', 'HND-MSS-BR-40', '40', 'Brown', 15000, 35000, true);


-- ─────────────────────────────────────────────────────────────────────────────
-- STOCK LEVELS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.stock_levels (tenant_id, branch_id, variant_id, on_hand, reorder_point)
VALUES
  -- Branch 1 (Main Street) — Tenant 1
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT001', 12, 3),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT002', 8,  3),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT003', 15, 3),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT004', 6,  3),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT005', 2,  3),  -- low stock
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT006', 0,  3),  -- out of stock
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT007', 5,  2),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT008', 4,  2),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT009', 3,  2),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT010', 2,  2),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT011', 10, 3),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT012', 7,  3),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT013', 4,  2),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT014', 3,  2),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT015', 8,  3),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT016', 5,  3),
  -- Branch 2 (Mlimani City) — Tenant 1
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH02', '01HZDEV00000000000VARNT001', 6,  3),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH02', '01HZDEV00000000000VARNT003', 9,  3),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH02', '01HZDEV00000000000VARNT004', 4,  3),
  -- Branch 3 (Stone Town) — Tenant 2
  ('01HZDEV00000000000TENANT02', '01HZDEV00000000000BRANCH03', '01HZDEV00000000000VARNT017', 20, 5),
  ('01HZDEV00000000000TENANT02', '01HZDEV00000000000BRANCH03', '01HZDEV00000000000VARNT018', 15, 5);


-- ─────────────────────────────────────────────────────────────────────────────
-- CUSTOMERS (sample)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.customers (id, tenant_id, full_name, phone, email, is_active)
VALUES
  ('01HZDEV00000000000CVSTMR01', '01HZDEV00000000000TENANT01', 'Mohamed Ally',    '+255 712 555 001', NULL,                     true),
  ('01HZDEV00000000000CVSTMR02', '01HZDEV00000000000TENANT01', 'Zainab Ibrahim',  '+255 754 555 002', 'zainab@example.com',     true),
  ('01HZDEV00000000000CVSTMR03', '01HZDEV00000000000TENANT01', 'David Mutua',     '+255 789 555 003', NULL,                     true),
  ('01HZDEV00000000000CVSTMR04', '01HZDEV00000000000TENANT02', 'Aisha Khamis',    '+255 777 666 001', 'aisha@zanzibarboutique.co.tz', true);
