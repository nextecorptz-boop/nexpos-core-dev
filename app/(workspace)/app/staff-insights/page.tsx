import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { StaffInsightsContainer } from './staff-insights-container'

export const dynamic = 'force-dynamic'

export default async function StaffInsightsPage() {
  await requireRole(['owner', 'manager'])
  const supabase = await createClient()

  // Step 1: active profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role, email')
    .eq('is_active', true)

  // Step 2: completed sales with correct column names
  const { data: sales } = await supabase
    .from('sales')
    .select('id, cashier_id, total, status, completed_at')
    .eq('status', 'completed')

  // No returns table exists — pass empty array; anomaly detection degrades gracefully
  return (
    <StaffInsightsContainer
      initialProfiles={profiles ?? []}
      initialSales={sales ?? []}
    />
  )
}
