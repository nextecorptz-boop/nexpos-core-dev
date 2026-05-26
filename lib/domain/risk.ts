export type RiskLevel = 'healthy' | 'watch' | 'high_risk' | 'critical'

/**
 * Determines till variance risk severity.
 */
export function determineTillRisk(variance: number | string): RiskLevel {
  const absVariance = Math.abs(Number(variance || 0))
  if (absVariance > 50000) return 'critical' // Over 50,000 TZS variance
  if (absVariance > 10000) return 'high_risk' // Over 10,000 TZS variance
  if (absVariance > 0) return 'watch'
  return 'healthy'
}

/**
 * Determines customer credit repayment risk.
 */
export function determineCustomerCreditRisk(balanceDue: number | string, daysOverdue: number): RiskLevel {
  const bal = Number(balanceDue || 0)
  if (bal === 0) return 'healthy'
  if (daysOverdue > 60 || (bal > 200000 && daysOverdue > 30)) return 'critical'
  if (daysOverdue > 30 || bal > 100000) return 'high_risk'
  if (daysOverdue > 7) return 'watch'
  return 'healthy'
}

/**
 * Determines supplier reliability scoring.
 */
export function determineSupplierRisk(fulfilledCount: number, lateCount: number): RiskLevel {
  if (fulfilledCount === 0) return 'watch'
  const lateRatio = lateCount / fulfilledCount
  if (lateRatio > 0.40) return 'critical'
  if (lateRatio > 0.20) return 'high_risk'
  if (lateRatio > 0.05) return 'watch'
  return 'healthy'
}

/**
 * Determines variant inventory status.
 */
export function determineInventoryStatus(
  currentQty: number,
  reorderThreshold: number,
  unitsSold60Days: number
): 'healthy' | 'low_stock' | 'overstocked' | 'dead_stock' | 'critical' {
  if (currentQty <= 0) return 'critical'
  if (currentQty <= reorderThreshold) return 'low_stock'
  if (unitsSold60Days === 0 && currentQty > 10) return 'dead_stock'
  if (currentQty > 50 && unitsSold60Days < 3) return 'overstocked'
  return 'healthy'
}

/**
 * Detects expense spikes compared to monthly averages.
 */
export function detectExpenseSpike(currentAmount: number, historicalAverage: number): boolean {
  if (historicalAverage === 0) return false
  return currentAmount > historicalAverage * 1.4 // 40% increase is flagged
}

/**
 * Checks for refund anomalies (unusually high frequency).
 */
export function detectRefundAnomaly(cashierRefundCount: number, averageRefundCount: number): boolean {
  if (averageRefundCount === 0) return cashierRefundCount > 5
  return cashierRefundCount > averageRefundCount * 2.5
}
