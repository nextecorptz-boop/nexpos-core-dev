/**
 * Computes projected revenue based on historical averages and growth multipliers.
 */
export function forecastRevenue(historicalAverage: number, growthVelocity: number = 1.05): number {
  return Math.round(historicalAverage * growthVelocity)
}

/**
 * Predicts depletion timeline of a specific product variant stock.
 * Days Remaining = current_stock / average_daily_sales
 */
export function predictStockDepletion(currentQty: number, avgDailySales: number): number {
  if (avgDailySales <= 0) return 999 // Effectively infinite coverage
  const days = currentQty / avgDailySales
  return parseFloat(days.toFixed(1))
}

/**
 * Recommends reorder quantities based on sales velocity and target days of coverage.
 * Target Coverage defaults to 30 days.
 */
export function calculateSuggestedReorder(
  currentQty: number,
  avgDailySales: number,
  targetDaysCoverage: number = 30,
  reorderThreshold: number = 5
): number {
  const daysRemaining = predictStockDepletion(currentQty, avgDailySales)
  if (daysRemaining > 15) return 0 // No immediate replenishment needed

  const expectedSales = avgDailySales * targetDaysCoverage
  const deficit = expectedSales - currentQty
  
  // Return reorder size to fill deficit, rounded up to increments of 5
  const size = Math.max(0, deficit)
  return Math.ceil(size / 5) * 5
}

/**
 * Predicts the business cashflow runway in days.
 * Runway = current_cash / daily_burn_rate
 */
export function forecastCashRunway(currentCash: number, dailyBurnRate: number): number {
  if (dailyBurnRate <= 0) return 999
  const runway = currentCash / dailyBurnRate
  return Math.round(runway)
}
