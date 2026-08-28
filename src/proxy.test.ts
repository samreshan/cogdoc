import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }))
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser },
  })),
}))

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
  vi.resetModules()
  getUser.mockReset()
})

async function loadProxy() {
  vi.resetModules()
  return (await import('@/proxy')).proxy
}

describe('production auth configuration gate', () => {
  it('returns a structured 503 for APIs when production auth is absent', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.COGDOC_SINGLE_USER_MODE
    const proxy = await loadProxy()

    const response = await proxy(new NextRequest('http://localhost/api/workspaces'))

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: 'Authentication is not configured for this production deployment',
      code: 'auth_not_configured',
    })
  })

  it('allows explicit private single-user mode to continue', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    process.env.COGDOC_SINGLE_USER_MODE = 'true'
    const proxy = await loadProxy()

    const response = await proxy(new NextRequest('http://localhost/api/health'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('keeps public verification routes reachable for fail-closed deployments', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.COGDOC_SINGLE_USER_MODE
    const proxy = await loadProxy()

    const response = await proxy(new NextRequest('http://localhost/verify/public-token'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('returns 401 for a protected API when Supabase validates no user', async () => {
    process.env.NODE_ENV = 'production'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://research.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public-key'
    delete process.env.COGDOC_SINGLE_USER_MODE
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    const proxy = await loadProxy()

    const response = await proxy(new NextRequest('http://localhost/api/workspaces'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: 'Authentication required',
      code: 'unauthenticated',
    })
  })
})
