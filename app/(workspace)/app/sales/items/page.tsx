import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { ItemsIntelligenceContainer } from './items-intelligence-container'

export const dynamic = 'force-dynamic'

export default async function SalesItemsPage() {
  const user = await requireRole(['owner', 'manager'])
  const supabase = await createClient()

  // 1. Fetch active categories
  const { data: categories } = await supabase
    .from('product_categories')
    .select('id, name')

  // 2. Fetch active product families with variants
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
        low_stock_threshold
      )
    `)
    .eq('is_active', true)

  // 3. Fetch sale items for velocity assessments
  const { data: saleItems } = await supabase
    .from('sale_items')
    .select('id, variant_id, quantity, subtotal, cost_price')

  // 4. Fetch current stock counts per branch from view
  const { data: currentStock } = await supabase
    .from('current_stock')
    .select('variant_id, current_quantity')

  return (
    <ItemsIntelligenceContainer
      initialProducts={products || []}
      initialSaleItems={saleItems || []}
      initialStock={currentStock || []}
      initialCategories={categories || []}
    />
  )
}
