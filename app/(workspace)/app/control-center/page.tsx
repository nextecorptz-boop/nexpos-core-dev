import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { ControlCenterContainer } from './control-center-container'

export const dynamic = 'force-dynamic'

export default async function ControlCenterPage() {
  const user = await requireRole(['owner', 'manager'])
  const supabase = await createClient()

  // 1. Fetch products & variants
  const { data: products } = await supabase
    .from('product_families')
    .select(`
      id,
      name,
      base_cost,
      variants:product_variants(id, size, color, cost_price, low_stock_threshold)
    `)
    .eq('is_active', true)

  // 2. Fetch current stocks
  const { data: currentStock } = await supabase
    .from('current_stock')
    .select('variant_id, current_quantity')

  // 3. Fetch sales
  const { data: sales } = await supabase
    .from('sales')
    .select('id, cashier_id, total_amount, status, sale_date')

  // 4. Fetch expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount, category_id, expense_date')

  // 5. Fetch credit accounts
  const { data: creditAccounts } = await supabase
    .from('credit_accounts')
    .select('*, customer:customers(full_name, phone)')
    .order('due_date', { ascending: true })

  // 6. Fetch cashier sessions
  const { data: sessions } = await supabase
    .from('cash_sessions')
    .select('*')
    .order('opened_at', { ascending: false })

  // 7. Fetch active staff profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role, email')
    .eq('is_active', true)

  return (
    <ControlCenterContainer
      initialProducts={products || []}
      initialStock={currentStock || []}
      initialSales={sales || []}
      initialExpenses={expenses || []}
      initialCreditAccounts={creditAccounts || []}
      initialSessions={sessions || []}
      initialProfiles={profiles || []}
    />
  )
}
