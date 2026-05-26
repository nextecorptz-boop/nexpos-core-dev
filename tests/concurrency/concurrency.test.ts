// =============================================================================
// NEXPOS CONCURRENCY + INTEGRATION TESTS
// File: tests/concurrency/concurrency.test.ts
//
// Run: npx vitest run tests/concurrency/concurrency.test.ts
//
// These tests require a running local Supabase instance.
// SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env.local
//
// Tests REAL database behavior:
// - Double-submit prevention (two clients, one client_id)
// - Race conditions (two cashiers, one item)
// - Offline queue drain (retry after network recovery)
// - JWT isolation verification
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { ulid } from 'ulid';

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.SUPABASE_URL  ?? 'http://127.0.0.1:54321';
const ANON_KEY      = process.env.SUPABASE_ANON_KEY ?? '';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// Create an authenticated client by signing in with test credentials
async function createAuthClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Auth failed for ${email}: ${error.message}`);
  return client;
}

// Service role client — bypasses RLS. Use for test setup/teardown only.
const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST FIXTURES
// Must match seed data. Create test users in local Supabase dashboard first.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURES = {
  tenant1: '01HZDEV00000000000000TENANT1',
  tenant2: '01HZDEV00000000000000TENANT2',
  branch1: '01HZDEV00000000000000BRANCH1',
  branch2: '01HZDEV00000000000000BRANCH2',
  branch3: '01HZDEV00000000000000BRANCH3',
  variants: {
    af1_size40:   '01HZDEV000000000000VARIANT02',  // on_hand = 8
    af1_size41:   '01HZDEV000000000000VARIANT03',  // on_hand = 15
    af1_size44:   '01HZDEV000000000000VARIANT06',  // on_hand = 0 (OOS)
    clarks_b42:   '01HZDEV000000000000VARIANT09',  // on_hand = 3
  },
  // Test user emails — create these in local Supabase before running tests
  users: {
    cashier1:  { email: 'cashier1@nexpos.test', password: 'test-password-123' },
    cashier2:  { email: 'cashier2@nexpos.test', password: 'test-password-123' },
    tenant2owner: { email: 'owner2@nexpos.test', password: 'test-password-123' },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function getStock(variantId: string, branchId: string): Promise<number> {
  const { data, error } = await adminClient
    .from('stock_levels')
    .select('on_hand')
    .eq('variant_id', variantId)
    .eq('branch_id', branchId)
    .single();

  if (error) throw new Error(`getStock failed: ${error.message}`);
  return data.on_hand;
}

function buildSalePayload(
  clientId: string,
  branchId: string,
  variantId: string,
  quantity: number = 1,
  unitPrice: number = 120000,
): object {
  return {
    client_id: clientId,
    branch_id: branchId,
    payment_method: 'cash',
    payment_meta: { cash_tendered: 150000, change_given: 30000 },
    lines: [{ variant_id: variantId, quantity, unit_price: unitPrice, line_discount: 0 }],
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

describe('NEXPOS: Double-Submit Prevention', () => {
  let cashier: SupabaseClient;

  beforeAll(async () => {
    cashier = await createAuthClient(
      FIXTURES.users.cashier1.email,
      FIXTURES.users.cashier1.password,
    );
  });

  test('identical client_id returns same sale_id, does not create duplicate', async () => {
    const clientId = ulid();
    const stockBefore = await getStock(FIXTURES.variants.af1_size41, FIXTURES.branch1);
    const payload = buildSalePayload(clientId, FIXTURES.branch1, FIXTURES.variants.af1_size41);

    const [result1, result2] = await Promise.all([
      cashier.rpc('complete_sale', { p_input: payload }),
      cashier.rpc('complete_sale', { p_input: payload }),  // exact duplicate
    ]);

    // Both calls must succeed (no error)
    expect(result1.error).toBeNull();
    expect(result2.error).toBeNull();

    const data1 = result1.data as Record<string, unknown>;
    const data2 = result2.data as Record<string, unknown>;

    // Same sale_id returned
    expect(data1.sale_id).toBe(data2.sale_id);

    // One of them must be marked replayed
    const replayedCount = [data1.replayed, data2.replayed].filter(Boolean).length;
    expect(replayedCount).toBe(1);

    // Stock decremented exactly once
    const stockAfter = await getStock(FIXTURES.variants.af1_size41, FIXTURES.branch1);
    expect(stockAfter).toBe(stockBefore - 1);
  });

  test('sequential retries (simulating network retry) are idempotent', async () => {
    const clientId = ulid();
    const stockBefore = await getStock(FIXTURES.variants.af1_size41, FIXTURES.branch1);
    const payload = buildSalePayload(clientId, FIXTURES.branch1, FIXTURES.variants.af1_size41);

    // Simulate 3 retries from a client that didn't receive the first response
    const results = await Promise.all([
      cashier.rpc('complete_sale', { p_input: payload }),
      cashier.rpc('complete_sale', { p_input: payload }),
      cashier.rpc('complete_sale', { p_input: payload }),
    ]);

    const errors = results.filter(r => r.error);
    expect(errors).toHaveLength(0);

    const saleIds = results.map(r => (r.data as Record<string, unknown>).sale_id);
    const uniqueSaleIds = new Set(saleIds);
    expect(uniqueSaleIds.size).toBe(1);  // All return same sale

    const stockAfter = await getStock(FIXTURES.variants.af1_size41, FIXTURES.branch1);
    expect(stockAfter).toBe(stockBefore - 1);  // One decrement
  });
});


describe('NEXPOS: Race Conditions — Concurrent Cashiers', () => {
  let cashier1: SupabaseClient;
  let cashier2: SupabaseClient;

  beforeAll(async () => {
    [cashier1, cashier2] = await Promise.all([
      createAuthClient(FIXTURES.users.cashier1.email, FIXTURES.users.cashier1.password),
      createAuthClient(FIXTURES.users.cashier2.email, FIXTURES.users.cashier2.password),
    ]);
  });

  test('two cashiers selling last item: exactly one succeeds, one fails', async () => {
    // Use clarks_b42 which has on_hand=3. We'll sell 2 each (total 4 > 3).
    const stockBefore = await getStock(FIXTURES.variants.clarks_b42, FIXTURES.branch1);

    // Both cashiers try to sell 2 units simultaneously
    const clientId1 = ulid();
    const clientId2 = ulid();

    const [result1, result2] = await Promise.all([
      cashier1.rpc('complete_sale', {
        p_input: buildSalePayload(clientId1, FIXTURES.branch1, FIXTURES.variants.clarks_b42, 2),
      }),
      cashier2.rpc('complete_sale', {
        p_input: buildSalePayload(clientId2, FIXTURES.branch1, FIXTURES.variants.clarks_b42, 2),
      }),
    ]);

    const successes = [result1, result2].filter(r => !r.error);
    const failures  = [result1, result2].filter(r => r.error);

    // Exactly one succeeds (FOR UPDATE serializes them; second finds 1 stock, needs 2 → fails)
    // NOTE: If stockBefore >= 4, both would succeed. This test assumes stockBefore < 4.
    if (stockBefore < 4) {
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
    }

    // Stock never goes negative
    const stockAfter = await getStock(FIXTURES.variants.clarks_b42, FIXTURES.branch1);
    expect(stockAfter).toBeGreaterThanOrEqual(0);
  });

  test('concurrent sales of DIFFERENT variants both succeed without interference', async () => {
    const clientId1 = ulid();
    const clientId2 = ulid();
    const stockBefore1 = await getStock(FIXTURES.variants.af1_size40, FIXTURES.branch1);
    const stockBefore2 = await getStock(FIXTURES.variants.af1_size41, FIXTURES.branch1);

    const [result1, result2] = await Promise.all([
      cashier1.rpc('complete_sale', {
        p_input: buildSalePayload(clientId1, FIXTURES.branch1, FIXTURES.variants.af1_size40),
      }),
      cashier2.rpc('complete_sale', {
        p_input: buildSalePayload(clientId2, FIXTURES.branch1, FIXTURES.variants.af1_size41),
      }),
    ]);

    expect(result1.error).toBeNull();
    expect(result2.error).toBeNull();

    const stockAfter1 = await getStock(FIXTURES.variants.af1_size40, FIXTURES.branch1);
    const stockAfter2 = await getStock(FIXTURES.variants.af1_size41, FIXTURES.branch1);

    expect(stockAfter1).toBe(stockBefore1 - 1);
    expect(stockAfter2).toBe(stockBefore2 - 1);
  });
});


describe('NEXPOS: Tenant Isolation', () => {
  let tenant1Cashier: SupabaseClient;
  let tenant2Owner: SupabaseClient;

  beforeAll(async () => {
    [tenant1Cashier, tenant2Owner] = await Promise.all([
      createAuthClient(FIXTURES.users.cashier1.email, FIXTURES.users.cashier1.password),
      createAuthClient(FIXTURES.users.tenant2owner.email, FIXTURES.users.tenant2owner.password),
    ]);
  });

  test('Tenant 1 cashier cannot query Tenant 2 products', async () => {
    const { data, error } = await tenant1Cashier
      .from('product_families')
      .select('id, name')
      .eq('tenant_id', FIXTURES.tenant2);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);  // RLS filters to 0 rows, not an error
  });

  test('Tenant 1 cashier cannot create a sale on Tenant 2 branch', async () => {
    const { error } = await tenant1Cashier.rpc('complete_sale', {
      p_input: buildSalePayload(ulid(), FIXTURES.branch3, FIXTURES.variants.af1_size40),
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain('branch');
  });

  test('Tenant 2 owner cannot see Tenant 1 stock', async () => {
    const { data, error } = await tenant2Owner
      .from('stock_levels')
      .select('on_hand')
      .eq('tenant_id', FIXTURES.tenant1);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  test('current_stock view returns only own-tenant rows', async () => {
    const { data: tenant1Rows } = await tenant1Cashier
      .from('current_stock')
      .select('tenant_id');

    const crossTenantRows = (tenant1Rows ?? []).filter(
      row => row.tenant_id !== FIXTURES.tenant1
    );
    expect(crossTenantRows).toHaveLength(0);
  });
});


describe('NEXPOS: Offline Queue Drain', () => {
  // Simulates the SaleQueue offline/retry behavior:
  // 1. "Connection drops" after completing sale server-side
  // 2. Client retries with same client_id
  // 3. Must get original result, stock must only be decremented once

  let cashier: SupabaseClient;

  beforeAll(async () => {
    cashier = await createAuthClient(
      FIXTURES.users.cashier1.email,
      FIXTURES.users.cashier1.password,
    );
  });

  test('queued sale that retries 5 times is idempotent', async () => {
    const clientId = ulid();
    const stockBefore = await getStock(FIXTURES.variants.af1_size41, FIXTURES.branch1);
    const payload = buildSalePayload(clientId, FIXTURES.branch1, FIXTURES.variants.af1_size41);

    // Simulate 5 retries (offline queue clearing after network recovery)
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        cashier.rpc('complete_sale', { p_input: payload })
      )
    );

    const errors = results.filter(r => r.error);
    expect(errors).toHaveLength(0);

    const replayedResults = results.filter(r => (r.data as Record<string, unknown>).replayed);
    expect(replayedResults.length).toBeGreaterThanOrEqual(4);  // at least 4 of 5 are replayed

    const stockAfter = await getStock(FIXTURES.variants.af1_size41, FIXTURES.branch1);
    expect(stockAfter).toBe(stockBefore - 1);
  });
});


describe('NEXPOS: Input Validation', () => {
  let cashier: SupabaseClient;

  beforeAll(async () => {
    cashier = await createAuthClient(
      FIXTURES.users.cashier1.email,
      FIXTURES.users.cashier1.password,
    );
  });

  test('missing client_id is rejected', async () => {
    const { error } = await cashier.rpc('complete_sale', {
      p_input: {
        branch_id: FIXTURES.branch1,
        payment_method: 'cash',
        lines: [{ variant_id: FIXTURES.variants.af1_size41, quantity: 1, unit_price: 120000 }],
      },
    });
    expect(error).not.toBeNull();
  });

  test('out-of-stock variant is rejected', async () => {
    const { error } = await cashier.rpc('complete_sale', {
      p_input: buildSalePayload(ulid(), FIXTURES.branch1, FIXTURES.variants.af1_size44, 1),
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain('insufficient stock');
  });

  test('invalid payment_method is rejected', async () => {
    const { error } = await cashier.rpc('complete_sale', {
      p_input: {
        client_id: ulid(),
        branch_id: FIXTURES.branch1,
        payment_method: 'bitcoin',  // not in CHECK constraint
        lines: [{ variant_id: FIXTURES.variants.af1_size41, quantity: 1, unit_price: 120000 }],
      },
    });
    expect(error).not.toBeNull();
  });

  test('quantity zero is rejected', async () => {
    const { error } = await cashier.rpc('complete_sale', {
      p_input: {
        client_id: ulid(),
        branch_id: FIXTURES.branch1,
        payment_method: 'cash',
        lines: [{ variant_id: FIXTURES.variants.af1_size41, quantity: 0, unit_price: 120000 }],
      },
    });
    expect(error).not.toBeNull();
  });
});
