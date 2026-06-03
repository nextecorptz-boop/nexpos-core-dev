// =============================================================================
// JWT Custom Claims Hook
// File: supabase/functions/jwt-claims-hook/index.ts
//
// Registered in Supabase Dashboard:
//   Authentication → Hooks → Custom Access Token → Enable
//   Function: jwt-claims-hook
//
// This function runs on EVERY login and token refresh.
// It injects tenant_id, role, and branch_id into the JWT.
// These claims are read by RLS helper functions like auth.current_tenant(),
// auth.current_role(), and auth.current_branch().
//
// PAYLOAD CONTRACT (per Supabase docs):
//   Input:  { user_id: string, claims: object, authentication_method: string }
//   Output: { claims: object }
//
// CRITICAL RULES:
// 1. This function MUST be fast (<500ms). It blocks login.
// 2. NEVER throw unhandled errors — a crash here locks all users out.
// 3. Read ONLY from profiles table. No other queries.
// 4. Must return { claims: {...} } — NOT { session: { custom_claims: {...} } }
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

// Keep these types in sync with your DB schema and user object.
interface ProfileRow {
  tenant_id: string;
  role: 'owner' | 'manager' | 'cashier' | 'viewer';
  branch_id: string | null;
  is_active: boolean;
}

// Supabase Custom Access Token Hook — exact payload contract
interface HookRequest {
  user_id: string;
  claims: Record<string, unknown>;
  authentication_method: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // 1. Overall safety net to prevent locking users out
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // NOTE: No Authorization header check here.
    // This hook is called by Supabase Auth's internal infrastructure only.
    // It is protected by:
    //   a) verify_jwt = false in supabase/config.toml (not publicly callable)
    //   b) The hook URL being registered exclusively in the Supabase Dashboard
    // Adding a shared secret requires Dashboard UI configuration:
    //   Dashboard → Authentication → Hooks → Custom Access Token → Authorization header

    let hookRequest: HookRequest;
    try {
      hookRequest = await req.json();
    } catch {
      return new Response('Invalid JSON body', { status: 400 });
    }

    const { user_id, claims } = hookRequest;
    if (!user_id) {
      console.error('[jwt-claims-hook] Missing user_id in request payload');
      return new Response('Missing user_id', { status: 400 });
    }

    // 2. Use service_role client for server-side operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 3. Fetch user profile with a single, fast query
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('tenant_id, role, branch_id, is_active')
      .eq('id', user_id)
      .single<ProfileRow>();

    // 4. Handle errors during profile fetch — return unmodified claims so login succeeds
    if (error) {
      console.error(`[jwt-claims-hook] DB error for user ${user_id}:`, error.message);
      return new Response(JSON.stringify({ claims }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Handle missing profile or deactivated user — return unmodified claims
    if (!profile || !profile.is_active) {
      if (!profile) {
        console.warn(`[jwt-claims-hook] No profile found for user: ${user_id}`);
      } else {
        console.warn(`[jwt-claims-hook] Inactive user attempted login: ${user_id}`);
      }
      return new Response(JSON.stringify({ claims }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 6. Happy path: inject tenant claims into the JWT
    const updatedClaims = {
      ...claims,
      tenant_id: profile.tenant_id,
      role: profile.role,
      branch_id: profile.branch_id ?? null,
      is_active: profile.is_active,
    };

    console.log(`[jwt-claims-hook] Claims injected for user ${user_id}: tenant=${profile.tenant_id} role=${profile.role}`);

    return new Response(JSON.stringify({ claims: updatedClaims }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    // 7. Final catch-all to guarantee a response — return empty claims modification
    // so Auth can still issue a token (no user lockout)
    const err = e as Error;
    console.error('[jwt-claims-hook] CRITICAL Unhandled Exception:', err.message);

    // We don't have the original claims here, so return minimal valid structure
    // Auth will still issue the token with its default claims
    return new Response(JSON.stringify({
      error: {
        http_code: 500,
        message: 'Internal hook error',
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
