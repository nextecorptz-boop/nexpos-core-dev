/**
 * Pure helpers for the G1.2 till close math.
 * Kept in a non-'use server' module so unit tests can import without pulling
 * Next.js server-only modules. Mirrors the math inside close_till_session().
 */

export type CloseResult = {
  expectedCash: number
  variance: number
  status: 'closed' | 'disputed'
}

/**
 * G1.2: expected_cash = opening_float + cash_sales. variance != 0 → disputed.
 */
export function computeTillClose(
  openingFloat: number,
  cashSales: number,
  actualCashCounted: number
): CloseResult {
  const expectedCash = openingFloat + cashSales
  const variance = actualCashCounted - expectedCash
  const status: 'closed' | 'disputed' = variance === 0 ? 'closed' : 'disputed'
  return { expectedCash, variance, status }
}
