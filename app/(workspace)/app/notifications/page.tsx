import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { determineInventoryStatus, detectRefundAnomaly } from '@/lib/domain/risk'
import { NotificationsContainer } from './notifications-container'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const user = await requireRole(['owner', 'manager'])
  const supabase = await createClient()

  // 1. Fetch data for Low Stock Alerts
  const { data: products } = await supabase
    .from('product_families')
    .select(`
      id,
      name,
      category_id,
      variants:product_variants(id, sku, size, color, cost_price, low_stock_threshold)
    `)
    .eq('is_active', true)

  const { data: currentStock } = await supabase
    .from('current_stock')
    .select('variant_id, current_quantity')

  const { data: saleItems } = await supabase
    .from('sale_items')
    .select('variant_id, quantity')

  const lowStockItems: any[] = []
  if (products && currentStock) {
    products.forEach(p => {
      (p.variants || []).forEach(v => {
        const stockRec = currentStock.find(s => s.variant_id === v.id)
        const stockLeft = stockRec ? Number(stockRec.current_quantity) : 0
        const items = (saleItems || []).filter(s => s.variant_id === v.id)
        const sold = items.reduce((sum, s) => sum + Number(s.quantity), 0)
        const status = determineInventoryStatus(stockLeft, v.low_stock_threshold, sold)
        
        if (status === 'low_stock' || status === 'critical') {
          lowStockItems.push({
            id: v.id,
            name: `${p.name} (${v.size}${v.color ? ` / ${v.color}` : ''})`,
            sku: v.sku,
            stock_left: stockLeft,
            low_stock_threshold: v.low_stock_threshold,
            supplier_id: 'default'
          })
        }
      })
    })
  }

  // 2. Fetch data for Overdue Credit Accounts
  const { data: creditAccounts } = await supabase
    .from('credit_accounts')
    .select('*, customer:customers(full_name, phone)')
    .eq('status', 'active')

  const overdueCreditAccounts: any[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (creditAccounts) {
    creditAccounts.forEach(account => {
      if (account.due_date) {
        const due = new Date(account.due_date)
        if (due < today) {
          const daysOverdue = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
          overdueCreditAccounts.push({
            ...account,
            daysOverdue
          })
        }
      }
    })
  }

  // 3. Fetch data for Till Variances
  const { data: varianceSessions } = await supabase
    .from('cash_sessions')
    .select('*')
    .neq('variance', 0)
    .order('closed_at', { ascending: false })

  // 4. Fetch data for Refund Anomaly Flags
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')

  const { data: returns } = await supabase
    .from('returns')
    .select('processed_by')

  const refundAnomalies: any[] = []
  if (profiles && returns) {
    const refundsPerCashier = profiles.map(p => returns.filter(r => r.processed_by === p.id).length)
    const averageRefundCount = refundsPerCashier.reduce((sum, c) => sum + c, 0) / (profiles.length || 1)
    
    profiles.forEach(p => {
      const refundCount = returns.filter(r => r.processed_by === p.id).length
      if (detectRefundAnomaly(refundCount, averageRefundCount)) {
        refundAnomalies.push({
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          refundCount
        })
      }
    })
  }

  return (
    <NotificationsContainer
      lowStockItems={lowStockItems}
      overdueCreditAccounts={overdueCreditAccounts}
      varianceSessions={varianceSessions || []}
      refundAnomalies={refundAnomalies}
    />
  )
}
