import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { PurchasesContainer } from './purchases-container'

export const dynamic = 'force-dynamic'

export default async function PurchasesPage() {
  const user = await requireRole(['owner', 'manager'])
  const supabase = await createClient()

  // 1. Fetch active suppliers
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  // 2. Fetch active products with variants
  const { data: products } = await supabase
    .from('product_families')
    .select(`
      id,
      name,
      base_cost,
      variants:product_variants(
        id,
        size,
        color,
        sku,
        cost_price
      )
    `)
    .eq('is_active', true)

  return (
    <PurchasesContainer
      suppliers={suppliers || []}
      products={products || []}
      branchId={user.branch_id || ''}
    />
  )
}
