import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { ExpensesContainer } from './expenses-container'

export const dynamic = 'force-dynamic'

export default async function ExpensesPage() {
  const user = await requireRole(['owner', 'manager'])
  const supabase = await createClient()

  // 1. Fetch expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*, category:expense_categories(name)')
    .order('expense_date', { ascending: false })

  // 2. Fetch categories
  const { data: categories } = await supabase
    .from('expense_categories')
    .select('id, name')
    .order('name', { ascending: true })

  // 3. Fetch sales (to compute expense metrics/ratios)
  const { data: sales } = await supabase
    .from('sales')
    .select('id, total_amount, status')
    .eq('status', 'completed')

  return (
    <ExpensesContainer
      initialExpenses={expenses || []}
      initialCategories={categories || []}
      initialSales={sales || []}
      branchId={user.branch_id || ''}
    />
  )
}
