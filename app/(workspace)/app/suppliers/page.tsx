import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { SuppliersContainer } from './suppliers-container'

export const dynamic = 'force-dynamic'

export default async function SuppliersPage() {
  const user = await requireRole(['owner', 'manager'])
  const supabase = await createClient()

  // 1. Fetch active suppliers
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  // 2. Fetch completed purchases summaries to compute spends
  const { data: purchases } = await supabase
    .from('purchases')
    .select('id, supplier_id, purchase_date, total_amount, status')
    .eq('status', 'completed')

  return (
    <SuppliersContainer 
      initialSuppliers={suppliers || []} 
      initialPurchases={purchases || []} 
    />
  )
}
