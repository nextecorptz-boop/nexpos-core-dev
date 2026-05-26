// =============================================================================
// JWT Custom Claims Hook
// File: supabase/functions/jwt-claims-hook/index.ts
//
// Registered in Supabase Dashboard:
//   Authentication → Hooks → Custom Access Token → Enable
//   Function: jwt-claims-hook
//
// This function runs on EVERY login and token refresh.
// It injects tenant_id, role, and branch_id into app_metadata.
// These claims are read by auth.current_tenant(), auth.current_role(),
// auth.current_branch() — the foundation of all RLS policies.
//
// CRITICAL RULES:
// 1. This function MUST be fast (< 500ms). It blocks login.
// 2. NEVER throw unhandled errors — a crash here locks all users out.
// 3. Read ONLY from profiles table. No other queries.
// 4. Return the full event.claims object — Supabase merges, not replaces.
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

// Type definitions — keep in sync with DB schema
interface ProfileRow {
  tenant_id: string;
  role: 'owner' | 'manager' | 'cashier' | 'viewer';
  branch_id: string | null;
  is_active: boolean;
}

interface ClaimsHookEvent {
  user_id: string;
  claims: {
    sub: string;
    email?: string;
    app_metadata: Record<string, unknown>;
    user_metadata: Record<string, unknown>;
    role: string;
    aud: string;
    iss: string;
    iat: number;
    exp: number;
    [key: string]: unknown;
  };
}

interface ClaimsHookResponse {
  claims: ClaimsHookEvent['claims'];
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Supabase calls this endpoint directly. Method must be POST.
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let event: ClaimsHookEvent;

  try {
    event = await req.json() as ClaimsHookEvent;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (!event?.user_id || !event?.claims) {
    return new Response('Missing user_id or claims', { status: 400 });
  }

  // Use service_role client — this function runs server-side, outside RLS.
  // The service_role key is safe here: this is a server-side Deno function,
  // never exposed to clients.
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

  // Fetch the user's profile row.
  // Single query. No JOINs. Indexed on id (PK).
  // pin_hash excluded explicitly — never include in JWT.
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('tenant_id, role, branch_id, is_active')
    .eq('id', event.user_id)
    .single<ProfileRow>();

  if (error) {
    // Log but don't crash. Return minimal claims so the user can still log in
    // but will have no tenant access (RLS will block everything).
    // Ops monitors JWT claims errors in Sentry/logs.
    console.error('[jwt-claims-hook] profile fetch error:', {
      user_id: event.user_id,
      error: error.message,
      code: error.code,
    });

    // Return claims without app_metadata enrichment.
    // The user will see "access denied" on all queries — correct behavior
    // when their profile row doesn't exist yet (unprovisioned user).
    const response: ClaimsHookResponse = {
      claims: {
        ...event.claims,
        app_metadata: {
          ...event.claims.app_metadata,
          // Explicitly clear any stale tenant claims
          tenant_id: null,
          role: null,
          branch_id: null,
        },
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!profile) {
    // User exists in auth.users but has no profile row.
    // Normal state for freshly invited users before onboarding completes.
    console.warn('[jwt-claims-hook] no profile found for user:', event.user_id);

    const response: ClaimsHookResponse = {
      claims: {
        ...event.claims,
        app_metadata: {
          ...event.claims.app_metadata,
          tenant_id: null,
          role: null,
          branch_id: null,
        },
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Deactivated users: inject claims but mark as inactive.
  // RLS will block them because their profile won't match.
  // Belt-and-suspenders: app layer checks is_active too.
  if (!profile.is_active) {
    console.warn('[jwt-claims-hook] inactive user attempted login:', event.user_id);

    const response: ClaimsHookResponse = {
      claims: {
        ...event.claims,
        app_metadata: {
          ...event.claims.app_metadata,
          tenant_id: null,
          role: null,
          branch_id: null,
          deactivated: true,
        },
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Happy path: inject tenant claims into app_metadata.
  // app_metadata is server-controlled. user_metadata is user-editable.
  // NEVER read from user_metadata for authorization decisions.
  const response: ClaimsHookResponse = {
    claims: {
      ...event.claims,
      app_metadata: {
        ...event.claims.app_metadata,
        tenant_id: profile.tenant_id,
        role: profile.role,
        branch_id: profile.branch_id ?? null,
      },
    },
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
