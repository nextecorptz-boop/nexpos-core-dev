import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { StaffInsightsContainer } from './staff-insights-container'

export const dynamic = 'force-dynamic'

export default async function StaffInsightsPage() {
  const user = await requireRole(['owner', 'manager'])
  const supabase = await createClient()

  // 1. Fetch active profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role, email')
    .eq('is_active', true)

  // 2. Fetch sales
  const { data: sales } = await supabase
    .from('sales')
    .select('id, cashier_id, total_amount, status, sale_date')

  // 3. Fetch returns to compute refund rates
  const { data: returns } = await supabase
    .from('returns')
    .select('id, processed_by, total_refund')

  return (
    <StaffInsightsContainer
      initialProfiles={profiles || []}
      initialSales={sales || []}
      initialReturns={returns || []}
    />
  )
}
