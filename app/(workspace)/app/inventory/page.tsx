import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { InventoryContainer } from './inventory-container'

export const dynamic = 'force-dynamic'

export default async function InventoryPage() {
  const user = await requireRole(['owner', 'manager'])
  const supabase = await createClient()

  // 1. Fetch categories
  // (Categories are now derived from product_families.category, no separate table)
  const categories: any[] = []

  // 2. Fetch product families with variants
  const { data: products } = await supabase
    .from('product_families')
    .select(`
      id,
      name,
      category,
      variants:product_variants(
        id,
        sku,
        size,
        color,
        cost_price,
        low_stock_threshold
      )
    `)
    .eq('is_active', true)

  // 3. Fetch stock count per branch from view
  const { data: currentStock } = await supabase
    .from('stock_levels')
    .select('variant_id, on_hand')

  // 4. Fetch sales velocity logs
  const { data: saleItems } = await supabase
    .from('sale_lines')
    .select('id, variant_id, quantity')

  // 5. Fetch suppliers
  const suppliers: any[] = []

  return (
    <InventoryContainer
      initialProducts={products || []}
      initialStock={currentStock || []}
      initialSaleItems={saleItems || []}
      initialCategories={categories || []}
      initialSuppliers={suppliers || []}
      branchId={user.branch_id || ''}
    />
  )
}
