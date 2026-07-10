/**
 * Tests for the Supabase auth layer (Sprint 2, Stream E).
 *
 * Contract:
 *  - getSession(req) reads the session from the request cookies via @supabase/ssr
 *  - getAuthenticatedUserId(req) returns the user id OR throws an AuthError (401)
 *  - The Supabase client is constructed from NEXT_PUBLIC_SUPABASE_URL + key
 *
 * The Supabase server client is mocked — these are pure contract tests for the
 * auth module's branching logic, not live network calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// Stub the @supabase/ssr createServerClient so no network is hit.
const getSessionMock = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getSession: getSessionMock },
  })),
}))

import {
  getSession,
  getAuthenticatedUserId,
  requireUserId,
  authed,
  isSupabaseAuthConfigured,
  AuthError,
  createSupabaseClient,
} from '@/lib/auth-supabase'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// Mock the default-user fallback so requireUserId's fallback path is testable
// without a DB.
vi.mock('@/lib/auth', () => ({
  getDefaultUser: vi.fn(async () => ({ id: 'default-user' })),
}))

import { getDefaultUser } from '@/lib/auth'
const getDefaultUserMock = getDefaultUser as ReturnType<typeof vi.fn>

beforeEach(() => {
  getSessionMock.mockReset()
  getDefaultUserMock.mockReset()
})

function makeReq(cookieHeader = ''): NextRequest {
  return new Request('http://localhost/api/x', {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  }) as unknown as NextRequest
}

describe('createSupabaseClient', () => {
  it('constructs a server client from env vars', () => {
    const client = createSupabaseClient(makeReq())
    expect(createServerClient).toHaveBeenCalled()
    const args = (createServerClient as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(args[0]).toBeDefined() // url
    expect(args[1]).toBeDefined() // key
    expect(typeof args[2]).toBe('object') // options with cookies
  })
})

describe('getSession', () => {
  it('returns the session when present', async () => {
    const session = { user: { id: 'user-1' }, access_token: 'tok' }
    getSessionMock.mockResolvedValue({ data: { session }, error: null })
    const result = await getSession(makeReq('sb-token=abc'))
    expect(result).toEqual(session)
  })

  it('returns null when there is no session', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null })
    expect(await getSession(makeReq())).toBeNull()
  })
})

describe('getAuthenticatedUserId', () => {
  it('returns the user id when a session exists', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    })
    const id = await getAuthenticatedUserId(makeReq('sb-token=abc'))
    expect(id).toBe('user-1')
  })

  it('throws AuthError (401) when there is no session', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null })
    await expect(getAuthenticatedUserId(makeReq())).rejects.toThrow(AuthError)
    try {
      await getAuthenticatedUserId(makeReq())
    } catch (e) {
      expect((e as AuthError).statusCode).toBe(401)
    }
  })

  it('throws AuthError when the session lookup errors', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: { message: 'bad token' } })
    await expect(getAuthenticatedUserId(makeReq())).rejects.toThrow(AuthError)
  })
})

describe('AuthError', () => {
  it('carries a statusCode for the route to forward', () => {
    const err = new AuthError('no session', 401)
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('no session')
    expect(err instanceof Error).toBe(true)
  })
})

describe('isSupabaseAuthConfigured', () => {
  it('returns true when both env vars are set', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'key'
    expect(isSupabaseAuthConfigured()).toBe(true)
  })

  it('returns false when env vars are absent', () => {
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const savedKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    expect(isSupabaseAuthConfigured()).toBe(false)
    process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = savedKey
  })
})

describe('requireUserId', () => {
  it('uses Supabase auth when configured, returns the session user id', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'key'
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: 'supabase-user' } } },
      error: null,
    })
    const id = await requireUserId(makeReq('sb-token=abc'))
    expect(id).toBe('supabase-user')
    expect(getDefaultUserMock).not.toHaveBeenCalled()
  })

  it('throws AuthError when configured but no session', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'key'
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null })
    await expect(requireUserId(makeReq())).rejects.toThrow(AuthError)
  })

  it('falls back to getDefaultUser when Supabase is not configured', async () => {
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const savedKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    getDefaultUserMock.mockResolvedValue({ id: 'default-user' })
    const id = await requireUserId(makeReq())
    expect(id).toBe('default-user')
    expect(getDefaultUserMock).toHaveBeenCalled()
    process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = savedKey
  })
})

describe('authed (route handler wrapper)', () => {
  it('passes the resolved userId to the handler and returns its response', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'key'
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: 'sb-user' } } },
      error: null,
    })
    const res = await authed(makeReq('sb-token=abc'), async (userId) => {
      return NextResponse.json({ userId })
    })
    expect(res.status).toBe(200)
    expect((await res.json()).userId).toBe('sb-user')
  })

  it('returns 401 JSON when auth fails', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'key'
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null })
    const handler = vi.fn()
    const res = await authed(makeReq(), handler)
    expect(res.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })
})
