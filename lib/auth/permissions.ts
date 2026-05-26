import { createClient } from '@/lib/supabase/client'

export type UserRole = 'owner' | 'manager' | 'cashier'

export interface UserPermissions {
  role: UserRole
  branchId: string | null
  tenantId: string
}

// Client advisory permission mappings
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  owner: [
    'view_dashboard',
    'view_analytics',
    'manage_inventory',
    'manage_users',
    'manage_billing',
    'manage_suppliers',
    'create_transfer',
    'dispatch_transfer',
    'receive_transfer',
    'cancel_transfer',
    'process_refund',
    'override_till',
    'view_security_logs'
  ],
  manager: [
    'view_dashboard',
    'view_analytics',
    'manage_inventory',
    'manage_suppliers',
    'create_transfer',
    'dispatch_transfer',
    'receive_transfer',
    'cancel_transfer',
    'override_till'
  ],
  cashier: [
    'view_dashboard',
    'create_sale',
    'record_repayment',
    'view_inventory'
  ]
}

// Advisory helper for UI gating
export function checkAdvisoryPermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false
}

// Server-authoritative mutation validator
export async function validateServerMutation(
  supabase: any,
  action: string,
  entityBranchId?: string | null
): Promise<UserPermissions> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Mtumiaji hajatambulishwa (Unauthenticated mutation attempt)')
  }

  // Get user profile role and branch scope
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('tenant_id, role, branch_id, is_active')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    throw new Error('Imeshindwa kupata wasifu wa mtumiaji (Failed to verify user profile)')
  }

  if (!profile.is_active) {
    throw new Error('Akaunti yako imesimamishwa (Account is suspended)')
  }

  const role = profile.role as UserRole
  const userBranchId = profile.branch_id
  const tenantId = profile.tenant_id

  // 1. Enforce hierarchy check
  const allowedPermissions = ROLE_PERMISSIONS[role] || []
  if (!allowedPermissions.includes(action)) {
    throw new Error(`Upatikanaji umekataliwa: Huna ruhusa ya ${action} (Access denied: Permission ${action} not granted for role ${role})`)
  }

  // 2. Enforce branch scope checks
  if (role !== 'owner' && entityBranchId) {
    // If cashier or manager, they can only modify resources inside their own branch
    if (userBranchId !== entityBranchId) {
      throw new Error('Upatikanaji umekataliwa: Huwezi kurekebisha data za tawi lingine (Access denied: Cannot mutate resources outside your assigned branch)')
    }
  }

  // 3. Till Overrides & Refunds require specific check
  if (action === 'process_refund' && role === 'cashier') {
    throw new Error('Miamala ya marejesho inahitaji idhini ya Meneja (Refund transactions require manager override authorization)')
  }

  return {
    role,
    branchId: userBranchId,
    tenantId
  }
}
