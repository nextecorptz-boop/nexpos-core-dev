/**
 * NEXPOS Role Permissions & Route Access
 *
 * This file is the single source of truth for:
 *   1. Feature-level advisory permissions (ROLE_PERMISSIONS)
 *   2. Route-level redirect rules for the cashier role
 *
 * Architecture notes — owner-controlled staff permissions (future)
 * ---------------------------------------------------------------
 * Cashier/staff access should eventually be owner-configurable. Some
 * businesses allow trusted staff to do more than the default set.
 *
 * TODO (future — requires schema + migration, NOT implemented yet):
 *   - Add `tenant_permissions` table: { tenant_id, role, feature, allowed }
 *   - Load overrides server-side and merge into ROLE_PERMISSIONS at runtime
 *   - Features owners can unlock for cashiers:
 *       credit            — record credit-customer sales
 *       expenses          — write shop expense entries
 *       inventory_count   — perform stock counts / adjustments
 *       customer_credit   — view/manage customer credit ledger
 *       delivery_quote    — enter delivery fee + manual dispatch in POS
 *       returns_process   — initiate full return flow (currently read-only)
 *
 * Future NEXPOS Roadmap (NOT implemented — backlog only):
 *   1. POS delivery / pickup mode
 *      - Customer chooses pickup or delivery at checkout
 *      - Staff enters customer location + delivery fee
 *      - Delivery method recorded (own means / Bolt-style manual first)
 *   2. Online store / shop link  [paid subscription feature]
 *      - Owner publishes a product catalog link
 *      - Customers browse and place orders from that link
 *   3. Owner-controlled staff permissions
 *      - Granular per-feature toggle (not all-or-nothing role promotion)
 *      - Owner authorises cashier/staff for specific features above
 */

import { createClient } from '@/lib/supabase/client'

export type UserRole = 'owner' | 'manager' | 'cashier'

// ---------------------------------------------------------------------------
// Route-level access config (used by requireRole + workspace nav)
// ---------------------------------------------------------------------------

/**
 * Routes accessible to all authenticated roles including cashier.
 */
export const UNIVERSAL_ROUTES: string[] = [
  '/app/pos',
  '/app/orders',
  '/app/returns',
  '/app/till',
  '/app/customers',
]

/**
 * Routes denied to cashier by default.
 * Accessing these redirects to CASHIER_FALLBACK_ROUTE.
 * Future: owners can unlock individual features to remove routes from this list.
 */
export const CASHIER_DENIED_ROUTES: string[] = [
  '/app/dashboard',
  '/app/control-center',
  '/app/products',
  '/app/inventory',
  '/app/transfers',
  '/app/suppliers',
  '/app/purchases',
  '/app/sales/trends',
  '/app/sales/items',
  '/app/staff-insights',
  '/app/notifications',
  '/app/expenses',
  '/app/security-log',
  '/app/payments',
  '/app/users',
  '/app/settings',
  '/app/credit',
  '/app/reports',
]

/** Where a cashier lands when they attempt to access a denied route. */
export const CASHIER_FALLBACK_ROUTE = '/app/pos'

/**
 * Returns a redirect path if the role is not allowed at pathname, else null.
 * Used by requireRole (session.ts) to avoid manual per-page checks.
 */
export function getRoleRedirect(role: UserRole, pathname: string): string | null {
  if (role === 'owner' || role === 'manager') return null
  if (role === 'cashier') {
    const denied = CASHIER_DENIED_ROUTES.some(
      (d) => pathname === d || pathname.startsWith(d + '/')
    )
    if (denied) return CASHIER_FALLBACK_ROUTE
  }
  return null
}

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
    // NOTE: view_dashboard intentionally excluded — cashier home is /app/pos
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
