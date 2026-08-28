/**
 * Supabase auth layer (Sprint 2, Stream E).
 *
 * Replaces the hardcoded single-user getDefaultUser() with real session-based
 * authentication via @supabase/ssr. Routes call getAuthenticatedUserId(req) to
 * resolve the current user from the request cookies; absence throws AuthError(401).
 *
 * getDefaultUser() remains available for local development and deliberately
 * configured, private single-user installations. Production otherwise fails
 * closed when Supabase auth is absent.
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

/** Validate the access token with Supabase and return its user. */
export async function getAuthenticatedUser(req: NextRequest) {
  const supabase = createSupabaseClient(req)
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user
}

/**
 * Resolve the authenticated user's id from the request.
 * Throws AuthError(401) if there is no valid session.
 */
export async function getAuthenticatedUserId(req: NextRequest): Promise<string> {
  const user = await getAuthenticatedUser(req)
  if (!user?.id) {
    throw new AuthError('Authentication required', 401)
  }
  return user.id
}

/**
 * Whether Supabase auth is configured (env vars present and non-empty).
 */
export function isSupabaseAuthConfigured(): boolean {
  return Boolean(SUPABASE_URL() && SUPABASE_KEY())
}

/**
 * Whether the operator deliberately chose a private, single-user deployment.
 * This is separate from COGDOC_DEV_FALLBACK because it is permitted in
 * production and therefore must be an explicit operational decision.
 */
export function isExplicitSingleUserMode(): boolean {
  return ['1', 'true'].includes((process.env.COGDOC_SINGLE_USER_MODE ?? '').toLowerCase())
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
 * - When Supabase auth is configured AND COGDOC_DEV_FALLBACK is unset (or
 *   ignored in production): requires a valid session (throws 401).
 * - In non-production development, an unconfigured Supabase instance or an
 *   explicit COGDOC_DEV_FALLBACK uses the seeded default user.
 * - In production without Supabase, only COGDOC_SINGLE_USER_MODE=1 permits
 *   the seeded user. Every other configuration fails closed with HTTP 503.
 *
 * COGDOC_DEV_FALLBACK is LOCAL-DEV ONLY. It is hard-ignored when NODE_ENV is
 * 'production' so a stray env var can never silently bypass auth in prod.
 * It exists because in local dev you set the Supabase env vars (so the login
 * UI is wired) but aren't logged in yet — without the fallback every route
 * would 401/500 before you can reach the app. Set it to "1" or "true" in
 * .env.local to use the default user locally; leave it unset in production.
 *
 * Single-user mode is intended only for a private, non-shared installation. It
 * must never be used to expose multiple people's workspaces through one user.
 */
export async function requireUserId(req: NextRequest): Promise<string> {
  // The dev fallback is LOCAL-DEV ONLY. It is hard-ignored in production so a
  // stray COGDOC_DEV_FALLBACK env var can never silently bypass auth there.
  const isProduction = process.env.NODE_ENV === 'production'
  const devFallback =
    !isProduction &&
    (process.env.COGDOC_DEV_FALLBACK === 'true' || process.env.COGDOC_DEV_FALLBACK === '1')
  if (isSupabaseAuthConfigured() && !devFallback) {
    return getAuthenticatedUserId(req)
  }
  if (isProduction && !isExplicitSingleUserMode()) {
    throw new AuthError(
      'Authentication is not configured for this production deployment',
      503,
    )
  }
  const user = await getDefaultUser()
  return user.id
}
