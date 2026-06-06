import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

// ─── Column alignment note ─────────────────────────────────────────────────
// The `sales` table uses:
//   completed_at timestamptz   (NOT sale_date)
//   total        numeric(14,2) (NOT total_amount)
//
// cashier_id references auth.users(id) — NOT profiles directly — so
// PostgREST embedded-join syntax `profiles!sales_cashier_id_fkey` does not
// work. getCashierPerformance fetches profile names in a second query.
// ──────────────────────────────────────────────────────────────────────────

/** Append end-of-day time so lte against a timestamptz includes the full day. */
function toEndOfDay(dateStr: string): string {
  return dateStr + 'T23:59:59.999Z'
}

export const getSalesSummary = cache(async (startDate: string, endDate: string, branchId?: string) => {
  const supabase = await createClient()

  let query = supabase
    .from('sales')
    .select('id, total, completed_at, status, sale_lines(line_total, unit_cost, quantity)')
    .gte('completed_at', startDate)
    .lte('completed_at', toEndOfDay(endDate))
    .eq('status', 'completed')

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching sales summary:', error)
    return { revenue: 0, orders: 0, profit: 0, rawData: [] }
  }

  const revenue = data.reduce((sum, sale) => sum + Number(sale.total || 0), 0)
  const orders  = data.length
  const profit  = data.reduce((sum, sale) => {
    const saleProfit = (sale.sale_lines as any[])?.reduce((itemSum: number, item: any) => {
      const lineTotal = Number(item.line_total || 0)
      const cost      = Number(item.unit_cost  || 0)
      const qty       = Number(item.quantity   || 0)
      return itemSum + (lineTotal - cost * qty)
    }, 0) ?? 0
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
      sales!inner(completed_at, status, branch_id),
      product_variants(
        id,
        size,
        product_families(name, brand)
      )
    `)
    .gte('sales.completed_at', startDate)
    .lte('sales.completed_at', toEndOfDay(endDate))
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

  ;(data as any[]).forEach((item) => {
    const variantId = item.product_variants?.id
    if (!variantId) return

    if (!productAggregates[variantId]) {
      productAggregates[variantId] = {
        name:    `${item.product_variants?.product_families?.name || 'Unknown'} - ${item.product_variants?.size || 'N/A'}`,
        brand:   item.product_variants?.product_families?.brand || 'Unknown',
        qty:     0,
        revenue: 0,
      }
    }

    productAggregates[variantId].qty     += Number(item.quantity   || 0)
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

  return (data as any[])
    .filter((item) => Number(item.on_hand) <= Number(item.reorder_point || 0))
    .map((item) => ({
      sku:       item.product_variants?.sku,
      name:      item.product_variants?.product_families?.name || 'Unknown',
      brand:     item.product_variants?.product_families?.brand || 'Unknown',
      onHand:    Number(item.on_hand),
      threshold: Number(item.reorder_point || 0),
    }))
    .sort((a, b) => a.onHand - b.onHand)
    .slice(0, limit)
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

  // Step 1: fetch sales with cashier_id and total.
  // We do NOT attempt an embedded join to profiles here because
  // sales.cashier_id → auth.users.id, and profiles.id → auth.users.id.
  // There is no direct FK from sales to profiles, so PostgREST cannot
  // resolve the join. We resolve names in a second query instead.
  let salesQuery = supabase
    .from('sales')
    .select('id, total, cashier_id')
    .gte('completed_at', startDate)
    .lte('completed_at', toEndOfDay(endDate))
    .eq('status', 'completed')

  if (branchId) {
    salesQuery = salesQuery.eq('branch_id', branchId)
  }

  const { data: salesData, error: salesError } = await salesQuery

  if (salesError) {
    console.error('Error fetching cashier performance:', salesError)
    return []
  }

  if (!salesData || salesData.length === 0) return []

  // Step 2: collect unique cashier UUIDs and batch-fetch their display names
  // from profiles. profiles_select_tenant RLS allows owners/managers to read
  // all profiles in their tenant — reports is gated to ['owner', 'manager'].
  const cashierIds = [...new Set(
    (salesData as any[]).map((s) => s.cashier_id).filter(Boolean)
  )]

  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', cashierIds)

  if (profilesError) {
    console.error('Error fetching cashier profiles:', profilesError)
    // Degrade gracefully: continue with "Unknown Cashier" labels
  }

  const nameMap: Record<string, string> = {}
  ;(profilesData ?? []).forEach((p: any) => {
    nameMap[p.id] = p.full_name
  })

  // Step 3: aggregate per cashier
  const cashierAggregates: Record<string, { name: string; orders: number; revenue: number }> = {}

  ;(salesData as any[]).forEach((sale) => {
    const cashierId = sale.cashier_id
    if (!cashierId) return

    if (!cashierAggregates[cashierId]) {
      cashierAggregates[cashierId] = {
        name:    nameMap[cashierId] || 'Unknown Cashier',
        orders:  0,
        revenue: 0,
      }
    }

    cashierAggregates[cashierId].orders  += 1
    cashierAggregates[cashierId].revenue += Number(sale.total || 0)
  })

  return Object.values(cashierAggregates).sort((a, b) => b.revenue - a.revenue)
})
