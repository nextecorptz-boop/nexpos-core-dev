export interface SaleItem {
  quantity: number | string
  subtotal: number | string
  cost_price: number | string
  [key: string]: any
}

export interface Sale {
  id: string
  total_amount: number | string
  subtotal: number | string
  discount_amount?: number | string
  amount_paid: number | string
  balance_due?: number | string
  status: string
  sale_date: string | Date
  sale_items?: SaleItem[]
  [key: string]: any
}

export interface Expense {
  amount: number | string
  category_id?: string
  expense_date: string | Date
  [key: string]: any
}

export interface StockRecord {
  current_quantity: number | string
  variant?: {
    cost_price?: number | string
    [key: string]: any
  }
  [key: string]: any
}

/**
 * Calculates the gross profit for a single sale.
 * Gross Profit = subtotal - (cost_price * quantity)
 */
export function calculateSaleGrossProfit(sale: Sale): number {
  if (!sale.sale_items || sale.sale_items.length === 0) return 0
  return sale.sale_items.reduce((sum, item) => {
    const qty = Number(item.quantity || 0)
    const sub = Number(item.subtotal || 0)
    const cost = Number(item.cost_price || 0)
    return sum + (sub - (cost * qty))
  }, 0)
}

/**
 * Calculates total revenue from a list of sales.
 * Revenue is computed from completed/partial sales (excluding cancelled).
 */
export function calculateRevenue(sales: Sale[]): number {
  return sales
    .filter(s => s.status === 'completed' || s.status === 'partial')
    .reduce((sum, s) => sum + Number(s.total_amount || 0), 0)
}

/**
 * Calculates overall gross profit from a list of sales.
 */
export function calculateGrossProfit(sales: Sale[]): number {
  return sales
    .filter(s => s.status === 'completed' || s.status === 'partial')
    .reduce((sum, s) => sum + calculateSaleGrossProfit(s), 0)
}

/**
 * Calculates net profit.
 * Net Profit = Gross Profit - Operating Expenses
 */
export function calculateNetProfit(sales: Sale[], expenses: Expense[]): number {
  const gross = calculateGrossProfit(sales)
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  return gross - totalExpenses
}

/**
 * Calculates average order value (AOV).
 */
export function calculateAOV(sales: Sale[]): number {
  const activeSales = sales.filter(s => s.status === 'completed' || s.status === 'partial')
  const count = activeSales.length
  if (count === 0) return 0
  const rev = activeSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0)
  return rev / count
}

/**
 * Calculates inventory valuation based on current stock levels and unit costs.
 */
export function calculateInventoryValuation(stockRecords: StockRecord[]): number {
  return stockRecords.reduce((sum, rec) => {
    const qty = Number(rec.current_quantity || 0)
    const cost = Number(rec.variant?.cost_price || 0)
    return sum + (qty * cost)
  }, 0)
}

/**
 * Calculates total outstanding customer credit (repayment balances).
 */
export function calculateOutstandingCredit(creditAccounts: any[]): number {
  return creditAccounts
    .filter(a => a.status === 'active' || a.status === 'overdue')
    .reduce((sum, a) => sum + Number(a.balance_due || 0), 0)
}

/**
 * Calculates ratio of expenses to revenue.
 */
export function calculateExpenseRatio(sales: Sale[], expenses: Expense[]): number {
  const rev = calculateRevenue(sales)
  if (rev === 0) return 0
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  return (totalExpenses / rev) * 100
}

/**
 * Calculates sales velocity (units sold per day).
 */
export function calculateSalesVelocity(saleItems: any[], daysCount: number = 30): number {
  const totalUnits = saleItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  return daysCount > 0 ? totalUnits / daysCount : 0
}

/**
 * Calculates customer lifetime value (CLV).
 */
export function calculateCLV(sales: Sale[]): number {
  return sales
    .filter(s => s.status === 'completed' || s.status === 'partial')
    .reduce((sum, s) => sum + Number(s.total_amount || 0), 0)
}

/**
 * Calculates staff performance score out of 100 based on sales and refund behavior.
 */
export function calculateStaffPerformanceScore(
  salesCount: number,
  revenueGenerated: number,
  refundCount: number
): number {
  if (salesCount === 0) return 0
  
  // Deterministic performance index
  const speedBonus = Math.min(25, salesCount * 1.5)
  const revenueBonus = Math.min(50, revenueGenerated / 200000)
  const refundPenalty = refundCount * 15

  const rawScore = 30 + speedBonus + revenueBonus - refundPenalty
  return Math.max(0, Math.min(100, Math.round(rawScore)))
}

/**
 * Calculates available stock for a variant.
 * Available Stock = Current Stock - Reserved Stock
 */
export function calculateAvailableStock(currentStock: number, reservedStock: number): number {
  return Math.max(0, currentStock - reservedStock)
}


