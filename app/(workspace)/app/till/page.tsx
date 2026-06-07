import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { TillContainer } from './till-container'
import type { TillSession } from '@/lib/actions/till'

export const dynamic = 'force-dynamic'

type ProfileLite = {
  id: string
  full_name: string | null
  email: string | null
  role: 'owner' | 'manager' | 'cashier'
  tenant_id: string
  branch_id: string | null
}

type Branch = {
  id: string
  name: string
}

export default async function TillPage() {
  const user = await requireRole(['owner', 'manager', 'cashier'])
  const supabase = await createClient()

  const isPrivileged = user.role === 'owner' || user.role === 'manager'

  // Cashier's concrete assigned branch (may be null).
  // Owner/manager don't use this for the open form — they pick from a branch selector.
  const workingBranchId: string | null = user.branch_id

  // For owner/manager: load all active tenant branches so the UI can render a selector.
  // Cashiers don't need the list — they use their assigned branch_id.
  let branches: Branch[] = []
  let branchesError: string | null = null
  if (isPrivileged) {
    const { data: branchesRaw, error: branchesErr } = await supabase
      .from('branches')
      .select('id, name')
      .eq('tenant_id', user.tenant_id)
      .eq('is_active', true)
      .order('name', { ascending: true })
    if (branchesErr) {
      console.error('[till] branches query failed:', branchesErr)
      branchesError = branchesErr.message
    }
    branches = (branchesRaw ?? []) as Branch[]
    // Diagnostic: privileged user with a known tenant_id but zero branches almost
    // always means RLS stripped the rows because the JWT app_metadata.tenant_id
    // claim is missing. Surface this so it isn't silently mistaken for "no
    // branches exist". Without this hint, the user sees the generic "activate a
    // branch" copy even though branches do exist in the database.
    if (!branchesErr && branches.length === 0 && user.tenant_id) {
      branchesError =
        'No branches returned for your tenant. If branches exist in the DB, this is usually because the JWT app_metadata.tenant_id claim is missing for your user (RLS hides every row).'
    }
  }

  // Recent till sessions visible to the caller (RLS filters automatically).
  // Owner/manager see all tenant sessions; cashier sees only own.
  const { data: sessionsRaw } = await supabase
    .from('till_sessions')
    .select(
      'id, tenant_id, branch_id, cashier_id, opening_float, opened_at, closed_at, ' +
        'actual_cash_counted, expected_cash, variance, status, close_mode, ' +
        'owner_reviewed_at, owner_reviewer_id, notes, review_notes, created_at'
    )
    .order('opened_at', { ascending: false })
    .limit(50)

  const sessions: TillSession[] = (sessionsRaw ?? []) as unknown as TillSession[]

  // Look up cashier names in a second query (no embedded FK relation between
  // till_sessions.cashier_id and profiles — same constraint as sales reporting).
  const cashierIds = Array.from(new Set(sessions.map((s) => s.cashier_id)))
  let cashierNames: Record<string, string> = {}
  if (cashierIds.length > 0) {
    const { data: profilesRaw } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', cashierIds)
    cashierNames = Object.fromEntries(
      (profilesRaw ?? []).map((p: { id: string; full_name: string | null; email: string | null }) => [
        p.id,
        p.full_name || p.email || 'Operator',
      ])
    )
  }

  const me: ProfileLite = {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    tenant_id: user.tenant_id,
    branch_id: user.branch_id,
  }

  return (
    <TillContainer
      me={me}
      isPrivileged={isPrivileged}
      workingBranchId={workingBranchId}
      branches={branches}
      branchesError={branchesError}
      sessions={sessions}
      cashierNames={cashierNames}
    />
  )
}
