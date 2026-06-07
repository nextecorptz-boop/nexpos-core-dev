import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cache } from 'react'

export type UserRole = 'owner' | 'manager' | 'cashier'

export interface UserProfile {
  id: string
  tenant_id: string
  full_name: string
  email: string
  role: UserRole
  branch_id: string | null
  is_active: boolean
}

/**
 * Get current user profile
 * Cached per request
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  return profile as UserProfile | null
})

/**
 * Require authentication
 * Redirects to login if not authenticated
 */
export async function requireAuth() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }

  return user
}

/**
 * Require specific role
 * Redirects if user doesn't have required role
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const user = await requireAuth()
  
  if (!allowedRoles.includes(user.role)) {
    redirect('/app/pos')
  }

  return user
}

/**
 * Check if user is owner
 */
export async function isOwner() {
  const user = await getCurrentUser()
  return user?.role === 'owner'
}

/**
 * Check if user is manager or owner
 */
export async function isManagerOrOwner() {
  const user = await getCurrentUser()
  return user?.role === 'owner' || user?.role === 'manager'
}

/**
 * Get user's branch ID
 * Owners return null (access all branches)
 */
export async function getUserBranch() {
  const user = await requireAuth()
  return user.role === 'owner' ? null : user.branch_id
}
