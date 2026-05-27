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
-- AUTH USERS (bootstrap for dev seeding)
-- supabase db reset truncates auth.users, so we must re-create them here
-- BEFORE inserting profiles (profiles.id FK → auth.users.id).
--
-- This uses direct INSERT into auth.users + auth.identities.
-- Password for ALL dev users: "password123"
-- Hash is pre-computed bcrypt ($2a$10$...) because pgcrypto's crypt()/gen_salt()
-- live in the extensions schema and are not on search_path during seed execution.
-- DO NOT use this pattern in production — use the Admin API instead.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_sent_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES
  -- Owner (Tenant 1)
  (
    '59bac885-f42d-4bee-9f3b-a15a3f6427c4',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'owner@nexpos.dev',
    '$2a$10$PwGnMiLSJi/VZ1GDYMa0RuEbjPHsODQvCVHQ8OL1mJn5EZqG6CJzO',
    now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"James Kimani"}'::jsonb,
    now(), now()
  ),
  -- Manager (Tenant 1)
  (
    'e4f2083e-55e9-4ad2-925a-aa4b5d8d5dea',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'manager@nexpos.dev',
    '$2a$10$PwGnMiLSJi/VZ1GDYMa0RuEbjPHsODQvCVHQ8OL1mJn5EZqG6CJzO',
    now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Amina Hassan"}'::jsonb,
    now(), now()
  ),
  -- Cashier (Tenant 1, Branch 1)
  (
    '2442aa5a-e4d7-409e-b91e-7addb5c2db21',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'cashier@nexpos.dev',
    '$2a$10$PwGnMiLSJi/VZ1GDYMa0RuEbjPHsODQvCVHQ8OL1mJn5EZqG6CJzO',
    now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Peter Mwangi"}'::jsonb,
    now(), now()
  ),
  -- Cashier 2 (Tenant 1, Branch 2)
  (
    'a0000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'grace@nexpos.dev',
    '$2a$10$PwGnMiLSJi/VZ1GDYMa0RuEbjPHsODQvCVHQ8OL1mJn5EZqG6CJzO',
    now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Grace Odhiambo"}'::jsonb,
    now(), now()
  ),
  -- Owner (Tenant 2)
  (
    'b0000000-0000-4000-8000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'fatima@nexpos.dev',
    '$2a$10$PwGnMiLSJi/VZ1GDYMa0RuEbjPHsODQvCVHQ8OL1mJn5EZqG6CJzO',
    now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Fatima Said"}'::jsonb,
    now(), now()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- AUTH IDENTITIES (required by GoTrue for email/password login)
-- Without these rows, auth.signInWithPassword will fail even though
-- the user row exists in auth.users.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) VALUES
  (
    '59bac885-f42d-4bee-9f3b-a15a3f6427c4',
    '59bac885-f42d-4bee-9f3b-a15a3f6427c4',
    'owner@nexpos.dev',
    format('{"sub":"%s","email":"%s"}', '59bac885-f42d-4bee-9f3b-a15a3f6427c4', 'owner@nexpos.dev')::jsonb,
    'email', now(), now(), now()
  ),
  (
    'e4f2083e-55e9-4ad2-925a-aa4b5d8d5dea',
    'e4f2083e-55e9-4ad2-925a-aa4b5d8d5dea',
    'manager@nexpos.dev',
    format('{"sub":"%s","email":"%s"}', 'e4f2083e-55e9-4ad2-925a-aa4b5d8d5dea', 'manager@nexpos.dev')::jsonb,
    'email', now(), now(), now()
  ),
  (
    '2442aa5a-e4d7-409e-b91e-7addb5c2db21',
    '2442aa5a-e4d7-409e-b91e-7addb5c2db21',
    'cashier@nexpos.dev',
    format('{"sub":"%s","email":"%s"}', '2442aa5a-e4d7-409e-b91e-7addb5c2db21', 'cashier@nexpos.dev')::jsonb,
    'email', now(), now(), now()
  ),
  (
    'a0000000-0000-4000-8000-000000000004',
    'a0000000-0000-4000-8000-000000000004',
    'grace@nexpos.dev',
    format('{"sub":"%s","email":"%s"}', 'a0000000-0000-4000-8000-000000000004', 'grace@nexpos.dev')::jsonb,
    'email', now(), now(), now()
  ),
  (
    'b0000000-0000-4000-8000-000000000005',
    'b0000000-0000-4000-8000-000000000005',
    'fatima@nexpos.dev',
    format('{"sub":"%s","email":"%s"}', 'b0000000-0000-4000-8000-000000000005', 'fatima@nexpos.dev')::jsonb,
    'email', now(), now(), now()
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- PROFILES
-- Now safe to insert — auth.users rows exist above.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.profiles (id, tenant_id, branch_id, full_name, role, phone, is_active)
VALUES
  ('59bac885-f42d-4bee-9f3b-a15a3f6427c4', '01HZDEV00000000000TENANT01', NULL,                          'James Kimani',  'owner',   '+255 712 111 001', true),
  ('e4f2083e-55e9-4ad2-925a-aa4b5d8d5dea', '01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', 'Amina Hassan',  'manager', '+255 712 111 002', true),
  ('2442aa5a-e4d7-409e-b91e-7addb5c2db21', '01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH01', 'Peter Mwangi',  'cashier', '+255 712 111 003', true),
  ('a0000000-0000-4000-8000-000000000004', '01HZDEV00000000000TENANT01', '01HZDEV00000000000BRANCH02', 'Grace Odhiambo','cashier', '+255 712 111 004', true),
  ('b0000000-0000-4000-8000-000000000005', '01HZDEV00000000000TENANT02', NULL,                          'Fatima Said',   'owner',   '+255 777 222 001', true);


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
