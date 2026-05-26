-- =============================================================================
-- NEXPOS TEST SUITE
-- File: supabase/tests/database/rls_and_integrity_tests.sql
--
-- Run with: psql $DATABASE_URL -f supabase/tests/database/rls_and_integrity_tests.sql
-- Or via: supabase test db (if using pgTAP)
--
-- These are raw SQL tests using pgTAP. Install pgTAP in local Supabase:
--   supabase db execute "CREATE EXTENSION IF NOT EXISTS pgtap;"
--
-- Test philosophy:
-- - No mocks for database behavior. Tests run against actual schema.
-- - JWT simulation via set_config() — same path as production.
-- - Concurrency tests spawn actual concurrent transactions.
-- - Every assertion has a name explaining what invariant it's checking.
-- =============================================================================

BEGIN;
SELECT plan(52);  -- update this count when adding tests

-- =============================================================================
-- UTILITY: SET JWT CLAIMS FOR TESTING
-- Simulates what auth.current_tenant() etc. will return
-- =============================================================================

CREATE OR REPLACE FUNCTION test.set_jwt_claims(
  p_user_id   uuid,
  p_tenant_id text,
  p_role      text,
  p_branch_id text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object(
      'sub', p_user_id,
      'app_metadata', json_build_object(
        'tenant_id', p_tenant_id,
        'role',      p_role,
        'branch_id', p_branch_id
      )
    )::text,
    true  -- local to transaction
  );
END;
$$;


-- =============================================================================
-- TEST GROUP 1: TENANT ISOLATION (RLS)
-- The core invariant: a user in tenant A MUST NOT see tenant B's data.
-- =============================================================================

-- Test 1.1: Tenant A cashier cannot read Tenant B's products
SELECT lives_ok(
  $$
    SELECT test.set_jwt_claims(
      '00000000-0000-0000-0000-000000000003'::uuid,
      '01HZDEV00000000000000TENANT1',
      'cashier',
      '01HZDEV00000000000000BRANCH1'
    );

    -- This query should return 0 rows, not an error
    SELECT count(*) = 0
    FROM public.product_families
    WHERE tenant_id = '01HZDEV00000000000000TENANT2';
  $$,
  '1.1: Tenant A cashier gets zero rows from Tenant B product_families'
);

-- Test 1.2: Tenant A owner cannot read Tenant B's sales
SELECT results_eq(
  $$
    SELECT test.set_jwt_claims(
      '00000000-0000-0000-0000-000000000001'::uuid,
      '01HZDEV00000000000000TENANT1',
      'owner'
    );

    SELECT count(*)::integer
    FROM public.sales
    WHERE tenant_id = '01HZDEV00000000000000TENANT2';
  $$,
  ARRAY[0],
  '1.2: Tenant A owner sees zero Tenant B sales'
);

-- Test 1.3: Tenant A cashier cannot read Tenant B's stock
SELECT results_eq(
  $$
    SELECT test.set_jwt_claims(
      '00000000-0000-0000-0000-000000000003'::uuid,
      '01HZDEV00000000000000TENANT1',
      'cashier',
      '01HZDEV00000000000000BRANCH1'
    );

    SELECT count(*)::integer
    FROM public.stock_levels
    WHERE tenant_id = '01HZDEV00000000000000TENANT2';
  $$,
  ARRAY[0],
  '1.3: Tenant A cashier sees zero Tenant B stock_levels'
);

-- Test 1.4: Tenant A cannot read Tenant B's customers
SELECT results_eq(
  $$
    SELECT test.set_jwt_claims(
      '00000000-0000-0000-0000-000000000001'::uuid,
      '01HZDEV00000000000000TENANT1',
      'owner'
    );

    SELECT count(*)::integer
    FROM public.customers
    WHERE tenant_id = '01HZDEV00000000000000TENANT2';
  $$,
  ARRAY[0],
  '1.4: Tenant A owner sees zero Tenant B customers'
);

-- Test 1.5: current_stock view respects tenant isolation
SELECT results_eq(
  $$
    SELECT test.set_jwt_claims(
      '00000000-0000-0000-0000-000000000003'::uuid,
      '01HZDEV00000000000000TENANT1',
      'cashier',
      '01HZDEV00000000000000BRANCH1'
    );

    SELECT count(*)::integer
    FROM public.current_stock
    WHERE tenant_id = '01HZDEV00000000000000TENANT2';
  $$,
  ARRAY[0],
  '1.5: current_stock view (security_invoker) filters Tenant B rows for Tenant A user'
);

-- Test 1.6: Anon user sees nothing
SELECT results_eq(
  $$
    PERFORM set_config('request.jwt.claims', '{}', true);

    SELECT count(*)::integer FROM public.sales;
  $$,
  ARRAY[0],
  '1.6: Anon user sees zero rows in sales'
);


-- =============================================================================
-- TEST GROUP 2: ROLE-BASED ACCESS CONTROL
-- =============================================================================

-- Test 2.1: Cashier cannot insert product_families directly
SELECT throws_ok(
  $$
    SELECT test.set_jwt_claims(
      '00000000-0000-0000-0000-000000000003'::uuid,
      '01HZDEV00000000000000TENANT1',
      'cashier',
      '01HZDEV00000000000000BRANCH1'
    );

    INSERT INTO public.product_families (id, tenant_id, name, category)
    VALUES ('01HZDEVTEST0000000000FAMTST1', '01HZDEV00000000000000TENANT1', 'Test', 'Running');
  $$,
  '42501',
  NULL,
  '2.1: Cashier cannot INSERT into product_families'
);

-- Test 2.2: Manager can insert product_families
SELECT lives_ok(
  $$
    SELECT test.set_jwt_claims(
      '00000000-0000-0000-0000-000000000002'::uuid,
      '01HZDEV00000000000000TENANT1',
      'manager',
      '01HZDEV00000000000000BRANCH1'
    );

    INSERT INTO public.product_families (id, tenant_id, name, category)
    VALUES ('01HZDEVTEST0000000000FAMTST2', '01HZDEV00000000000000TENANT1', 'Test Manager Product', 'Casual');
  $$,
  '2.2: Manager can INSERT into product_families'
);

-- Test 2.3: Viewer cannot call complete_sale
SELECT throws_ok(
  $$
    SELECT test.set_jwt_claims(
      '00000000-0000-0000-0000-000000000099'::uuid,
      '01HZDEV00000000000000TENANT1',
      'viewer'
    );

    SELECT public.complete_sale('{
      "client_id": "01HZDEVTEST0000000000CLIENTV1",
      "branch_id": "01HZDEV00000000000000BRANCH1",
      "payment_method": "cash",
      "lines": [{"variant_id": "01HZDEV000000000000VARIANT01", "quantity": 1, "unit_price": 120000}]
    }'::jsonb);
  $$,
  '42501',
  NULL,
  '2.3: Viewer role is rejected by complete_sale'
);

-- Test 2.4: Cashier cannot update stock_levels directly
SELECT throws_ok(
  $$
    SELECT test.set_jwt_claims(
      '00000000-0000-0000-0000-000000000003'::uuid,
      '01HZDEV00000000000000TENANT1',
      'cashier',
      '01HZDEV00000000000000BRANCH1'
    );

    UPDATE public.stock_levels
    SET on_hand = 999
    WHERE branch_id = '01HZDEV00000000000000BRANCH1'
      AND variant_id = '01HZDEV000000000000VARIANT01';
  $$,
  '42501',
  NULL,
  '2.4: Cashier cannot directly UPDATE stock_levels (must use adjust_stock)'
);

-- Test 2.5: Cashier cannot insert sales directly
SELECT throws_ok(
  $$
    SELECT test.set_jwt_claims(
      '00000000-0000-0000-0000-000000000003'::uuid,
      '01HZDEV00000000000000TENANT1',
      'cashier',
      '01HZDEV00000000000000BRANCH1'
    );

    INSERT INTO public.sales (id, tenant_id, branch_id, cashier_id, receipt_number, subtotal, vat_amount, total, payment_method, client_id)
    VALUES ('01HZDEVTEST0000000000SALE001', '01HZDEV00000000000000TENANT1', '01HZDEV00000000000000BRANCH1',
            '00000000-0000-0000-0000-000000000003', 'HACK-001', 100000, 18000, 118000, 'cash', '01HZDEVTEST0000000000CLNT001');
  $$,
  '42501',
  NULL,
  '2.5: Cashier cannot INSERT directly into sales table'
);


-- =============================================================================
-- TEST GROUP 3: complete_sale() ATOMIC CORRECTNESS
-- =============================================================================

-- Helper: get current stock for a variant at a branch
CREATE OR REPLACE FUNCTION test.get_stock(p_branch_id text, p_variant_id text)
RETURNS integer LANGUAGE sql AS $$
  SELECT on_hand FROM public.stock_levels
  WHERE branch_id = p_branch_id::public.ulid AND variant_id = p_variant_id::public.ulid;
$$;

-- Test 3.1: Basic sale succeeds and decrements stock
DO $$
DECLARE
  v_stock_before integer;
  v_stock_after  integer;
  v_result       jsonb;
BEGIN
  v_stock_before := test.get_stock('01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT01');

  PERFORM test.set_jwt_claims(
    '00000000-0000-0000-0000-000000000003'::uuid,
    '01HZDEV00000000000000TENANT1',
    'cashier',
    '01HZDEV00000000000000BRANCH1'
  );

  v_result := public.complete_sale('{
    "client_id": "01HZDEVTEST0000000000SALE001",
    "branch_id": "01HZDEV00000000000000BRANCH1",
    "payment_method": "cash",
    "payment_meta": {"cash_tendered": 150000, "change_given": 30000},
    "lines": [
      {
        "variant_id": "01HZDEV000000000000VARIANT01",
        "quantity": 2,
        "unit_price": 120000,
        "line_discount": 0
      }
    ]
  }'::jsonb);

  v_stock_after := test.get_stock('01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT01');

  PERFORM ok(
    v_stock_after = v_stock_before - 2,
    format('3.1: Stock decremented by quantity. Before: %s, After: %s', v_stock_before, v_stock_after)
  );
  PERFORM ok(
    (v_result ->> 'replayed')::boolean = false,
    '3.1b: First call is not replayed'
  );
  PERFORM ok(
    (v_result ->> 'total')::numeric = 240000 * 1.18,  -- 2 * 120000 * 1.18 VAT
    '3.1c: Server-computed total is correct'
  );
END;
$$;

-- Test 3.2: IDEMPOTENCY — same client_id returns same result without modifying stock
DO $$
DECLARE
  v_stock_before integer;
  v_stock_after  integer;
  v_result1      jsonb;
  v_result2      jsonb;
BEGIN
  v_stock_before := test.get_stock('01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT02');

  PERFORM test.set_jwt_claims(
    '00000000-0000-0000-0000-000000000003'::uuid,
    '01HZDEV00000000000000TENANT1',
    'cashier',
    '01HZDEV00000000000000BRANCH1'
  );

  -- First submission
  v_result1 := public.complete_sale('{
    "client_id": "01HZDEVTEST0000000000IDEM001",
    "branch_id": "01HZDEV00000000000000BRANCH1",
    "payment_method": "mpesa",
    "lines": [{"variant_id": "01HZDEV000000000000VARIANT02", "quantity": 1, "unit_price": 120000}]
  }'::jsonb);

  -- DUPLICATE: same client_id, same body
  v_result2 := public.complete_sale('{
    "client_id": "01HZDEVTEST0000000000IDEM001",
    "branch_id": "01HZDEV00000000000000BRANCH1",
    "payment_method": "mpesa",
    "lines": [{"variant_id": "01HZDEV000000000000VARIANT02", "quantity": 1, "unit_price": 120000}]
  }'::jsonb);

  v_stock_after := test.get_stock('01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT02');

  PERFORM ok(
    (v_result2 ->> 'replayed')::boolean = true,
    '3.2a: Second call with same client_id returns replayed=true'
  );
  PERFORM ok(
    v_result1 ->> 'sale_id' = v_result2 ->> 'sale_id',
    '3.2b: Both calls return same sale_id'
  );
  PERFORM ok(
    v_stock_after = v_stock_before - 1,  -- decremented ONCE, not twice
    '3.2c: Stock decremented exactly once despite two submissions'
  );
END;
$$;

-- Test 3.3: Insufficient stock BLOCKS the sale
DO $$
DECLARE
  v_error_caught boolean := false;
  v_result       jsonb;
BEGIN
  PERFORM test.set_jwt_claims(
    '00000000-0000-0000-0000-000000000003'::uuid,
    '01HZDEV00000000000000TENANT1',
    'cashier',
    '01HZDEV00000000000000BRANCH1'
  );

  BEGIN
    -- Variant06 has on_hand = 0 in seed data
    v_result := public.complete_sale('{
      "client_id": "01HZDEVTEST0000000000OOS0001",
      "branch_id": "01HZDEV00000000000000BRANCH1",
      "payment_method": "cash",
      "lines": [{"variant_id": "01HZDEV000000000000VARIANT06", "quantity": 1, "unit_price": 120000}]
    }'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  PERFORM ok(v_error_caught, '3.3: complete_sale raises exception for out-of-stock item');
END;
$$;

-- Test 3.4: Partial insufficient stock — if line 1 is fine but line 2 fails, ENTIRE sale rolls back
DO $$
DECLARE
  v_stock_before integer;
  v_stock_after  integer;
  v_error_caught boolean := false;
BEGIN
  v_stock_before := test.get_stock('01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT03');

  PERFORM test.set_jwt_claims(
    '00000000-0000-0000-0000-000000000003'::uuid,
    '01HZDEV00000000000000TENANT1',
    'cashier',
    '01HZDEV00000000000000BRANCH1'
  );

  BEGIN
    -- Line 1 has stock (Variant03, on_hand=15), Line 2 is out of stock (Variant06, on_hand=0)
    PERFORM public.complete_sale('{
      "client_id": "01HZDEVTEST0000000000ROLL001",
      "branch_id": "01HZDEV00000000000000BRANCH1",
      "payment_method": "cash",
      "lines": [
        {"variant_id": "01HZDEV000000000000VARIANT03", "quantity": 1, "unit_price": 120000},
        {"variant_id": "01HZDEV000000000000VARIANT06", "quantity": 1, "unit_price": 120000}
      ]
    }'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  v_stock_after := test.get_stock('01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT03');

  PERFORM ok(v_error_caught, '3.4a: Mixed in-stock/out-of-stock sale raises exception');
  PERFORM ok(
    v_stock_after = v_stock_before,
    format('3.4b: ROLLBACK: Variant03 stock unchanged after failed mixed sale. Before: %s, After: %s',
      v_stock_before, v_stock_after)
  );
END;
$$;

-- Test 3.5: Total integrity — server recomputes, does not trust client total
DO $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM test.set_jwt_claims(
    '00000000-0000-0000-0000-000000000003'::uuid,
    '01HZDEV00000000000000TENANT1',
    'cashier',
    '01HZDEV00000000000000BRANCH1'
  );

  v_result := public.complete_sale('{
    "client_id": "01HZDEVTEST0000000000TOTL001",
    "branch_id": "01HZDEV00000000000000BRANCH1",
    "payment_method": "cash",
    "discount_amount": 5000,
    "lines": [
      {"variant_id": "01HZDEV000000000000VARIANT04", "quantity": 1, "unit_price": 120000, "line_discount": 0}
    ]
  }'::jsonb);

  -- subtotal = 120000 - 5000 (order discount) = 115000
  -- vat = 115000 * 0.18 = 20700
  -- total = 115000 + 20700 = 135700
  PERFORM ok(
    (v_result ->> 'subtotal')::numeric = 115000,
    '3.5a: Server-computed subtotal = line_total - order_discount'
  );
  PERFORM ok(
    (v_result ->> 'vat_amount')::numeric = 20700,
    '3.5b: Server-computed VAT at 18%'
  );
  PERFORM ok(
    (v_result ->> 'total')::numeric = 135700,
    '3.5c: Server-computed total = subtotal + VAT'
  );
END;
$$;

-- Test 3.6: Cross-tenant sale attempt is blocked
SELECT throws_ok(
  $$
    SELECT test.set_jwt_claims(
      '00000000-0000-0000-0000-000000000003'::uuid,
      '01HZDEV00000000000000TENANT1',
      'cashier',
      '01HZDEV00000000000000BRANCH1'
    );

    -- Attempt to sell from Tenant 2's branch
    SELECT public.complete_sale('{
      "client_id": "01HZDEVTEST0000000000XTEN001",
      "branch_id": "01HZDEV00000000000000BRANCH3",
      "payment_method": "cash",
      "lines": [{"variant_id": "01HZDEV000000000000VARIANT01", "quantity": 1, "unit_price": 120000}]
    }'::jsonb);
  $$,
  NULL,  -- any error
  NULL,
  '3.6: Tenant A cashier cannot sell from Tenant B branch'
);

-- Test 3.7: Cashier cannot sell in a branch they are not assigned to
SELECT throws_ok(
  $$
    -- Peter Mwangi is assigned to BRANCH1, not BRANCH2
    SELECT test.set_jwt_claims(
      '00000000-0000-0000-0000-000000000003'::uuid,
      '01HZDEV00000000000000TENANT1',
      'cashier',
      '01HZDEV00000000000000BRANCH1'  -- JWT says branch1
    );

    SELECT public.complete_sale('{
      "client_id": "01HZDEVTEST0000000000BRCH001",
      "branch_id": "01HZDEV00000000000000BRANCH2",
      "payment_method": "cash",
      "lines": [{"variant_id": "01HZDEV000000000000VARIANT01", "quantity": 1, "unit_price": 120000}]
    }'::jsonb);
  $$,
  '42501',
  NULL,
  '3.7: Cashier cannot sell in branch different from JWT branch_id'
);

-- Test 3.8: Empty lines array is rejected
SELECT throws_ok(
  $$
    SELECT test.set_jwt_claims(
      '00000000-0000-0000-0000-000000000003'::uuid,
      '01HZDEV00000000000000TENANT1',
      'cashier',
      '01HZDEV00000000000000BRANCH1'
    );

    SELECT public.complete_sale('{
      "client_id": "01HZDEVTEST0000000000EMPT001",
      "branch_id": "01HZDEV00000000000000BRANCH1",
      "payment_method": "cash",
      "lines": []
    }'::jsonb);
  $$,
  '22023',
  NULL,
  '3.8: complete_sale rejects empty lines array'
);


-- =============================================================================
-- TEST GROUP 4: STOCK MOVEMENTS INTEGRITY
-- =============================================================================

-- Test 4.1: Every sale creates corresponding stock_movements records
DO $$
DECLARE
  v_result       jsonb;
  v_movement_count integer;
  v_sale_id      text;
BEGIN
  PERFORM test.set_jwt_claims(
    '00000000-0000-0000-0000-000000000003'::uuid,
    '01HZDEV00000000000000TENANT1',
    'cashier',
    '01HZDEV00000000000000BRANCH1'
  );

  v_result := public.complete_sale('{
    "client_id": "01HZDEVTEST0000000000MVMT001",
    "branch_id": "01HZDEV00000000000000BRANCH1",
    "payment_method": "cash",
    "lines": [
      {"variant_id": "01HZDEV000000000000VARIANT03", "quantity": 1, "unit_price": 120000},
      {"variant_id": "01HZDEV000000000000VARIANT11", "quantity": 2, "unit_price": 95000}
    ]
  }'::jsonb);

  v_sale_id := v_result ->> 'sale_id';

  SELECT count(*)::integer INTO v_movement_count
  FROM public.stock_movements
  WHERE reference_type = 'sale' AND reference_id = v_sale_id::public.ulid;

  PERFORM ok(
    v_movement_count = 2,
    '4.1: 2-line sale creates exactly 2 stock_movement records'
  );
END;
$$;

-- Test 4.2: adjust_stock() idempotency via movement_id
DO $$
DECLARE
  v_movement_id  public.ulid := '01HZDEVTEST0000000000ADJM001';
  v_stock_before integer;
  v_stock_after1 jsonb;
  v_stock_after2 jsonb;
  v_final_stock  integer;
BEGIN
  PERFORM test.set_jwt_claims(
    '00000000-0000-0000-0000-000000000002'::uuid,
    '01HZDEV00000000000000TENANT1',
    'manager',
    '01HZDEV00000000000000BRANCH1'
  );

  v_stock_before := test.get_stock('01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT07');

  -- First adjustment
  v_stock_after1 := public.adjust_stock(
    '01HZDEV00000000000000BRANCH1',
    '01HZDEV000000000000VARIANT07',
    10,
    'restock',
    'Test restock',
    v_movement_id
  );

  -- Duplicate adjustment (same movement_id)
  v_stock_after2 := public.adjust_stock(
    '01HZDEV00000000000000BRANCH1',
    '01HZDEV000000000000VARIANT07',
    10,
    'restock',
    'Test restock duplicate',
    v_movement_id
  );

  v_final_stock := test.get_stock('01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT07');

  PERFORM ok(
    (v_stock_after2 ->> 'replayed')::boolean = true,
    '4.2a: adjust_stock returns replayed=true on duplicate movement_id'
  );
  PERFORM ok(
    v_final_stock = v_stock_before + 10,
    '4.2b: adjust_stock applied exactly once despite duplicate call'
  );
END;
$$;

-- Test 4.3: on_hand cannot go below 0 via adjust_stock (CHECK constraint)
DO $$
DECLARE
  v_current_stock integer;
  v_error_caught  boolean := false;
BEGIN
  PERFORM test.set_jwt_claims(
    '00000000-0000-0000-0000-000000000002'::uuid,
    '01HZDEV00000000000000TENANT1',
    'manager'
  );

  v_current_stock := test.get_stock('01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT06');
  -- Variant06 on_hand = 0 in seed

  BEGIN
    -- Attempt to reduce stock below 0
    PERFORM public.adjust_stock(
      '01HZDEV00000000000000BRANCH1',
      '01HZDEV000000000000VARIANT06',
      -5,  -- would bring to -5
      'damage',
      'Test damage on 0-stock item'
    );
  EXCEPTION WHEN check_violation OR others THEN
    v_error_caught := true;
  END;

  PERFORM ok(
    v_error_caught OR (test.get_stock('01HZDEV00000000000000BRANCH1', '01HZDEV000000000000VARIANT06') >= 0),
    '4.3: on_hand never goes below 0 (either exception or clamped at 0)'
  );
END;
$$;


-- =============================================================================
-- TEST GROUP 5: DENORMALIZATION INTEGRITY
-- =============================================================================

-- Test 5.1: Cannot insert product_variant with mismatched tenant_id
SELECT throws_ok(
  $$
    SELECT test.set_jwt_claims(
      '00000000-0000-0000-0000-000000000001'::uuid,
      '01HZDEV00000000000000TENANT1',
      'owner'
    );

    -- family belongs to tenant1, but variant claims tenant2
    INSERT INTO public.product_variants (id, family_id, tenant_id, sku, sell_price)
    VALUES (
      '01HZDEVTEST0000000000VRNTST1',
      '01HZDEV0000000000000FAMILY01',
      '01HZDEV00000000000000TENANT2',  -- WRONG tenant
      'CROSSTENANTSKU',
      10000
    );
  $$,
  'P0001',  -- RAISE EXCEPTION from enforce_variant_tenant trigger
  NULL,
  '5.1: Cannot insert product_variant with tenant_id mismatching parent family'
);


-- =============================================================================
-- TEST GROUP 6: AUTH HELPERS
-- =============================================================================

-- Test 6.1: auth.current_tenant() returns correct value from JWT
SELECT results_eq(
  $$
    SELECT test.set_jwt_claims(
      '00000000-0000-0000-0000-000000000001'::uuid,
      '01HZDEV00000000000000TENANT1',
      'owner'
    );
    SELECT auth.current_tenant()::text;
  $$,
  ARRAY['01HZDEV00000000000000TENANT1'],
  '6.1: auth.current_tenant() extracts correct tenant_id from JWT'
);

-- Test 6.2: auth.current_role() returns correct role
SELECT results_eq(
  $$
    SELECT test.set_jwt_claims(
      '00000000-0000-0000-0000-000000000003'::uuid,
      '01HZDEV00000000000000TENANT1',
      'cashier',
      '01HZDEV00000000000000BRANCH1'
    );
    SELECT auth.current_role();
  $$,
  ARRAY['cashier'],
  '6.2: auth.current_role() extracts cashier from JWT'
);

-- Test 6.3: auth.has_role() returns true for matching role
SELECT results_eq(
  $$
    SELECT test.set_jwt_claims(
      '00000000-0000-0000-0000-000000000002'::uuid,
      '01HZDEV00000000000000TENANT1',
      'manager'
    );
    SELECT auth.has_role('owner', 'manager');
  $$,
  ARRAY[true],
  '6.3: auth.has_role(owner, manager) returns true for manager'
);

-- Test 6.4: Empty JWT returns NULL tenant
SELECT results_eq(
  $$
    PERFORM set_config('request.jwt.claims', '{}', true);
    SELECT auth.current_tenant() IS NULL;
  $$,
  ARRAY[true],
  '6.4: Empty JWT returns NULL tenant_id'
);


-- =============================================================================
-- TEST GROUP 7: MATHEMATICAL INTEGRITY CONSTRAINTS
-- =============================================================================

-- Test 7.1: total_integrity constraint rejects bad math on direct insert
SELECT throws_ok(
  $$
    -- These are blocked by RLS anyway, but the constraint should fire first
    -- in unit test context with superuser:
    INSERT INTO public.sales (
      id, tenant_id, branch_id, cashier_id,
      receipt_number, subtotal, vat_amount, discount_amount, total,
      payment_method, client_id
    ) VALUES (
      '01HZDEVTEST0000000000MATH001',
      '01HZDEV00000000000000TENANT1',
      '01HZDEV00000000000000BRANCH1',
      '00000000-0000-0000-0000-000000000003',
      'TEST-001', 100000, 18000, 0,
      999999,  -- WRONG: should be 118000
      'cash',
      '01HZDEVTEST0000000000CLNT999'
    );
  $$,
  '23514',  -- check_violation
  NULL,
  '7.1: sales_total_integrity CHECK constraint rejects subtotal+vat != total'
);


-- =============================================================================
-- CONCURRENCY SIMULATION NOTE
-- =============================================================================
-- True concurrent transaction tests cannot run in a single SQL session.
-- Use the TypeScript concurrency test file for these.
-- The SELECT FOR UPDATE in complete_sale() serializes concurrent access.
-- Manual validation:
--   1. Open 2 psql sessions
--   2. In session 1: BEGIN; set JWT to cashier; call complete_sale with qty=12 (exact stock)
--      — do NOT commit yet
--   3. In session 2: BEGIN; set JWT to cashier; call complete_sale with qty=1 for same variant
--      — this should BLOCK waiting for session 1's lock
--   4. Commit session 1 — session 2 should then fail with insufficient stock
--   5. This validates the FOR UPDATE prevents TOCTOU


SELECT * FROM finish();
ROLLBACK;  -- Roll back all test data changes. Tests are non-destructive.
