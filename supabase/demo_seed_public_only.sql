-- =============================================================================
-- SEED: Demo Data For Production/Staging (Idempotent)
-- File: supabase/demo_seed_public_only.sql
-- Description: Safe, rerunnable seed file that only writes to public tables.
--              No auth schema writes. Safe for execution in Supabase SQL Editor.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TENANTS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.tenants (id, name, slug, country_code, currency_code, timezone, vat_rate, status)
VALUES
  ('01HZDEV00000000000TENANT01', 'Kariakoo Footwear Ltd',  'kariakoo-footwear', 'TZ', 'TZS', 'Africa/Dar_es_Salaam', 0.18, 'active'),
  ('01HZDEV00000000000TENANT02', 'Zanzibar Boutique SARL', 'zanzibar-boutique', 'TZ', 'TZS', 'Africa/Dar_es_Salaam', 0.18, 'active')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  country_code = EXCLUDED.country_code,
  currency_code = EXCLUDED.currency_code,
  timezone = EXCLUDED.timezone,
  vat_rate = EXCLUDED.vat_rate,
  status = EXCLUDED.status;

-- ─────────────────────────────────────────────────────────────────────────────
-- BRANCHES
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.branches (id, tenant_id, name, code, address, phone, is_active)
VALUES
  ('01HZDEV00000000000BRANCH01', '01HZDEV00000000000TENANT01', 'Main Street Store', 'MSS', 'Kariakoo Market, Dar es Salaam', '+255 22 123 4567', true),
  ('01HZDEV00000000000BRANCH02', '01HZDEV00000000000TENANT01', 'Mlimani City Branch', 'MCB', 'Mlimani City Mall, Sam Nujoma Rd', '+255 22 765 4321', true),
  ('01HZDEV00000000000BRANCH03', '01HZDEV00000000000TENANT02', 'Stone Town Store', 'STS', 'Stone Town, Zanzibar City', '+255 24 223 1234', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  is_active = EXCLUDED.is_active;

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
  ('01HZDEV00000000000FAMPD006', '01HZDEV00000000000TENANT02', 'Maasai Sandal Classic',  'Handcraft', 'Casual', 'Hand-stitched leather sandal', '{"gender": "unisex", "made_in": "Tanzania"}'::jsonb, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  attributes = EXCLUDED.attributes,
  is_active = EXCLUDED.is_active;

-- ─────────────────────────────────────────────────────────────────────────────
-- PRODUCT VARIANTS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.product_variants (id, family_id, tenant_id, sku, size, color, cost_price, sell_price, is_active)
VALUES
  ('01HZDEV00000000000VARNT001', '01HZDEV00000000000FAMPD001', '01HZDEV00000000000TENANT01', 'NK-AF1-W-39', '39', 'White', 65000, 120000, true),
  ('01HZDEV00000000000VARNT002', '01HZDEV00000000000FAMPD001', '01HZDEV00000000000TENANT01', 'NK-AF1-W-40', '40', 'White', 65000, 120000, true),
  ('01HZDEV00000000000VARNT003', '01HZDEV00000000000FAMPD001', '01HZDEV00000000000TENANT01', 'NK-AF1-W-41', '41', 'White', 65000, 120000, true),
  ('01HZDEV00000000000VARNT004', '01HZDEV00000000000FAMPD001', '01HZDEV00000000000TENANT01', 'NK-AF1-W-42', '42', 'White', 65000, 120000, true),
  ('01HZDEV00000000000VARNT005', '01HZDEV00000000000FAMPD001', '01HZDEV00000000000TENANT01', 'NK-AF1-W-43', '43', 'White', 65000, 120000, true),
  ('01HZDEV00000000000VARNT006', '01HZDEV00000000000FAMPD001', '01HZDEV00000000000TENANT01', 'NK-AF1-W-44', '44', 'White', 65000, 120000, true),
  ('01HZDEV00000000000VARNT007', '01HZDEV00000000000FAMPD002', '01HZDEV00000000000TENANT01', 'CL-OXF-B-40', '40', 'Black', 85000, 189000, true),
  ('01HZDEV00000000000VARNT008', '01HZDEV00000000000FAMPD002', '01HZDEV00000000000TENANT01', 'CL-OXF-B-41', '41', 'Black', 85000, 189000, true),
  ('01HZDEV00000000000VARNT009', '01HZDEV00000000000FAMPD002', '01HZDEV00000000000TENANT01', 'CL-OXF-B-42', '42', 'Black', 85000, 189000, true),
  ('01HZDEV00000000000VARNT010', '01HZDEV00000000000FAMPD002', '01HZDEV00000000000TENANT01', 'CL-OXF-T-42', '42', 'Tan',   85000, 189000, true),
  ('01HZDEV00000000000VARNT011', '01HZDEV00000000000FAMPD003', '01HZDEV00000000000TENANT01', 'AD-SS-G-40', '40', 'White/Green', 55000, 95000, true),
  ('01HZDEV00000000000VARNT012', '01HZDEV00000000000FAMPD003', '01HZDEV00000000000TENANT01', 'AD-SS-G-42', '42', 'White/Green', 55000, 95000, true),
  ('01HZDEV00000000000VARNT013', '01HZDEV00000000000FAMPD004', '01HZDEV00000000000TENANT01', 'TB-6IN-W-41', '41', 'Wheat', 130000, 245000, true),
  ('01HZDEV00000000000VARNT014', '01HZDEV00000000000FAMPD004', '01HZDEV00000000000TENANT01', 'TB-6IN-W-42', '42', 'Wheat', 130000, 245000, true),
  ('01HZDEV00000000000VARNT015', '01HZDEV00000000000FAMPD005', '01HZDEV00000000000TENANT01', 'NK-PEG-B-41', '41', 'Black/Red', 90000, 165000, true),
  ('01HZDEV00000000000VARNT016', '01HZDEV00000000000FAMPD005', '01HZDEV00000000000TENANT01', 'NK-PEG-B-42', '42', 'Black/Red', 90000, 165000, true),
  ('01HZDEV00000000000VARNT017', '01HZDEV00000000000FAMPD006', '01HZDEV00000000000TENANT02', 'HND-MSS-BR-38', '38', 'Brown', 15000, 35000, true),
  ('01HZDEV00000000000VARNT018', '01HZDEV00000000000FAMPD006', '01HZDEV00000000000TENANT02', 'HND-MSS-BR-40', '40', 'Brown', 15000, 35000, true)
ON CONFLICT (id) DO UPDATE SET
  sku = EXCLUDED.sku,
  size = EXCLUDED.size,
  color = EXCLUDED.color,
  cost_price = EXCLUDED.cost_price,
  sell_price = EXCLUDED.sell_price,
  is_active = EXCLUDED.is_active;

-- ─────────────────────────────────────────────────────────────────────────────
-- STOCK LEVELS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.stock_levels (tenant_id, branch_id, variant_id, on_hand, reorder_point)
VALUES
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT001', 12, 3),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT002', 8,  3),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT003', 15, 3),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT004', 6,  3),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT005', 2,  3),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', '01HZDEV00000000000VARNT006', 0,  3),
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
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH02', '01HZDEV00000000000VARNT001', 6,  3),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH02', '01HZDEV00000000000VARNT003', 9,  3),
  ('01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH02', '01HZDEV00000000000VARNT004', 4,  3),
  ('01HZDEV00000000000TENANT02', '01HZDEV00000000000BRANCH03', '01HZDEV00000000000VARNT017', 20, 5),
  ('01HZDEV00000000000TENANT02', '01HZDEV00000000000BRANCH03', '01HZDEV00000000000VARNT018', 15, 5)
ON CONFLICT (branch_id, variant_id) DO UPDATE SET 
  on_hand = EXCLUDED.on_hand,
  reorder_point = EXCLUDED.reorder_point;

-- ─────────────────────────────────────────────────────────────────────────────
-- CUSTOMERS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.customers (id, tenant_id, full_name, phone, email, is_active)
VALUES
  ('01HZDEV00000000000CVSTMR01', '01HZDEV00000000000TENANT01', 'Mohamed Ally',    '+255 712 555 001', NULL,                     true),
  ('01HZDEV00000000000CVSTMR02', '01HZDEV00000000000TENANT01', 'Zainab Ibrahim',  '+255 754 555 002', 'zainab@example.com',     true),
  ('01HZDEV00000000000CVSTMR03', '01HZDEV00000000000TENANT01', 'David Mutua',     '+255 789 555 003', NULL,                     true),
  ('01HZDEV00000000000CVSTMR04', '01HZDEV00000000000TENANT02', 'Aisha Khamis',    '+255 777 666 001', 'aisha@zanzibarboutique.co.tz', true)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  is_active = EXCLUDED.is_active;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES
-- ─────────────────────────────────────────────────────────────────────────────
SELECT count(*) as tenants_count FROM public.tenants;
SELECT count(*) as branches_count FROM public.branches;
SELECT count(*) as product_families_count FROM public.product_families;
SELECT count(*) as product_variants_count FROM public.product_variants;
SELECT count(*) as stock_levels_count FROM public.stock_levels;
SELECT count(*) as customers_count FROM public.customers;
