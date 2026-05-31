import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

export const getSalesSummary = cache(async (startDate: string, endDate: string, branchId?: string) => {
  const supabase = await createClient()
  
  let query = supabase
    .from('sales')
    .select('id, total_amount, sale_date, status, sale_items(subtotal, cost_price, quantity)')
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

  const revenue = data.reduce((sum, sale) => sum + Number(sale.total_amount), 0)
  const orders = data.length
  const profit = data.reduce((sum, sale) => {
    const saleProfit = sale.sale_items?.reduce((itemSum: number, item: any) => {
      return itemSum + (Number(item.subtotal) - (Number(item.cost_price) * Number(item.quantity)))
    }, 0) || 0
    return sum + saleProfit
  }, 0)

  return { revenue, orders, profit, rawData: data }
})

export const getTopProducts = cache(async (startDate: string, endDate: string, branchId?: string, limit = 5) => {
  const supabase = await createClient()
  
  let query = supabase
    .from('sale_items')
    .select(`
      quantity,
      subtotal,
      sales!inner(sale_date, status, branch_id),
      product_variants(
        id,
        size,
        color,
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
        name: `${item.product_variants?.product_families?.name} - ${item.product_variants?.size}`,
        brand: item.product_variants?.product_families?.brand || 'Unknown',
        qty: 0,
        revenue: 0,
      }
    }

    productAggregates[variantId].qty += Number(item.quantity)
    productAggregates[variantId].revenue += Number(item.subtotal)
  })

  return Object.values(productAggregates)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit)
})

export const getInventoryValuation = cache(async (branchId?: string) => {
  const supabase = await createClient()
  
  let query = supabase
    .from('current_stock')
    .select(`
      current_quantity,
      product_variants(
        id,
        cost_price,
        base_price,
        product_families(name)
      )
    `)

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching inventory valuation:', error)
    return { totalCostValue: 0, totalRetailValue: 0, items: [] }
  }

  let totalCostValue = 0
  let totalRetailValue = 0

  const items = data.map((item: any) => {
    const qty = Number(item.current_quantity)
    const cost = Number(item.product_variants?.cost_price || 0)
    const retail = Number(item.product_variants?.base_price || 0)

    totalCostValue += qty * cost
    totalRetailValue += qty * retail

    return {
      name: item.product_variants?.product_families?.name,
      quantity: qty,
      costValue: qty * cost,
      retailValue: qty * retail
    }
  })

  return { totalCostValue, totalRetailValue, items }
})
