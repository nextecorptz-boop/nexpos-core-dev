import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh session if exists
  const { data: { session } } = await supabase.auth.getSession()

  const isAppRoute = request.nextUrl.pathname.startsWith('/app')
  const isSuspendedRoute = request.nextUrl.pathname === '/app/billing/suspended'
  const isLoginRoute = request.nextUrl.pathname === '/login'

  // Protect /app routes
  if (isAppRoute) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Enforce tenant suspension billing wall
    if (!isSuspendedRoute) {
      let tenantId = session.user.app_metadata?.tenant_id
      
      // Fallback: If not in JWT metadata yet, retrieve from user profile
      if (!tenantId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', session.user.id)
          .single()
        tenantId = profile?.tenant_id
      }

      if (tenantId) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('status')
          .eq('id', tenantId)
          .single()

        if (tenant?.status === 'suspended') {
          return NextResponse.redirect(new URL('/app/billing/suspended', request.url))
        }
      }
    }
  }

  // Redirect logged in users away from login
  if (isLoginRoute && session) {
    // Get user profile to determine redirect
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profile?.role === 'cashier') {
      return NextResponse.redirect(new URL('/app/pos', request.url))
    } else {
      return NextResponse.redirect(new URL('/app/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

