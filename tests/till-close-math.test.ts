// =============================================================================
// G1.1 — Till close math unit test
// Run: npx vitest run tests/till-close-math.test.ts
//
// Pure unit coverage for the close math used by the close_till_session RPC
// and mirrored in lib/actions/till.ts (computeG1_1Close).
//
// Database-bound assertions (open-session uniqueness, cross-tenant RLS) are
// documented as manual SQL steps in the implementation report — they require
// a live Supabase instance and live in tests/concurrency/ with the other
// integration tests.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { computeG1_1Close } from '../lib/actions/till-math'

describe('G1.1 till close math', () => {
  it('zero unreconciled difference closes the session', () => {
    const r = computeG1_1Close(100_000, 100_000)
    expect(r.expectedCash).toBe(100_000)
    expect(r.variance).toBe(0)
    expect(r.status).toBe('closed')
  })

  it('positive unreconciled difference forces disputed', () => {
    const r = computeG1_1Close(100_000, 120_000)
    expect(r.expectedCash).toBe(100_000)
    expect(r.variance).toBe(20_000)
    expect(r.status).toBe('disputed')
  })

  it('negative unreconciled difference forces disputed', () => {
    const r = computeG1_1Close(100_000, 80_000)
    expect(r.expectedCash).toBe(100_000)
    expect(r.variance).toBe(-20_000)
    expect(r.status).toBe('disputed')
  })

  it('zero opening float and zero count closes cleanly', () => {
    const r = computeG1_1Close(0, 0)
    expect(r.expectedCash).toBe(0)
    expect(r.variance).toBe(0)
    expect(r.status).toBe('closed')
  })

  it('G1.1 expected_cash never includes fabricated cash sales', () => {
    // Asserting the invariant: expected_cash MUST equal opening_float in G1.1.
    // If this ever fails, cash-sale linkage has leaked in early and G1.2
    // labelling / migration comments must be revisited.
    const r = computeG1_1Close(250_000, 999_999)
    expect(r.expectedCash).toBe(250_000)
  })
})
