/**
 * Pure helpers for the G1.1 till close math.
 * Kept in a non-'use server' module so unit tests can import without pulling
 * Next.js server-only modules. Mirrors the math inside close_till_session().
 */

export type G1_1CloseResult = {
  expectedCash: number
  variance: number
  status: 'closed' | 'disputed'
}

/**
 * G1.1: expected_cash = opening_float. variance != 0 → disputed.
 * G1.2 will fold linked cash flows into expectedCash; until then this helper
 * MUST NOT include cash sales.
 */
export function computeG1_1Close(
  openingFloat: number,
  actualCashCounted: number
): G1_1CloseResult {
  const expectedCash = openingFloat
  const variance = actualCashCounted - expectedCash
  const status: 'closed' | 'disputed' = variance === 0 ? 'closed' : 'disputed'
  return { expectedCash, variance, status }
}
