'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const signupSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
})

export type SignupState = {
  success?: boolean
  error?: string
}

export async function signupTenant(prevState: any, formData: FormData): Promise<SignupState> {
  const businessName = formData.get('businessName') as string
  const slug = formData.get('slug') as string
  const fullName = formData.get('fullName') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Validate inputs
  const validation = signupSchema.safeParse({
    businessName,
    slug,
    fullName,
    email,
    password
  })

  if (!validation.success) {
    return { error: validation.error.errors[0].message }
  }

  const supabase = (await createServiceClient()) as any

  try {
    // 1. Check if slug exists
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (existingTenant) {
      return { error: 'This business slug/URL is already taken.' }
    }

    // 2. Insert new tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: businessName,
        slug: slug.toLowerCase(),
        status: 'trialing',
        plan_id: 'basic'
      })
      .select()
      .single()

    if (tenantError) {
      throw new Error(`Tenant creation failed: ${tenantError.message}`)
    }

    // 3. Create Default Branch
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .insert({
        tenant_id: tenant.id,
        name: 'Main Branch - ' + businessName,
        code: 'MAIN',
        is_active: true
      })
      .select()
      .single()

    if (branchError) {
      throw new Error(`Branch creation failed: ${branchError.message}`)
    }

    // 4. Create Supabase Auth User with admin client to inject tenant custom metadata
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: {
        tenant_id: tenant.id,
        role: 'owner',
        branch_id: null
      }
    })

    if (authError || !authUser.user) {
      throw new Error(`Auth account creation failed: ${authError?.message || 'Unknown error'}`)
    }

    // 5. Create profile (linked to the auth user)
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authUser.user.id,
        tenant_id: tenant.id,
        full_name: fullName,
        role: 'owner',
        branch_id: null,
        is_active: true
      })

    if (profileError) {
      // Cleanup auth user if profile insert fails
      await supabase.auth.admin.deleteUser(authUser.user.id)
      throw new Error(`Profile database insertion failed: ${profileError.message}`)
    }

    return { success: true }
  } catch (error: any) {
    console.error('Signup error:', error)
    return { error: error.message || 'An unexpected error occurred during registration.' }
  }
}
