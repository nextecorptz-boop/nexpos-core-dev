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
// CRITICAL RULES:
// 1. This function MUST be fast (< 500ms). It blocks login.
// 2. NEVER throw unhandled errors — a crash here locks all users out.
// 3. Read ONLY from profiles table. No other queries.
// 4. Populate the 'custom_claims' object in the response.
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

// Keep these types in sync with your DB schema and user object.
interface ProfileRow {
  tenant_id: string;
  role: 'owner' | 'manager' | 'cashier' | 'viewer';
  branch_id: string | null;
  is_active: boolean;
}

interface User {
  id: string;
  aud: string;
  role: string;
  email?: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  // ... other user properties
}

interface HookRequest {
  user: User;
}

// The response must be in this format.
interface HookResponse {
  session: {
    custom_claims: {
      [key: string]: any;
    };
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  // 1. Overall safety net to prevent locking users out
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let hookRequest: HookRequest;
    try {
      hookRequest = await req.json();
    } catch {
      return new Response('Invalid JSON body', { status: 400 });
    }

    const { user } = hookRequest;
    if (!user?.id) {
      return new Response('Received invalid user object', { status: 400 });
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
      .eq('id', user.id)
      .single<ProfileRow>();
    
    // Fallback claims for any error or non-standard user state
    const fallbackClaims = {
      tenant_id: null,
      role: null,
      branch_id: null,
      is_active: false,
    };
    
    // 4. Handle errors during profile fetch
    if (error) {
      console.error(`[jwt-claims-hook] DB error for user ${user.id}:`, error.message);
      const response: HookResponse = { session: { custom_claims: fallbackClaims } };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Handle missing profile or deactivated user
    if (!profile || !profile.is_active) {
      if (!profile) {
        console.warn(`[jwt-claims-hook] No profile found for user: ${user.id}`);
      } else {
        console.warn(`[jwt-claims-hook] Inactive user attempted login: ${user.id}`);
      }
      const response: HookResponse = { session: { custom_claims: fallbackClaims } };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 6. Happy path: user is active and has a profile
    const response: HookResponse = {
      session: {
        custom_claims: {
          tenant_id: profile.tenant_id,
          role: profile.role,
          branch_id: profile.branch_id ?? null,
          is_active: profile.is_active, // Include for client-side checks
        },
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    // 7. Final catch-all to guarantee a response
    console.error('[jwt-claims-hook] CRITICAL Unhandled Exception:', e.message);
    // Return a generic, empty claims response to prevent user lockout
    const safeResponse: HookResponse = {
      session: {
        custom_claims: {
          tenant_id: null,
          role: null,
          branch_id: null,
          is_active: false,
        },
      },
    };
    return new Response(JSON.stringify(safeResponse), {
      status: 200, // Must be 200 to not block login
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
