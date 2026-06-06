'use server'

/**
 * Server Actions for banner dismissals. Runs in a Server Component context so
 * we never expose the service-role key on the client — the per-request anon
 * cookie session writes through RLS as the authenticated user.
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { BANNER_IDS, type BannerId } from './defs'

function isBannerId(x: string): x is BannerId {
  return (BANNER_IDS as readonly string[]).includes(x)
}

/**
 * Persist a dismissal for the current user + current tenant. The tenant
 * scoping is enforced by the trigger on insert: the row's tenant_id MUST
 * equal `public.current_tenant()`, which we read here from the user's
 * profile (single read) and write through with the insert.
 */
export async function dismissBanner(
  bannerId: string,
  opts: { reappearAfter?: string | null } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isBannerId(bannerId)) {
    return { ok: false, error: 'unknown banner id' }
  }

  const supabase = await createClient()
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  if (!user) return { ok: false, error: 'not authenticated' }

  // Read the user's tenant from their profile so we satisfy the RLS WITH CHECK
  // (`tenant_id = public.current_tenant()`). The current_tenant() helper reads
  // from JWT app_metadata; profile is the canonical mirror.
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileErr || !profile?.tenant_id) {
    return { ok: false, error: 'tenant not resolved for current user' }
  }

  const { error } = await supabase
    .from('user_banner_dismissals')
    .upsert(
      {
        user_id: user.id,
        tenant_id: profile.tenant_id,
        banner_id: bannerId,
        dismissed_at: new Date().toISOString(),
        reappear_after: opts.reappearAfter ?? null,
      },
      { onConflict: 'user_id,tenant_id,banner_id' },
    )

  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/dashboard')
  return { ok: true }
}
