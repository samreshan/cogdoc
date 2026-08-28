/**
 * Integration tests for the small routes: GET /api/user, GET /api/settings,
 * DELETE /api/pdfs/[id], and the root GET /api.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getDefaultUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { pdf: { findFirst: vi.fn(), delete: vi.fn() }, user: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() } } }))

import { GET as getUser, PATCH as patchUser } from '@/app/api/user/route'
import { GET as getSettings } from '@/app/api/settings/route'
import { DELETE as deletePdf } from '@/app/api/pdfs/[id]/route'
import { GET as getRoot } from '@/app/api/route'
import { getDefaultUser } from '@/lib/auth'
import { db } from '@/lib/db'

const user = getDefaultUser as ReturnType<typeof vi.fn>
const pdfDelete = db.pdf.delete as ReturnType<typeof vi.fn>
const pdfFindFirst = db.pdf.findFirst as ReturnType<typeof vi.fn>
const userFindUnique = db.user.findUnique as ReturnType<typeof vi.fn>
const userUpsert = db.user.upsert as ReturnType<typeof vi.fn>
const userUpdate = db.user.update as ReturnType<typeof vi.fn>

function makeReq(cookie = '') {
  return new NextRequest('http://localhost/api/user', {
    headers: cookie ? { cookie } : {},
  })
}

beforeEach(() => {
  user.mockReset(); pdfFindFirst.mockReset(); pdfDelete.mockReset(); userFindUnique.mockReset(); userUpsert.mockReset(); userUpdate.mockReset()
  user.mockResolvedValue({ id: 'u1' })
})

describe('GET /api/user (fallback path — Supabase not configured)', () => {
  it('returns the default user profile fields', async () => {
    // Global setup ensures Supabase env is unset here.
    user.mockResolvedValue({ id: 'u1', email: 'w@c.local', displayName: 'Writer', dailyTokenBudget: 100000, onboardingCompletedAt: null })
    const res = await getUser(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user).toEqual({ id: 'u1', email: 'w@c.local', displayName: 'Writer', dailyTokenBudget: 100000, onboardingCompletedAt: null })
  })
})

describe('GET /api/user (Supabase-configured path)', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'key'
  })

  it('returns the session user when authenticated', async () => {
    // Stub the server-validated Supabase user for this test.
    const authSupa = await import('@/lib/auth-supabase')
    vi.spyOn(authSupa, 'getAuthenticatedUser').mockResolvedValue({ id: 'sb-1', email: 'sb@x.co', user_metadata: {} } as any)
    userUpsert.mockResolvedValue({ id: 'sb-1', email: 'sb@x.co', displayName: null, dailyTokenBudget: 100000, onboardingCompletedAt: null })
    const res = await getUser(makeReq('sb-token=abc'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.id).toBe('sb-1')
    expect(body.user.email).toBe('sb@x.co')
  })

  it('returns 401 when unauthenticated', async () => {
    const authSupa = await import('@/lib/auth-supabase')
    vi.spyOn(authSupa, 'getAuthenticatedUser').mockResolvedValue(null as any)
    const res = await getUser(makeReq())
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/user onboarding state', () => {
  it('persists tutorial completion for the acting user', async () => {
    userUpdate.mockResolvedValue({ onboardingCompletedAt: new Date('2026-08-28T00:00:00.000Z') })
    const res = await patchUser(new NextRequest('http://localhost/api/user', {
      method: 'PATCH', body: JSON.stringify({ onboardingCompleted: true }),
    }))
    expect(res.status).toBe(200)
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u1' },
      data: { onboardingCompletedAt: expect.any(Date) },
    }))
  })

  it('rejects an invalid onboarding value', async () => {
    const res = await patchUser(new NextRequest('http://localhost/api/user', {
      method: 'PATCH', body: JSON.stringify({ onboardingCompleted: 'yes' }),
    }))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/settings', () => {
  it('returns idleThresholdSeconds and dailyTokenBudget from env with defaults', async () => {
    const res = await getSettings(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('idleThresholdSeconds')
    expect(body).toHaveProperty('dailyTokenBudget')
    expect(typeof body.idleThresholdSeconds).toBe('number')
  })

  it('respects the IDLE_THRESHOLD env var', async () => {
    process.env.IDLE_THRESHOLD = '45'
    const res = await getSettings(makeReq())
    expect((await res.json()).idleThresholdSeconds).toBe(45)
    delete process.env.IDLE_THRESHOLD
  })
})

describe('DELETE /api/pdfs/[id]', () => {
  function ctx(id: string) {
    return { params: Promise.resolve({ id }) }
  }
  it('deletes the pdf and cascades', async () => {
    pdfFindFirst.mockResolvedValue({ id: 'p1', userId: 'u1' })
    pdfDelete.mockResolvedValue({})
    const res = await deletePdf(new NextRequest('http://localhost/api/pdfs/p1', { method: 'DELETE' }), ctx('p1'))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(pdfDelete).toHaveBeenCalledWith({ where: { id: 'p1' } })
  })
})

describe('GET /api (root)', () => {
  it('returns the health message', async () => {
    const res = await getRoot()
    expect(res.status).toBe(200)
    expect((await res.json()).message).toBe('Hello, world!')
  })
})
