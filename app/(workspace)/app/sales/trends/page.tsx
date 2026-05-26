import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { SalesTrendsContainer } from './sales-trends-container'

export const dynamic = 'force-dynamic'

export default async function SalesTrendsPage() {
  const user = await requireRole(['owner', 'manager'])
  const supabase = await createClient()

  // Fetch sales lightweight metadata
  const { data: sales } = await supabase
    .from('sales')
    .select('id, total_amount, sale_date, status, subtotal, discount_amount, amount_paid, balance_due')
    .order('sale_date', { ascending: false })

  // Fetch sale items with full variant/category structures for local client calculations
  const { data: saleItems } = await supabase
    .from('sale_items')
    .select(`
      id,
      sale_id,
      quantity,
      subtotal,
      cost_price,
      variant:product_variants(
        id,
        family:product_families(
          id,
          name,
          category:product_categories(id, name)
        )
      )
    `)

  return (
    <SalesTrendsContainer 
      initialSales={sales || []} 
      initialSaleItems={saleItems || []} 
    />
  )
}
