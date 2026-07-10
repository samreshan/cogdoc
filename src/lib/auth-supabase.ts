/**
 * Supabase auth layer (Sprint 2, Stream E).
 *
 * Replaces the hardcoded single-user getDefaultUser() with real session-based
 * authentication via @supabase/ssr. Routes call getAuthenticatedUserId(req) to
 * resolve the current user from the request cookies; absence throws AuthError(401).
 *
 * Migration strategy: getDefaultUser() in auth.ts is KEPT for the transition so
 * routes can migrate one at a time behind a flag without breaking the gate.
 * The app-level isolation (filtering by userId) works today against the SQLite
 * DB; full Row-Level Security lands when the data store moves to Supabase
 * Postgres (needs the database connection string, not just the publishable key).
 */
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getDefaultUser } from '@/lib/auth'

const SUPABASE_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_KEY = () =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ''

/** Error carrying an HTTP status code, for routes to forward directly. */
export class AuthError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 401) {
    super(message)
    this.name = 'AuthError'
    this.statusCode = statusCode
  }
}

/**
 * Construct a Supabase server client bound to the request's cookies.
 * Exported for reuse (e.g. writing session cookies on sign-in).
 */
export function createSupabaseClient(req: NextRequest): SupabaseClient {
  return createServerClient(SUPABASE_URL(), SUPABASE_KEY(), {
    cookies: {
      getAll() {
        const cookieHeader = req.headers.get('cookie') ?? ''
        return cookieHeader
          .split(';')
          .map((c) => c.trim())
          .filter(Boolean)
          .map((c) => {
            const [name, ...rest] = c.split('=')
            return { name: name ?? '', value: rest.join('=') }
          })
      },
      // Server-side cookie writes are no-ops in route handlers; the middleware
      // layer handles set-cookie. Stubbed to satisfy the interface.
      setAll() {},
    },
  }) as unknown as SupabaseClient
}

/** Read the session from the request, or null if unauthenticated. */
export async function getSession(req: NextRequest) {
  const supabase = createSupabaseClient(req)
  const { data, error } = await supabase.auth.getSession()
  if (error) return null
  return data.session
}

/**
 * Resolve the authenticated user's id from the request.
 * Throws AuthError(401) if there is no valid session.
 */
export async function getAuthenticatedUserId(req: NextRequest): Promise<string> {
  const session = await getSession(req)
  if (!session?.user?.id) {
    throw new AuthError('Authentication required', 401)
  }
  return session.user.id
}

/**
 * Whether Supabase auth is configured (env vars present and non-empty).
 */
export function isSupabaseAuthConfigured(): boolean {
  return Boolean(SUPABASE_URL() && SUPABASE_KEY())
}

/**
 * Wrap a route handler so an AuthError from requireUserId becomes a clean 401
 * JSON response instead of an unhandled 500. Routes that need the userId call
 * requireUserId directly inside a try/catch, OR use this wrapper to get it
 * passed as the first arg with 401 handled automatically.
 */
export async function authed(
  req: NextRequest,
  handler: (userId: string) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    const userId = await requireUserId(req)
    return handler(userId)
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode })
    }
    throw e
  }
}

/**
 * Resolve the acting user id for a route.
 *
 * - When Supabase auth is configured: requires a valid session (throws 401).
 * - When unconfigured (local dev / tests without env): falls back to the
 *   default user so the gate stays green during the migration and the
 *   characterization tests (which mock getDefaultUser) keep working.
 *
 * Routes call this instead of getDefaultUser directly. Once the data store
 * moves to Supabase Postgres + RLS, the fallback is removed.
 */
export async function requireUserId(req: NextRequest): Promise<string> {
  if (isSupabaseAuthConfigured()) {
    return getAuthenticatedUserId(req)
  }
  const user = await getDefaultUser()
  return user.id
}
