/** Supabase session refresh, route protection, and baseline mutation throttling. */
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const mutationWindows = new Map<string, { count: number; resetAt: number }>()

function mutationLimit(req: NextRequest): NextResponse | null {
  if (!req.nextUrl.pathname.startsWith('/api/') || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return null
  const address = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'local'
  const sensitive = /\/(imports|certificates)(?:\/|$)/.test(req.nextUrl.pathname)
  const limit = sensitive ? 20 : 120
  const key = `${address}:${sensitive ? 'sensitive' : 'mutation'}`
  const now = Date.now()
  const current = mutationWindows.get(key)
  const window = !current || current.resetAt <= now ? { count: 0, resetAt: now + 60_000 } : current
  window.count += 1
  mutationWindows.set(key, window)
  if (mutationWindows.size > 5_000) {
    for (const [candidate, value] of mutationWindows) if (value.resetAt <= now) mutationWindows.delete(candidate)
  }
  if (window.count <= limit) return null
  return NextResponse.json({ error: 'Too many mutation requests. Try again shortly.', code: 'rate_limited' }, {
    status: 429,
    headers: { 'Retry-After': String(Math.max(1, Math.ceil((window.resetAt - now) / 1000))) },
  })
}

export async function proxy(req: NextRequest) {
  const limited = mutationLimit(req)
  if (limited) return limited
  if (!SUPABASE_URL || !SUPABASE_KEY) return NextResponse.next()

  const res = NextResponse.next({ request: req })
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll().map((cookie) => ({ name: cookie.name, value: cookie.value })),
      setAll(cookies) {
        try { cookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options)) } catch { /* response cannot set cookies */ }
      },
    },
  })
  const { data: { session } } = await supabase.auth.getSession()
  const devFallback = process.env.NODE_ENV !== 'production' && ['true', '1'].includes(process.env.COGDOC_DEV_FALLBACK ?? '')
  if (!session && !devFallback && !req.nextUrl.pathname.startsWith('/api/')) {
    if (req.nextUrl.pathname !== '/' && !req.nextUrl.pathname.startsWith('/verify/')) {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }
  return res
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
