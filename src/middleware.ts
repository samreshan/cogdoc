/**
 * Next.js middleware (Phase 6) — Supabase session refresh + route protection.
 *
 * The @supabase/ssr server client's setAll is a no-op in route handlers (they
 * can't write cookies); this middleware is where session cookies are refreshed
 * on every request. When Supabase auth is configured and there is no session,
 * the user is redirected to the login screen.
 *
 * In local dev with COGDOC_DEV_FALLBACK, the middleware lets requests through
 * (the default-user path handles auth there). This is hard-ignored in
 * production via requireUserId's own NODE_ENV check.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ''

export async function middleware(req: NextRequest) {
  // Only protect when Supabase is configured.
  if (!SUPABASE_URL || !SUPABASE_KEY) return NextResponse.next()

  const res = NextResponse.next({ request: req })
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }))
      },
      setAll(cookies) {
        // Apply cookie updates to the response so the refreshed session persists.
        try {
          cookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        } catch {
          // no-op (called from a context that can't set cookies)
        }
      },
    },
  })

  // Refresh the session (this updates the cookies via setAll above).
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Local-dev fallback bypass (non-production only).
  const devFallback =
    process.env.NODE_ENV !== 'production' &&
    (process.env.COGDOC_DEV_FALLBACK === 'true' || process.env.COGDOC_DEV_FALLBACK === '1')

  // If no session and not in dev-fallback mode, redirect to login. API routes
  // return JSON 401 instead (handled by requireUserId in the route).
  if (!session && !devFallback && !req.nextUrl.pathname.startsWith('/api/')) {
    // Allow the login page itself + static assets through.
    if (req.nextUrl.pathname !== '/') {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return res
}

export const config = {
  // Run on all routes except Next.js internals + static asset paths.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
