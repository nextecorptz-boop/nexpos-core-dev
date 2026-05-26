import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { InventoryContainer } from './inventory-container'

export const dynamic = 'force-dynamic'

export default async function InventoryPage() {
  const user = await requireRole(['owner', 'manager'])
  const supabase = await createClient()

  // 1. Fetch categories
  const { data: categories } = await supabase
    .from('product_categories')
    .select('id, name')

  // 2. Fetch product families with variants
  const { data: products } = await supabase
    .from('product_families')
    .select(`
      id,
      name,
      category_id,
      category:product_categories(name),
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
    .from('current_stock')
    .select('variant_id, current_quantity')

  // 4. Fetch sales velocity logs
  const { data: saleItems } = await supabase
    .from('sale_items')
    .select('id, variant_id, quantity')

  // 5. Fetch suppliers
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name, phone')
    .eq('is_active', true)

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
