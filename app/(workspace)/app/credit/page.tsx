import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { CreditContainer } from './credit-container'

export const dynamic = 'force-dynamic'

export default async function CreditPage() {
  const user = await requireRole(['owner', 'manager'])
  const supabase = await createClient()

  // 1. Fetch credit accounts
  const { data: creditAccounts } = await supabase
    .from('credit_accounts')
    .select('*, customer:customers(full_name, phone)')
    .order('due_date', { ascending: true })

  // 2. Fetch repayments history
  const { data: repayments } = await supabase
    .from('credit_repayments')
    .select(`
      id,
      credit_account_id,
      amount,
      notes,
      paid_at
    `)
    .order('paid_at', { ascending: false })

  return (
    <CreditContainer
      initialAccounts={creditAccounts || []}
      initialRepayments={repayments || []}
      branchId={user.branch_id || ''}
    />
  )
}
