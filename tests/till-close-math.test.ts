// =============================================================================
// G1.2 — Till close math unit test
// Run: npx vitest run tests/till-close-math.test.ts
//
// Pure unit coverage for the close math used by the close_till_session RPC
// and mirrored in lib/actions/till-math.ts.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { computeTillClose } from '../lib/actions/till-math'

describe('G1.2 till close math', () => {
  it('zero variance closes the session cleanly', () => {
    // 100k float + 50k cash sales = 150k expected. Counted 150k.
    const r = computeTillClose(100_000, 50_000, 150_000)
    expect(r.expectedCash).toBe(150_000)
    expect(r.variance).toBe(0)
    expect(r.status).toBe('closed')
  })

  it('positive variance forces disputed', () => {
    // 100k float + 50k cash sales = 150k expected. Counted 160k (+10k).
    const r = computeTillClose(100_000, 50_000, 160_000)
    expect(r.expectedCash).toBe(150_000)
    expect(r.variance).toBe(10_000)
    expect(r.status).toBe('disputed')
  })

  it('negative variance forces disputed', () => {
    // 100k float + 50k cash sales = 150k expected. Counted 140k (-10k).
    const r = computeTillClose(100_000, 50_000, 140_000)
    expect(r.expectedCash).toBe(150_000)
    expect(r.variance).toBe(-10_000)
    expect(r.status).toBe('disputed')
  })

  it('zero opening float and zero count closes cleanly', () => {
    const r = computeTillClose(0, 0, 0)
    expect(r.expectedCash).toBe(0)
    expect(r.variance).toBe(0)
    expect(r.status).toBe('closed')
  })

  it('G1.2 expected_cash includes cash sales', () => {
    // Asserting the invariant: expected_cash MUST equal opening_float + cash_sales in G1.2.
    const r = computeTillClose(250_000, 150_000, 400_000)
    expect(r.expectedCash).toBe(400_000)
    expect(r.variance).toBe(0)
    expect(r.status).toBe('closed')
  })
})
