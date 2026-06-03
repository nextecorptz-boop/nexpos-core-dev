import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

export const getSalesSummary = cache(async (startDate: string, endDate: string, branchId?: string) => {
  const supabase = await createClient()
  
  let query = supabase
    .from('sales')
    .select('id, total_amount, sale_date, status, sale_lines(line_total, unit_cost, quantity)')
    .gte('sale_date', startDate)
    .lte('sale_date', endDate)
    .eq('status', 'completed')

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching sales summary:', error)
    return { revenue: 0, orders: 0, profit: 0, rawData: [] }
  }

  const revenue = data.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0)
  const orders = data.length
  const profit = data.reduce((sum, sale) => {
    const saleProfit = sale.sale_lines?.reduce((itemSum: number, item: any) => {
      const lineTotal = Number(item.line_total || 0)
      const cost = Number(item.unit_cost || 0)
      const qty = Number(item.quantity || 0)
      return itemSum + (lineTotal - (cost * qty))
    }, 0) || 0
    return sum + saleProfit
  }, 0)

  return { revenue, orders, profit, rawData: data }
})

export const getTopProducts = cache(async (startDate: string, endDate: string, branchId?: string, limit = 5) => {
  const supabase = await createClient()
  
  let query = supabase
    .from('sale_lines')
    .select(`
      quantity,
      line_total,
      sales!inner(sale_date, status, branch_id),
      product_variants(
        id,
        size,
        product_families(name, brand)
      )
    `)
    .gte('sales.sale_date', startDate)
    .lte('sales.sale_date', endDate)
    .eq('sales.status', 'completed')

  if (branchId) {
    query = query.eq('sales.branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching top products:', error)
    return []
  }

  const productAggregates: Record<string, { name: string; brand: string; qty: number; revenue: number }> = {}

  data.forEach((item: any) => {
    const variantId = item.product_variants?.id
    if (!variantId) return

    if (!productAggregates[variantId]) {
      productAggregates[variantId] = {
        name: `${item.product_variants?.product_families?.name || 'Unknown'} - ${item.product_variants?.size || 'N/A'}`,
        brand: item.product_variants?.product_families?.brand || 'Unknown',
        qty: 0,
        revenue: 0,
      }
    }

    productAggregates[variantId].qty += Number(item.quantity || 0)
    productAggregates[variantId].revenue += Number(item.line_total || 0)
  })

  return Object.values(productAggregates)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit)
})

export const getLowStock = cache(async (branchId?: string, limit = 10) => {
  const supabase = await createClient()

  let query = supabase
    .from('stock_levels')
    .select(`
      on_hand,
      reorder_point,
      branch_id,
      product_variants!inner(
        id,
        sku,
        product_families(name, brand)
      )
    `)

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching low stock:', error)
    return []
  }

  // Filter where on_hand <= reorder_point
  const lowStockItems = data
    .filter((item: any) => Number(item.on_hand) <= Number(item.reorder_point || 0))
    .map((item: any) => ({
      sku: item.product_variants?.sku,
      name: item.product_variants?.product_families?.name || 'Unknown',
      brand: item.product_variants?.product_families?.brand || 'Unknown',
      onHand: Number(item.on_hand),
      threshold: Number(item.reorder_point || 0)
    }))
    .sort((a, b) => a.onHand - b.onHand) // Lowest first

  return lowStockItems.slice(0, limit)
})

export const getCustomerCount = cache(async () => {
  const supabase = await createClient()
  
  const { count, error } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.error('Error fetching customer count:', error)
    return 0
  }

  return count || 0
})

export const getCashierPerformance = cache(async (startDate: string, endDate: string, branchId?: string) => {
  const supabase = await createClient()

  let query = supabase
    .from('sales')
    .select('id, total_amount, cashier_id, profiles!sales_cashier_id_fkey(full_name)')
    .gte('sale_date', startDate)
    .lte('sale_date', endDate)
    .eq('status', 'completed')

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching cashier performance:', error)
    return []
  }

  const cashierAggregates: Record<string, { name: string; orders: number; revenue: number }> = {}

  data.forEach((sale: any) => {
    const cashierId = sale.cashier_id
    if (!cashierId) return

    if (!cashierAggregates[cashierId]) {
      cashierAggregates[cashierId] = {
        name: sale.profiles?.full_name || 'Unknown Cashier',
        orders: 0,
        revenue: 0,
      }
    }

    cashierAggregates[cashierId].orders += 1
    cashierAggregates[cashierId].revenue += Number(sale.total_amount || 0)
  })

  return Object.values(cashierAggregates)
    .sort((a, b) => b.revenue - a.revenue)
})
