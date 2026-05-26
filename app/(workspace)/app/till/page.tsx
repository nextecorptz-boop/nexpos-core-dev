import { requireAuth } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { TillContainer } from './till-container'

export const dynamic = 'force-dynamic'

export default async function TillPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  // 1. Fetch till sessions
  const { data: rawSessions } = await supabase
    .from('cash_sessions')
    .select('*')
    .order('opened_at', { ascending: false })

  // 2. Fetch profiles to map opened_by and closed_by cashier names safely
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')

  const profilesMap = new Map((profiles || []).map(p => [p.id, p.full_name]))

  const sessions = (rawSessions || []).map(session => ({
    ...session,
    opened_by_user: {
      full_name: profilesMap.get(session.opened_by) || 'Cashier'
    },
    closed_by_user: session.closed_by ? {
      full_name: profilesMap.get(session.closed_by) || 'Manager'
    } : null
  }))

  // 3. Fetch cash payments (only cash payment method, to calculate live drawer contents)
  const { data: cashPayments } = await supabase
    .from('payments')
    .select('id, amount, paid_at')
    .eq('payment_method', 'cash')

  // Find the current user's profile full name
  const cashierName = profilesMap.get(user.id) || 'Current User'

  return (
    <TillContainer
      initialSessions={sessions}
      initialCashPayments={cashPayments || []}
      branchId={user.branch_id || ''}
      userId={user.id}
      cashierName={cashierName}
    />
  )
}
