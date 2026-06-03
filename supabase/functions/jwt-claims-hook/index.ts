// =============================================================================
// JWT Custom Claims Hook
// File: supabase/functions/jwt-claims-hook/index.ts
//
// Registered in Supabase Dashboard:
//   Authentication → Hooks → Custom Access Token → Enable
//   Function: jwt-claims-hook
//
// This function runs on EVERY login and token refresh.
// It injects tenant_id, role, branch_id, and is_active into the JWT.
// These claims are read by RLS helper functions like auth.current_tenant(),
// auth.current_role(), and auth.current_branch().
//
// PAYLOAD CONTRACT (per Supabase docs):
//   Input:  { user_id: string, claims: object, authentication_method: string }
//   Output: { claims: object }
//
// SECURITY:
//   AUTH_HOOK_SECRET is set in Supabase Project Secrets (v1,whsec_... format).
//   The Dashboard hook is configured to send this as an HMAC signature via
//   StandardWebhooks headers (webhook-id, webhook-timestamp, webhook-signature).
//   If the secret is not set, the hook runs without signature verification
//   (safe for local dev; not recommended for production).
//
// CRITICAL RULES:
// 1. This function MUST be fast (<500ms). It blocks login.
// 2. NEVER throw unhandled errors — a crash here locks all users out.
// 3. Read ONLY from profiles table. No other queries.
// 4. Must return { claims: {...} } — NOT { session: { custom_claims: {...} } }
// 5. NEVER write to auth.users or auth.identities.
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

// Keep these types in sync with your DB schema.
interface ProfileRow {
  tenant_id: string;
  role: 'owner' | 'manager' | 'cashier' | 'viewer';
  branch_id: string | null;
  is_active: boolean;
}

// Supabase Custom Access Token Hook — exact payload contract
interface HookPayload {
  user_id: string;
  claims: Record<string, unknown>;
  authentication_method: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // 1. Overall safety net — any unhandled error must not lock users out
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // 2. Read raw body (needed for HMAC signature verification)
    const rawBody = await req.text();

    // 3. StandardWebhooks signature verification (when AUTH_HOOK_SECRET is set)
    //    Secret format: v1,whsec_<base64-encoded-secret>
    //    Configured in: Dashboard → Authentication → Hooks → Custom Access Token
    //    Set via: supabase secrets set AUTH_HOOK_SECRET="v1,whsec_..."
    const authHookSecret = Deno.env.get('AUTH_HOOK_SECRET');
    if (authHookSecret) {
      try {
        const base64Secret = authHookSecret.replace('v1,whsec_', '');
        const wh = new Webhook(base64Secret);
        // verify() throws if signature is invalid
        wh.verify(rawBody, Object.fromEntries(req.headers));
      } catch (verifyErr) {
        const err = verifyErr as Error;
        console.error('[jwt-claims-hook] Webhook signature verification failed:', err.message);
        return new Response('Unauthorized', { status: 401 });
      }
    } else {
      console.warn('[jwt-claims-hook] AUTH_HOOK_SECRET not set — running without signature verification');
    }

    // 4. Parse payload
    let hookPayload: HookPayload;
    try {
      hookPayload = JSON.parse(rawBody);
    } catch {
      return new Response('Invalid JSON body', { status: 400 });
    }

    const { user_id, claims } = hookPayload;
    if (!user_id) {
      console.error('[jwt-claims-hook] Missing user_id in request payload');
      return new Response('Missing user_id', { status: 400 });
    }

    // 5. Service-role Supabase client for profile lookup
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

    // 6. Fetch user profile — single fast query
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('tenant_id, role, branch_id, is_active')
      .eq('id', user_id)
      .single<ProfileRow>();

    // 7. DB error — return unmodified claims so login still succeeds
    if (error) {
      console.error(`[jwt-claims-hook] DB error for user ${user_id}:`, error.message);
      return new Response(JSON.stringify({ claims }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 8. Missing or inactive profile — return unmodified claims
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

    // 9. Happy path — inject NEXPOS tenant claims into JWT
    const updatedClaims = {
      ...claims,
      tenant_id: profile.tenant_id,
      role: profile.role,
      branch_id: profile.branch_id ?? null,
      is_active: profile.is_active,
    };

    console.log(
      `[jwt-claims-hook] Claims injected for user ${user_id}: ` +
      `tenant=${profile.tenant_id} role=${profile.role} branch=${profile.branch_id ?? 'null'}`
    );

    return new Response(JSON.stringify({ claims: updatedClaims }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    // 10. Catch-all — never crash the Auth flow
    const err = e as Error;
    console.error('[jwt-claims-hook] CRITICAL Unhandled Exception:', err.message);
    return new Response(JSON.stringify({
      error: { http_code: 500, message: 'Internal hook error' },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
